// Provider-neutral types for the AI layer (docs/architecture.md §6, §9).

export interface ToolCallRequest {
  id: string;
  name: string; // wire name (see toWireName)
  input: Record<string, unknown>;
}

export type AgentMessage =
  | { role: "user"; content: string }
  | {
      role: "assistant";
      text: string;
      toolCalls: ToolCallRequest[];
      /** Provider-native content, replayed verbatim to the same provider (thinking blocks, signatures). */
      raw?: { provider: string; model: string; content: unknown };
    }
  | { role: "tool"; results: { id: string; name: string; content: string; isError?: boolean }[] };

export interface ToolSpec {
  name: string; // wire name
  description: string;
  inputSchema: Record<string, unknown>; // JSON schema (object)
}

export interface GenerateRequest {
  apiKey: string;
  model: string;
  system: string;
  messages: AgentMessage[];
  tools?: ToolSpec[];
  maxTokens?: number;
  /** Ask for a JSON-only answer (planner). */
  json?: boolean;
}

export type StopReason = "end" | "tool_use" | "max_tokens" | "refusal" | "other";

export interface GenerateResult {
  text: string;
  toolCalls: ToolCallRequest[];
  stopReason: StopReason;
  usage: { inputTokens: number; outputTokens: number };
  model: string;
  raw?: unknown;
}

export type AIErrorKind = "auth" | "rate_limit" | "bad_request" | "unavailable" | "limit_exceeded" | "not_configured" | "unknown";

export class AIProviderError extends Error {
  constructor(
    public kind: AIErrorKind,
    message: string,
    public retryable = false,
  ) {
    super(message);
    this.name = "AIProviderError";
  }
}

export interface AIProvider {
  id: string;
  name: string;
  defaultModel: string;
  /** Lightweight authenticated call used by "Test Connection". */
  testConnection(apiKey: string): Promise<{ ok: true; detail?: string } | { ok: false; error: string }>;
  generate(req: GenerateRequest): Promise<GenerateResult>;
}

/** Tool names contain dots internally; provider APIs only accept [a-zA-Z0-9_-]. */
export function toWireName(name: string): string {
  return name.replace(/\./g, "__");
}
export function fromWireName(wire: string): string {
  return wire.replace(/__/g, ".");
}
