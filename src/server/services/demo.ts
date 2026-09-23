import "server-only";
import type { EmployeeStatus, Prisma } from "@prisma/client";
import { prisma, tenantDb } from "../db";
import { createEmployee } from "./employees";
import { syncProfileMemory } from "./companies";
import { isLocalApp } from "../env";
import { IN_MEMORY_DB } from "../memory-db";
import { createHmac } from "node:crypto";
import { hashPassword, verifyPassword } from "../auth/password";

/** The shared demo account. Its company holds sample data only (no connected services, no credentials). */
export const DEMO_EMAIL = "demo@fluxa.demo";
export const DEMO_NAME = "デモ ユーザー";
/** Public by design: only usable while demo login is enabled (never on a real deployment by default). */
export const DEMO_PASSWORD = "fluxa-demo-2026";

export function demoLoginEnabled(): boolean {
  if (IN_MEMORY_DB) return true; // memory-db: nothing real can exist in a throwaway in-memory database
  if (process.env.DEMO_LOGIN === "true") return true;
  if (process.env.DEMO_LOGIN === "false") return false;
  return process.env.NODE_ENV !== "production" || isLocalApp();
}

const PROFILE = {
  name: "Re-Palette Inc.（デモ）",
  industry: "Beauty",
  size: "1–10",
  description: "美容サロン向けのヘアケアブランドと EC サイトを運営しています。主な顧客は 20〜40 代の女性とサロン経営者です。",
  goal: "美容を通じて、すべての人に自信と居場所を提供する。今期は EC 売上を前年比 150% にする。",
  website: "https://example.com",
};

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000);

const RESEARCH_REPORT = `# 競合調査レポート（サンプル）

## 対象
- ブランド A（大手・ドラッグストア中心）
- ブランド B（D2C・SNS 発）
- ブランド C（サロン専売）

## 主な発見
| 項目 | A | B | C |
|---|---|---|---|
| 価格帯 | 低 | 中 | 高 |
| 主なチャネル | 店頭 | Instagram / TikTok | サロン |
| 強み | 認知・流通 | 世界観とコミュニティ | 専門性 |

1. **B 社は UGC（ユーザー投稿）を中心に成長**。レビュー投稿でクーポンを配布している。
2. **C 社はサロンでの体験から EC へ送客**。当社のサロン網と重なる。
3. どの競合も「サロン経営者向け」の情報発信は弱い。

## 示唆
- 当社はサロン向けの B2B 情報発信で差別化できる余地が大きい。

> これはデモ用のサンプルデータです。`;

const PLAN_REPORT = `# マーケティング施策案（サンプル）

## 目標
EC 売上を前年比 150% に。

## 施策
1. **サロン連動キャンペーン** — 来店客に EC 限定のトライアルセットを案内（QR コード）。
2. **UGC プログラム** — 購入者のビフォーアフター投稿に次回 10% オフ。
3. **サロン経営者向けニュースレター** — 月 1 回、トレンドと売上改善のヒントを配信。

## KPI
- EC 新規購入者数：月 +300 人
- サロン経由の EC 流入：全体の 25%

## 次のアクション
- 既存サロン 50 店舗に案内メールを送る（**承認待ち**）

> これはデモ用のサンプルデータです。`;

const SALES_REPORT = `# 週次営業レポート（サンプル）

- 新規リード：18 件（前週比 +20%）
- 商談化：6 件
- 受注：2 件（サロン 2 店舗、月額契約）

## 注目
- 美容専門学校からの問い合わせが増加。教育機関向けプランの検討を推奨。

> これはデモ用のサンプルデータです。`;

async function buildDemoCompany(userId: string) {
  // Fixed ids keep links valid across server instances (each in-memory instance rebuilds the same demo).
  const company = await prisma.company.create({
    data: { id: "demo_company", ...PROFILE, status: "ACTIVE", onboardingStep: 6, launchedAt: ago(60 * 24 * 3) },
  });
  await prisma.companyMember.create({ data: { companyId: company.id, userId, role: "OWNER" } });
  const free = await prisma.plan.findUnique({ where: { key: "free" } });
  if (free) await prisma.subscription.create({ data: { companyId: company.id, planKey: free.key } });
  await syncProfileMemory(company.id, PROFILE);

  const db = tenantDb(company.id);
  const cid = company.id;
  const keys = ["ceo_assistant", "market_researcher", "marketing_manager", "sns_manager", "sales_manager", "finance_manager"];
  const emp: Record<string, { id: string; role: string }> = {};
  for (const k of keys) {
    const e = await createEmployee(db, cid, { id: `demo_emp_${k}`, templateKey: k });
    emp[k] = { id: e.id, role: e.role };
  }
  const statuses: Record<string, EmployeeStatus> = {
    ceo_assistant: "IDLE",
    market_researcher: "COMPLETED",
    marketing_manager: "WAITING_APPROVAL",
    sns_manager: "IDLE",
    sales_manager: "COMPLETED",
    finance_manager: "PAUSED",
  };
  for (const [k, s] of Object.entries(statuses)) await db.aIEmployee.update({ where: { id: emp[k].id }, data: { status: s } });

  // Workflow 1: research → marketing plan, waiting for approval on an outbound email.
  const wf1 = await db.workflow.create({
    data: { id: "demo_wf_research",
      companyId: cid,
      request: "競合他社を調査して、新しいマーケティング施策を考えて",
      title: "競合調査とマーケティング施策",
      status: "WAITING_APPROVAL",
      createdById: userId,
      createdAt: ago(95),
      plan: { title: "競合調査とマーケティング施策", steps: [] } as Prisma.InputJsonValue,
    },
  });
  const t1 = await db.task.create({
    data: { id: "demo_task_research",
      companyId: cid, workflowId: wf1.id, employeeId: emp.market_researcher.id, step: 0,
      title: "競合3社の調査", description: "主要な競合3社の価格・チャネル・強みを比較する",
      status: "COMPLETED", result: RESEARCH_REPORT, createdAt: ago(94), startedAt: ago(94), completedAt: ago(80),
    },
  });
  const t2 = await db.task.create({
    data: { id: "demo_task_plan",
      companyId: cid, workflowId: wf1.id, employeeId: emp.marketing_manager.id, step: 1,
      title: "施策の立案", description: "調査結果をもとに、EC 売上を伸ばす施策を3つ提案する",
      status: "APPROVAL_REQUIRED", approvalRequired: true, result: null, createdAt: ago(94), startedAt: ago(79),
    },
  });
  await db.task.create({
    data: {
      companyId: cid, workflowId: wf1.id, employeeId: emp.ceo_assistant.id, step: 2,
      title: "最終レビュー", description: "施策案をレビューし、優先順位をつける", status: "WAITING", createdAt: ago(94),
    },
  });
  await db.report.create({
    data: { id: "demo_report_research", companyId: cid, employeeId: emp.market_researcher.id, taskId: t1.id, workflowId: wf1.id, title: "競合調査レポート", kind: "task", summary: "競合3社を比較。サロン経営者向けの情報発信に差別化の余地。", content: RESEARCH_REPORT, createdAt: ago(80) },
  });
  await db.report.create({
    data: { id: "demo_report_plan", companyId: cid, employeeId: emp.marketing_manager.id, taskId: t2.id, workflowId: wf1.id, title: "マーケティング施策案", kind: "task", summary: "サロン連動キャンペーン・UGC プログラム・経営者向けニュースレターの3施策。", content: PLAN_REPORT, createdAt: ago(70) },
  });
  const payload = {
    to: ["salon-a@example.com", "salon-b@example.com", "salon-c@example.com"],
    subject: "【ご案内】EC 限定トライアルセットのご紹介",
    body: "いつもお世話になっております。Re-Palette です。\n\n来店されたお客様向けに、EC 限定のトライアルセットをご用意しました。店頭で QR コードをご案内いただくだけで、サロン様にも紹介報酬をお支払いします。\n\nご不明点がございましたらお気軽にご返信ください。",
  };
  const call = await db.toolCall.create({
    data: { id: "demo_call_email", companyId: cid, taskId: t2.id, employeeId: emp.marketing_manager.id, tool: "gmail.send", callId: "demo-call-1", input: payload, status: "AWAITING_APPROVAL", createdAt: ago(68) },
  });
  await db.approval.create({
    data: {
      id: "demo_approval_email",
      companyId: cid, taskId: t2.id, employeeId: emp.marketing_manager.id, toolCallId: call.id,
      title: `メール「${payload.subject}」を 3 件の宛先に送信`,
      summary: `宛先: ${payload.to.join(", ")}\n\n${payload.body}`,
      payload, riskTags: ["email"], createdAt: ago(68),
    },
  });

  // Workflow 2: completed weekly sales report.
  const wf2 = await db.workflow.create({
    data: { id: "demo_wf_sales", companyId: cid, request: "今週の営業レポートを作成して", title: "週次営業レポート", status: "COMPLETED", createdById: userId, targetEmployeeId: emp.sales_manager.id, createdAt: ago(60 * 26), completedAt: ago(60 * 25), finalResult: SALES_REPORT },
  });
  const t3 = await db.task.create({
    data: { id: "demo_task_sales", companyId: cid, workflowId: wf2.id, employeeId: emp.sales_manager.id, step: 0, title: "週次営業レポートの作成", description: "今週の営業活動をまとめる", status: "COMPLETED", result: SALES_REPORT, createdAt: ago(60 * 26), startedAt: ago(60 * 26), completedAt: ago(60 * 25) },
  });
  await db.report.create({
    data: { id: "demo_report_sales", companyId: cid, employeeId: emp.sales_manager.id, taskId: t3.id, workflowId: wf2.id, title: "週次営業レポート", kind: "workflow", summary: "新規リード18件、受注2件。教育機関向けプランの検討を推奨。", content: SALES_REPORT, createdAt: ago(60 * 25) },
  });

  await db.companyMemory.createMany({
    data: [
      { companyId: cid, kind: "brand", title: "トーン＆マナー", content: "親しみやすく、専門的すぎない言葉で。誇張表現（「絶対」「100%」）は使わない。", source: "user", pinned: true, importance: 4 },
      { companyId: cid, kind: "decision", title: "価格競争はしない", content: "値下げではなく、サロン体験と専門性で差別化する。", source: "employee", importance: 3 },
    ],
  });
  await db.schedule.create({
    data: { companyId: cid, employeeId: emp.ceo_assistant.id, name: "週次会社レポート", cron: "0 9 * * 1", timezone: "Asia/Tokyo", instruction: "今週の会社全体の活動をまとめ、完了タスク・重要な発見・次のアクションを含むレポートを作成して", nextRunAt: new Date(Date.now() + 3 * 86_400_000) },
  });

  const log = (m: number, actorType: "USER" | "EMPLOYEE" | "SYSTEM", actorName: string, action: string, message: string, targetType?: string, targetId?: string) => ({
    companyId: cid, actorType, actorName, action, message, targetType, targetId, createdAt: ago(m),
  });
  await db.activityLog.createMany({
    data: [
      log(60 * 72, "SYSTEM", "FLUXA", "company.launched", "Re-Palette Inc. の AI 会社が起動しました（AI社員 6 名）"),
      log(60 * 26, "USER", "You", "workflow.created", "新しい依頼: 今週の営業レポートを作成して", "workflow", wf2.id),
      log(60 * 25, "EMPLOYEE", "Sales Manager", "task.completed", "Sales Manager が「週次営業レポートの作成」を完了しました", "workflow", wf2.id),
      log(95, "USER", "You", "workflow.created", "新しい依頼: 競合他社を調査して、新しいマーケティング施策を考えて", "workflow", wf1.id),
      log(94, "SYSTEM", "Orchestrator", "workflow.planned", "「競合調査とマーケティング施策」を 3 ステップに分解: Market Researcher → Marketing Manager → CEO Assistant", "workflow", wf1.id),
      log(94, "EMPLOYEE", "Market Researcher", "task.started", "Market Researcher が「競合3社の調査」を開始しました", "workflow", wf1.id),
      log(80, "EMPLOYEE", "Market Researcher", "task.completed", "Market Researcher が「競合3社の調査」を完了しました", "workflow", wf1.id),
      log(79, "SYSTEM", "Orchestrator", "task.handoff", "Market Researcher の成果を Marketing Manager に引き継ぎました", "workflow", wf1.id),
      log(70, "EMPLOYEE", "Marketing Manager", "tool.used", "Marketing Manager used レポート作成", "workflow", wf1.id),
      log(68, "EMPLOYEE", "Marketing Manager", "approval.requested", "Marketing Manager が承認を求めています（1 件）", "approval", undefined),
      log(30, "USER", "You", "employee.paused", "Finance Manager を一時停止しました", "employee", emp.finance_manager.id),
    ],
  });
  await db.notification.createMany({
    data: [
      { companyId: cid, userId, type: "approval_required", title: "Marketing Manager が承認を待っています", body: "1 件のアクションがあなたの承認待ちです。", link: "/app/approvals", createdAt: ago(68) },
      { companyId: cid, userId, type: "report_ready", title: "「週次営業レポート」が完了しました", body: "成果物がレポートに保存されました。", link: "/app/reports", createdAt: ago(60 * 25), readAt: ago(60 * 24) },
    ],
  });
  await db.usageRecord.createMany({
    data: [
      { companyId: cid, provider: "anthropic", model: "claude-opus-5", purpose: "plan", inputTokens: 2100, outputTokens: 420, costMicroUsd: 21_000, createdAt: ago(94) },
      { companyId: cid, provider: "anthropic", model: "claude-opus-5", purpose: "employee", inputTokens: 18_400, outputTokens: 3_900, costMicroUsd: 189_500, createdAt: ago(80) },
      { companyId: cid, provider: "anthropic", model: "claude-opus-5", purpose: "employee", inputTokens: 12_200, outputTokens: 2_600, costMicroUsd: 126_000, createdAt: ago(68) },
    ],
  });
  return company;
}

/** Returns the demo user id, creating the demo user and a fully populated sample company on first use. */
let ensuring: Promise<string> | null = null;

export function ensureDemoAccount(): Promise<string> {
  // Serialize within this process so concurrent first requests don't build the demo twice.
  ensuring ??= ensureDemoAccountOnce().finally(() => {
    ensuring = null;
  });
  return ensuring;
}

async function ensureDemoAccountOnce(): Promise<string> {
  let user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    create: { id: "demo_user", email: DEMO_EMAIL, name: DEMO_NAME, passwordHash: await hashPassword(DEMO_PASSWORD) },
    update: {},
  });
  if (!user.passwordHash || !(await verifyPassword(DEMO_PASSWORD, user.passwordHash))) {
    user = await prisma.user.update({ where: { id: user.id }, data: { name: DEMO_NAME, passwordHash: await hashPassword(DEMO_PASSWORD) } });
  }
  const hasCompany = await prisma.companyMember.count({ where: { userId: user.id } });
  if (!hasCompany) await buildDemoCompany(user.id);
  return user.id;
}

/** Deletes the demo companies and recreates fresh sample data. */
export async function resetDemoAccount(): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (user) {
    const memberships = await prisma.companyMember.findMany({ where: { userId: user.id }, select: { companyId: true } });
    await prisma.company.deleteMany({ where: { id: { in: memberships.map((m) => m.companyId) } } });
  }
  await ensureDemoAccount();
}

/**
 * memory-db: a stateless demo session token. Each in-memory server instance has its own sessions table, so the
 * session layer recognises this token and recreates the demo session on whichever instance receives it.
 */
export function demoSessionToken(): string {
  const secret = process.env.AUTH_SECRET || "fluxa-in-memory-demo";
  return "demo." + createHmac("sha256", secret).update("fluxa-demo-session").digest("base64url");
}
