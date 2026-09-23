import "server-only";
import { prisma, tenantDb } from "../db";
import { nextCronRun } from "@/lib/cron";
import { createWorkflow } from "../orchestrator/engine";
import { logActivity } from "./activity";

/** Creates workflows for due schedules and advances nextRunAt. Claims each schedule atomically. */
export async function runDueSchedules(now = new Date()): Promise<number> {
  const due = await prisma.schedule.findMany({
    where: { enabled: true, nextRunAt: { lte: now }, company: { status: "ACTIVE" } },
    take: 50,
  });
  let fired = 0;
  for (const s of due) {
    const next = nextCronRun(s.cron, s.timezone, now);
    const claim = await prisma.schedule.updateMany({ where: { id: s.id, nextRunAt: s.nextRunAt }, data: { nextRunAt: next, lastRunAt: now } });
    if (claim.count !== 1) continue;
    const db = tenantDb(s.companyId);
    try {
      await createWorkflow(db, s.companyId, { request: s.instruction, targetEmployeeId: s.employeeId, source: "schedule", scheduleId: s.id });
      fired++;
    } catch (err) {
      await logActivity(db, s.companyId, { actorType: "SYSTEM", actorName: "Scheduler", action: "schedule.failed", message: `定期実行「${s.name}」を開始できませんでした: ${(err as Error).message}` });
    }
  }
  return fired;
}
