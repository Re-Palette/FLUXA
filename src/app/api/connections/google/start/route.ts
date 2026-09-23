import { NextResponse, type NextRequest } from "next/server";
import { assertCompany, MANAGE_ROLES } from "@/server/auth/guards";
import { googleOAuthConfigured } from "@/server/env";
import { beginOAuth, safeReturnTo } from "@/server/auth/oauth-state";
import { googleAuthUrl, googleRedirectUri } from "@/server/auth/google";
import { GOOGLE_IDENTITY_SCOPES, GOOGLE_SERVICE_SCOPES, isGoogleService } from "@/server/integrations/google-scopes";

/** Starts incremental Google authorization for one service with its minimal scopes. */
export async function GET(request: NextRequest) {
  const provider = request.nextUrl.searchParams.get("provider") ?? "";
  const returnTo = safeReturnTo(request.nextUrl.searchParams.get("returnTo"), "/app/connections");
  const back = (msg: string) => {
    const url = new URL(returnTo, request.url);
    url.searchParams.set("connect_error", msg);
    return NextResponse.redirect(url);
  };
  let ctx;
  try {
    ctx = await assertCompany(MANAGE_ROLES);
  } catch {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (!isGoogleService(provider)) return back("unsupported");
  if (!googleOAuthConfigured()) return back("google_not_configured");
  const st = await beginOAuth({ purpose: "connect", provider, companyId: ctx.company.id, userId: ctx.user.id, returnTo });
  return NextResponse.redirect(
    googleAuthUrl({
      scopes: [...GOOGLE_IDENTITY_SCOPES, ...GOOGLE_SERVICE_SCOPES[provider]],
      state: st.state,
      verifier: st.verifier,
      redirectUri: googleRedirectUri("connect"),
      offline: true,
      loginHint: ctx.user.email,
    }),
  );
}
