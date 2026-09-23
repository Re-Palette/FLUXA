import { requireCompany } from "@/server/auth/guards";
import { PageHeader } from "@/components/shell/page-header";
import { EmployeeBuilder } from "./builder";

export const metadata = { title: "AI社員を追加" };

export default async function NewEmployeePage() {
  const { db, company } = await requireCompany();
  const existing = await db.aIEmployee.findMany({ where: { companyId: company.id }, select: { templateKey: true } });
  return (
    <div>
      <PageHeader en="AI Employee Builder" title="AI社員を追加" description="テンプレートから選ぶか、完全オリジナルのAI社員を作成します。" />
      <EmployeeBuilder existingTemplateKeys={existing.map((e) => e.templateKey).filter((k): k is string => Boolean(k))} />
    </div>
  );
}
