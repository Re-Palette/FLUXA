import "server-only";
import type { Prisma, Task } from "@prisma/client";
import { prisma, type TenantDb } from "../db";
import { callAI } from "../ai/runtime";
import { AIProviderError, fromWireName, toWireName, type AgentMessage, type ToolCallRequest } from "../ai/types";
import { checkToolAccess, loadAccessProfile, toolsForEmployee, type EmployeeAccessProfile } from "../tools/permissions";
import { getTool } from "../tools/registry";
import { ToolExecutionError } from "../tools/types";
import { ConnectionError } from "../integrations/google-token";
import { logActivity, notifyCompany } from "../services/activity";
import { buildEmployeeSystemPrompt, untrusted } from "./prompts";

export const MAX_MODEL_TURNS = 10;

export type AgentOutcome =
  | { kind: "completed"; result: string }
  | { kind: "approval_required"; approvalIds: string[] }
  | { kind: "failed"; error: string };

type ToolResult = { id: string; name: string; content: string; isError?: boolean };

function asTranscript(value: Prisma.JsonValue | null): AgentMessage[] {
  return Array.isArray(value) ? (value as unknown as AgentMessage[]) : [];
}

async function saveTranscript(db: TenantDb, taskId: string, transcript: AgentMessage[]) {
  await db.task.update({ where: { id: taskId }, data: { transcript: transcript as unknown as Prisma.InputJsonValue } });
}

/** Builds the opening user message for a task: the assignment plus earlier steps' outputs as untrusted data. */
export async function buildTaskBrief(db: TenantDb, task: Task): Promise<string> {
  let brief = `## Your task\n**${task.title}**\n\n${task.description}`;
  if (task.workflowId) {
    const wf = await db.workflow.findUnique({ where: { id: task.workflowId } });
    const previous = await db.task.findMany({
      where: { workflowId: task.workflowId, step: { lt: task.step }, status: "COMPLETED" },
      orderBy: { step: "asc" },
      include: { employee: { select: { name: true, role: true } } },
    });
    if (wf && wf.request !== task.description) brief = `## Original request from the user\n${wf.request}\n\n${brief}`;
    if (previous.length) {
      brief +=
        "\n\n## Output from earlier steps (reference material)\n" +
        previous.map((p) => untrusted(`employee:${p.employee.role}`, `### ${p.title}\n${p.result ?? ""}`)).join("\n\n");
    }
  }
  return brief;
}

async function setEmployeeStatus(db: TenantDb, employeeId: string, status: "WORKING" | "THINKING" | "WAITING_APPROVAL") {
  await db.aIEmployee.updateMany({ where: { id: employeeId, status: { not: "PAUSED" } }, data: { status } });
}

/**
 * Resolves every tool call of one assistant turn. Already-decided calls are reused (never re-executed);
 * new calls pass the permission gate; approval-gated calls pause the task.
 */
async function resolveToolCalls(
  db: TenantDb,
  task: Task,
  employee: { id: string; name: string; role: string },
  profile: EmployeeAccessProfile,
  calls: ToolCallRequest[],
): Promise<{ results: ToolResult[]; pendingApprovalIds: string[] }> {
  const results: ToolResult[] = [];
  const pendingApprovalIds: string[] = [];

  for (const call of calls) {
    const toolName = fromWireName(call.name);
    const reg = getTool(toolName);
    let row = await db.toolCall.findUnique({ where: { taskId_callId: { taskId: task.id, callId: call.id } }, include: { approval: true } });

    if (!row) {
      if (!reg) {
        results.push({ id: call.id, name: call.name, content: `Unknown tool "${toolName}".`, isError: true });
        continue;
      }
      const decision = checkToolAccess(profile, reg.info);
      const parsed = reg.impl.input.safeParse(call.input);
      const base = {
        companyId: task.companyId,
        taskId: task.id,
        employeeId: employee.id,
        tool: toolName,
        callId: call.id,
        input: call.input as Prisma.InputJsonValue,
      };
      if (!decision.allowed) {
        await db.toolCall.create({ data: { ...base, status: "DENIED", error: decision.reason, completedAt: new Date() } });
        results.push({ id: call.id, name: call.name, content: `Permission denied: ${decision.reason}`, isError: true });
        continue;
      }
      if (!parsed.success) {
        const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
        await db.toolCall.create({ data: { ...base, status: "FAILED", error: `Invalid input: ${msg}`, completedAt: new Date() } });
        results.push({ id: call.id, name: call.name, content: `Invalid input: ${msg}`, isError: true });
        continue;
      }
      if (decision.requiresApproval) {
        const created = await db.toolCall.create({ data: { ...base, input: parsed.data as Prisma.InputJsonValue, status: "AWAITING_APPROVAL" } });
        const described = reg.impl.describe?.(parsed.data) ?? { title: reg.info.label, summary: JSON.stringify(parsed.data).slice(0, 600) };
        const approval = await db.approval.create({
          data: {
            companyId: task.companyId,
            taskId: task.id,
            employeeId: employee.id,
            toolCallId: created.id,
            title: described.title,
            summary: described.summary,
            payload: parsed.data as Prisma.InputJsonValue,
            riskTags: reg.info.riskTags,
          },
        });
        pendingApprovalIds.push(approval.id);
        continue;
      }
      row = { ...(await db.toolCall.create({ data: { ...base, input: parsed.data as Prisma.InputJsonValue, status: "PENDING" } })), approval: null };
    }

    switch (row.status) {
      case "AWAITING_APPROVAL":
        if (row.approval) pendingApprovalIds.push(row.approval.id);
        continue;
      case "SUCCEEDED":
        results.push({ id: call.id, name: call.name, content: untrusted(toolName, String((row.output as { content?: string } | null)?.content ?? "")) });
        continue;
      case "REJECTED":
        results.push({ id: call.id, name: call.name, content: `The user rejected this action. ${row.error ?? ""} Do not retry it; continue without it or explain the alternative.`, isError: true });
        continue;
      case "DENIED":
      case "FAILED":
        results.push({ id: call.id, name: call.name, content: `Tool failed: ${row.error ?? "unknown error"}`, isError: true });
        continue;
      case "RUNNING":
        // A previous run died mid-execution. The call may have had side effects, so never re-run it.
        await db.toolCall.update({ where: { id: row.id }, data: { status: "FAILED", error: "Interrupted; not retried to avoid duplicate side effects", completedAt: new Date() } });
        results.push({ id: call.id, name: call.name, content: "Tool execution was interrupted and was not retried.", isError: true });
        continue;
      case "PENDING": {
        if (!reg) {
          results.push({ id: call.id, name: call.name, content: `Unknown tool "${toolName}".`, isError: true });
          continue;
        }
        // Re-check permissions at execution time (they may have changed while awaiting approval).
        const decision = checkToolAccess(profile, reg.info);
        const approved = row.approval?.status === "APPROVED";
        if (!decision.allowed || (decision.requiresApproval && !approved)) {
          const reason = decision.allowed ? "approval missing" : decision.reason;
          await db.toolCall.update({ where: { id: row.id }, data: { status: "DENIED", error: reason, completedAt: new Date() } });
          results.push({ id: call.id, name: call.name, content: `Permission denied: ${reason}`, isError: true });
          continue;
        }
        const claimed = await db.toolCall.updateMany({ where: { id: row.id, status: "PENDING" }, data: { status: "RUNNING" } });
        if (claimed.count !== 1) {
          results.push({ id: call.id, name: call.name, content: "Tool call already handled elsewhere.", isError: true });
          continue;
        }
        await setEmployeeStatus(db, employee.id, "WORKING");
        try {
          const out = await reg.impl.execute(
            { db, companyId: task.companyId, employee, taskId: task.id, workflowId: task.workflowId },
            reg.impl.input.parse(row.input),
          );
          await db.toolCall.update({
            where: { id: row.id },
            data: { status: "SUCCEEDED", output: { content: out.content, data: (out.data ?? null) as Prisma.InputJsonValue }, completedAt: new Date() },
          });
          await logActivity(db, task.companyId, {
            actorType: "EMPLOYEE",
            actorId: employee.id,
            actorName: employee.role,
            action: "tool.used",
            message: `${employee.role} used ${reg.info.label}`,
            targetType: "task",
            targetId: task.id,
          });
          results.push({ id: call.id, name: call.name, content: untrusted(toolName, out.content) });
        } catch (err) {
          const message =
            err instanceof ToolExecutionError || err instanceof ConnectionError ? err.message : "ツールの実行中にエラーが発生しました";
          if (!(err instanceof ToolExecutionError || err instanceof ConnectionError)) console.error("tool execution failed", { tool: toolName, error: (err as Error).message });
          await db.toolCall.update({ where: { id: row.id }, data: { status: "FAILED", error: message, completedAt: new Date() } });
          results.push({ id: call.id, name: call.name, content: `Tool failed: ${message}`, isError: true });
        }
        continue;
      }
    }
  }
  return { results, pendingApprovalIds };
}

/**
 * Runs (or resumes) one employee's work on a task: model turn → tools → model turn … until done,
 * paused for approval, or failed. The transcript is persisted after every step so the loop can resume.
 */
export async function runTaskAgent(db: TenantDb, task: Task): Promise<AgentOutcome> {
  const employee = await db.aIEmployee.findUnique({ where: { id: task.employeeId }, include: { responsibilities: true } });
  if (!employee) return { kind: "failed", error: "担当のAI社員が見つかりません" };
  const company = await prisma.company.findUniqueOrThrow({ where: { id: task.companyId } });
  const memories = await db.companyMemory.findMany({
    where: { companyId: task.companyId, OR: [{ pinned: true }, { kind: { in: ["profile", "mission", "goal", "brand", "preference", "instruction"] } }] },
    orderBy: [{ pinned: "desc" }, { importance: "desc" }, { updatedAt: "desc" }],
    take: 12,
  });
  const profile = await loadAccessProfile(db, task.companyId, employee.id);
  const tools = toolsForEmployee(profile);
  const system = buildEmployeeSystemPrompt({
    employee,
    company,
    memories,
    tools: tools.map((t) => ({ name: toWireName(t.info.name), label: t.info.label, requiresApproval: t.requiresApproval })),
  });
  const toolSpecs = tools.map((t) => ({ name: toWireName(t.info.name), description: t.impl.description, inputSchema: t.jsonSchema }));
  const who = { id: employee.id, name: employee.name, role: employee.role };

  const transcript = asTranscript(task.transcript);
  if (transcript.length === 0) {
    transcript.push({ role: "user", content: await buildTaskBrief(db, task) });
    await saveTranscript(db, task.id, transcript);
  }

  let nudged = false;
  let modelTurns = 0;
  for (;;) {
    const last = transcript[transcript.length - 1];

    // Resume point: an assistant turn whose tool calls are not yet answered.
    if (last.role === "assistant" && last.toolCalls.length > 0) {
      const { results, pendingApprovalIds } = await resolveToolCalls(db, task, who, profile, last.toolCalls);
      if (pendingApprovalIds.length > 0) {
        await saveTranscript(db, task.id, transcript);
        return { kind: "approval_required", approvalIds: pendingApprovalIds };
      }
      transcript.push({ role: "tool", results });
      await saveTranscript(db, task.id, transcript);
      continue;
    }

    if (last.role === "assistant") {
      // Finished turn with no tool calls.
      if (last.text.trim()) return { kind: "completed", result: last.text.trim() };
      if (nudged) return { kind: "failed", error: "AI社員が成果物を返しませんでした" };
      nudged = true;
      transcript.push({ role: "user", content: "Please provide your final deliverable now, in Markdown." });
      continue;
    }

    if (modelTurns++ >= MAX_MODEL_TURNS) break;
    await setEmployeeStatus(db, employee.id, "THINKING");
    let res;
    try {
      res = await callAI(
        db,
        { companyId: task.companyId, purpose: "employee", employeeId: employee.id, taskId: task.id, modelRef: employee.model },
        { system, messages: transcript, tools: toolSpecs },
      );
    } catch (err) {
      if (err instanceof AIProviderError) return { kind: "failed", error: err.message };
      throw err;
    }
    if (res.stopReason === "refusal") {
      return { kind: "failed", error: "AIがこの依頼への対応を辞退しました。依頼内容を見直してください。" };
    }
    transcript.push({
      role: "assistant",
      text: res.text,
      toolCalls: res.toolCalls,
      raw: res.raw !== undefined ? { provider: res.providerId, model: res.model, content: res.raw } : undefined,
    });
    await saveTranscript(db, task.id, transcript);
    await setEmployeeStatus(db, employee.id, "WORKING");
  }
  return { kind: "failed", error: `処理が上限回数 (${MAX_MODEL_TURNS}) を超えました` };
}

export async function notifyApprovalNeeded(db: TenantDb, companyId: string, employeeRole: string, approvalCount: number) {
  await notifyCompany(db, companyId, {
    type: "approval_required",
    title: `${employeeRole} が承認を待っています`,
    body: `${approvalCount} 件のアクションがあなたの承認待ちです。`,
    link: "/app/approvals",
  });
}
