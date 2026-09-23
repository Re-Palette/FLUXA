import "server-only";
import type { Task, TaskPriority } from "@prisma/client";
import { prisma, tenantDb, type TenantDb } from "../db";
import { AIProviderError } from "../ai/types";
import { logActivity, notifyCompany } from "../services/activity";
import { notifyApprovalNeeded, runTaskAgent } from "./agent";
import { planWorkflow, type Plan } from "./planner";

const STALE_LOCK_MS = 15 * 60 * 1000;

// ───────────────────────── Creating work ─────────────────────────

export class WorkflowInputError extends Error {}

export async function createWorkflow(
  db: TenantDb,
  companyId: string,
  input: { request: string; targetEmployeeId?: string | null; priority?: TaskPriority; userId?: string | null; source?: "user" | "schedule"; scheduleId?: string },
) {
  if (input.targetEmployeeId) {
    const emp = await db.aIEmployee.findUnique({ where: { id: input.targetEmployeeId } });
    if (!emp) throw new WorkflowInputError("指定されたAI社員が見つかりません");
    if (emp.status === "PAUSED") throw new WorkflowInputError(`${emp.role} は一時停止中です`);
  } else {
    const active = await db.aIEmployee.count({ where: { companyId, status: { not: "PAUSED" } } });
    if (active === 0) throw new WorkflowInputError("稼働中のAI社員がいません。まずAI社員を追加してください。");
  }
  const wf = await db.workflow.create({
    data: {
      companyId,
      request: input.request,
      title: input.request.slice(0, 60),
      status: "PLANNING",
      priority: input.priority ?? "NORMAL",
      targetEmployeeId: input.targetEmployeeId ?? null,
      createdById: input.userId ?? null,
      source: input.source ?? "user",
      scheduleId: input.scheduleId,
    },
  });
  await logActivity(db, companyId, {
    actorType: input.source === "schedule" ? "SYSTEM" : "USER",
    actorId: input.userId,
    actorName: input.source === "schedule" ? "Scheduler" : "You",
    action: "workflow.created",
    message: `新しい依頼: ${wf.title}`,
    targetType: "workflow",
    targetId: wf.id,
  });
  return wf;
}

// ───────────────────────── Planning ─────────────────────────

async function planOne(db: TenantDb, workflowId: string): Promise<void> {
  const claim = await db.workflow.updateMany({
    where: { id: workflowId, status: "PLANNING", OR: [{ lockedAt: null }, { lockedAt: { lt: new Date(Date.now() - STALE_LOCK_MS) } }] },
    data: { lockedAt: new Date() },
  });
  if (claim.count !== 1) return;
  const wf = await db.workflow.findUniqueOrThrow({ where: { id: workflowId } });
  const company = await prisma.company.findUniqueOrThrow({ where: { id: wf.companyId } });

  try {
    let plan: Plan;
    if (wf.targetEmployeeId) {
      plan = { title: wf.request.slice(0, 60), steps: [{ employeeId: wf.targetEmployeeId, title: wf.request.slice(0, 120), instructions: wf.request }] };
    } else {
      const employees = await db.aIEmployee.findMany({
        where: { companyId: wf.companyId, status: { not: "PAUSED" } },
        include: { responsibilities: { select: { label: true } } },
        orderBy: { createdAt: "asc" },
      });
      if (employees.length === 0) throw new AIProviderError("bad_request", "稼働中のAI社員がいません");
      plan = await planWorkflow(db, { company, request: wf.request, employees, userId: wf.createdById });
    }

    await db.$transaction(async (tdb) => {
      for (const [i, step] of plan.steps.entries()) {
        await tdb.task.create({
          data: {
            companyId: wf.companyId,
            workflowId: wf.id,
            employeeId: step.employeeId,
            step: i,
            title: step.title,
            description: step.instructions,
            priority: wf.priority,
            status: i === 0 ? "PENDING" : "WAITING",
          },
        });
      }
      await tdb.workflow.update({
        where: { id: wf.id },
        data: { status: "RUNNING", title: plan.title, plan: plan as object, lockedAt: null },
      });
    });

    const names = await db.aIEmployee.findMany({ where: { id: { in: plan.steps.map((s) => s.employeeId) } }, select: { id: true, role: true } });
    const chain = plan.steps.map((s) => names.find((n) => n.id === s.employeeId)?.role ?? "?").join(" → ");
    await logActivity(db, wf.companyId, {
      actorType: "SYSTEM",
      actorName: "Orchestrator",
      action: "workflow.planned",
      message: `「${plan.title}」を ${plan.steps.length} ステップに分解: ${chain}`,
      targetType: "workflow",
      targetId: wf.id,
    });
  } catch (err) {
    const message = err instanceof AIProviderError ? err.message : "計画の作成中にエラーが発生しました";
    if (!(err instanceof AIProviderError)) console.error("planning failed", { workflowId, error: (err as Error).message });
    await db.workflow.update({ where: { id: wf.id }, data: { status: "FAILED", error: message, lockedAt: null } });
    await logActivity(db, wf.companyId, { actorType: "SYSTEM", actorName: "Orchestrator", action: "workflow.failed", message: `計画に失敗: ${message}`, targetType: "workflow", targetId: wf.id });
    await notifyCompany(db, wf.companyId, { type: "error", title: "依頼を開始できませんでした", body: message, link: `/app/tasks/${wf.id}` });
  }
}

// ───────────────────────── Executing tasks ─────────────────────────

async function finishWorkflow(db: TenantDb, workflowId: string) {
  const wf = await db.workflow.findUniqueOrThrow({
    where: { id: workflowId },
    include: { tasks: { orderBy: { step: "asc" }, include: { employee: { select: { role: true, id: true } } } } },
  });
  const last = wf.tasks[wf.tasks.length - 1];
  const content = wf.tasks.map((t) => `## ${t.step + 1}. ${t.title}\n_${t.employee.role}_\n\n${t.result ?? ""}`).join("\n\n---\n\n");
  const report = await db.report.create({
    data: {
      companyId: wf.companyId,
      workflowId: wf.id,
      employeeId: last?.employee.id ?? null,
      taskId: last?.id ?? null,
      title: wf.title,
      kind: "workflow",
      summary: (last?.result ?? "").replace(/[#*_`>]/g, "").slice(0, 300),
      content: `# ${wf.title}\n\n> ${wf.request.replace(/\n/g, "\n> ")}\n\n${content}`,
    },
  });
  await db.workflow.update({
    where: { id: wf.id },
    data: { status: "COMPLETED", finalResult: last?.result ?? "", completedAt: new Date() },
  });
  await db.companyMemory.create({
    data: {
      companyId: wf.companyId,
      kind: "report_summary",
      title: wf.title,
      content: report.summary || wf.title,
      source: "system",
    },
  });
  await logActivity(db, wf.companyId, { actorType: "SYSTEM", actorName: "Orchestrator", action: "workflow.completed", message: `「${wf.title}」が完了しました`, targetType: "workflow", targetId: wf.id });
  await notifyCompany(db, wf.companyId, { type: "report_ready", title: `「${wf.title}」が完了しました`, body: "成果物がレポートに保存されました。", link: `/app/reports/${report.id}` });
}

async function onTaskCompleted(db: TenantDb, task: Task, result: string) {
  await db.task.update({ where: { id: task.id }, data: { status: "COMPLETED", result, completedAt: new Date(), lockedAt: null } });
  await db.aIEmployee.updateMany({ where: { id: task.employeeId, status: { not: "PAUSED" } }, data: { status: "COMPLETED" } });
  const emp = await db.aIEmployee.findUnique({ where: { id: task.employeeId }, select: { role: true } });
  await logActivity(db, task.companyId, {
    actorType: "EMPLOYEE",
    actorId: task.employeeId,
    actorName: emp?.role ?? "AI Employee",
    action: "task.completed",
    message: `${emp?.role ?? "AI社員"} が「${task.title}」を完了しました`,
    targetType: "task",
    targetId: task.id,
  });
  if (!task.workflowId) return;
  const next = await db.task.findFirst({ where: { workflowId: task.workflowId, step: { gt: task.step }, status: "WAITING" }, orderBy: { step: "asc" } });
  if (next) {
    await db.task.update({ where: { id: next.id }, data: { status: "PENDING" } });
    const nextEmp = await db.aIEmployee.findUnique({ where: { id: next.employeeId }, select: { role: true } });
    await logActivity(db, task.companyId, {
      actorType: "SYSTEM",
      actorName: "Orchestrator",
      action: "task.handoff",
      message: `${emp?.role ?? "AI社員"} の成果を ${nextEmp?.role ?? "次の社員"} に引き継ぎました`,
      targetType: "task",
      targetId: next.id,
    });
  } else {
    await finishWorkflow(db, task.workflowId);
  }
}

async function onTaskFailed(db: TenantDb, task: Task, error: string) {
  await db.task.update({ where: { id: task.id }, data: { status: "FAILED", error, lockedAt: null } });
  await db.aIEmployee.updateMany({ where: { id: task.employeeId, status: { not: "PAUSED" } }, data: { status: "ERROR" } });
  if (task.workflowId) await db.workflow.update({ where: { id: task.workflowId }, data: { status: "FAILED", error } });
  const emp = await db.aIEmployee.findUnique({ where: { id: task.employeeId }, select: { role: true } });
  await logActivity(db, task.companyId, {
    actorType: "EMPLOYEE",
    actorId: task.employeeId,
    actorName: emp?.role ?? "AI Employee",
    action: "task.failed",
    message: `「${task.title}」が失敗しました: ${error}`,
    targetType: "task",
    targetId: task.id,
  });
  await notifyCompany(db, task.companyId, {
    type: "error",
    title: `${emp?.role ?? "AI社員"} の仕事が失敗しました`,
    body: error,
    link: task.workflowId ? `/app/tasks/${task.workflowId}` : "/app/tasks",
  });
}

async function runOneTask(db: TenantDb, taskId: string): Promise<void> {
  const claim = await db.task.updateMany({
    where: { id: taskId, status: "PENDING", employee: { status: { not: "PAUSED" } } },
    data: { status: "RUNNING", lockedAt: new Date(), attempts: { increment: 1 } },
  });
  if (claim.count !== 1) return;
  const task = await db.task.findUniqueOrThrow({ where: { id: taskId } });
  if (!task.startedAt) await db.task.update({ where: { id: task.id }, data: { startedAt: new Date() } });
  if (task.attempts === 1 && !task.transcript) {
    const emp = await db.aIEmployee.findUnique({ where: { id: task.employeeId }, select: { role: true } });
    await logActivity(db, task.companyId, {
      actorType: "EMPLOYEE",
      actorId: task.employeeId,
      actorName: emp?.role ?? "AI Employee",
      action: "task.started",
      message: `${emp?.role ?? "AI社員"} が「${task.title}」を開始しました`,
      targetType: "task",
      targetId: task.id,
    });
  }

  let outcome;
  try {
    outcome = await runTaskAgent(db, task);
  } catch (err) {
    console.error("task run crashed", { taskId, error: (err as Error).message });
    outcome = { kind: "failed" as const, error: "予期しないエラーが発生しました。再試行してください。" };
  }

  if (outcome.kind === "completed") await onTaskCompleted(db, task, outcome.result);
  else if (outcome.kind === "failed") await onTaskFailed(db, task, outcome.error);
  else {
    await db.task.update({ where: { id: task.id }, data: { status: "APPROVAL_REQUIRED", approvalRequired: true, lockedAt: null } });
    await db.aIEmployee.updateMany({ where: { id: task.employeeId, status: { not: "PAUSED" } }, data: { status: "WAITING_APPROVAL" } });
    if (task.workflowId) await db.workflow.update({ where: { id: task.workflowId }, data: { status: "WAITING_APPROVAL" } });
    const emp = await db.aIEmployee.findUnique({ where: { id: task.employeeId }, select: { role: true } });
    await logActivity(db, task.companyId, {
      actorType: "EMPLOYEE",
      actorId: task.employeeId,
      actorName: emp?.role ?? "AI Employee",
      action: "approval.requested",
      message: `${emp?.role ?? "AI社員"} が承認を求めています（${outcome.approvalIds.length} 件）`,
      targetType: "task",
      targetId: task.id,
    });
    await notifyApprovalNeeded(db, task.companyId, emp?.role ?? "AI社員", outcome.approvalIds.length);
  }
}

// ───────────────────────── Queue ─────────────────────────

let running: Promise<void> | null = null;

/**
 * Drains claimable work across all companies. Each unit of work is processed with a tenant-scoped client.
 * Safe to call concurrently (claims are atomic); calls within one process are coalesced.
 */
export function runQueue(opts: { budgetMs?: number } = {}): Promise<void> {
  if (running) return running;
  running = (async () => {
    const deadline = Date.now() + (opts.budgetMs ?? 4 * 60 * 1000);
    try {
      while (Date.now() < deadline) {
        const wf = await prisma.workflow.findFirst({
          where: { status: "PLANNING", OR: [{ lockedAt: null }, { lockedAt: { lt: new Date(Date.now() - STALE_LOCK_MS) } }] },
          orderBy: { createdAt: "asc" },
          select: { id: true, companyId: true },
        });
        if (wf) {
          await planOne(tenantDb(wf.companyId), wf.id);
          continue;
        }
        const task = await prisma.task.findFirst({
          where: { status: "PENDING", employee: { status: { not: "PAUSED" } } },
          orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
          select: { id: true, companyId: true },
        });
        if (!task) break;
        await runOneTask(tenantDb(task.companyId), task.id);
      }
    } finally {
      running = null;
    }
  })();
  return running;
}

/** Marks tasks whose worker died as failed (never auto-retried: they may have had side effects). */
export async function recoverStaleTasks(): Promise<number> {
  const stale = await prisma.task.findMany({
    where: { status: "RUNNING", lockedAt: { lt: new Date(Date.now() - STALE_LOCK_MS) } },
    select: { id: true, companyId: true },
  });
  for (const t of stale) {
    const db = tenantDb(t.companyId);
    const task = await db.task.findUnique({ where: { id: t.id } });
    if (task) await onTaskFailed(db, task, "処理が中断されました。内容を確認して再試行してください。");
  }
  return stale.length;
}

// ───────────────────────── User actions on running work ─────────────────────────

export async function decideApproval(
  db: TenantDb,
  companyId: string,
  input: { approvalId: string; decision: "APPROVED" | "REJECTED"; userId: string; reason?: string },
) {
  const approval = await db.approval.findUnique({ where: { id: input.approvalId }, include: { employee: { select: { role: true } } } });
  if (!approval) throw new WorkflowInputError("承認リクエストが見つかりません");
  const updated = await db.approval.updateMany({
    where: { id: approval.id, status: "PENDING" },
    data: { status: input.decision, decidedById: input.userId, decidedAt: new Date(), reason: input.reason?.slice(0, 500) },
  });
  if (updated.count !== 1) throw new WorkflowInputError("この承認リクエストはすでに処理されています");

  if (input.decision === "APPROVED") {
    await db.toolCall.update({ where: { id: approval.toolCallId }, data: { status: "PENDING" } });
  } else {
    await db.toolCall.update({
      where: { id: approval.toolCallId },
      data: { status: "REJECTED", error: input.reason ? `Reason: ${input.reason.slice(0, 500)}` : null, completedAt: new Date() },
    });
  }
  await logActivity(db, companyId, {
    actorType: "USER",
    actorId: input.userId,
    actorName: "You",
    action: input.decision === "APPROVED" ? "approval.approved" : "approval.rejected",
    message: `${approval.employee.role} の「${approval.title}」を${input.decision === "APPROVED" ? "承認" : "却下"}しました`,
    targetType: "approval",
    targetId: approval.id,
  });

  // Resume the task once none of its approvals are pending.
  const stillPending = await db.approval.count({ where: { taskId: approval.taskId, status: "PENDING" } });
  if (stillPending === 0) {
    const task = await db.task.findUnique({ where: { id: approval.taskId } });
    if (task && task.status === "APPROVAL_REQUIRED") {
      await db.task.update({ where: { id: task.id }, data: { status: "PENDING" } });
      await db.aIEmployee.updateMany({ where: { id: task.employeeId, status: "WAITING_APPROVAL" }, data: { status: "WORKING" } });
      if (task.workflowId) await db.workflow.update({ where: { id: task.workflowId }, data: { status: "RUNNING" } });
    }
  }
}

export async function retryTask(db: TenantDb, companyId: string, taskId: string, userId: string) {
  const task = await db.task.findUnique({ where: { id: taskId } });
  if (!task) throw new WorkflowInputError("タスクが見つかりません");
  if (task.status !== "FAILED") throw new WorkflowInputError("失敗したタスクのみ再試行できます");
  await db.task.update({ where: { id: task.id }, data: { status: "PENDING", error: null } });
  await db.aIEmployee.updateMany({ where: { id: task.employeeId, status: "ERROR" }, data: { status: "IDLE" } });
  if (task.workflowId) await db.workflow.update({ where: { id: task.workflowId }, data: { status: "RUNNING", error: null } });
  await logActivity(db, companyId, { actorType: "USER", actorId: userId, actorName: "You", action: "task.retried", message: `「${task.title}」を再試行しました`, targetType: "task", targetId: task.id });
}

export async function retryWorkflowPlanning(db: TenantDb, workflowId: string) {
  const wf = await db.workflow.findUnique({ where: { id: workflowId }, include: { _count: { select: { tasks: true } } } });
  if (!wf) throw new WorkflowInputError("依頼が見つかりません");
  if (wf.status !== "FAILED" || wf._count.tasks > 0) return false;
  await db.workflow.update({ where: { id: wf.id }, data: { status: "PLANNING", error: null, lockedAt: null } });
  return true;
}

export async function cancelWorkflow(db: TenantDb, companyId: string, workflowId: string, userId: string) {
  const wf = await db.workflow.findUnique({ where: { id: workflowId } });
  if (!wf) throw new WorkflowInputError("依頼が見つかりません");
  if (["COMPLETED", "CANCELLED"].includes(wf.status)) return;
  await db.task.updateMany({ where: { workflowId, status: { in: ["PENDING", "WAITING", "APPROVAL_REQUIRED"] } }, data: { status: "CANCELLED" } });
  await db.approval.updateMany({ where: { task: { workflowId }, status: "PENDING" }, data: { status: "EXPIRED", decidedAt: new Date() } });
  await db.workflow.update({ where: { id: workflowId }, data: { status: "CANCELLED" } });
  const empIds = (await db.task.findMany({ where: { workflowId }, select: { employeeId: true } })).map((t) => t.employeeId);
  await db.aIEmployee.updateMany({ where: { id: { in: empIds }, status: { in: ["WAITING_APPROVAL", "ERROR"] } }, data: { status: "IDLE" } });
  await logActivity(db, companyId, { actorType: "USER", actorId: userId, actorName: "You", action: "workflow.cancelled", message: `「${wf.title}」をキャンセルしました`, targetType: "workflow", targetId: wf.id });
}
