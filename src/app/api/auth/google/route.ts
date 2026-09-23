import { NextResponse, type NextRequest } from "next/server";
import { googleOAuthConfigured } from "@/server/env";
import { beginOAuth, safeReturnTo } from "@/server/auth/oauth-state";
import { GOOGLE_LOGIN_SCOPES, googleAuthUrl, googleRedirectUri } from "@/server/auth/google";
import { rateLimit } from "@/server/security/rate-limit";
import { clientIp } from "@/server/security/request";

export async function GET(request: NextRequest) {
  if (!googleOAuthConfigured()) return NextResponse.redirect(new URL("/login?error=oauth", request.url));
  if (!(await rateLimit(`oauth:${await clientIp()}`, 30, 600))) return NextResponse.redirect(new URL("/login?error=oauth", request.url));
  const st = await beginOAuth({ purpose: "login", returnTo: safeReturnTo(request.nextUrl.searchParams.get("next"), "/app") });
  return NextResponse.redirect(
    googleAuthUrl({ scopes: GOOGLE_LOGIN_SCOPES, state: st.state, verifier: st.verifier, redirectUri: googleRedirectUri("login") }),
  );
}
