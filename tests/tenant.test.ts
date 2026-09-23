import { describe, expect, it } from "vitest";
import { TenantViolationError } from "@/server/db";
import { loadCredential } from "@/server/integrations/vault";
import { createEmployee, makeCompany } from "./helpers";
import { storeApiKey } from "@/server/integrations/vault";

describe("multi-tenant isolation", () => {
  it("scoped clients cannot see, change or delete another company's rows", async () => {
    const a = await makeCompany("A");
    const b = await makeCompany("B");
    const empB = await createEmployee(b.db, b.company.id, { templateKey: "sales_manager" });

    expect(await a.db.aIEmployee.findUnique({ where: { id: empB.id } })).toBeNull();
    expect(await a.db.aIEmployee.findMany({})).toHaveLength(0);
    expect(await a.db.aIEmployee.count({ where: { id: empB.id } })).toBe(0);
    expect((await a.db.aIEmployee.updateMany({ where: { id: empB.id }, data: { mission: "hacked" } })).count).toBe(0);
    expect((await a.db.aIEmployee.deleteMany({ where: { id: empB.id } })).count).toBe(0);
    await expect(a.db.aIEmployee.update({ where: { id: empB.id }, data: { mission: "hacked" } })).rejects.toThrow();
    await expect(a.db.aIEmployee.delete({ where: { id: empB.id } })).rejects.toThrow();

    const still = await b.db.aIEmployee.findUnique({ where: { id: empB.id }, include: { responsibilities: true } });
    expect(still?.mission).not.toBe("hacked");
    expect(still?.responsibilities.length).toBeGreaterThan(0);
  });

  it("rejects writes that target another company", async () => {
    const a = await makeCompany("A");
    const b = await makeCompany("B");
    await expect(
      a.db.companyMemory.create({ data: { companyId: b.company.id, kind: "note", title: "x", content: "y" } }),
    ).rejects.toBeInstanceOf(TenantViolationError);
    await expect(a.db.companyMemory.findMany({ where: { companyId: b.company.id } })).rejects.toBeInstanceOf(TenantViolationError);
    await expect(
      a.db.companyMemory.updateMany({ where: {}, data: { companyId: b.company.id } as never }),
    ).rejects.toBeInstanceOf(TenantViolationError);
  });

  it("credentials are encrypted and unreadable from another tenant", async () => {
    const a = await makeCompany("A");
    const b = await makeCompany("B");
    const integration = await storeApiKey(a.db, a.company.id, "notion", "secret_abcdefghijklmnop");
    const row = await a.db.credential.findUnique({ where: { integrationId: integration.id } });
    expect(row?.ciphertext).not.toContain("secret_");
    expect(integration.secretHint).toBe("••••••••mnop");
    expect((await loadCredential(a.db, a.company.id, "notion"))?.payload).toEqual({ kind: "api_key", apiKey: "secret_abcdefghijklmnop" });
    expect(await loadCredential(b.db, b.company.id, "notion")).toBeNull();
    expect(await b.db.credential.findUnique({ where: { integrationId: integration.id } })).toBeNull();
  });
});
