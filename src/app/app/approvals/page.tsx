import Link from "next/link";
import { CheckSquare } from "lucide-react";
import { requireCompany } from "@/server/auth/guards";
import { RISK_LABELS, type RiskTag } from "@/lib/tool-catalog";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/shell/page-header";
import { ApprovalCard } from "@/components/work/approval-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata = { title: "承認" };

export default async function ApprovalsPage() {
  const { db, company } = await requireCompany();
  const [pending, history] = await Promise.all([
    db.approval.findMany({ where: { companyId: company.id, status: "PENDING" }, orderBy: { createdAt: "asc" }, include: { employee: { select: { role: true, department: true } }, task: { select: { workflowId: true } } } }),
    db.approval.findMany({ where: { companyId: company.id, status: { not: "PENDING" } }, orderBy: { decidedAt: "desc" }, take: 30, include: { employee: { select: { role: true } } } }),
  ]);
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader en="Approval Center" title="承認センター" description="AI社員が外部に影響する操作を行う前に、ここであなたの承認を求めます。承認されるまで実行されません。" />
      <section>
        <h2 className="mb-3 text-xs font-semibold tracking-[0.16em] text-muted">PENDING APPROVALS · {pending.length}</h2>
        {pending.length === 0 ? (
          <Card>
            <EmptyState icon={<CheckSquare className="h-5 w-5" />} title="承認待ちのアクションはありません" description="AI社員がメール送信や投稿などを行う前に、ここに表示されます。" />
          </Card>
        ) : (
          <div className="space-y-3">
            {pending.map((a) => (
              <div key={a.id}>
                <ApprovalCard approval={{ id: a.id, title: a.title, summary: a.summary, riskTags: a.riskTags, payload: a.payload, createdAt: a.createdAt.toISOString(), employee: a.employee }} />
                {a.task.workflowId ? (
                  <Link href={`/app/tasks/${a.task.workflowId}`} className="ml-4 mt-1 inline-block text-[11px] text-faint hover:text-accent">
                    関連するタスクを見る →
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
      <Card>
        <CardHeader title="承認履歴" description="History" />
        <CardBody className="pt-3">
          {history.length === 0 ? (
            <p className="text-sm text-faint">まだ履歴はありません</p>
          ) : (
            <ul className="divide-y divide-line">
              {history.map((h) => (
                <li key={h.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                  <Badge tone={h.status === "APPROVED" ? "success" : h.status === "REJECTED" ? "danger" : "neutral"}>{h.status === "APPROVED" ? "承認" : h.status === "REJECTED" ? "却下" : "失効"}</Badge>
                  <span className="min-w-0 flex-1 truncate">
                    {h.employee.role}: {h.title}
                  </span>
                  <span className="flex gap-1">
                    {h.riskTags.map((t) => (
                      <Badge key={t}>{RISK_LABELS[t as RiskTag] ?? t}</Badge>
                    ))}
                  </span>
                  <span className="text-[11px] text-faint">{h.decidedAt ? formatDateTime(h.decidedAt) : ""}</span>
                  {h.reason ? <p className="w-full text-xs text-muted">理由: {h.reason}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
