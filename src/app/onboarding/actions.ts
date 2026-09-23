"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { COMPANY_SIZES, EMPLOYEE_TEMPLATES, INDUSTRIES, responsibilityInfo } from "@/lib/catalog";
import { TOOLS, type Policy } from "@/lib/tool-catalog";
import { assertCompany, getCompanyContext, MANAGE_ROLES } from "@/server/auth/guards";
import { prisma } from "@/server/db";
import { createCompany, syncProfileMemory } from "@/server/services/companies";
import { createEmployee, defaultConnectionAccess, setPermissions, setResponsibilities } from "@/server/services/employees";
import { logActivity } from "@/server/services/activity";
import { toActionError, type ActionResult } from "@/server/actions";

const companySchema = z.object({
  name: z.string().trim().min(1, "会社名を入力してください").max(100),
  industry: z.enum(INDUSTRIES, { message: "業種を選択してください" }),
  size: z.enum(COMPANY_SIZES, { message: "会社の規模を選択してください" }),
  description: z.string().trim().min(1, "会社の説明を入力してください").max(2000),
  goal: z.string().trim().min(1, "会社の目標を入力してください").max(1000),
  website: z
    .string()
    .trim()
    .max(300)
    .refine((v) => v === "" || /^https?:\/\/[^\s]+$/i.test(v), "https:// から始まるURLを入力してください")
    .optional()
    .transform((v) => v || null),
});

export type CompanyFormState = { error?: string; fieldErrors?: Record<string, string> } | undefined;

async function advance(companyId: string, step: number) {
  await prisma.company.updateMany({ where: { id: companyId, onboardingStep: { lt: step } }, data: { onboardingStep: step } });
}

export async function saveCompanyAction(_prev: CompanyFormState, formData: FormData): Promise<CompanyFormState> {
  const ctx = await getCompanyContext();
  if (!ctx) redirect("/login");
  const parsed = companySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { error: "入力内容を確認してください", fieldErrors };
  }
  if (ctx.company) {
    if (!ctx.membership || !MANAGE_ROLES.includes(ctx.membership.role)) return { error: "この操作を行う権限がありません" };
    await prisma.company.update({ where: { id: ctx.company.id }, data: parsed.data });
    await syncProfileMemory(ctx.company.id, parsed.data);
    await advance(ctx.company.id, 2);
  } else {
    await createCompany(ctx.user.id, ctx.session.id, parsed.data);
  }
  redirect("/onboarding?step=2");
}

const templateKeys = new Set(EMPLOYEE_TEMPLATES.map((t) => t.key));

/** Syncs the onboarding team with the selected templates. */
export async function saveEmployeesAction(keys: string[]): Promise<ActionResult> {
  try {
    const ctx = await assertCompany(MANAGE_ROLES);
    const selected = [...new Set(z.array(z.string()).max(40).parse(keys))].filter((k) => templateKeys.has(k));
    const existing = await ctx.db.aIEmployee.findMany({ where: { companyId: ctx.company.id }, select: { id: true, templateKey: true, isCustom: true } });
    if (selected.length === 0 && existing.filter((e) => e.isCustom).length === 0) {
      return { ok: false, error: "AI社員を1人以上選択してください" };
    }
    const have = new Set(existing.map((e) => e.templateKey));
    for (const key of selected) if (!have.has(key)) await createEmployee(ctx.db, ctx.company.id, { templateKey: key });
    if (ctx.company.status === "ONBOARDING") {
      const remove = existing.filter((e) => e.templateKey && !e.isCustom && !selected.includes(e.templateKey)).map((e) => e.id);
      if (remove.length) await ctx.db.aIEmployee.deleteMany({ where: { id: { in: remove } } });
    }
    await advance(ctx.company.id, 3);
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}

const responsibilityPayload = z.array(
  z.object({
    employeeId: z.string(),
    mission: z.string().trim().min(1, "Mission を入力してください").max(500),
    responsibilities: z
      .array(z.object({ key: z.string().nullable().optional(), label: z.string().trim().min(1).max(120) }))
      .max(40),
  }),
);

export async function saveResponsibilitiesAction(payload: unknown): Promise<ActionResult> {
  try {
    const ctx = await assertCompany(MANAGE_ROLES);
    const items = responsibilityPayload.parse(payload);
    for (const item of items) {
      const emp = await ctx.db.aIEmployee.findUnique({ where: { id: item.employeeId } });
      if (!emp) continue;
      if (item.responsibilities.length === 0) return { ok: false, error: `${emp.role} の仕事内容を1つ以上選択してください` };
      const resp = item.responsibilities.map((r) => ({
        key: r.key && responsibilityInfo(r.key) ? r.key : null,
        label: r.key && responsibilityInfo(r.key) ? responsibilityInfo(r.key)!.ja : r.label,
      }));
      await ctx.db.aIEmployee.update({ where: { id: emp.id }, data: { mission: item.mission } });
      await setResponsibilities(ctx.db, ctx.company.id, emp.id, resp);
      // Recompute default data access from the new responsibilities (permissions step can refine it).
      const access = defaultConnectionAccess(emp.templateKey, resp.map((r) => r.key));
      await ctx.db.employeeConnectionAccess.deleteMany({ where: { employeeId: emp.id } });
      if (access.length) {
        await ctx.db.employeeConnectionAccess.createMany({ data: access.map((provider) => ({ companyId: ctx.company.id, employeeId: emp.id, provider })) });
      }
    }
    await advance(ctx.company.id, 4);
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}

export async function finishConnectionsAction(): Promise<void> {
  const ctx = await assertCompany(MANAGE_ROLES);
  await advance(ctx.company.id, 5);
  redirect("/onboarding?step=5");
}

const policyEnum = z.enum(["ALLOW", "REQUIRE_APPROVAL", "DENY"]);
const permissionsPayload = z.array(
  z.object({
    employeeId: z.string(),
    connectionAccess: z.array(z.string()).max(30),
    toolPolicies: z.record(z.string(), policyEnum),
  }),
);

export async function savePermissionsAction(payload: unknown): Promise<ActionResult> {
  try {
    const ctx = await assertCompany(MANAGE_ROLES);
    const items = permissionsPayload.parse(payload);
    const toolNames = new Set(TOOLS.map((t) => t.name));
    for (const item of items) {
      const emp = await ctx.db.aIEmployee.findUnique({ where: { id: item.employeeId } });
      if (!emp) continue;
      const policies = Object.fromEntries(Object.entries(item.toolPolicies).filter(([k]) => toolNames.has(k))) as Record<string, Policy>;
      await setPermissions(ctx.db, ctx.company.id, emp.id, { connectionAccess: item.connectionAccess, toolPolicies: policies });
    }
    await advance(ctx.company.id, 6);
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}

export async function launchCompanyAction(): Promise<ActionResult> {
  try {
    const ctx = await assertCompany(MANAGE_ROLES);
    const count = await ctx.db.aIEmployee.count({ where: { companyId: ctx.company.id } });
    if (count === 0) return { ok: false, error: "AI社員を1人以上追加してください" };
    await prisma.company.update({ where: { id: ctx.company.id }, data: { status: "ACTIVE", launchedAt: new Date(), onboardingStep: 6 } });
    await logActivity(ctx.db, ctx.company.id, {
      actorType: "SYSTEM",
      actorName: "FLUXA",
      action: "company.launched",
      message: `${ctx.company.name} の AI 会社が起動しました（AI社員 ${count} 名）`,
    });
    revalidatePath("/", "layout");
  } catch (err) {
    return toActionError(err);
  }
  redirect("/app?launched=1");
}
