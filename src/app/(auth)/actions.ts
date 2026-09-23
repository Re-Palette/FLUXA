"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/server/db";
import { DUMMY_HASH, hashPassword, verifyPassword } from "@/server/auth/password";
import { createSession, destroySession, getSession } from "@/server/auth/session";
import { safeReturnTo } from "@/server/auth/oauth-state";
import { rateLimit } from "@/server/security/rate-limit";
import { clientIp, userAgent } from "@/server/security/request";
import { audit } from "@/server/security/audit";
import { databaseSetupError } from "@/server/actions";
import { DEMO_EMAIL, demoLoginEnabled, demoSessionToken, ensureDemoAccount, resetDemoAccount } from "@/server/services/demo";
import { IN_MEMORY_DB } from "@/server/memory-db";

export type AuthState = { error?: string; fields?: { email?: string; name?: string } } | undefined;

const signupSchema = z.object({
  name: z.string().trim().min(1, "お名前を入力してください").max(80),
  email: z.string().trim().toLowerCase().email("メールアドレスの形式が正しくありません").max(320),
  password: z.string().min(10, "パスワードは10文字以上にしてください").max(200),
});

export async function signupAction(prev: AuthState, formData: FormData): Promise<AuthState> {
  try {
    return await signupActionImpl(prev, formData);
  } catch (err) {
    const msg = databaseSetupError(err);
    if (msg) return { error: msg, fields: { email: String(formData.get("email") ?? "") } };
    throw err;
  }
}

async function signupActionImpl(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const raw = { name: formData.get("name"), email: formData.get("email"), password: formData.get("password") };
  const parsed = signupSchema.safeParse(raw);
  const fields = { email: String(raw.email ?? ""), name: String(raw.name ?? "") };
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, fields };
  const ip = await clientIp();
  if (!(await rateLimit(`signup:${ip}`, 10, 3600))) return { error: "しばらくしてから再度お試しください", fields };

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return { error: "このメールアドレスはすでに登録されています。ログインしてください。", fields };
  const user = await prisma.user.create({
    data: { email: parsed.data.email, name: parsed.data.name, passwordHash: await hashPassword(parsed.data.password) },
  });
  await createSession(user.id, { ip, userAgent: await userAgent() });
  await audit({ action: "auth.signup", userId: user.id, ip, metadata: { method: "password" } });
  redirect("/onboarding");
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("メールアドレスの形式が正しくありません"),
  password: z.string().min(1, "パスワードを入力してください").max(200),
});

export async function loginAction(prev: AuthState, formData: FormData): Promise<AuthState> {
  try {
    return await loginActionImpl(prev, formData);
  } catch (err) {
    const msg = databaseSetupError(err);
    if (msg) return { error: msg, fields: { email: String(formData.get("email") ?? "") } };
    throw err;
  }
}

async function loginActionImpl(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  const fields = { email: String(formData.get("email") ?? "") };
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, fields };
  const ip = await clientIp();
  const okIp = await rateLimit(`login:ip:${ip}`, 30, 900);
  const okEmail = await rateLimit(`login:email:${parsed.data.email}`, 8, 900);
  if (!okIp || !okEmail) return { error: "ログイン試行が多すぎます。15分ほど待ってから再度お試しください。", fields };

  if (parsed.data.email === DEMO_EMAIL) {
    // The demo account only exists while demo login is enabled; create it on first use.
    if (!demoLoginEnabled()) return { error: "メールアドレスまたはパスワードが正しくありません", fields };
    await ensureDemoAccount();
  }
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  const valid = await verifyPassword(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !user.passwordHash || !valid) {
    await audit({ action: "auth.login_failed", userId: user?.id, ip });
    return { error: "メールアドレスまたはパスワードが正しくありません", fields };
  }
  const demoToken = IN_MEMORY_DB && user.email === DEMO_EMAIL ? demoSessionToken() : undefined; // memory-db
  await createSession(user.id, { ip, userAgent: await userAgent(), token: demoToken });
  await audit({ action: "auth.login", userId: user.id, ip, metadata: { method: "password" } });
  redirect(safeReturnTo(String(formData.get("next") ?? ""), "/app"));
}

export async function logoutAction() {
  const session = await getSession();
  await destroySession();
  if (session) await audit({ action: "auth.logout", userId: session.userId });
  redirect("/login");
}

/** One-click entry into a sample company (development, or DEMO_LOGIN=true). */
export async function demoLoginAction() {
  if (!demoLoginEnabled()) redirect("/login");
  let userId: string;
  const ip = await clientIp();
  try {
    if (!(await rateLimit(`demo:${ip}`, 30, 600))) redirect("/login");
    userId = await ensureDemoAccount();
  } catch (err) {
    if (databaseSetupError(err)) redirect("/login?error=database");
    throw err;
  }
  // memory-db: a stateless token so the session survives across server instances.
  await createSession(userId, { ip, userAgent: await userAgent(), token: IN_MEMORY_DB ? demoSessionToken() : undefined });
  await audit({ action: "auth.login", userId, ip, metadata: { method: "demo" } });
  redirect("/app");
}

export async function resetDemoAction() {
  const session = await getSession();
  if (!demoLoginEnabled() || session?.user.email !== DEMO_EMAIL) redirect("/app");
  await resetDemoAccount();
  redirect("/app");
}
