import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { requireCompany } from "@/server/auth/guards";
import { formatDateTime } from "@/lib/format";
import { buttonClass } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Markdown } from "@/components/ui/markdown";

export default async function ReportPage({ params }: PageProps<"/app/reports/[id]">) {
  const { id } = await params;
  const { db } = await requireCompany();
  const report = await db.report.findUnique({ where: { id }, include: { employee: { select: { id: true, role: true } } } });
  if (!report) notFound();
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/app/reports" className="mb-4 inline-flex items-center gap-1 text-xs text-muted hover:text-fg">
        <ArrowLeft className="h-3.5 w-3.5" /> レポート一覧
      </Link>
      <div className="mb-6 flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">{report.title}</h1>
          <p className="mt-1 text-xs text-faint">
            {report.employee ? (
              <Link href={`/app/employees/${report.employee.id}`} className="hover:text-accent">
                {report.employee.role}
              </Link>
            ) : (
              "Orchestrator"
            )}{" "}
            · {formatDateTime(report.createdAt)}
            {report.workflowId ? (
              <>
                {" · "}
                <Link href={`/app/tasks/${report.workflowId}`} className="hover:text-accent">
                  関連タスク
                </Link>
              </>
            ) : null}
          </p>
        </div>
        <a href={`/api/reports/${report.id}/download`} className={buttonClass("secondary", "sm")}>
          <Download className="h-3.5 w-3.5" /> Markdown
        </a>
      </div>
      {report.summary ? (
        <div className="mb-6 rounded-xl border border-accent/30 bg-accent-soft/30 p-4 text-sm leading-relaxed">{report.summary}</div>
      ) : null}
      <Card>
        <CardBody className="sm:p-8">
          <Markdown>{report.content}</Markdown>
        </CardBody>
      </Card>
    </div>
  );
}
