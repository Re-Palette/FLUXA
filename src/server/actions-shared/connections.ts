"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertCompany, MANAGE_ROLES } from "@/server/auth/guards";
import { providerInfo } from "@/lib/catalog";
import { testApiKey } from "@/server/integrations/connectors";
import { loadCredential, removeCredential, storeApiKey } from "@/server/integrations/vault";
import { isGoogleService } from "@/server/integrations/google-scopes";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { audit } from "@/server/security/audit";
import { logActivity } from "@/server/services/activity";
import { toActionError, type ActionResult } from "@/server/actions";

const providerSchema = z.string().refine((p) => providerInfo(p)?.status === "available", "このサービスはまだ接続できません");

/** Test → encrypt → store. The key is never echoed back, logged, or stored in plaintext. */
export async function connectApiKeyAction(provider: string, apiKey: string): Promise<ActionResult> {
  try {
    const ctx = await assertCompany(MANAGE_ROLES);
    providerSchema.parse(provider);
    const key = z.string().trim().min(8, "キーが短すぎます").max(500).parse(apiKey);
    const info = providerInfo(provider)!;
    if (info.authType !== "api_key") return { ok: false, error: "このサービスはアカウント連携で接続します" };
    await enforceRateLimit(`conn-test:${ctx.company.id}`, 20, 600);
    const result = await testApiKey(provider, key);
    if (!result.ok) {
      await audit({ action: "connection.test_failed", userId: ctx.user.id, companyId: ctx.company.id, metadata: { provider } });
      return { ok: false, error: result.error };
    }
    await storeApiKey(ctx.db, ctx.company.id, provider, key, { accountLabel: result.accountLabel, userId: ctx.user.id });
    await audit({ action: "connection.connected", userId: ctx.user.id, companyId: ctx.company.id, metadata: { provider } });
    await logActivity(ctx.db, ctx.company.id, { actorType: "USER", actorId: ctx.user.id, actorName: "You", action: "connection.connected", message: `${info.name} を接続しました` });
    revalidatePath("/", "layout");
    return { ok: true, message: `${info.name} を接続しました` };
  } catch (err) {
    return toActionError(err);
  }
}

export async function disconnectAction(provider: string): Promise<ActionResult> {
  try {
    const ctx = await assertCompany(MANAGE_ROLES);
    const info = providerInfo(provider);
    if (!info) return { ok: false, error: "不明なサービスです" };
    await removeCredential(ctx.db, ctx.company.id, provider);
    await audit({ action: "connection.disconnected", userId: ctx.user.id, companyId: ctx.company.id, metadata: { provider } });
    await logActivity(ctx.db, ctx.company.id, { actorType: "USER", actorId: ctx.user.id, actorName: "You", action: "connection.disconnected", message: `${info.name} の接続を解除しました` });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}

/** Re-tests a stored API-key connection server-side. */
export async function retestConnectionAction(provider: string): Promise<ActionResult> {
  try {
    const ctx = await assertCompany(MANAGE_ROLES);
    await enforceRateLimit(`conn-test:${ctx.company.id}`, 20, 600);
    if (isGoogleService(provider)) return { ok: true, message: "Google サービスは利用時に自動で確認されます" };
    const cred = await loadCredential(ctx.db, ctx.company.id, provider);
    if (!cred || cred.payload.kind !== "api_key") return { ok: false, error: "接続されていません" };
    const result = await testApiKey(provider, cred.payload.apiKey);
    await ctx.db.integration.update({
      where: { id: cred.integration.id },
      data: result.ok ? { status: "CONNECTED", lastError: null, lastCheckedAt: new Date() } : { status: "ERROR", lastError: result.error, lastCheckedAt: new Date() },
    });
    revalidatePath("/", "layout");
    return result.ok ? { ok: true, message: "接続は正常です" } : { ok: false, error: result.error };
  } catch (err) {
    return toActionError(err);
  }
}
