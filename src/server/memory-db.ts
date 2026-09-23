import "server-only";
// TEMPORARY DEMO SUPPORT — delete this file (and its uses, marked "memory-db") to remove the in-memory mode.
//
// When DATABASE_URL is not set (or is "memory"), the app runs on an in-process PGlite Postgres that is
// migrated and seeded on startup. Data lives only as long as the server instance.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { PrismaPGlite } from "pglite-prisma-adapter";
import { PrismaClient } from "@prisma/client";

// FLUXA_MEMORY_DB marks the decision, because DATABASE_URL is replaced with a placeholder below and modules
// evaluated later in the same process must still see memory mode.
export const IN_MEMORY_DB =
  process.env.FLUXA_MEMORY_DB === "1" || !process.env.DATABASE_URL?.trim() || process.env.DATABASE_URL.trim() === "memory";
if (IN_MEMORY_DB) {
  process.env.FLUXA_MEMORY_DB = "1";
  // Throwaway defaults so the demo runs with zero configuration. The secret only protects the public demo
  // session; the encryption key is per process, matching the per-process database.
  process.env.AUTH_SECRET ||= "fluxa-in-memory-demo-secret-not-for-production";
  process.env.ENCRYPTION_KEY ||= randomBytes(32).toString("base64");
}

let ready: Promise<void> | null = null;

function migrationsSql(): string[] {
  const dir = path.join(process.cwd(), "prisma", "migrations");
  return readdirSync(dir)
    .filter((d) => /^\d/.test(d))
    .sort()
    .map((d) => readFileSync(path.join(dir, d, "migration.sql"), "utf8"));
}

export function createMemoryClient(log: ("warn" | "error")[]): { client: PrismaClient; whenReady: () => Promise<void> } {
  // Prisma still expects the datasource env var to exist even though the adapter is used.
  process.env.DATABASE_URL = "postgresql://memory@localhost/memory";
  const pg = new PGlite();
  // The adapter pins an older @prisma/driver-adapter-utils; the runtime interface is compatible.
  const client = new PrismaClient({ adapter: new PrismaPGlite(pg) as never, log });
  const whenReady = () => {
    ready ??= (async () => {
      for (const sql of migrationsSql()) await pg.exec(sql);
      const { seedCatalog } = await import("../../prisma/seed-data");
      await seedCatalog(client);
      console.warn("[memory-db] Running on an in-memory database (DATABASE_URL not set). Data is temporary.");
    })();
    return ready;
  };
  return { client, whenReady };
}
