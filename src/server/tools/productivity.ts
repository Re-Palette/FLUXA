import "server-only";
import { z } from "zod";
import { loadCredential } from "../integrations/vault";
import { defineTool, ToolExecutionError, type ToolContext } from "./types";

async function apiKeyFor(ctx: ToolContext, provider: string): Promise<string> {
  const cred = await loadCredential(ctx.db, ctx.companyId, provider);
  if (!cred || cred.payload.kind !== "api_key") throw new ToolExecutionError(`${provider} が接続されていません`);
  return cred.payload.apiKey;
}

async function call(url: string, init: RequestInit, label: string) {
  const res = await fetch(url, init);
  if (!res.ok) throw new ToolExecutionError(`${label} API エラー (${res.status})`);
  return res.json() as Promise<Record<string, unknown>>;
}

const notionHeaders = (key: string) => ({ authorization: `Bearer ${key}`, "notion-version": "2022-06-28", "content-type": "application/json" });

type RichText = { plain_text?: string }[];

export const notionSearch = defineTool({
  name: "notion.search",
  description: "Search Notion pages shared with the integration by title.",
  input: z.object({ query: z.string().max(200) }),
  async execute(ctx, input) {
    const key = await apiKeyFor(ctx, "notion");
    const body = await call("https://api.notion.com/v1/search", {
      method: "POST",
      headers: notionHeaders(key),
      body: JSON.stringify({ query: input.query, page_size: 10, filter: { property: "object", value: "page" } }),
    }, "Notion");
    const results = (body.results as { id: string; url?: string; properties?: Record<string, { type: string; title?: RichText }> }[]) ?? [];
    const lines = results.map((p) => {
      const titleProp = Object.values(p.properties ?? {}).find((v) => v.type === "title");
      const title = titleProp?.title?.map((t) => t.plain_text).join("") || "(untitled)";
      return `- ${title} id=${p.id}`;
    });
    return { content: lines.length ? lines.join("\n") : "No pages found.", data: { count: lines.length } };
  },
});

export const notionReadPage = defineTool({
  name: "notion.read_page",
  description: "Read the text blocks of a Notion page.",
  input: z.object({ pageId: z.string().regex(/^[0-9a-fA-F-]{32,36}$/) }),
  async execute(ctx, input) {
    const key = await apiKeyFor(ctx, "notion");
    const body = await call(`https://api.notion.com/v1/blocks/${input.pageId}/children?page_size=100`, { headers: notionHeaders(key) }, "Notion");
    const blocks = (body.results as Record<string, unknown>[]) ?? [];
    const text = blocks
      .map((b) => {
        const inner = b[b.type as string] as { rich_text?: RichText } | undefined;
        return inner?.rich_text?.map((t) => t.plain_text).join("") ?? "";
      })
      .filter(Boolean)
      .join("\n");
    return { content: text.slice(0, 50_000) || "(empty page)" };
  },
});

export const slackPostMessage = defineTool({
  name: "slack.post_message",
  description: "Post a message to a Slack channel the bot is a member of. channel is a channel ID like C0123456.",
  input: z.object({ channel: z.string().regex(/^[CGD][A-Z0-9]{6,20}$/), text: z.string().min(1).max(4000) }),
  describe: (i) => ({ title: `Slack チャンネル ${i.channel} に投稿`, summary: i.text.slice(0, 600) }),
  async execute(ctx, input) {
    const key = await apiKeyFor(ctx, "slack");
    const body = await call("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ channel: input.channel, text: input.text }),
    }, "Slack");
    if (!body.ok) throw new ToolExecutionError(`Slack への投稿に失敗しました (${String(body.error ?? "unknown")})`);
    return { content: "Message posted.", data: { ts: body.ts } };
  },
});

const repo = z.string().regex(/^[\w.-]+\/[\w.-]+$/, "owner/name の形式で指定してください");
const ghHeaders = (key: string) => ({
  authorization: `Bearer ${key}`,
  accept: "application/vnd.github+json",
  "user-agent": "fluxa-ai-company-os",
  "x-github-api-version": "2022-11-28",
});

export const githubListIssues = defineTool({
  name: "github.list_issues",
  description: "List issues in a GitHub repository.",
  input: z.object({ repo, state: z.enum(["open", "closed", "all"]).default("open") }),
  async execute(ctx, input) {
    const key = await apiKeyFor(ctx, "github");
    const res = await fetch(`https://api.github.com/repos/${input.repo}/issues?state=${input.state}&per_page=30`, { headers: ghHeaders(key) });
    if (!res.ok) throw new ToolExecutionError(`GitHub API エラー (${res.status})`);
    const issues = (await res.json()) as { number: number; title: string; state: string; pull_request?: unknown }[];
    const list = issues.filter((i) => !i.pull_request);
    return { content: list.length ? list.map((i) => `#${i.number} [${i.state}] ${i.title}`).join("\n") : "No issues.", data: { count: list.length } };
  },
});

export const githubCreateIssue = defineTool({
  name: "github.create_issue",
  description: "Create an issue in a GitHub repository.",
  input: z.object({ repo, title: z.string().min(1).max(256), body: z.string().max(20_000).default("") }),
  describe: (i) => ({ title: `${i.repo} に Issue「${i.title}」を作成`, summary: i.body.slice(0, 600) }),
  async execute(ctx, input) {
    const key = await apiKeyFor(ctx, "github");
    const body = await call(`https://api.github.com/repos/${input.repo}/issues`, {
      method: "POST",
      headers: { ...ghHeaders(key), "content-type": "application/json" },
      body: JSON.stringify({ title: input.title, body: input.body }),
    }, "GitHub");
    return { content: `Issue created: ${String(body.html_url ?? body.number)}`, data: { number: body.number, url: body.html_url } };
  },
});
