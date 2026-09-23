"use server";
import { assertCompany } from "@/server/auth/guards";
import { toActionError, type ActionResult } from "@/server/actions";

export async function markNotificationsReadAction(ids?: string[]): Promise<ActionResult> {
  try {
    const ctx = await assertCompany();
    await ctx.db.notification.updateMany({
      where: { companyId: ctx.company.id, userId: ctx.user.id, readAt: null, ...(ids?.length ? { id: { in: ids.slice(0, 100) } } : {}) },
      data: { readAt: new Date() },
    });
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}
