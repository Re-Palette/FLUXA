import "server-only";
import { Prisma, PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/** Unscoped client. Only use for identity/global tables or after an explicit tenant check. */
export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/** Models whose rows belong to exactly one company. */
export const TENANT_MODELS = new Set<string>([
  "AIEmployee",
  "AIEmployeeResponsibility",
  "EmployeeToolPermission",
  "EmployeeConnectionAccess",
  "Integration",
  "Credential",
  "Workflow",
  "Task",
  "ToolCall",
  "Approval",
  "Report",
  "ActivityLog",
  "Notification",
  "CompanyMemory",
  "KnowledgeDocument",
  "KnowledgeChunk",
  "Schedule",
  "UsageRecord",
  "UsageLimit",
  "Subscription",
]);

export class TenantViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantViolationError";
  }
}

type AnyArgs = Record<string, unknown> & {
  where?: Record<string, unknown>;
  data?: unknown;
  create?: Record<string, unknown>;
  update?: Record<string, unknown>;
};

function stampData(companyId: string, data: unknown, model: string): unknown {
  if (Array.isArray(data)) return data.map((d) => stampData(companyId, d, model));
  if (!data || typeof data !== "object") return data;
  const row = data as Record<string, unknown>;
  if ("company" in row) {
    throw new TenantViolationError(`${model}: use companyId, not a company relation, in tenant-scoped writes`);
  }
  if (row.companyId !== undefined && row.companyId !== companyId) {
    throw new TenantViolationError(`${model}: attempted write into another company`);
  }
  return { ...row, companyId };
}

function scopeWhere(companyId: string, where: Record<string, unknown> | undefined, model: string) {
  if (where && where.companyId !== undefined && where.companyId !== companyId) {
    throw new TenantViolationError(`${model}: attempted read across companies`);
  }
  return { ...(where ?? {}), companyId };
}

/**
 * Tenant-scoped Prisma client (docs/architecture.md §3). Every query against a tenant model is
 * forced to `companyId`, so rows of other companies are invisible and unwritable.
 */
export function tenantDb(companyId: string) {
  if (!companyId) throw new TenantViolationError("tenantDb requires a companyId");
  return prisma.$extends({
    name: "tenant-scope",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANT_MODELS.has(model)) return query(args);
          const a = { ...(args as AnyArgs) };
          switch (operation) {
            case "create":
              a.data = stampData(companyId, a.data, model);
              break;
            case "createMany":
            case "createManyAndReturn":
              a.data = stampData(companyId, a.data, model);
              break;
            case "upsert":
              a.where = scopeWhere(companyId, a.where, model);
              a.create = stampData(companyId, a.create, model) as Record<string, unknown>;
              if (a.update && "companyId" in a.update) delete a.update.companyId;
              break;
            case "update":
            case "updateMany":
            case "updateManyAndReturn":
              a.where = scopeWhere(companyId, a.where, model);
              if (a.data && typeof a.data === "object" && "companyId" in (a.data as object)) {
                throw new TenantViolationError(`${model}: companyId is immutable`);
              }
              break;
            default:
              // findUnique(OrThrow), findFirst(OrThrow), findMany, count, aggregate, groupBy, delete, deleteMany
              a.where = scopeWhere(companyId, a.where, model);
          }
          return query(a as typeof args);
        },
      },
    },
  });
}

export type TenantDb = ReturnType<typeof tenantDb>;
export { Prisma };
