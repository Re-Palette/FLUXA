import { NextResponse, type NextRequest } from "next/server";
import { safeEqual } from "@/server/security/crypto";
import { recoverStaleTasks, runQueue } from "@/server/orchestrator/engine";
import { runDueSchedules } from "@/server/services/scheduler";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Called by an external scheduler (e.g. every minute): fires due schedules, recovers stale work,
 * and drains the task queue. Protected by CRON_SECRET (Authorization: Bearer <secret>).
 */
async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const fired = await runDueSchedules();
  const recovered = await recoverStaleTasks();
  await runQueue({ budgetMs: 240_000 });
  return NextResponse.json({ ok: true, fired, recovered });
}

export const GET = handle;
export const POST = handle;
