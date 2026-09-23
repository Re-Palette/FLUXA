import "server-only";
import { z } from "zod";
import { env } from "../env";
import { pkceChallenge } from "./oauth-state";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

export const GOOGLE_LOGIN_SCOPES = ["openid", "email", "profile"];

export function googleRedirectUri(kind: "login" | "connect"): string {
  const base = env().APP_URL.replace(/\/$/, "");
  return kind === "login" ? `${base}/api/auth/google/callback` : `${base}/api/connections/google/callback`;
}

export function googleAuthUrl(opts: {
  scopes: string[];
  state: string;
  verifier: string;
  redirectUri: string;
  offline?: boolean;
  loginHint?: string;
}): string {
  const e = env();
  if (!e.GOOGLE_CLIENT_ID) throw new Error("Google sign-in is not configured");
  const params = new URLSearchParams({
    client_id: e.GOOGLE_CLIENT_ID,
    redirect_uri: opts.redirectUri,
    response_type: "code",
    scope: opts.scopes.join(" "),
    state: opts.state,
    code_challenge: pkceChallenge(opts.verifier),
    code_challenge_method: "S256",
    include_granted_scopes: "true",
  });
  if (opts.offline) {
    params.set("access_type", "offline");
    params.set("prompt", "consent");
  } else {
    params.set("prompt", "select_account");
  }
  if (opts.loginHint) params.set("login_hint", opts.loginHint);
  return `${AUTH_URL}?${params}`;
}

const tokenSchema = z.object({
  access_token: z.string(),
  expires_in: z.number(),
  refresh_token: z.string().optional(),
  scope: z.string().optional(),
  id_token: z.string().optional(),
  token_type: z.string(),
});
export type GoogleTokens = z.infer<typeof tokenSchema>;

export async function exchangeGoogleCode(code: string, verifier: string, redirectUri: string): Promise<GoogleTokens> {
  const e = env();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      code_verifier: verifier,
      client_id: e.GOOGLE_CLIENT_ID ?? "",
      client_secret: e.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed (${res.status})`);
  return tokenSchema.parse(await res.json());
}

export async function refreshGoogleToken(refreshToken: string): Promise<GoogleTokens> {
  const e = env();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: e.GOOGLE_CLIENT_ID ?? "",
      client_secret: e.GOOGLE_CLIENT_SECRET ?? "",
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed (${res.status})`);
  return tokenSchema.parse(await res.json());
}

const userInfoSchema = z.object({
  sub: z.string(),
  email: z.string().email(),
  email_verified: z.boolean().optional(),
  name: z.string().optional(),
  picture: z.string().url().optional(),
});

export async function fetchGoogleUser(accessToken: string) {
  const res = await fetch(USERINFO_URL, { headers: { authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`Google userinfo failed (${res.status})`);
  return userInfoSchema.parse(await res.json());
}
