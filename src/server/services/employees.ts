import "server-only";
import type { TenantDb } from "../db";
import { responsibilityInfo, templateInfo } from "@/lib/catalog";
import { clampPolicy, toolInfo, TOOLS, type Policy } from "@/lib/tool-catalog";
import { recommendConnections } from "@/lib/recommend";

export interface ResponsibilityInput {
  key?: string | null;
  label: string;
}

/** Default connection access for a new employee: every recommended/optional provider of its responsibilities. */
export function defaultConnectionAccess(templateKey: string | null | undefined, responsibilityKeys: (string | null)[]): string[] {
  return recommendConnections({ templateKey, responsibilityKeys }).map((r) => r.provider);
}

export async function createEmployee(
  db: TenantDb,
  companyId: string,
  input: {
    id?: string;
    templateKey?: string | null;
    name?: string;
    role?: string;
    department?: string;
    description?: string;
    mission?: string;
    instructions?: string;
    responsibilities?: ResponsibilityInput[];
    connectionAccess?: string[];
  },
) {
  const tpl = templateInfo(input.templateKey);
  const role = input.role?.trim() || tpl?.name || "AI Employee";
  const responsibilities: ResponsibilityInput[] =
    input.responsibilities ??
    (tpl?.defaultResponsibilities.map((k) => ({ key: k, label: responsibilityInfo(k)?.ja ?? k })) ?? []);

  return db.$transaction(async (tx) => {
    const employee = await tx.aIEmployee.create({
      data: {
        ...(input.id ? { id: input.id } : {}),
        companyId,
        templateKey: tpl?.key ?? null,
        name: input.name?.trim() || role,
        role,
        department: input.department || tpl?.department || "Executive",
        description: input.description ?? tpl?.description ?? "",
        mission: input.mission?.trim() || tpl?.defaultMission || "会社の目標達成に貢献する",
        instructions: input.instructions ?? "",
        isCustom: !tpl,
      },
    });
    if (responsibilities.length) {
      await tx.aIEmployeeResponsibility.createMany({
        data: responsibilities.map((r) => ({
          companyId,
          employeeId: employee.id,
          key: r.key ?? null,
          label: r.label.slice(0, 120),
          isCustom: !r.key,
        })),
      });
    }
    const access = input.connectionAccess ?? defaultConnectionAccess(tpl?.key, responsibilities.map((r) => r.key ?? null));
    if (access.length) {
      await tx.employeeConnectionAccess.createMany({
        data: [...new Set(access)].map((provider) => ({ companyId, employeeId: employee.id, provider })),
        skipDuplicates: true,
      });
    }
    return employee;
  });
}

export async function setResponsibilities(db: TenantDb, companyId: string, employeeId: string, items: ResponsibilityInput[]) {
  await db.$transaction(async (tx) => {
    await tx.aIEmployeeResponsibility.deleteMany({ where: { employeeId } });
    if (items.length) {
      await tx.aIEmployeeResponsibility.createMany({
        data: items.map((r) => ({ companyId, employeeId, key: r.key ?? null, label: r.label.slice(0, 120), isCustom: !r.key })),
      });
    }
  });
}

export async function setPermissions(
  db: TenantDb,
  companyId: string,
  employeeId: string,
  input: { connectionAccess: string[]; toolPolicies: Record<string, Policy> },
) {
  await db.$transaction(async (tx) => {
    await tx.employeeConnectionAccess.deleteMany({ where: { employeeId } });
    const providers = [...new Set(input.connectionAccess)];
    if (providers.length) {
      await tx.employeeConnectionAccess.createMany({ data: providers.map((provider) => ({ companyId, employeeId, provider })) });
    }
    await tx.employeeToolPermission.deleteMany({ where: { employeeId } });
    const rows = Object.entries(input.toolPolicies).flatMap(([tool, policy]) => {
      const info = toolInfo(tool);
      if (!info) return [];
      const clamped = clampPolicy(info, policy);
      return clamped === info.defaultPolicy ? [] : [{ companyId, employeeId, tool, policy: clamped }];
    });
    if (rows.length) await tx.employeeToolPermission.createMany({ data: rows });
  });
}

/** Effective policy for every catalog tool, for rendering the permission editor. */
export async function effectivePolicies(db: TenantDb, employeeId: string): Promise<Record<string, Policy>> {
  const rows = await db.employeeToolPermission.findMany({ where: { employeeId } });
  const explicit = new Map(rows.map((r) => [r.tool, r.policy as Policy]));
  return Object.fromEntries(TOOLS.map((t) => [t.name, clampPolicy(t, explicit.get(t.name) ?? t.defaultPolicy)]));
}
