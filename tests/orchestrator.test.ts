import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { createWorkflow, decideApproval, runQueue } from "@/server/orchestrator/engine";
import { toWireName } from "@/server/ai/types";
import { createEmployee, makeCompany, useScriptedAI } from "./helpers";

async function reload(db: Awaited<ReturnType<typeof makeCompany>>["db"], workflowId: string) {
  return db.workflow.findUniqueOrThrow({
    where: { id: workflowId },
    include: { tasks: { orderBy: { step: "asc" }, include: { toolCalls: true, approvals: true } }, reports: true },
  });
}

describe("orchestrator", () => {
  beforeEach(async () => {
    // Keep each test's queue independent of leftovers from other tests.
    await prisma.task.updateMany({ where: { status: { in: ["PENDING", "WAITING"] } }, data: { status: "CANCELLED" } });
    await prisma.workflow.updateMany({ where: { status: "PLANNING" }, data: { status: "CANCELLED" } });
  });

  it("plans a chain, runs employees with tools, pauses for approval, resumes, and reports", async () => {
    const { db, company, user } = await makeCompany("Orch");
    const researcher = await createEmployee(db, company.id, { templateKey: "market_researcher" });
    const marketer = await createEmployee(db, company.id, { templateKey: "marketing_manager" });
    // Make the marketer's memory writes approval-gated to exercise the approval path with a builtin tool.
    await db.employeeToolPermission.create({ data: { companyId: company.id, employeeId: marketer.id, tool: "memory.save", policy: "REQUIRE_APPROVAL" } });

    const calls = await useScriptedAI(company.id, (req) => {
      const last = req.messages[req.messages.length - 1];
      if (req.json) {
        return {
          text: JSON.stringify({
            title: "競合調査と施策",
            steps: [
              { employeeId: researcher.id, title: "競合調査", instructions: "競合3社を調査" },
              { employeeId: "not-a-real-id", title: "ghost", instructions: "x" },
              { employeeId: marketer.id, title: "施策立案", instructions: "施策を作る" },
            ],
          }),
        };
      }
      const isResearcher = req.system.includes("Market Researcher");
      if (isResearcher) {
        if (last.role === "user") {
          return { text: "調査します", toolCalls: [{ id: "c1", name: toWireName("report.create"), input: { title: "競合調査レポート", summary: "3社を比較", content: "# 結果\n- A社\n- B社" } }] };
        }
        return { text: "競合A社は価格が強み。" };
      }
      // Marketer
      if (last.role === "user") {
        expect(last.content).toContain("<untrusted_data");
        expect(last.content).toContain("競合A社は価格が強み。");
        return { toolCalls: [{ id: "m1", name: toWireName("memory.save"), input: { title: "施策方針", content: "価格以外で差別化", kind: "decision" } }] };
      }
      if (last.role === "tool") return { text: "## 施策\n1. ブランド訴求を強化" };
      return { text: "done" };
    });

    const wf = await createWorkflow(db, company.id, { request: "競合他社を調査して新しいマーケティング施策を考えて", userId: user.id });
    await runQueue({ budgetMs: 20_000 });

    let state = await reload(db, wf.id);
    expect(state.status).toBe("WAITING_APPROVAL");
    expect(state.tasks).toHaveLength(2);
    expect(state.tasks[0].status).toBe("COMPLETED");
    expect(state.tasks[0].toolCalls[0].status).toBe("SUCCEEDED");
    expect(state.tasks[1].status).toBe("APPROVAL_REQUIRED");
    const approval = state.tasks[1].approvals[0];
    expect(approval.status).toBe("PENDING");
    expect(await db.companyMemory.count({ where: { title: "施策方針" } })).toBe(0); // not executed before approval

    await decideApproval(db, company.id, { approvalId: approval.id, decision: "APPROVED", userId: user.id });
    await runQueue({ budgetMs: 20_000 });

    state = await reload(db, wf.id);
    expect(state.status).toBe("COMPLETED");
    expect(state.tasks[1].status).toBe("COMPLETED");
    expect(state.tasks[1].result).toContain("ブランド訴求");
    expect(await db.companyMemory.count({ where: { title: "施策方針" } })).toBe(1);
    expect(state.reports.map((r) => r.kind).sort()).toEqual(["task", "workflow"]);
    expect(await db.usageRecord.count({ where: { companyId: company.id } })).toBe(calls.length);
    expect(await db.activityLog.count({ where: { companyId: company.id, action: "approval.approved" } })).toBe(1);
    expect(await db.notification.count({ where: { companyId: company.id, type: "approval_required" } })).toBe(1);

    // Approving twice is refused.
    await expect(decideApproval(db, company.id, { approvalId: approval.id, decision: "APPROVED", userId: user.id })).rejects.toThrow();
  });

  it("a rejected action is reported back to the employee and never executed", async () => {
    const { db, company, user } = await makeCompany("Reject");
    const emp = await createEmployee(db, company.id, { templateKey: "ceo_assistant" });
    await db.employeeToolPermission.create({ data: { companyId: company.id, employeeId: emp.id, tool: "memory.save", policy: "REQUIRE_APPROVAL" } });
    await useScriptedAI(company.id, (req) => {
      const last = req.messages[req.messages.length - 1];
      if (last.role === "user") return { toolCalls: [{ id: "x1", name: toWireName("memory.save"), input: { title: "T", content: "C" } }] };
      if (last.role === "tool") {
        expect(last.results[0].isError).toBe(true);
        expect(last.results[0].content).toContain("rejected");
        return { text: "承認されなかったため記録しませんでした。" };
      }
      return { text: "?" };
    });
    const wf = await createWorkflow(db, company.id, { request: "決定を記録して", targetEmployeeId: emp.id, userId: user.id });
    await runQueue({ budgetMs: 20_000 });
    const approval = await db.approval.findFirstOrThrow({ where: { companyId: company.id } });
    await decideApproval(db, company.id, { approvalId: approval.id, decision: "REJECTED", userId: user.id, reason: "不要" });
    await runQueue({ budgetMs: 20_000 });
    const state = await reload(db, wf.id);
    expect(state.status).toBe("COMPLETED");
    expect(state.tasks[0].toolCalls[0].status).toBe("REJECTED");
    expect(await db.companyMemory.count({ where: { title: "T" } })).toBe(0);
  });

  it("denies tools the employee has no permission for, without asking the model's opinion", async () => {
    const { db, company, user } = await makeCompany("Deny");
    const emp = await createEmployee(db, company.id, { templateKey: "sales_manager" });
    await useScriptedAI(company.id, (req) => {
      const last = req.messages[req.messages.length - 1];
      // The model tries a tool it was never offered (Gmail is not connected).
      if (last.role === "user") {
        expect(req.tools?.some((t) => t.name.startsWith("gmail"))).toBe(false);
        return { toolCalls: [{ id: "g1", name: toWireName("gmail.send"), input: { to: ["a@b.co"], subject: "hi", body: "x" } }] };
      }
      return { text: "Gmail が使えないため下書きのみ作成しました。" };
    });
    const wf = await createWorkflow(db, company.id, { request: "営業メールを送って", targetEmployeeId: emp.id, userId: user.id });
    await runQueue({ budgetMs: 20_000 });
    const state = await reload(db, wf.id);
    expect(state.status).toBe("COMPLETED");
    expect(state.tasks[0].toolCalls[0].status).toBe("DENIED");
    expect(await db.approval.count({ where: { companyId: company.id } })).toBe(0);
  });

  it("fails clearly when no AI is connected, and enforces usage limits", async () => {
    const { db, company, user } = await makeCompany("NoAI");
    const emp = await createEmployee(db, company.id, { templateKey: "ceo_assistant" });
    const wf = await createWorkflow(db, company.id, { request: "レポートを作って", targetEmployeeId: emp.id, userId: user.id });
    await runQueue({ budgetMs: 20_000 });
    let state = await reload(db, wf.id);
    expect(state.status).toBe("FAILED");
    expect(state.tasks[0].error).toContain("AIが接続されていません");
    expect(await db.notification.count({ where: { companyId: company.id, type: "error" } })).toBe(1);

    await useScriptedAI(company.id, () => ({ text: "ok" }));
    await db.usageLimit.create({ data: { companyId: company.id, dailyRequestLimit: 0 } });
    const wf2 = await createWorkflow(db, company.id, { request: "もう一度", targetEmployeeId: emp.id, userId: user.id });
    await runQueue({ budgetMs: 20_000 });
    state = await reload(db, wf2.id);
    expect(state.status).toBe("FAILED");
    expect(state.tasks[0].error).toContain("使用上限");
  });

  it("does not run work for paused employees", async () => {
    const { db, company, user } = await makeCompany("Paused");
    const emp = await createEmployee(db, company.id, { templateKey: "ceo_assistant" });
    await db.aIEmployee.update({ where: { id: emp.id }, data: { status: "PAUSED" } });
    await expect(createWorkflow(db, company.id, { request: "やって", targetEmployeeId: emp.id, userId: user.id })).rejects.toThrow("一時停止中");
  });
});
