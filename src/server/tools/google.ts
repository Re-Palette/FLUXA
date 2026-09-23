import "server-only";
import { z } from "zod";
import { googleAccessToken } from "../integrations/google-token";
import { defineTool, ToolExecutionError, type ToolContext } from "./types";

const MAX_TEXT = 50_000;

async function gfetch(ctx: ToolContext, provider: string, url: string, init: RequestInit = {}) {
  const token = await googleAccessToken(ctx.db, ctx.companyId, provider);
  const res = await fetch(url, { ...init, headers: { ...(init.headers ?? {}), authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const status = res.status;
    throw new ToolExecutionError(
      status === 403 ? "Google がこの操作を許可しませんでした（権限不足）" : status === 404 ? "対象が見つかりませんでした" : `Google API エラー (${status})`,
    );
  }
  return res;
}

const noCrlf = (s: string) => !/[\r\n]/.test(s);
const email = z.string().email().max(320).refine(noCrlf);
const header = z.string().max(300).refine(noCrlf, "改行は使用できません");

function encodeHeader(v: string): string {
  return /^[\x20-\x7e]*$/.test(v) ? v : `=?UTF-8?B?${Buffer.from(v, "utf8").toString("base64")}?=`;
}

function rfc822(input: { to: string[]; cc?: string[]; subject: string; body: string }): string {
  const lines = [
    `To: ${input.to.join(", ")}`,
    ...(input.cc?.length ? [`Cc: ${input.cc.join(", ")}`] : []),
    `Subject: ${encodeHeader(input.subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(input.body, "utf8").toString("base64"),
  ];
  return Buffer.from(lines.join("\r\n"), "utf8").toString("base64url");
}

const mailInput = z.object({
  to: z.array(email).min(1).max(50),
  cc: z.array(email).max(50).optional(),
  subject: header,
  body: z.string().min(1).max(20_000),
});

export const driveSearch = defineTool({
  name: "google_drive.search",
  description: "Search Google Drive files this app can access by name. Returns id, name, type and link.",
  input: z.object({ query: z.string().min(1).max(100) }),
  async execute(ctx, input) {
    const q = `name contains '${input.query.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}' and trashed = false`;
    const url = `https://www.googleapis.com/drive/v3/files?${new URLSearchParams({ q, pageSize: "10", fields: "files(id,name,mimeType,modifiedTime,webViewLink)" })}`;
    const body = (await (await gfetch(ctx, "google_drive", url)).json()) as { files?: { id: string; name: string; mimeType: string; webViewLink?: string }[] };
    const files = body.files ?? [];
    return {
      content: files.length ? files.map((f) => `- ${f.name} [${f.mimeType}] id=${f.id}`).join("\n") : "No files found.",
      data: { files },
    };
  },
});

export const driveRead = defineTool({
  name: "google_drive.read",
  description: "Read the text content of a Google Drive file (Google Docs are exported as plain text).",
  input: z.object({ fileId: z.string().regex(/^[\w-]{10,200}$/) }),
  async execute(ctx, input) {
    const meta = (await (
      await gfetch(ctx, "google_drive", `https://www.googleapis.com/drive/v3/files/${input.fileId}?fields=id,name,mimeType`)
    ).json()) as { name: string; mimeType: string };
    let text: string;
    if (meta.mimeType === "application/vnd.google-apps.document") {
      text = await (await gfetch(ctx, "google_drive", `https://www.googleapis.com/drive/v3/files/${input.fileId}/export?mimeType=text/plain`)).text();
    } else if (meta.mimeType === "application/vnd.google-apps.spreadsheet") {
      text = await (await gfetch(ctx, "google_drive", `https://www.googleapis.com/drive/v3/files/${input.fileId}/export?mimeType=text/csv`)).text();
    } else if (meta.mimeType.startsWith("text/") || meta.mimeType === "application/json") {
      text = await (await gfetch(ctx, "google_drive", `https://www.googleapis.com/drive/v3/files/${input.fileId}?alt=media`)).text();
    } else {
      throw new ToolExecutionError(`このファイル形式 (${meta.mimeType}) はテキストとして読み取れません`);
    }
    const truncated = text.length > MAX_TEXT;
    return { content: `# ${meta.name}\n\n${text.slice(0, MAX_TEXT)}${truncated ? "\n\n[truncated]" : ""}`, data: { name: meta.name, truncated } };
  },
});

export const driveCreateDocument = defineTool({
  name: "google_drive.create_document",
  description: "Create a new Google Doc with the given title and plain-text/Markdown content.",
  input: z.object({ title: z.string().min(1).max(200), content: z.string().min(1).max(200_000) }),
  describe: (i) => ({ title: `Google ドキュメント「${i.title}」を作成`, summary: i.content.slice(0, 400) }),
  async execute(ctx, input) {
    const boundary = `fluxa${Date.now()}`;
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      JSON.stringify({ name: input.title, mimeType: "application/vnd.google-apps.document" }) +
      `\r\n--${boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${input.content}\r\n--${boundary}--`;
    const res = await gfetch(ctx, "google_drive", "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink", {
      method: "POST",
      headers: { "content-type": `multipart/related; boundary=${boundary}` },
      body,
    });
    const file = (await res.json()) as { id: string; name: string; webViewLink?: string };
    return { content: `Created Google Doc "${file.name}" (${file.webViewLink ?? file.id}).`, data: file };
  },
});

export const sheetsRead = defineTool({
  name: "google_sheets.read",
  description: "Read cell values from a Google Sheet. range uses A1 notation, e.g. 'Sheet1!A1:F100'.",
  input: z.object({ spreadsheetId: z.string().regex(/^[\w-]{10,200}$/), range: z.string().min(1).max(100) }),
  async execute(ctx, input) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${input.spreadsheetId}/values/${encodeURIComponent(input.range)}`;
    const body = (await (await gfetch(ctx, "google_sheets", url)).json()) as { values?: string[][] };
    const rows = (body.values ?? []).slice(0, 500);
    return { content: rows.length ? rows.map((r) => r.join("\t")).join("\n") : "The range is empty.", data: { rowCount: rows.length } };
  },
});

export const gmailCreateDraft = defineTool({
  name: "gmail.create_draft",
  description: "Create an email draft in Gmail. Does not send.",
  input: mailInput,
  describe: (i) => ({ title: `メール下書き「${i.subject}」を作成`, summary: `宛先: ${i.to.join(", ")}\n\n${i.body.slice(0, 400)}` }),
  async execute(ctx, input) {
    const res = await gfetch(ctx, "gmail", "https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: { raw: rfc822(input) } }),
    });
    const draft = (await res.json()) as { id: string };
    return { content: `Draft created (id: ${draft.id}).`, data: draft };
  },
});

export const gmailSend = defineTool({
  name: "gmail.send",
  description: "Send an email from the connected Gmail account. Always requires human approval.",
  input: mailInput,
  describe: (i) => ({ title: `メール「${i.subject}」を ${i.to.length} 件の宛先に送信`, summary: `宛先: ${i.to.join(", ")}\n\n${i.body.slice(0, 600)}` }),
  async execute(ctx, input) {
    const res = await gfetch(ctx, "gmail", "https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ raw: rfc822(input) }),
    });
    const msg = (await res.json()) as { id: string };
    return { content: `Email sent (id: ${msg.id}).`, data: msg };
  },
});

export const calendarListEvents = defineTool({
  name: "google_calendar.list_events",
  description: "List upcoming events on the primary calendar.",
  input: z.object({ days: z.number().int().min(1).max(60).default(7) }),
  async execute(ctx, input) {
    const now = new Date();
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?${new URLSearchParams({
      timeMin: now.toISOString(),
      timeMax: new Date(now.getTime() + input.days * 86_400_000).toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "25",
    })}`;
    const body = (await (await gfetch(ctx, "google_calendar", url)).json()) as {
      items?: { summary?: string; start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string } }[];
    };
    const items = body.items ?? [];
    return {
      content: items.length
        ? items.map((e) => `- ${e.start?.dateTime ?? e.start?.date} – ${e.end?.dateTime ?? e.end?.date}: ${e.summary ?? "(no title)"}`).join("\n")
        : "No upcoming events.",
      data: { count: items.length },
    };
  },
});

export const calendarCreateEvent = defineTool({
  name: "google_calendar.create_event",
  description: "Create an event on the primary calendar. start/end are ISO 8601 date-times with timezone offset.",
  input: z.object({
    summary: header,
    description: z.string().max(5000).optional(),
    start: z.string().datetime({ offset: true }),
    end: z.string().datetime({ offset: true }),
    attendees: z.array(email).max(50).optional(),
  }),
  describe: (i) => ({
    title: `予定「${i.summary}」を作成`,
    summary: `${i.start} → ${i.end}${i.attendees?.length ? `\n参加者: ${i.attendees.join(", ")}` : ""}`,
  }),
  async execute(ctx, input) {
    const res = await gfetch(ctx, "google_calendar", "https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=none", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        summary: input.summary,
        description: input.description,
        start: { dateTime: input.start },
        end: { dateTime: input.end },
        attendees: input.attendees?.map((e) => ({ email: e })),
      }),
    });
    const ev = (await res.json()) as { id: string; htmlLink?: string };
    return { content: `Event created (${ev.htmlLink ?? ev.id}).`, data: ev };
  },
});
