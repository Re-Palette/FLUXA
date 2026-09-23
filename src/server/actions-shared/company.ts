"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { COMPANY_SIZES, INDUSTRIES } from "@/lib/catalog";
import { nextCronRun, validateCron } from "@/lib/cron";
import { assertCompany, MANAGE_ROLES } from "@/server/auth/guards";
import { prisma } from "@/server/db";
import { syncProfileMemory } from "@/server/services/companies";
import { logActivity } from "@/server/services/activity";
import { toActionError, type ActionResult } from "@/server/actions";

const profileSchema = z.object({
  name: z.string().trim().min(1, "会社名を入力してください").max(100),
  industry: z.enum(INDUSTRIES),
  size: z.enum(COMPANY_SIZES),
  description: z.string().trim().min(1, "会社の説明を入力してください").max(2000),
  goal: z.string().trim().min(1, "会社の目標を入力してください").max(1000),
  website: z
    .string()
    .trim()
    .max(300)
    .refine((v) => v === "" || /^https?:\/\/[^\s]+$/i.test(v), "https:// から始まるURLを入力してください")
    .transform((v) => v || null),
});

export async function updateCompanyAction(input: unknown): Promise<ActionResult> {
  try {
    const ctx = await assertCompany(MANAGE_ROLES);
    const d = profileSchema.parse(input);
    await prisma.company.update({ where: { id: ctx.company.id }, data: d });
    await syncProfileMemory(ctx.company.id, d);
    await logActivity(ctx.db, ctx.company.id, { actorType: "USER", actorId: ctx.user.id, actorName: "You", action: "company.updated", message: "会社情報を更新しました" });
    revalidatePath("/app", "layout");
    return { ok: true, message: "保存しました" };
  } catch (err) {
    return toActionError(err);
  }
}

const memorySchema = z.object({
  kind: z.enum(["brand", "preference", "decision", "instruction", "note", "mission", "goal"]),
  title: z.string().trim().min(1, "タイトルを入力してください").max(200),
  content: z.string().trim().min(1, "内容を入力してください").max(10_000),
  pinned: z.boolean().default(false),
});

export async function addMemoryAction(input: unknown): Promise<ActionResult> {
  try {
    const ctx = await assertCompany(MANAGE_ROLES);
    const d = memorySchema.parse(input);
    await ctx.db.companyMemory.create({ data: { companyId: ctx.company.id, ...d, source: "user", importance: d.pinned ? 4 : 2 } });
    revalidatePath("/app/company");
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}

export async function toggleMemoryPinAction(id: string): Promise<ActionResult> {
  try {
    const ctx = await assertCompany(MANAGE_ROLES);
    const m = await ctx.db.companyMemory.findUnique({ where: { id: z.string().parse(id) } });
    if (!m) return { ok: false, error: "見つかりません" };
    await ctx.db.companyMemory.update({ where: { id: m.id }, data: { pinned: !m.pinned } });
    revalidatePath("/app/company");
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}

export async function deleteMemoryAction(id: string): Promise<ActionResult> {
  try {
    const ctx = await assertCompany(MANAGE_ROLES);
    await ctx.db.companyMemory.deleteMany({ where: { id: z.string().parse(id) } });
    revalidatePath("/app/company");
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}

const scheduleSchema = z.object({
  name: z.string().trim().min(1, "名前を入力してください").max(100),
  employeeId: z.string().nullable().optional(),
  cron: z.string().refine(validateCron, "スケジュールの形式が正しくありません"),
  timezone: z.string().refine((tz) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, "タイムゾーンが正しくありません"),
  instruction: z.string().trim().min(3, "指示を入力してください").max(4000),
});

export async function createScheduleAction(input: unknown): Promise<ActionResult> {
  try {
    const ctx = await assertCompany(MANAGE_ROLES);
    const d = scheduleSchema.parse(input);
    if (d.employeeId) {
      const emp = await ctx.db.aIEmployee.findUnique({ where: { id: d.employeeId } });
      if (!emp) return { ok: false, error: "AI社員が見つかりません" };
    }
    await ctx.db.schedule.create({
      data: { companyId: ctx.company.id, name: d.name, employeeId: d.employeeId || null, cron: d.cron, timezone: d.timezone, instruction: d.instruction, nextRunAt: nextCronRun(d.cron, d.timezone) },
    });
    await logActivity(ctx.db, ctx.company.id, { actorType: "USER", actorId: ctx.user.id, actorName: "You", action: "schedule.created", message: `定期実行「${d.name}」を作成しました` });
    revalidatePath("/app/company");
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}

export async function toggleScheduleAction(id: string): Promise<ActionResult> {
  try {
    const ctx = await assertCompany(MANAGE_ROLES);
    const s = await ctx.db.schedule.findUnique({ where: { id: z.string().parse(id) } });
    if (!s) return { ok: false, error: "見つかりません" };
    await ctx.db.schedule.update({ where: { id: s.id }, data: { enabled: !s.enabled, nextRunAt: !s.enabled ? nextCronRun(s.cron, s.timezone) : s.nextRunAt } });
    revalidatePath("/app/company");
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}

export async function deleteScheduleAction(id: string): Promise<ActionResult> {
  try {
    const ctx = await assertCompany(MANAGE_ROLES);
    await ctx.db.schedule.deleteMany({ where: { id: z.string().parse(id) } });
    revalidatePath("/app/company");
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}
