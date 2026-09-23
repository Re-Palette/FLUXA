import "server-only";
import { z } from "zod";
import { AuthError } from "./auth/guards";
import { RateLimitError } from "./security/rate-limit";
import { WorkflowInputError } from "./orchestrator/engine";
import { TenantViolationError } from "./db";

export type ActionResult<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Converts known errors into user-facing results; unknown errors are logged without leaking details. */
export function toActionError(err: unknown): { ok: false; error: string; fieldErrors?: Record<string, string> } {
  if (err instanceof z.ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const i of err.issues) fieldErrors[i.path.join(".")] ??= i.message;
    return { ok: false, error: "入力内容を確認してください", fieldErrors };
  }
  if (err instanceof AuthError || err instanceof RateLimitError || err instanceof WorkflowInputError) return { ok: false, error: err.message };
  if (err instanceof TenantViolationError) {
    console.error("tenant violation", err.message);
    return { ok: false, error: "見つかりません" };
  }
  // Next.js control-flow errors (redirect/notFound) must propagate.
  if (err && typeof err === "object" && "digest" in err && typeof (err as { digest: unknown }).digest === "string" && (err as { digest: string }).digest.startsWith("NEXT_")) throw err;
  console.error("action failed", { error: (err as Error)?.message });
  return { ok: false, error: "エラーが発生しました。しばらくしてから再度お試しください。" };
}
