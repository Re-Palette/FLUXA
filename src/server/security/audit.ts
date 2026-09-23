import "server-only";
import { prisma } from "../db";
import type { Prisma } from "@prisma/client";

/** Security-relevant events (auth, credentials, permissions). Never include secrets in metadata. */
export async function audit(entry: {
  action: string;
  userId?: string | null;
  companyId?: string | null;
  ip?: string | null;
  metadata?: Prisma.InputJsonValue;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: entry.action,
        userId: entry.userId ?? null,
        companyId: entry.companyId ?? null,
        ip: entry.ip ?? null,
        metadata: entry.metadata,
      },
    });
  } catch (err) {
    console.error("audit log write failed", { action: entry.action, error: (err as Error).message });
  }
}
