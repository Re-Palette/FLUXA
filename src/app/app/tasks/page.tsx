import Link from "next/link";
import { ListTodo } from "lucide-react";
import type { WorkflowStatus } from "@prisma/client";
import { requireCompany } from "@/server/auth/guards";
import { WORKFLOW_STATUS, PRIORITY_LABEL } from "@/lib/status";
import { timeAgo } from "@/lib/format";
import { EmployeeAvatar } from "@/components/employees/avatar";
import { PageHeader } from "@/components/shell/page-header";
import { RequestBox } from "@/components/work/request-box";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata = { title: "タスク" };

const FILTERS: { key: string; label: string; statuses?: WorkflowStatus[] }[] = [
  { key: "all", label: "すべて" },
  { key: "active", label: "進行中", statuses: ["PLANNING", "RUNNING", "WAITING_APPROVAL"] },
  { key: "COMPLETED", label: "完了", statuses: ["COMPLETED"] },
  { key: "FAILED", label: "失敗", statuses: ["FAILED"] },
];

export default async function TasksPage({ searchParams }: PageProps<"/app/tasks">) {
  const sp = await searchParams;
  const { db, company } = await requireCompany();
  const filter = FILTERS.find((f) => f.key === sp.status) ?? FILTERS[0];
  const [workflows, employees] = await Promise.all([
    db.workflow.findMany({
      where: { companyId: company.id, ...(filter.statuses ? { status: { in: filter.statuses } } : {}) },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { tasks: { orderBy: { step: "asc" }, select: { id: true, status: true, employee: { select: { role: true, department: true } } } } },
    }),
    db.aIEmployee.findMany({ where: { companyId: company.id }, select: { id: true, role: true, status: true }, orderBy: { createdAt: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader en="Tasks" title="タスク" description="依頼は Orchestrator がタスクに分解し、最適なAI社員に割り当てます。" />
      <RequestBox employees={employees.map((e) => ({ id: e.id, role: e.role, paused: e.status === "PAUSED" }))} />
      <div className="flex gap-1.5">
        {FILTERS.map((f) => (
          <Link key={f.key} href={f.key === "all" ? "/app/tasks" : `/app/tasks?status=${f.key}`} className={cn("rounded-lg border px-3 py-1.5 text-xs", f.key === filter.key ? "border-accent bg-accent text-white" : "border-line text-muted hover:text-fg")}>
            {f.label}
          </Link>
        ))}
      </div>
      <Card>
        {workflows.length === 0 ? (
          <EmptyState icon={<ListTodo className="h-5 w-5" />} title="No tasks yet." description="上のボックスから、AI会社に最初の仕事を依頼しましょう。" />
        ) : (
          <ul className="divide-y divide-line">
            {workflows.map((w) => {
              const done = w.tasks.filter((t) => t.status === "COMPLETED").length;
              const st = WORKFLOW_STATUS[w.status];
              return (
                <li key={w.id}>
                  <Link href={`/app/tasks/${w.id}`} className="flex flex-wrap items-center gap-4 px-5 py-4 transition-colors hover:bg-panel-hover">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">{w.title}</p>
                        {w.priority !== "NORMAL" ? <Badge tone={w.priority === "URGENT" || w.priority === "HIGH" ? "danger" : "neutral"}>{PRIORITY_LABEL[w.priority]}</Badge> : null}
                        {w.source === "schedule" ? <Badge tone="info">定期実行</Badge> : null}
                      </div>
                      <div className="mt-1.5 flex items-center gap-1">
                        {w.tasks.map((t, i) => (
                          <span key={t.id} className="flex items-center gap-1">
                            {i > 0 ? <span className="h-px w-3 bg-line-strong" /> : null}
                            <span title={t.employee.role} className={cn("rounded-full", t.status === "COMPLETED" ? "opacity-100" : t.status === "RUNNING" ? "ring-2 ring-success/60" : "opacity-50")}>
                              <EmployeeAvatar department={t.employee.department} size={20} />
                            </span>
                          </span>
                        ))}
                        {w.tasks.length ? <span className="ml-2 text-[11px] text-faint">{done}/{w.tasks.length} ステップ</span> : null}
                      </div>
                    </div>
                    <Badge tone={st.tone}>{st.label}</Badge>
                    <span className="w-16 text-right text-[11px] text-faint">{timeAgo(w.createdAt)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
