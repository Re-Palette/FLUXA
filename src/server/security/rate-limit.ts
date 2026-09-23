import "server-only";
import { prisma } from "../db";

export class RateLimitError extends Error {
  constructor(public retryAfterSeconds: number) {
    super("リクエストが多すぎます。しばらくしてから再度お試しください。");
    this.name = "RateLimitError";
  }
}

/**
 * Fixed-window limiter backed by Postgres so it holds across server instances.
 * Returns true when the call is allowed.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const now = new Date();
  const windowStart = new Date(Math.floor(now.getTime() / (windowSeconds * 1000)) * windowSeconds * 1000);
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimitBucket" ("key", "count", "windowStart")
    VALUES (${key}, 1, ${windowStart})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimitBucket"."windowStart" = ${windowStart} THEN "RateLimitBucket"."count" + 1 ELSE 1 END,
      "windowStart" = ${windowStart}
    RETURNING "count"`;
  return (rows[0]?.count ?? 1) <= limit;
}

export async function enforceRateLimit(key: string, limit: number, windowSeconds: number): Promise<void> {
  if (!(await rateLimit(key, limit, windowSeconds))) throw new RateLimitError(windowSeconds);
}
