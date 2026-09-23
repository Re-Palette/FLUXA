import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { MemberRole } from "@prisma/client";
import { prisma, tenantDb } from "../db";
import { getSession, setActiveCompany } from "./session";

export class AuthError extends Error {
  constructor(
    message: string,
    public status: 401 | 403 | 404 = 401,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/login");
  return { session, user: session.user };
}

/**
 * Resolves the caller's active company and membership. The company id always comes from the
 * server-side session, never from client input.
 */
export const getCompanyContext = cache(async () => {
  const session = await getSession();
  if (!session) return null;
  let membership = session.activeCompanyId
    ? await prisma.companyMember.findUnique({
        where: { companyId_userId: { companyId: session.activeCompanyId, userId: session.userId } },
        include: { company: true },
      })
    : null;
  if (!membership) {
    membership = await prisma.companyMember.findFirst({
      where: { userId: session.userId },
      orderBy: { createdAt: "asc" },
      include: { company: true },
    });
    if (membership) await setActiveCompany(session.id, membership.companyId);
  }
  if (!membership) return { session, user: session.user, membership: null, company: null, db: null } as const;
  return {
    session,
    user: session.user,
    membership,
    company: membership.company,
    db: tenantDb(membership.companyId),
  } as const;
});

type Ctx = NonNullable<Awaited<ReturnType<typeof getCompanyContext>>>;
export type CompanyContext = Ctx & { membership: NonNullable<Ctx["membership"]>; company: NonNullable<Ctx["company"]>; db: NonNullable<Ctx["db"]> };

/** For pages: redirects to login/onboarding as needed. */
export async function requireCompany(opts: { allowOnboarding?: boolean } = {}): Promise<CompanyContext> {
  const ctx = await getCompanyContext();
  if (!ctx) redirect("/login");
  if (!ctx.company) redirect("/onboarding");
  if (ctx.company.status === "ONBOARDING" && !opts.allowOnboarding) redirect("/onboarding");
  return ctx as CompanyContext;
}

/** For server actions and route handlers: throws instead of redirecting. */
export async function assertCompany(roles?: MemberRole[]): Promise<CompanyContext> {
  const ctx = await getCompanyContext();
  if (!ctx) throw new AuthError("ログインが必要です", 401);
  if (!ctx.company || !ctx.membership) throw new AuthError("会社が見つかりません", 404);
  if (roles && !roles.includes(ctx.membership.role)) throw new AuthError("この操作を行う権限がありません", 403);
  return ctx as CompanyContext;
}

export const MANAGE_ROLES: MemberRole[] = ["OWNER", "ADMIN"];
