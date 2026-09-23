"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { DEPARTMENTS, EMPLOYEE_TEMPLATES, TEAM_PACKS, responsibilityInfo } from "@/lib/catalog";
import { TOOLS, type Policy } from "@/lib/tool-catalog";
import { assertCompany, MANAGE_ROLES } from "@/server/auth/guards";
import { createEmployee, setPermissions, setResponsibilities } from "@/server/services/employees";
import { logActivity } from "@/server/services/activity";
import { audit } from "@/server/security/audit";
import { prisma } from "@/server/db";
import { toActionError, type ActionResult } from "@/server/actions";

const respItems = z.array(z.object({ key: z.string().nullable().optional(), label: z.string().trim().min(1).max(120) })).max(40);
const normalize = (items: z.infer<typeof respItems>) =>
  items.map((r) => (r.key && responsibilityInfo(r.key) ? { key: r.key, label: responsibilityInfo(r.key)!.ja } : { key: null, label: r.label }));

async function enforceSeatLimit(companyId: string, adding: number) {
  const sub = await prisma.subscription.findUnique({ where: { companyId }, include: { plan: true } });
  const max = sub?.plan.maxEmployees;
  if (max == null) return;
  const count = await prisma.aIEmployee.count({ where: { companyId } });
  if (count + adding > max) throw new z.ZodError([{ code: "custom", path: ["plan"], message: `現在のプランでは AI社員は ${max} 名までです`, input: undefined }]);
}

const builderSchema = z.object({
  templateKey: z.string().nullable().optional(),
  name: z.string().trim().max(80).optional(),
  role: z.string().trim().min(1, "役職を入力してください").max(80),
  department: z.enum(DEPARTMENTS.map((d) => d.key) as [string, ...string[]]),
  mission: z.string().trim().min(1, "Mission を入力してください").max(500),
  instructions: z.string().max(4000).optional(),
  responsibilities: respItems.min(1, "仕事内容を1つ以上選択してください"),
});

export async function createEmployeeAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await assertCompany(MANAGE_ROLES);
    const d = builderSchema.parse(input);
    await enforceSeatLimit(ctx.company.id, 1);
    const tpl = EMPLOYEE_TEMPLATES.find((t) => t.key === d.templateKey);
    const emp = await createEmployee(ctx.db, ctx.company.id, {
      templateKey: tpl?.key ?? null,
      name: d.name,
      role: d.role,
      department: d.department,
      mission: d.mission,
      instructions: d.instructions,
      responsibilities: normalize(d.responsibilities),
    });
    await logActivity(ctx.db, ctx.company.id, { actorType: "USER", actorId: ctx.user.id, actorName: "You", action: "employee.created", message: `${emp.role} を採用しました`, targetType: "employee", targetId: emp.id });
    revalidatePath("/app", "layout");
    return { ok: true, data: { id: emp.id } };
  } catch (err) {
    return toActionError(err);
  }
}

export async function addTeamPackAction(packKey: string): Promise<ActionResult<{ added: number }>> {
  try {
    const ctx = await assertCompany(MANAGE_ROLES);
    const pack = TEAM_PACKS.find((p) => p.key === packKey);
    if (!pack) return { ok: false, error: "テンプレートが見つかりません" };
    const existing = new Set((await ctx.db.aIEmployee.findMany({ where: { companyId: ctx.company.id }, select: { templateKey: true } })).map((e) => e.templateKey));
    const toAdd = pack.templates.filter((t) => !existing.has(t));
    await enforceSeatLimit(ctx.company.id, toAdd.length);
    for (const key of toAdd) await createEmployee(ctx.db, ctx.company.id, { templateKey: key });
    await logActivity(ctx.db, ctx.company.id, { actorType: "USER", actorId: ctx.user.id, actorName: "You", action: "employee.pack_added", message: `${pack.name} から ${toAdd.length} 名を採用しました` });
    revalidatePath("/app", "layout");
    return { ok: true, data: { added: toAdd.length } };
  } catch (err) {
    return toActionError(err);
  }
}

const profileSchema = z.object({
  name: z.string().trim().min(1).max(80),
  role: z.string().trim().min(1).max(80),
  mission: z.string().trim().min(1, "Mission を入力してください").max(500),
  instructions: z.string().max(4000),
  model: z.string().max(100).nullable().optional(),
  responsibilities: respItems.min(1, "仕事内容を1つ以上選択してください"),
});

export async function updateEmployeeAction(employeeId: string, input: unknown): Promise<ActionResult> {
  try {
    const ctx = await assertCompany(MANAGE_ROLES);
    const d = profileSchema.parse(input);
    const emp = await ctx.db.aIEmployee.findUnique({ where: { id: z.string().parse(employeeId) } });
    if (!emp) return { ok: false, error: "AI社員が見つかりません" };
    const model = d.model && /^(anthropic|openai|gemini):[\w.\-]+$/.test(d.model) ? d.model : null;
    await ctx.db.aIEmployee.update({ where: { id: emp.id }, data: { name: d.name, role: d.role, mission: d.mission, instructions: d.instructions, model } });
    await setResponsibilities(ctx.db, ctx.company.id, emp.id, normalize(d.responsibilities));
    await logActivity(ctx.db, ctx.company.id, { actorType: "USER", actorId: ctx.user.id, actorName: "You", action: "employee.updated", message: `${d.role} の設定を更新しました`, targetType: "employee", targetId: emp.id });
    revalidatePath("/app", "layout");
    return { ok: true, message: "保存しました" };
  } catch (err) {
    return toActionError(err);
  }
}

const policyEnum = z.enum(["ALLOW", "REQUIRE_APPROVAL", "DENY"]);
export async function updatePermissionsAction(employeeId: string, input: unknown): Promise<ActionResult> {
  try {
    const ctx = await assertCompany(MANAGE_ROLES);
    const d = z.object({ connectionAccess: z.array(z.string()).max(30), toolPolicies: z.record(z.string(), policyEnum) }).parse(input);
    const emp = await ctx.db.aIEmployee.findUnique({ where: { id: z.string().parse(employeeId) } });
    if (!emp) return { ok: false, error: "AI社員が見つかりません" };
    const names = new Set(TOOLS.map((t) => t.name));
    const policies = Object.fromEntries(Object.entries(d.toolPolicies).filter(([k]) => names.has(k))) as Record<string, Policy>;
    await setPermissions(ctx.db, ctx.company.id, emp.id, { connectionAccess: d.connectionAccess, toolPolicies: policies });
    await audit({ action: "employee.permissions_changed", userId: ctx.user.id, companyId: ctx.company.id, metadata: { employeeId: emp.id } });
    await logActivity(ctx.db, ctx.company.id, { actorType: "USER", actorId: ctx.user.id, actorName: "You", action: "employee.permissions", message: `${emp.role} の権限を変更しました`, targetType: "employee", targetId: emp.id });
    revalidatePath("/app", "layout");
    return { ok: true, message: "権限を保存しました" };
  } catch (err) {
    return toActionError(err);
  }
}

export async function setEmployeePausedAction(employeeId: string, paused: boolean): Promise<ActionResult> {
  try {
    const ctx = await assertCompany(MANAGE_ROLES);
    const emp = await ctx.db.aIEmployee.findUnique({ where: { id: z.string().parse(employeeId) } });
    if (!emp) return { ok: false, error: "AI社員が見つかりません" };
    await ctx.db.aIEmployee.update({ where: { id: emp.id }, data: { status: paused ? "PAUSED" : "IDLE" } });
    await logActivity(ctx.db, ctx.company.id, { actorType: "USER", actorId: ctx.user.id, actorName: "You", action: paused ? "employee.paused" : "employee.resumed", message: `${emp.role} を${paused ? "一時停止" : "再開"}しました`, targetType: "employee", targetId: emp.id });
    revalidatePath("/app", "layout");
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}

export async function deleteEmployeeAction(employeeId: string): Promise<ActionResult> {
  try {
    const ctx = await assertCompany(MANAGE_ROLES);
    const emp = await ctx.db.aIEmployee.findUnique({ where: { id: z.string().parse(employeeId) } });
    if (!emp) return { ok: false, error: "AI社員が見つかりません" };
    const busy = await ctx.db.task.count({ where: { employeeId: emp.id, status: { in: ["RUNNING", "APPROVAL_REQUIRED"] } } });
    if (busy) return { ok: false, error: "実行中・承認待ちの仕事があります。完了またはキャンセルしてから削除してください。" };
    await ctx.db.aIEmployee.delete({ where: { id: emp.id } });
    await audit({ action: "employee.deleted", userId: ctx.user.id, companyId: ctx.company.id, metadata: { employeeId: emp.id, role: emp.role } });
    await logActivity(ctx.db, ctx.company.id, { actorType: "USER", actorId: ctx.user.id, actorName: "You", action: "employee.deleted", message: `${emp.role} を削除しました` });
    revalidatePath("/app", "layout");
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}
