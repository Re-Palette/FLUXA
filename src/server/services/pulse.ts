import "server-only";
import type { TenantDb } from "../db";

/** One snapshot of live company state; polled today, swappable for SSE later (docs/architecture.md §11). */
export async function companyPulse(db: TenantDb, companyId: string, userId: string) {
  const [employees, running, pendingApprovals, unread, notifications, latestTask, latestActivity, latestWorkflow] = await Promise.all([
    db.aIEmployee.findMany({ where: { companyId }, select: { id: true, status: true, updatedAt: true }, orderBy: { createdAt: "asc" } }),
    db.task.count({ where: { companyId, status: { in: ["RUNNING", "PENDING", "APPROVAL_REQUIRED"] } } }),
    db.approval.count({ where: { companyId, status: "PENDING" } }),
    db.notification.count({ where: { companyId, userId, readAt: null } }),
    db.notification.findMany({ where: { companyId, userId }, orderBy: { createdAt: "desc" }, take: 10 }),
    db.task.findFirst({ where: { companyId }, orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }),
    db.activityLog.findFirst({ where: { companyId }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    db.workflow.findFirst({ where: { companyId }, orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }),
  ]);
  const version = [
    latestTask?.updatedAt.getTime() ?? 0,
    latestActivity?.createdAt.getTime() ?? 0,
    latestWorkflow?.updatedAt.getTime() ?? 0,
    ...employees.map((e) => `${e.status}${e.updatedAt.getTime()}`),
    pendingApprovals,
    unread,
  ].join(":");
  return {
    version,
    running,
    pendingApprovals,
    unread,
    employees: employees.map((e) => ({ id: e.id, status: e.status })),
    notifications: notifications.map((n) => ({ id: n.id, type: n.type, title: n.title, body: n.body, link: n.link, read: Boolean(n.readAt), createdAt: n.createdAt.toISOString() })),
  };
}

export type Pulse = Awaited<ReturnType<typeof companyPulse>>;
