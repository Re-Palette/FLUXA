import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { prisma } from "../db";
import { randomToken, sha256 } from "../security/crypto";
import { secureCookies } from "../env";
import { IN_MEMORY_DB } from "../memory-db";
import { demoSessionToken, ensureDemoAccount } from "../services/demo";

export const SESSION_COOKIE = "fluxa_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const REFRESH_AFTER_MS = 24 * 60 * 60 * 1000;

export async function createSession(userId: string, meta: { ip?: string; userAgent?: string | null; token?: string } = {}) {
  const token = meta.token ?? randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const firstMembership = await prisma.companyMember.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { companyId: true },
  });
  await prisma.session.deleteMany({ where: { tokenHash: sha256(token) } });
  await prisma.session.create({
    data: {
      tokenHash: sha256(token),
      userId,
      expiresAt,
      activeCompanyId: firstMembership?.companyId ?? null,
      ip: meta.ip,
      userAgent: meta.userAgent?.slice(0, 300) ?? null,
    },
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Resolves the current session from the cookie. Cached per request. */
export const getSession = cache(async () => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  let session = await prisma.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { select: { id: true, email: true, name: true, image: true } } },
  });
  // memory-db: this server instance may never have seen the demo session; rebuild it from the stateless token.
  if (!session && IN_MEMORY_DB && token === demoSessionToken()) {
    const userId = await ensureDemoAccount();
    session = await prisma.session.upsert({
      where: { tokenHash: sha256(token) },
      create: { tokenHash: sha256(token), userId, expiresAt: new Date(Date.now() + SESSION_TTL_MS), activeCompanyId: "demo_company" },
      update: {},
      include: { user: { select: { id: true, email: true, name: true, image: true } } },
    });
  }
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  if (Date.now() - session.lastSeenAt.getTime() > REFRESH_AFTER_MS) {
    await prisma.session
      .update({
        where: { id: session.id },
        data: { lastSeenAt: new Date(), expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
      })
      .catch(() => {});
  }
  return session;
});

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.delete(SESSION_COOKIE);
}

export async function setActiveCompany(sessionId: string, companyId: string): Promise<void> {
  await prisma.session.update({ where: { id: sessionId }, data: { activeCompanyId: companyId } });
}

/** For public pages (landing, login): treat an unavailable database as "not signed in" instead of crashing. */
export async function getSessionOrNull() {
  try {
    return await getSession();
  } catch (err) {
    unstable_rethrow(err); // let Next.js control-flow errors (dynamic rendering, redirects) propagate
    console.error("session lookup failed", { error: (err as Error).message });
    return null;
  }
}
