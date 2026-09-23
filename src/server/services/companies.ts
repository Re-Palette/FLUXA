import "server-only";
import { prisma, tenantDb } from "../db";
import { logActivity } from "./activity";

export interface CompanyProfileInput {
  name: string;
  industry: string;
  size: string;
  description: string;
  goal: string;
  website?: string | null;
}

/** Creates a company with the caller as OWNER, seeds its memory, and makes it the session's active company. */
export async function createCompany(userId: string, sessionId: string, input: CompanyProfileInput) {
  const company = await prisma.$transaction(async (tx) => {
    const c = await tx.company.create({
      data: { ...input, website: input.website || null, status: "ONBOARDING", onboardingStep: 2 },
    });
    await tx.companyMember.create({ data: { companyId: c.id, userId, role: "OWNER" } });
    const freePlan = await tx.plan.findUnique({ where: { key: "free" } });
    if (freePlan) await tx.subscription.create({ data: { companyId: c.id, planKey: freePlan.key } });
    await tx.session.update({ where: { id: sessionId }, data: { activeCompanyId: c.id } });
    return c;
  });
  const db = tenantDb(company.id);
  await syncProfileMemory(company.id, input);
  await logActivity(db, company.id, {
    actorType: "USER",
    actorId: userId,
    actorName: "You",
    action: "company.created",
    message: `${company.name} を作成しました`,
  });
  return company;
}

/** Keeps the pinned profile/mission/goal memories in sync with the company profile. */
export async function syncProfileMemory(companyId: string, input: CompanyProfileInput) {
  const db = tenantDb(companyId);
  const entries = [
    { kind: "profile", title: "会社概要", content: `${input.name}（${input.industry} / ${input.size}）\n${input.description}${input.website ? `\nWebsite: ${input.website}` : ""}` },
    { kind: "goal", title: "会社の目標", content: input.goal },
  ];
  for (const e of entries) {
    const existing = await db.companyMemory.findFirst({ where: { companyId, kind: e.kind, source: "system" } });
    if (existing) await db.companyMemory.update({ where: { id: existing.id }, data: { title: e.title, content: e.content } });
    else await db.companyMemory.create({ data: { companyId, kind: e.kind, title: e.title, content: e.content, source: "system", pinned: true, importance: 5 } });
  }
}
