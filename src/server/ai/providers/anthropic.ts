import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { BetaContentBlockParam, BetaMessageParam, BetaToolUnion } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { AIProviderError, type AIProvider, type GenerateRequest, type GenerateResult } from "../types";

const DEFAULT_MODEL = process.env.ANTHROPIC_DEFAULT_MODEL || "claude-opus-5";
/** Models that support server-side refusal fallbacks (routes by refusal category). */
const FALLBACK_MODELS = /^claude-(opus-5|fable-5)/;

function client(apiKey: string) {
  return new Anthropic({ apiKey, maxRetries: 3, timeout: 10 * 60 * 1000 });
}

function mapError(err: unknown): never {
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    throw new AIProviderError("auth", "Claude の認証に失敗しました。キーを確認してください。");
  }
  if (err instanceof Anthropic.RateLimitError) throw new AIProviderError("rate_limit", "Claude のレート制限に達しました。", true);
  if (err instanceof Anthropic.BadRequestError || err instanceof Anthropic.NotFoundError) {
    throw new AIProviderError("bad_request", `Claude へのリクエストが不正です: ${err.message}`);
  }
  if (err instanceof Anthropic.InternalServerError || err instanceof Anthropic.APIConnectionError) {
    throw new AIProviderError("unavailable", "Claude に一時的に接続できません。", true);
  }
  if (err instanceof Anthropic.APIError) throw new AIProviderError("unknown", `Claude API error ${err.status ?? ""}`.trim(), (err.status ?? 0) >= 500);
  throw err;
}

function toMessages(req: GenerateRequest): BetaMessageParam[] {
  const out: BetaMessageParam[] = [];
  for (const m of req.messages) {
    if (m.role === "user") out.push({ role: "user", content: m.content });
    else if (m.role === "assistant") {
      if (m.raw && m.raw.provider === "anthropic") {
        out.push({ role: "assistant", content: m.raw.content as BetaContentBlockParam[] });
      } else {
        const content: BetaContentBlockParam[] = [];
        if (m.text) content.push({ type: "text", text: m.text });
        for (const c of m.toolCalls) content.push({ type: "tool_use", id: c.id, name: c.name, input: c.input });
        out.push({ role: "assistant", content });
      }
    } else {
      out.push({
        role: "user",
        content: m.results.map((r) => ({ type: "tool_result" as const, tool_use_id: r.id, content: r.content, is_error: r.isError })),
      });
    }
  }
  return out;
}

export const anthropicProvider: AIProvider = {
  id: "anthropic",
  name: "Claude",
  defaultModel: DEFAULT_MODEL,

  async testConnection(apiKey) {
    try {
      const page = await client(apiKey).models.list({ limit: 1 });
      return { ok: true, detail: page.data[0]?.id };
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
    const tools: BetaToolUnion[] | undefined = req.tools?.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema as { type: "object"; [k: string]: unknown },
    }));
    const useFallbacks = FALLBACK_MODELS.test(model);
    try {
      const stream = client(req.apiKey).beta.messages.stream({
        model,
        max_tokens: req.maxTokens ?? 16000,
        system: req.system,
        messages: toMessages(req),
        ...(tools && tools.length ? { tools } : {}),
        thinking: { type: "adaptive" },
        ...(useFallbacks ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
      });
      const msg = await stream.finalMessage();
      const text = msg.content
        .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      const toolCalls =
        msg.stop_reason === "refusal" || msg.stop_reason === "max_tokens"
          ? []
          : msg.content
              .filter((b): b is Extract<typeof b, { type: "tool_use" }> => b.type === "tool_use")
              .map((b) => ({ id: b.id, name: b.name, input: (b.input ?? {}) as Record<string, unknown> }));
      const stopReason =
        msg.stop_reason === "end_turn" || msg.stop_reason === "stop_sequence"
          ? "end"
          : msg.stop_reason === "tool_use"
            ? "tool_use"
            : msg.stop_reason === "max_tokens"
              ? "max_tokens"
              : msg.stop_reason === "refusal"
                ? "refusal"
                : "other";
      return {
        text,
        toolCalls,
        stopReason,
        usage: { inputTokens: msg.usage.input_tokens, outputTokens: msg.usage.output_tokens },
        model: msg.model,
        raw: msg.content,
      };
    } catch (err) {
      mapError(err);
    }
  },
};
