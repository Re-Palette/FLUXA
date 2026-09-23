"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertCompany, MANAGE_ROLES } from "@/server/auth/guards";
import { prisma } from "@/server/db";
import { audit } from "@/server/security/audit";
import { toActionError, type ActionResult } from "@/server/actions";

export async function setDefaultModelAction(modelRef: string | null): Promise<ActionResult> {
  try {
    const ctx = await assertCompany(MANAGE_ROLES);
    const ref = modelRef ? z.string().regex(/^(anthropic|openai|gemini):[\w.\-]{1,80}$/, "モデル名が正しくありません").parse(modelRef) : null;
    await prisma.company.update({ where: { id: ctx.company.id }, data: { defaultModel: ref } });
    revalidatePath("/app/settings");
    return { ok: true, message: "保存しました" };
  } catch (err) {
    return toActionError(err);
  }
}

const optInt = z.union([z.number().int().min(0).max(1_000_000_000), z.null()]);
export async function updateUsageLimitsAction(input: unknown): Promise<ActionResult> {
  try {
    const ctx = await assertCompany(MANAGE_ROLES);
    const d = z
      .object({ dailyRequestLimit: optInt, monthlyRequestLimit: optInt, dailyTokenLimit: optInt, monthlyTokenLimit: optInt, monthlyCostLimitUsd: z.union([z.number().min(0).max(1_000_000), z.null()]) })
      .parse(input);
    const data = {
      dailyRequestLimit: d.dailyRequestLimit,
      monthlyRequestLimit: d.monthlyRequestLimit,
      dailyTokenLimit: d.dailyTokenLimit,
      monthlyTokenLimit: d.monthlyTokenLimit,
      monthlyCostLimitMicroUsd: d.monthlyCostLimitUsd == null ? null : Math.round(d.monthlyCostLimitUsd * 1_000_000),
    };
    await ctx.db.usageLimit.upsert({ where: { companyId: ctx.company.id }, create: { companyId: ctx.company.id, ...data }, update: data });
    await audit({ action: "usage.limits_changed", userId: ctx.user.id, companyId: ctx.company.id, metadata: data });
    revalidatePath("/app/settings");
    return { ok: true, message: "上限を保存しました" };
  } catch (err) {
    return toActionError(err);
  }
}

export async function revokeSessionAction(sessionId: string): Promise<ActionResult> {
  try {
    const ctx = await assertCompany();
    await prisma.session.deleteMany({ where: { id: z.string().parse(sessionId), userId: ctx.user.id, NOT: { id: ctx.session.id } } });
    await audit({ action: "auth.session_revoked", userId: ctx.user.id });
    revalidatePath("/app/settings");
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}
