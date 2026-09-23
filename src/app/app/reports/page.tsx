import Link from "next/link";
import { FileText } from "lucide-react";
import { requireCompany } from "@/server/auth/guards";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata = { title: "レポート" };

const KIND: Record<string, string> = { task: "タスク", workflow: "依頼", daily: "日次", weekly: "週次", monthly: "月次", custom: "カスタム" };

export default async function ReportsPage() {
  const { db, company } = await requireCompany();
  const reports = await db.report.findMany({ where: { companyId: company.id }, orderBy: { createdAt: "desc" }, take: 200, include: { employee: { select: { role: true } } } });
  return (
    <div>
      <PageHeader en="Reports" title="レポート" description="AI社員が作成した成果物・レポートの一覧です。" />
      <Card>
        {reports.length === 0 ? (
          <EmptyState icon={<FileText className="h-5 w-5" />} title="Your first AI report will appear here." description="AI社員に仕事を依頼すると、成果物がここに保存されます。" />
        ) : (
          <ul className="divide-y divide-line">
            {reports.map((r) => (
              <li key={r.id}>
                <Link href={`/app/reports/${r.id}`} className="flex flex-wrap items-center gap-4 px-5 py-4 hover:bg-panel-hover">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
                    <FileText className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{r.title}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted">{r.summary || "—"}</span>
                  </span>
                  <Badge>{KIND[r.kind] ?? r.kind}</Badge>
                  <span className="w-32 text-right text-[11px] text-faint">
                    {r.employee?.role ?? "Orchestrator"}
                    <br />
                    {formatDateTime(r.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
