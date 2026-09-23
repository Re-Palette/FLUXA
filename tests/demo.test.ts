import { afterEach, describe, expect, it } from "vitest";
import { prisma, tenantDb } from "@/server/db";
import { DEMO_EMAIL, demoLoginEnabled, ensureDemoAccount, resetDemoAccount } from "@/server/services/demo";

describe("demo account", () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });

  it("is enabled in development and off in production unless explicitly allowed", () => {
    Object.assign(process.env, { NODE_ENV: "development", DEMO_LOGIN: "" });
    expect(demoLoginEnabled()).toBe(true);
    Object.assign(process.env, { NODE_ENV: "production", DEMO_LOGIN: "" });
    expect(demoLoginEnabled()).toBe(false);
    Object.assign(process.env, { NODE_ENV: "production", DEMO_LOGIN: "true" });
    expect(demoLoginEnabled()).toBe(true);
  });

  it("creates one populated sample company, idempotently, with no connected services", async () => {
    const userId = await ensureDemoAccount();
    expect(await ensureDemoAccount()).toBe(userId);
    const members = await prisma.companyMember.findMany({ where: { userId } });
    expect(members).toHaveLength(1);
    const db = tenantDb(members[0].companyId);
    expect(await db.aIEmployee.count({})).toBe(6);
    expect(await db.approval.count({ where: { status: "PENDING" } })).toBe(1);
    expect(await db.report.count({})).toBe(3);
    expect(await db.integration.count({})).toBe(0);
    expect(await db.credential.count({})).toBe(0);

    await resetDemoAccount();
    const after = await prisma.companyMember.findMany({ where: { user: { email: DEMO_EMAIL } } });
    expect(after).toHaveLength(1);
    expect(after[0].companyId).not.toBe(members[0].companyId);
  });
});
