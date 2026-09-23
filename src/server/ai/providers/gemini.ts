import "server-only";
import { ApiError, GoogleGenAI, type Content, type Part } from "@google/genai";
import { AIProviderError, type AIProvider, type GenerateResult } from "../types";

const DEFAULT_MODEL = process.env.GEMINI_DEFAULT_MODEL || "gemini-2.5-pro";

function mapError(err: unknown): never {
  if (err instanceof ApiError) {
    if (err.status === 401 || err.status === 403 || (err.status === 400 && /API key/i.test(err.message))) {
      throw new AIProviderError("auth", "Gemini の認証に失敗しました。キーを確認してください。");
    }
    if (err.status === 429) throw new AIProviderError("rate_limit", "Gemini のレート制限に達しました。", true);
    if (err.status >= 500) throw new AIProviderError("unavailable", "Gemini に一時的に接続できません。", true);
    throw new AIProviderError("bad_request", `Gemini へのリクエストが不正です: ${err.message}`);
  }
  throw err;
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status = err instanceof ApiError ? err.status : 0;
      if (!(status === 429 || status >= 500)) break;
      await new Promise((r) => setTimeout(r, 500 * 2 ** i));
    }
  }
  throw lastErr;
}

export const geminiProvider: AIProvider = {
  id: "gemini",
  name: "Gemini",
  defaultModel: DEFAULT_MODEL,

  async testConnection(apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const pager = await ai.models.list({ config: { pageSize: 1 } });
      return { ok: true, detail: pager.page[0]?.name };
    } catch (err) {
      try {
        mapError(err);
      } catch (e) {
        return { ok: false, error: (e as Error).message };
      }
      return { ok: false, error: "接続テストに失敗しました" };
    }
  },

  async generate(req): Promise<GenerateResult> {
    const model = req.model || DEFAULT_MODEL;
    const contents: Content[] = [];
    for (const m of req.messages) {
      if (m.role === "user") contents.push({ role: "user", parts: [{ text: m.content }] });
      else if (m.role === "assistant") {
        if (m.raw && m.raw.provider === "gemini") contents.push(m.raw.content as Content);
        else {
          const parts: Part[] = [];
          if (m.text) parts.push({ text: m.text });
          for (const c of m.toolCalls) parts.push({ functionCall: { id: c.id, name: c.name, args: c.input } });
          contents.push({ role: "model", parts });
        }
      } else {
        contents.push({
          role: "user",
          parts: m.results.map((r) => ({
            functionResponse: { id: r.id, name: r.name, response: r.isError ? { error: r.content } : { output: r.content } },
          })),
        });
      }
    }
    const ai = new GoogleGenAI({ apiKey: req.apiKey });
    try {
      const res = await withRetry(() =>
        ai.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction: req.system,
            maxOutputTokens: req.maxTokens ?? 16000,
            ...(req.tools && req.tools.length
              ? { tools: [{ functionDeclarations: req.tools.map((t) => ({ name: t.name, description: t.description, parametersJsonSchema: t.inputSchema })) }] }
              : {}),
            ...(req.json ? { responseMimeType: "application/json" } : {}),
          },
        }),
      );
      const candidate = res.candidates?.[0];
      const toolCalls = (res.functionCalls ?? []).map((c, i) => ({
        id: c.id ?? `call_${Date.now()}_${i}`,
        name: c.name ?? "",
        input: (c.args ?? {}) as Record<string, unknown>,
      }));
      const fr = candidate?.finishReason;
      return {
        text: (res.text ?? "").trim(),
        toolCalls,
        stopReason: toolCalls.length ? "tool_use" : fr === "MAX_TOKENS" ? "max_tokens" : fr === "SAFETY" || fr === "PROHIBITED_CONTENT" ? "refusal" : "end",
        usage: { inputTokens: res.usageMetadata?.promptTokenCount ?? 0, outputTokens: res.usageMetadata?.candidatesTokenCount ?? 0 },
        model,
        raw: candidate?.content,
      };
    } catch (err) {
      mapError(err);
    }
  },
};
