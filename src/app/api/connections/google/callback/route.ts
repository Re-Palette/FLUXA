import { NextResponse, type NextRequest } from "next/server";
import { getCompanyContext } from "@/server/auth/guards";
import { consumeOAuth, safeReturnTo } from "@/server/auth/oauth-state";
import { exchangeGoogleCode, fetchGoogleUser, googleRedirectUri } from "@/server/auth/google";
import { GOOGLE_SERVICE_SCOPES } from "@/server/integrations/google-scopes";
import { storeOAuthTokens } from "@/server/integrations/vault";
import { audit } from "@/server/security/audit";
import { logActivity } from "@/server/services/activity";
import { providerInfo } from "@/lib/catalog";

export async function GET(request: NextRequest) {
  const st = await consumeOAuth(request.nextUrl.searchParams.get("state"));
  const returnTo = safeReturnTo(st?.returnTo, "/app/connections");
  const back = (params: Record<string, string>) => {
    const url = new URL(returnTo, request.url);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    return NextResponse.redirect(url);
  };
  const code = request.nextUrl.searchParams.get("code");
  if (!st || st.purpose !== "connect" || !st.provider || !st.companyId) return back({ connect_error: "state" });
  if (!code) return back({ connect_error: request.nextUrl.searchParams.get("error") === "access_denied" ? "denied" : "oauth" });

  // The callback must be completed by the same user, in the same company, that started it.
  const ctx = await getCompanyContext();
  if (!ctx?.company || ctx.company.id !== st.companyId || ctx.user.id !== st.userId || !ctx.db) return back({ connect_error: "session" });

  try {
    const tokens = await exchangeGoogleCode(code, st.verifier, googleRedirectUri("connect"));
    const granted = (tokens.scope ?? "").split(" ").filter(Boolean);
    const required = GOOGLE_SERVICE_SCOPES[st.provider] ?? [];
    if (!required.every((s) => granted.includes(s))) return back({ connect_error: "scope" });
    const profile = await fetchGoogleUser(tokens.access_token);
    await storeOAuthTokens(
      ctx.db,
      ctx.company.id,
      st.provider,
      { accessToken: tokens.access_token, refreshToken: tokens.refresh_token, expiresAt: Date.now() + tokens.expires_in * 1000, scope: tokens.scope },
      { accountLabel: profile.email, scopes: required, userId: ctx.user.id },
    );
    await audit({ action: "connection.connected", userId: ctx.user.id, companyId: ctx.company.id, metadata: { provider: st.provider } });
    await logActivity(ctx.db, ctx.company.id, {
      actorType: "USER",
      actorId: ctx.user.id,
      actorName: "You",
      action: "connection.connected",
      message: `${providerInfo(st.provider)?.name ?? st.provider} を接続しました`,
    });
    return back({ connected: st.provider });
  } catch (err) {
    console.error("google connect failed", { provider: st.provider, error: (err as Error).message });
    return back({ connect_error: "oauth" });
  }
}
