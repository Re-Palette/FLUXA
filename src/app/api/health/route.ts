import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { demoLoginEnabled } from "@/server/services/demo";
import { googleOAuthConfigured } from "@/server/env";

export const dynamic = "force-dynamic";

/** Setup diagnostics. Reports only booleans and error codes, never secret values. */
export async function GET() {
  const envSet = (k: string) => Boolean(process.env[k]?.trim());
  let database: "ok" | "not_configured" | "unreachable" | "not_migrated" = "ok";
  let seeded = false;
  if (!envSet("DATABASE_URL")) database = "not_configured";
  else {
    try {
      seeded = (await prisma.employeeTemplate.count()) > 0;
    } catch (err) {
      const code = (err as { code?: string }).code;
      database = code === "P2021" ? "not_migrated" : "unreachable";
    }
  }
  const env = {
    DATABASE_URL: envSet("DATABASE_URL"),
    AUTH_SECRET: (process.env.AUTH_SECRET ?? "").length >= 32,
    ENCRYPTION_KEY: Buffer.from(process.env.ENCRYPTION_KEY ?? "", "base64").length === 32,
    APP_URL: envSet("APP_URL"),
  };
  const ok = database === "ok" && seeded && env.AUTH_SECRET && env.ENCRYPTION_KEY;
  return NextResponse.json(
    { ok, database, seeded, env, demoLogin: demoLoginEnabled(), googleLogin: googleOAuthConfigured() },
    { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
