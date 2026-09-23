import Link from "next/link";
import { Bot, Plus } from "lucide-react";
import { requireCompany } from "@/server/auth/guards";
import { departmentJa, DEPARTMENTS } from "@/lib/catalog";
import { EmployeeAvatar } from "@/components/employees/avatar";
import { EmployeeStatus } from "@/components/employees/status-badge";
import { PageHeader } from "@/components/shell/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata = { title: "AI社員" };

export default async function EmployeesPage() {
  const { db, company } = await requireCompany();
  const employees = await db.aIEmployee.findMany({
    where: { companyId: company.id },
    orderBy: { createdAt: "asc" },
    include: {
      responsibilities: { select: { label: true } },
      connectionAccess: { select: { provider: true } },
      _count: { select: { tasks: { where: { status: "COMPLETED" } } } },
    },
  });
  const byDept = DEPARTMENTS.map((d) => ({ ...d, list: employees.filter((e) => e.department === d.key) })).filter((d) => d.list.length);

  return (
    <div>
      <PageHeader
        en="AI Employees"
        title="AI社員の管理"
        description={`${employees.length} 名のAI社員が在籍しています`}
        action={
          <ButtonLink href="/app/employees/new">
            <Plus className="h-4 w-4" /> Add AI Employee
          </ButtonLink>
        }
      />
      {employees.length === 0 ? (
        <Card>
          <EmptyState icon={<Bot className="h-5 w-5" />} title="Your AI company has no employees yet." description="テンプレートから、またはオリジナルのAI社員を作成できます。" action={<ButtonLink href="/app/employees/new">Add AI Employee</ButtonLink>} />
        </Card>
      ) : (
        <div className="space-y-8">
          {byDept.map((d) => (
            <section key={d.key}>
              <h2 className="mb-3 text-xs font-semibold tracking-[0.16em] text-muted">
                {d.key.toUpperCase()} <span className="ml-1 font-normal tracking-normal text-faint">· {d.ja}</span>
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {d.list.map((e) => (
                  <Link key={e.id} href={`/app/employees/${e.id}`} className="panel flex flex-col p-4 transition-colors hover:border-line-strong">
                    <div className="flex items-center gap-3">
                      <EmployeeAvatar department={e.department} size={42} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{e.role}</p>
                        <p className="truncate text-[11px] text-faint">{e.name !== e.role ? `${e.name} · ` : ""}{departmentJa(e.department)}{e.isCustom ? " · Custom" : ""}</p>
                      </div>
                      <EmployeeStatus status={e.status} />
                    </div>
                    <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-muted">{e.mission}</p>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {e.responsibilities.slice(0, 4).map((r) => (
                        <span key={r.label} className="rounded-md bg-panel-2 px-1.5 py-0.5 text-[10px] text-muted">{r.label}</span>
                      ))}
                      {e.responsibilities.length > 4 ? <span className="text-[10px] text-faint">+{e.responsibilities.length - 4}</span> : null}
                    </div>
                    <p className="mt-auto pt-3 text-[11px] text-faint">完了タスク {e._count.tasks} 件 · 連携 {e.connectionAccess.length}</p>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
