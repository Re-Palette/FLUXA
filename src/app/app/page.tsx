import Link from "next/link";
import { AlertTriangle, ArrowRight, Bot, CheckCircle2, CheckSquare, FileText, ListTodo, Plug, Plus, TrendingUp } from "lucide-react";
import { requireCompany } from "@/server/auth/guards";
import { startOfDay } from "@/server/ai/runtime";
import { departmentJa } from "@/lib/catalog";
import { TASK_STATUS } from "@/lib/status";
import { daysAgo, formatTime, timeAgo } from "@/lib/format";
import { EmployeeAvatar } from "@/components/employees/avatar";
import { EmployeeStatus } from "@/components/employees/status-badge";
import { RequestBox } from "@/components/work/request-box";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar, ProgressRing } from "@/components/ui/progress";

export const metadata = { title: "Overview" };

function greeting() {
  const h = Number(new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "Asia/Tokyo" }));
  return h < 11 ? "おはようございます" : h < 18 ? "こんにちは" : "こんばんは";
}

export default async function OverviewPage({ searchParams }: PageProps<"/app">) {
  const sp = await searchParams;
  const { db, company, user } = await requireCompany();
  const cid = company.id;
  const weekAgo = daysAgo(7);

  const [employees, running, completedToday, pendingApprovals, reportsCount, integrations, recentReports, activity, weekTasks] = await Promise.all([
    db.aIEmployee.findMany({
      where: { companyId: cid },
      orderBy: { createdAt: "asc" },
      include: {
        tasks: { where: { status: { in: ["RUNNING", "APPROVAL_REQUIRED", "PENDING"] } }, orderBy: { updatedAt: "desc" }, take: 1, select: { title: true, status: true, workflowId: true } },
        _count: { select: { tasks: { where: { status: "COMPLETED", completedAt: { gte: weekAgo } } } } },
      },
    }),
    db.task.count({ where: { companyId: cid, status: { in: ["RUNNING", "PENDING", "APPROVAL_REQUIRED"] } } }),
    db.task.count({ where: { companyId: cid, status: "COMPLETED", completedAt: { gte: startOfDay() } } }),
    db.approval.count({ where: { companyId: cid, status: "PENDING" } }),
    db.report.count({ where: { companyId: cid } }),
    db.integration.findMany({ where: { companyId: cid, status: "CONNECTED" }, select: { provider: true } }),
    db.report.findMany({ where: { companyId: cid }, orderBy: { createdAt: "desc" }, take: 5, include: { employee: { select: { role: true, department: true } } } }),
    db.activityLog.findMany({ where: { companyId: cid }, orderBy: { createdAt: "desc" }, take: 8 }),
    db.task.groupBy({ by: ["status"], where: { companyId: cid, createdAt: { gte: weekAgo } }, _count: true }),
  ]);

  const active = employees.filter((e) => e.status !== "PAUSED").length;
  const hasAI = integrations.some((i) => ["anthropic", "openai", "gemini"].includes(i.provider));
  const weekTotal = weekTasks.filter((g) => g.status !== "CANCELLED").reduce((a, g) => a + g._count, 0);
  const weekDone = weekTasks.find((g) => g.status === "COMPLETED")?._count ?? 0;
  const progress = weekTotal ? Math.round((weekDone / weekTotal) * 100) : 0;
  const maxWeekly = Math.max(1, ...employees.map((e) => e._count.tasks));
  const firstName = user.name?.split(/\s+/)[0] ?? "";

  const kpis = [
    { label: "稼働中のAI社員", en: "Active AI Employees", value: active, icon: Bot, href: "/app/employees" },
    { label: "進行中のタスク", en: "Running Tasks", value: running, icon: ListTodo, href: "/app/tasks" },
    { label: "本日の完了", en: "Completed Today", value: completedToday, icon: CheckCircle2, href: "/app/tasks?status=COMPLETED" },
    { label: "承認待ち", en: "Pending Approvals", value: pendingApprovals, icon: CheckSquare, href: "/app/approvals", highlight: pendingApprovals > 0 },
    { label: "レポート", en: "Reports", value: reportsCount, icon: FileText, href: "/app/reports" },
    { label: "連携サービス", en: "Connected Services", value: integrations.length, icon: Plug, href: "/app/connections" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {greeting()}{firstName ? `、${firstName}さん` : ""}
          </h1>
          <p className="mt-1 text-sm text-muted">今日も FLUXA が、あなたの会社をサポートします。</p>
        </div>
        <p className="text-xs text-faint tabular-nums">{new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", timeZone: "Asia/Tokyo" })}</p>
      </div>

      {sp.launched ? (
        <div className="rounded-xl border border-accent/40 bg-accent-soft/40 px-4 py-3 text-sm">🚀 AI 会社が起動しました。下のボックスから最初の仕事を依頼してみましょう。</div>
      ) : null}
      {!hasAI ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <span className="flex-1">AI が接続されていないため、AI社員はまだ仕事を実行できません。</span>
          <ButtonLink href="/app/connections" size="sm">
            Connect Claude
          </ButtonLink>
        </div>
      ) : null}

      <RequestBox employees={employees.map((e) => ({ id: e.id, role: e.role, paused: e.status === "PAUSED" }))} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => (
          <Link key={k.en} href={k.href} className={`panel group p-4 transition-colors hover:border-line-strong ${k.highlight ? "border-warning/40" : ""}`}>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted">{k.label}</p>
              <k.icon className={`h-4 w-4 ${k.highlight ? "text-warning" : "text-faint group-hover:text-accent"}`} />
            </div>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{k.value}</p>
            <p className="mt-1 text-[10px] tracking-wide text-faint">{k.en}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr_1fr]">
        <Card>
          <CardHeader
            title="AI社員の活動状況"
            description="AI Employee Overview"
            action={
              <ButtonLink href="/app/employees/new" size="sm" variant="secondary">
                <Plus className="h-3.5 w-3.5" /> Add AI Employee
              </ButtonLink>
            }
          />
          <CardBody className="pt-3">
            {employees.length === 0 ? (
              <EmptyState icon={<Bot className="h-5 w-5" />} title="Your AI company has no employees yet." action={<ButtonLink href="/app/employees/new">Add AI Employee</ButtonLink>} />
            ) : (
              <ul className="divide-y divide-line">
                {employees.map((e) => {
                  const current = e.tasks[0];
                  return (
                    <li key={e.id}>
                      <Link href={`/app/employees/${e.id}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-panel-hover">
                        <EmployeeAvatar department={e.department} size={38} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium">{e.role}</p>
                            <EmployeeStatus status={e.status} english />
                          </div>
                          <p className="truncate text-xs text-muted">{current ? `${TASK_STATUS[current.status]?.label}: ${current.title}` : departmentJa(e.department)}</p>
                        </div>
                        <div className="hidden w-28 sm:block">
                          <ProgressBar value={(e._count.tasks / maxWeekly) * 100} />
                          <p className="mt-1 text-right text-[10px] text-faint">今週 {e._count.tasks} 件完了</p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="最近の成果物" description="Reports" action={<Link href="/app/reports" className="text-xs text-muted hover:text-accent">すべて見る</Link>} />
          <CardBody className="pt-3">
            {recentReports.length === 0 ? (
              <EmptyState icon={<FileText className="h-5 w-5" />} title="Your first AI report will appear here." description="仕事を依頼すると、成果物がここに届きます。" />
            ) : (
              <ul className="space-y-1">
                {recentReports.map((r) => (
                  <li key={r.id}>
                    <Link href={`/app/reports/${r.id}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-panel-hover">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
                        <FileText className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{r.title}</span>
                        <span className="block text-[11px] text-faint">{r.employee?.role ?? "Orchestrator"}</span>
                      </span>
                      <span className="text-[11px] text-faint">{timeAgo(r.createdAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="今週のアクティビティ" description="Activity" action={<Link href="/app/activity" className="text-xs text-muted hover:text-accent">すべて</Link>} />
            <CardBody className="pt-3">
              {activity.length === 0 ? (
                <p className="py-6 text-center text-xs text-faint">まだアクティビティはありません</p>
              ) : (
                <ol className="relative space-y-4 border-l border-line pl-4">
                  {activity.map((a) => (
                    <li key={a.id} className="relative">
                      <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-bg bg-accent" />
                      <p className="text-xs leading-relaxed">{a.message}</p>
                      <p className="mt-0.5 text-[10px] text-faint">{formatTime(a.createdAt)} · {a.actorName}</p>
                    </li>
                  ))}
                </ol>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardBody className="flex items-center gap-5">
              <ProgressRing value={progress} size={76} />
              <div>
                <p className="text-sm font-medium">会社の進捗</p>
                <p className="mt-1 text-xs text-muted">今週のタスク {weekDone} / {weekTotal} 件完了</p>
                <Link href="/app/tasks" className="mt-2 inline-flex items-center gap-1 text-xs text-accent hover:underline">
                  <TrendingUp className="h-3 w-3" /> 詳細を見る <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
      {pendingApprovals > 0 ? (
        <Link href="/app/approvals" className="flex items-center gap-3 rounded-xl border border-warning/40 bg-warning-soft px-4 py-3 text-sm">
          <CheckSquare className="h-4 w-4 text-warning" />
          <span className="flex-1">{pendingApprovals} 件のアクションがあなたの承認を待っています</span>
          <Badge tone="warning">Approval Center</Badge>
        </Link>
      ) : null}
    </div>
  );
}
