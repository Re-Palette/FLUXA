import "server-only";
import type { TenantDb } from "../db";
import { refreshGoogleToken } from "../auth/google";
import { loadCredential, updateOAuthPayload } from "./vault";
import { notifyCompany } from "../services/activity";
import { providerInfo } from "@/lib/catalog";

export class ConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConnectionError";
  }
}

/** Returns a valid access token for a Google service, refreshing server-side when needed. */
export async function googleAccessToken(db: TenantDb, companyId: string, provider: string): Promise<string> {
  const cred = await loadCredential(db, companyId, provider);
  const name = providerInfo(provider)?.name ?? provider;
  if (!cred || cred.payload.kind !== "oauth") throw new ConnectionError(`${name} が接続されていません`);
  const p = cred.payload;
  if (p.expiresAt - 60_000 > Date.now()) return p.accessToken;
  if (!p.refreshToken) throw new ConnectionError(`${name} の再接続が必要です`);
  try {
    const t = await refreshGoogleToken(p.refreshToken);
    const next = {
      ...p,
      accessToken: t.access_token,
      expiresAt: Date.now() + t.expires_in * 1000,
      refreshToken: t.refresh_token ?? p.refreshToken,
    };
    await updateOAuthPayload(db, companyId, cred.integration.id, next);
    return next.accessToken;
  } catch {
    await db.integration.update({
      where: { id: cred.integration.id },
      data: { status: "ERROR", lastError: "認証の有効期限が切れました。再接続してください。", lastCheckedAt: new Date() },
    });
    await notifyCompany(db, companyId, {
      type: "connection_lost",
      title: `${name} の接続が切れました`,
      body: "Connections から再接続してください。",
      link: "/app/connections",
    });
    throw new ConnectionError(`${name} の再接続が必要です`);
  }
}
