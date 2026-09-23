import "server-only";
import { prisma, type TenantDb } from "../db";
import { env } from "../env";
import { loadCredential } from "../integrations/vault";
import { getAIProvider, PROVIDER_PREFERENCE } from "./registry";
import { AIProviderError, type AIProvider, type GenerateRequest, type GenerateResult } from "./types";

export interface ResolvedAI {
  provider: AIProvider;
  apiKey: string;
  model: string;
  billingMode: "BYOK" | "PLATFORM";
}

const PLATFORM_KEYS: Record<string, () => string | undefined> = {
  anthropic: () => env().ANTHROPIC_API_KEY,
  openai: () => env().OPENAI_API_KEY,
  gemini: () => env().GEMINI_API_KEY,
};

/** "anthropic:claude-opus-5" → { provider, model } */
export function parseModelRef(ref: string | null | undefined): { provider: string; model: string } | null {
  if (!ref) return null;
  const idx = ref.indexOf(":");
  if (idx <= 0) return null;
  return { provider: ref.slice(0, idx), model: ref.slice(idx + 1) };
}

/**
 * Picks the AI provider for a company: BYOK keys first (employee override → company default → preference
 * order), then platform-funded keys when PLATFORM_AI_ENABLED is on.
 */
export async function resolveAI(db: TenantDb, companyId: string, modelRef?: string | null): Promise<ResolvedAI> {
  const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId }, select: { defaultModel: true } });
  const preferred = parseModelRef(modelRef) ?? parseModelRef(company.defaultModel);
  const order = preferred ? [preferred.provider, ...PROVIDER_PREFERENCE.filter((p) => p !== preferred.provider)] : PROVIDER_PREFERENCE;

  for (const id of order) {
    const provider = getAIProvider(id);
    if (!provider) continue;
    const cred = await loadCredential(db, companyId, id);
    if (cred?.integration.status === "CONNECTED" && cred.payload.kind === "api_key") {
      const model = preferred?.provider === id ? preferred.model : provider.defaultModel;
      return { provider, apiKey: cred.payload.apiKey, model, billingMode: "BYOK" };
    }
  }
  if (env().PLATFORM_AI_ENABLED === "true") {
    for (const id of order) {
      const key = PLATFORM_KEYS[id]?.();
      const provider = getAIProvider(id);
      if (key && provider) {
        const model = preferred?.provider === id ? preferred.model : provider.defaultModel;
        return { provider, apiKey: key, model, billingMode: "PLATFORM" };
      }
    }
  }
  throw new AIProviderError(
    "not_configured",
    "AIが接続されていません。Connections で Claude・OpenAI・Gemini のいずれかを接続してください。",
  );
}

function startOfDay(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function startOfMonth(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export async function usageTotals(db: TenantDb, companyId: string, since: Date) {
  const agg = await db.usageRecord.aggregate({
    where: { companyId, createdAt: { gte: since } },
    _sum: { inputTokens: true, outputTokens: true, requests: true, costMicroUsd: true },
  });
  return {
    tokens: (agg._sum.inputTokens ?? 0) + (agg._sum.outputTokens ?? 0),
    inputTokens: agg._sum.inputTokens ?? 0,
    outputTokens: agg._sum.outputTokens ?? 0,
    requests: agg._sum.requests ?? 0,
    costMicroUsd: agg._sum.costMicroUsd ?? 0,
  };
}

/** Cost control (docs/architecture.md §10): refuse the call before spending when a limit is reached. */
export async function assertWithinLimits(db: TenantDb, companyId: string): Promise<void> {
  const limit = await db.usageLimit.findUnique({ where: { companyId } });
  if (!limit) return;
  const [day, month] = await Promise.all([usageTotals(db, companyId, startOfDay()), usageTotals(db, companyId, startOfMonth())]);
  const over =
    (limit.dailyRequestLimit != null && day.requests >= limit.dailyRequestLimit) ||
    (limit.dailyTokenLimit != null && day.tokens >= limit.dailyTokenLimit) ||
    (limit.monthlyRequestLimit != null && month.requests >= limit.monthlyRequestLimit) ||
    (limit.monthlyTokenLimit != null && month.tokens >= limit.monthlyTokenLimit) ||
    (limit.monthlyCostLimitMicroUsd != null && month.costMicroUsd >= limit.monthlyCostLimitMicroUsd);
  if (over) throw new AIProviderError("limit_exceeded", "AI の使用上限に達しました。Settings › Usage で上限を確認してください。");
}

export async function estimateCostMicroUsd(provider: string, model: string, inputTokens: number, outputTokens: number) {
  const price = await prisma.modelPrice.findUnique({ where: { provider_model: { provider, model } } });
  if (!price) return 0;
  return Math.round((inputTokens * price.inputPerMTokMicroUsd + outputTokens * price.outputPerMTokMicroUsd) / 1_000_000);
}

export interface CallContext {
  companyId: string;
  purpose: "plan" | "employee" | "test";
  userId?: string | null;
  employeeId?: string | null;
  taskId?: string | null;
  modelRef?: string | null;
}

/** Resolve → limit check → generate → record usage. The only entry point the orchestrator uses. */
export async function callAI(
  db: TenantDb,
  ctx: CallContext,
  req: Omit<GenerateRequest, "apiKey" | "model">,
): Promise<GenerateResult & { providerId: string }> {
  const ai = await resolveAI(db, ctx.companyId, ctx.modelRef);
  await assertWithinLimits(db, ctx.companyId);
  const result = await ai.provider.generate({ ...req, apiKey: ai.apiKey, model: ai.model });
  const costMicroUsd = await estimateCostMicroUsd(ai.provider.id, ai.model, result.usage.inputTokens, result.usage.outputTokens);
  await db.usageRecord.create({
    data: {
      companyId: ctx.companyId,
      userId: ctx.userId ?? null,
      employeeId: ctx.employeeId ?? null,
      taskId: ctx.taskId ?? null,
      provider: ai.provider.id,
      model: ai.model,
      purpose: ctx.purpose,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      costMicroUsd,
      billingMode: ai.billingMode,
    },
  });
  return { ...result, providerId: ai.provider.id };
}

export { startOfDay, startOfMonth };
