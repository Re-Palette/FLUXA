import "server-only";
import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import { AIProviderError, type AIProvider, type GenerateResult } from "../types";

const DEFAULT_MODEL = process.env.OPENAI_DEFAULT_MODEL || "gpt-5";

function client(apiKey: string) {
  return new OpenAI({ apiKey, maxRetries: 3, timeout: 10 * 60 * 1000 });
}

function mapError(err: unknown): never {
  if (err instanceof OpenAI.AuthenticationError || err instanceof OpenAI.PermissionDeniedError) {
    throw new AIProviderError("auth", "OpenAI の認証に失敗しました。キーを確認してください。");
  }
  if (err instanceof OpenAI.RateLimitError) throw new AIProviderError("rate_limit", "OpenAI のレート制限に達しました。", true);
  if (err instanceof OpenAI.BadRequestError || err instanceof OpenAI.NotFoundError) {
    throw new AIProviderError("bad_request", `OpenAI へのリクエストが不正です: ${err.message}`);
  }
  if (err instanceof OpenAI.InternalServerError || err instanceof OpenAI.APIConnectionError) {
    throw new AIProviderError("unavailable", "OpenAI に一時的に接続できません。", true);
  }
  if (err instanceof OpenAI.APIError) throw new AIProviderError("unknown", `OpenAI API error ${err.status ?? ""}`.trim());
  throw err;
}

export const openaiProvider: AIProvider = {
  id: "openai",
  name: "OpenAI",
  defaultModel: DEFAULT_MODEL,

  async testConnection(apiKey) {
    try {
      await client(apiKey).models.list();
      return { ok: true };
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
    const messages: ChatCompletionMessageParam[] = [{ role: "system", content: req.system }];
    for (const m of req.messages) {
      if (m.role === "user") messages.push({ role: "user", content: m.content });
      else if (m.role === "assistant") {
        messages.push({
          role: "assistant",
          content: m.text || null,
          ...(m.toolCalls.length
            ? {
                tool_calls: m.toolCalls.map((c) => ({
                  id: c.id,
                  type: "function" as const,
                  function: { name: c.name, arguments: JSON.stringify(c.input) },
                })),
              }
            : {}),
        });
      } else {
        for (const r of m.results) messages.push({ role: "tool", tool_call_id: r.id, content: r.content });
      }
    }
    const tools: ChatCompletionTool[] | undefined = req.tools?.map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.inputSchema },
    }));
    try {
      const res = await client(req.apiKey).chat.completions.create({
        model,
        messages,
        max_completion_tokens: req.maxTokens ?? 16000,
        ...(tools && tools.length ? { tools } : {}),
        ...(req.json ? { response_format: { type: "json_object" as const } } : {}),
      });
      const choice = res.choices[0];
      const toolCalls = (choice?.message.tool_calls ?? []).flatMap((c) => {
        if (c.type !== "function") return [];
        let input: Record<string, unknown> = {};
        try {
          input = JSON.parse(c.function.arguments || "{}");
        } catch {
          input = { __invalid_json: c.function.arguments };
        }
        return [{ id: c.id, name: c.function.name, input }];
      });
      const fr = choice?.finish_reason;
      return {
        text: (choice?.message.content ?? "").trim(),
        toolCalls,
        stopReason: fr === "tool_calls" ? "tool_use" : fr === "length" ? "max_tokens" : fr === "content_filter" ? "refusal" : "end",
        usage: { inputTokens: res.usage?.prompt_tokens ?? 0, outputTokens: res.usage?.completion_tokens ?? 0 },
        model: res.model,
      };
    } catch (err) {
      mapError(err);
    }
  },
};
