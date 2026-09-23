import "server-only";
import { isAIProvider, providerInfo } from "@/lib/catalog";
import { getAIProvider } from "../ai/registry";

export type TestResult = { ok: true; accountLabel?: string } | { ok: false; error: string };

async function json(res: Response) {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Live check that an API key works before we store it. Error messages never echo the key. */
export async function testApiKey(provider: string, apiKey: string): Promise<TestResult> {
  const info = providerInfo(provider);
  if (!info || info.authType !== "api_key" || info.status !== "available") return { ok: false, error: "このサービスはまだ接続できません" };
  try {
    if (isAIProvider(provider)) {
      const p = getAIProvider(provider);
      if (!p) return { ok: false, error: "未対応のプロバイダーです" };
      const r = await p.testConnection(apiKey);
      return r.ok ? { ok: true, accountLabel: info.name } : r;
    }
    if (provider === "notion") {
      const res = await fetch("https://api.notion.com/v1/users/me", {
        headers: { authorization: `Bearer ${apiKey}`, "notion-version": "2022-06-28" },
      });
      if (!res.ok) return { ok: false, error: "Notion の認証に失敗しました" };
      const body = await json(res);
      return { ok: true, accountLabel: typeof body.name === "string" ? body.name : "Notion" };
    }
    if (provider === "slack") {
      const res = await fetch("https://slack.com/api/auth.test", { method: "POST", headers: { authorization: `Bearer ${apiKey}` } });
      const body = await json(res);
      if (!body.ok) return { ok: false, error: "Slack の認証に失敗しました" };
      return { ok: true, accountLabel: typeof body.team === "string" ? body.team : "Slack" };
    }
    if (provider === "github") {
      const res = await fetch("https://api.github.com/user", {
        headers: { authorization: `Bearer ${apiKey}`, accept: "application/vnd.github+json", "user-agent": "fluxa-ai-company-os" },
      });
      if (!res.ok) return { ok: false, error: "GitHub の認証に失敗しました" };
      const body = await json(res);
      return { ok: true, accountLabel: typeof body.login === "string" ? body.login : "GitHub" };
    }
    return { ok: false, error: "未対応のサービスです" };
  } catch {
    return { ok: false, error: "サービスに接続できませんでした。ネットワークを確認してください。" };
  }
}
