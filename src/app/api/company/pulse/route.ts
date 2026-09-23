import { NextResponse } from "next/server";
import { assertCompany, AuthError } from "@/server/auth/guards";
import { companyPulse } from "@/server/services/pulse";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ctx = await assertCompany();
    const pulse = await companyPulse(ctx.db, ctx.company.id, ctx.user.id);
    return NextResponse.json(pulse, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 500;
    return NextResponse.json({ error: "unavailable" }, { status });
  }
}
