import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { consumeOAuth, safeReturnTo } from "@/server/auth/oauth-state";
import { exchangeGoogleCode, fetchGoogleUser, googleRedirectUri, GoogleOAuthError } from "@/server/auth/google";
import { createSession } from "@/server/auth/session";
import { audit } from "@/server/security/audit";
import { clientIp, userAgent } from "@/server/security/request";

export async function GET(request: NextRequest) {
  const fail = (code = "oauth") => NextResponse.redirect(new URL(`/login?error=${code}`, request.url));
  const st = await consumeOAuth(request.nextUrl.searchParams.get("state"));
  const code = request.nextUrl.searchParams.get("code");
  if (request.nextUrl.searchParams.get("error") === "access_denied") return fail("oauth_denied");
  if (!st || st.purpose !== "login") return fail("oauth_state");
  if (!code) return fail();

  try {
    const tokens = await exchangeGoogleCode(code, st.verifier, googleRedirectUri("login"));
    const profile = await fetchGoogleUser(tokens.access_token);
    if (profile.email_verified !== true) return fail("oauth_email");
    const email = profile.email.toLowerCase();

    const account = await prisma.authAccount.findUnique({
      where: { provider_providerAccountId: { provider: "google", providerAccountId: profile.sub } },
    });
    let userId = account?.userId;
    if (!userId) {
      // Link to an existing user with the same verified email, or create one.
      const user = await prisma.user.upsert({
        where: { email },
        create: { email, name: profile.name, image: profile.picture, emailVerified: new Date() },
        update: { emailVerified: new Date(), image: profile.picture },
      });
      await prisma.authAccount.create({ data: { userId: user.id, provider: "google", providerAccountId: profile.sub } });
      userId = user.id;
    }
    const ip = await clientIp();
    await createSession(userId, { ip, userAgent: await userAgent() });
    await audit({ action: "auth.login", userId, ip, metadata: { method: "google" } });
    const hasCompany = await prisma.companyMember.count({ where: { userId } });
    return NextResponse.redirect(new URL(hasCompany ? safeReturnTo(st.returnTo, "/app") : "/onboarding", request.url));
  } catch (err) {
    console.error("google login failed", { error: (err as Error).message });
    if (err instanceof GoogleOAuthError && ["invalid_client", "unauthorized_client", "redirect_uri_mismatch"].includes(err.code)) return fail("oauth_config");
    return fail();
  }
}
