import "server-only";
import type { ActorType, Prisma } from "@prisma/client";
import { prisma, type TenantDb } from "../db";

export interface ActivityInput {
  actorType: ActorType;
  actorId?: string | null;
  actorName: string;
  action: string;
  message: string;
  targetType?: string;
  targetId?: string;
  metadata?: Prisma.InputJsonValue;
}

export async function logActivity(db: TenantDb, companyId: string, a: ActivityInput) {
  await db.activityLog.create({
    data: {
      companyId,
      actorType: a.actorType,
      actorId: a.actorId ?? null,
      actorName: a.actorName,
      action: a.action,
      message: a.message.slice(0, 500),
      targetType: a.targetType,
      targetId: a.targetId,
      metadata: a.metadata,
    },
  });
}

export type NotificationType =
  | "task_completed"
  | "approval_required"
  | "error"
  | "connection_lost"
  | "report_ready"
  | "alert";

/** In-app notification to every member of the company. */
export async function notifyCompany(
  db: TenantDb,
  companyId: string,
  n: { type: NotificationType; title: string; body: string; link?: string },
) {
  const members = await prisma.companyMember.findMany({ where: { companyId }, select: { userId: true } });
  if (members.length === 0) return;
  await db.notification.createMany({
    data: members.map((m) => ({
      companyId,
      userId: m.userId,
      type: n.type,
      title: n.title.slice(0, 200),
      body: n.body.slice(0, 1000),
      link: n.link,
    })),
  });
}
