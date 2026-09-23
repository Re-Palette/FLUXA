"use server";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertCompany, MANAGE_ROLES } from "@/server/auth/guards";
import { cancelWorkflow, createWorkflow, decideApproval, retryTask, retryWorkflowPlanning, runQueue } from "@/server/orchestrator/engine";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { toActionError, type ActionResult } from "@/server/actions";

/** Continue processing after the response is sent (cron /api/cron/tick is the safety net). */
function kickQueue() {
  after(async () => {
    try {
      await runQueue();
    } catch (err) {
      console.error("queue run failed", { error: (err as Error).message });
    }
  });
}

const requestSchema = z.object({
  request: z.string().trim().min(3, "依頼内容を入力してください").max(8000),
  targetEmployeeId: z.string().max(40).nullable().optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
});

export async function createWorkflowAction(input: unknown): Promise<ActionResult<{ workflowId: string }>> {
  try {
    const ctx = await assertCompany();
    const data = requestSchema.parse(input);
    await enforceRateLimit(`workflow:${ctx.company.id}`, 30, 3600);
    const wf = await createWorkflow(ctx.db, ctx.company.id, { ...data, targetEmployeeId: data.targetEmployeeId || null, userId: ctx.user.id });
    kickQueue();
    revalidatePath("/app", "layout");
    return { ok: true, data: { workflowId: wf.id } };
  } catch (err) {
    return toActionError(err);
  }
}

export async function decideApprovalAction(approvalId: string, decision: "APPROVED" | "REJECTED", reason?: string): Promise<ActionResult> {
  try {
    const ctx = await assertCompany(MANAGE_ROLES);
    z.enum(["APPROVED", "REJECTED"]).parse(decision);
    await decideApproval(ctx.db, ctx.company.id, { approvalId: z.string().parse(approvalId), decision, userId: ctx.user.id, reason: reason?.slice(0, 500) });
    kickQueue();
    revalidatePath("/app", "layout");
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}

export async function retryTaskAction(taskId: string): Promise<ActionResult> {
  try {
    const ctx = await assertCompany();
    await retryTask(ctx.db, ctx.company.id, z.string().parse(taskId), ctx.user.id);
    kickQueue();
    revalidatePath("/app", "layout");
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}

export async function retryPlanningAction(workflowId: string): Promise<ActionResult> {
  try {
    const ctx = await assertCompany();
    const ok = await retryWorkflowPlanning(ctx.db, z.string().parse(workflowId));
    if (!ok) return { ok: false, error: "この依頼は再試行できません" };
    kickQueue();
    revalidatePath("/app", "layout");
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}

export async function cancelWorkflowAction(workflowId: string): Promise<ActionResult> {
  try {
    const ctx = await assertCompany();
    await cancelWorkflow(ctx.db, ctx.company.id, z.string().parse(workflowId), ctx.user.id);
    revalidatePath("/app", "layout");
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}
