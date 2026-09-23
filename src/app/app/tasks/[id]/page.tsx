import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, CircleDashed, FileText, Loader2, ShieldAlert, Wrench, XCircle } from "lucide-react";
import { requireCompany } from "@/server/auth/guards";
import { toolInfo } from "@/lib/tool-catalog";
import { TASK_STATUS, WORKFLOW_STATUS, PRIORITY_LABEL } from "@/lib/status";
import { formatDateTime } from "@/lib/format";
import { EmployeeAvatar } from "@/components/employees/avatar";
import { ApprovalCard } from "@/components/work/approval-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { Markdown } from "@/components/ui/markdown";
import { CancelWorkflowButton, RetryPlanningButton, RetryTaskButton } from "./controls";

const TOOL_STATUS: Record<string, { label: string; tone: "success" | "danger" | "warning" | "neutral" }> = {
  SUCCEEDED: { label: "成功", tone: "success" },
  FAILED: { label: "失敗", tone: "danger" },
  DENIED: { label: "権限なし", tone: "danger" },
  REJECTED: { label: "却下", tone: "danger" },
  AWAITING_APPROVAL: { label: "承認待ち", tone: "warning" },
  PENDING: { label: "実行待ち", tone: "neutral" },
  RUNNING: { label: "実行中", tone: "neutral" },
};

export default async function WorkflowPage({ params }: PageProps<"/app/tasks/[id]">) {
  const { id } = await params;
  const { db } = await requireCompany();
  const wf = await db.workflow.findUnique({
    where: { id },
    include: {
      tasks: {
        orderBy: { step: "asc" },
        include: {
          employee: { select: { id: true, role: true, department: true } },
          toolCalls: { orderBy: { createdAt: "asc" } },
          approvals: { where: { status: "PENDING" }, include: { employee: { select: { role: true, department: true } } } },
        },
      },
      reports: { orderBy: { createdAt: "desc" }, select: { id: true, title: true, kind: true } },
    },
  });
  if (!wf) notFound();
  const st = WORKFLOW_STATUS[wf.status];
  const active = ["PLANNING", "RUNNING", "WAITING_APPROVAL"].includes(wf.status);

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/app/tasks" className="mb-4 inline-flex items-center gap-1 text-xs text-muted hover:text-fg">
        <ArrowLeft className="h-3.5 w-3.5" /> タスク一覧
      </Link>
      <div className="mb-6 flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{wf.title}</h1>
            <Badge tone={st.tone}>{st.label}</Badge>
            {wf.priority !== "NORMAL" ? <Badge>{`優先度: ${PRIORITY_LABEL[wf.priority]}`}</Badge> : null}
          </div>
          <p className="mt-1 text-xs text-faint">{formatDateTime(wf.createdAt)} に依頼</p>
        </div>
        {active ? <CancelWorkflowButton workflowId={wf.id} /> : null}
      </div>

      <Card className="mb-6">
        <CardBody>
          <p className="text-xs font-medium text-muted">依頼内容</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{wf.request}</p>
        </CardBody>
      </Card>

      {wf.status === "PLANNING" ? (
        <div className="flex items-center gap-3 rounded-xl border border-info/30 bg-info-soft px-4 py-3 text-sm text-info">
          <Loader2 className="h-4 w-4 animate-spin" /> Orchestrator が担当と手順を計画しています…
        </div>
      ) : null}
      {wf.status === "FAILED" && wf.tasks.length === 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
          <XCircle className="h-4 w-4" /> <span className="flex-1">{wf.error}</span>
          <RetryPlanningButton workflowId={wf.id} />
        </div>
      ) : null}

      {wf.tasks.length ? (
        <ol className="relative space-y-4">
          {wf.tasks.map((t, i) => {
            const ts = TASK_STATUS[t.status];
            const Icon = t.status === "COMPLETED" ? CheckCircle2 : t.status === "FAILED" ? XCircle : t.status === "APPROVAL_REQUIRED" ? ShieldAlert : t.status === "RUNNING" ? Loader2 : CircleDashed;
            return (
              <li key={t.id} className="relative pl-10">
                {i < wf.tasks.length - 1 ? <span className="absolute bottom-[-16px] left-[15px] top-8 w-px bg-line" /> : null}
                <span className="absolute left-0 top-1">
                  <EmployeeAvatar department={t.employee.department} size={32} />
                </span>
                <Card>
                  <CardBody>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-medium text-faint">STEP {i + 1}</span>
                      <Link href={`/app/employees/${t.employee.id}`} className="text-sm font-medium hover:text-accent">
                        {t.employee.role}
                      </Link>
                      <Badge tone={ts.tone}>
                        <Icon className={`h-3 w-3 ${t.status === "RUNNING" ? "animate-spin" : ""}`} /> {ts.label}
                      </Badge>
                      {t.status === "FAILED" ? <span className="ml-auto"><RetryTaskButton taskId={t.id} /></span> : null}
                    </div>
                    <p className="mt-2 text-sm">{t.title}</p>
                    {t.description !== t.title ? <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-muted">{t.description}</p> : null}
                    {t.toolCalls.length ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {t.toolCalls.map((c) => (
                          <Badge key={c.id} tone={TOOL_STATUS[c.status]?.tone ?? "neutral"}>
                            <Wrench className="h-3 w-3" /> {toolInfo(c.tool)?.label ?? c.tool} · {TOOL_STATUS[c.status]?.label}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                    {t.error ? <p className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">{t.error}</p> : null}
                    {t.approvals.length ? (
                      <div className="mt-4 space-y-3">
                        {t.approvals.map((a) => (
                          <ApprovalCard key={a.id} approval={{ id: a.id, title: a.title, summary: a.summary, riskTags: a.riskTags, payload: a.payload, createdAt: a.createdAt.toISOString(), employee: a.employee }} />
                        ))}
                      </div>
                    ) : null}
                    {t.result ? (
                      <details className="group mt-4 rounded-lg border border-line bg-bg-elev" open={i === wf.tasks.length - 1}>
                        <summary className="cursor-pointer list-none px-4 py-2.5 text-xs font-medium text-muted group-open:border-b group-open:border-line">成果を表示</summary>
                        <div className="px-4 py-3">
                          <Markdown>{t.result}</Markdown>
                        </div>
                      </details>
                    ) : null}
                  </CardBody>
                </Card>
              </li>
            );
          })}
        </ol>
      ) : null}

      {wf.reports.length ? (
        <Card className="mt-6">
          <CardBody>
            <p className="mb-2 text-xs font-medium text-muted">成果物</p>
            <ul className="space-y-1">
              {wf.reports.map((r) => (
                <li key={r.id}>
                  <Link href={`/app/reports/${r.id}`} className="flex items-center gap-2 text-sm hover:text-accent">
                    <FileText className="h-4 w-4 text-accent" /> {r.title}
                  </Link>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
