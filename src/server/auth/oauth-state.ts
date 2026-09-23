import "server-only";
import { createHash, createHmac } from "node:crypto";
import { cookies } from "next/headers";
import { randomToken, safeEqual } from "../security/crypto";
import { env, secureCookies } from "../env";

const COOKIE = "fluxa_oauth";
const TTL_SECONDS = 600;

export interface OAuthState {
  state: string;
  verifier: string;
  purpose: "login" | "connect";
  provider?: string;
  companyId?: string;
  userId?: string;
  returnTo?: string;
  exp: number;
}

function sign(payload: string): string {
  return createHmac("sha256", env().AUTH_SECRET).update(payload).digest("base64url");
}

export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

/** Creates state + PKCE verifier and stores them in a signed, short-lived httpOnly cookie. */
export async function beginOAuth(data: Omit<OAuthState, "state" | "verifier" | "exp">): Promise<OAuthState> {
  const st: OAuthState = { ...data, state: randomToken(24), verifier: randomToken(48), exp: Date.now() + TTL_SECONDS * 1000 };
  const payload = Buffer.from(JSON.stringify(st)).toString("base64url");
  (await cookies()).set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: "lax",
    path: "/api",
    maxAge: TTL_SECONDS,
  });
  return st;
}

/** Validates the callback `state` against the cookie and consumes it (one-time use). */
export async function consumeOAuth(stateParam: string | null): Promise<OAuthState | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  jar.delete({ name: COOKIE, path: "/api" });
  if (!raw || !stateParam) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig || !safeEqual(sig, sign(payload))) return null;
  const st = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as OAuthState;
  if (st.exp < Date.now() || !safeEqual(st.state, stateParam)) return null;
  return st;
}

/** Only allow relative in-app return paths (prevents open redirects). */
export function safeReturnTo(path: string | null | undefined, fallback: string): string {
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return fallback;
  return path;
}
