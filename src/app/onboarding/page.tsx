import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { getCompanyContext } from "@/server/auth/guards";
import { googleOAuthConfigured } from "@/server/env";
import { effectivePolicies } from "@/server/services/employees";
import { demoBackToSampleAction, logoutAction } from "../(auth)/actions";
import { DEMO_EMAIL } from "@/server/services/demo";
import { Stepper } from "./stepper";
import { CompanyStep } from "./steps/company-step";
import { EmployeesStep } from "./steps/employees-step";
import { ResponsibilitiesStep } from "./steps/responsibilities-step";
import { ConnectionsStep } from "./steps/connections-step";
import { PermissionsStep } from "./steps/permissions-step";
import { LaunchStep } from "./steps/launch-step";

export const metadata = { title: "Create your AI Company" };

export default async function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  const sp = await searchParams;
  const ctx = await getCompanyContext();
  if (!ctx) redirect("/login");
  if (ctx.company?.status === "ACTIVE") redirect("/app");

  const reached = ctx.company?.onboardingStep ?? 1;
  const requested = Number(sp.step);
  const step = Number.isInteger(requested) && requested >= 1 && requested <= reached ? requested : reached;

  const { company, db } = ctx;
  let body: React.ReactNode;
  if (step === 1 || !company || !db) {
    body = <CompanyStep company={company} />;
  } else if (step === 2) {
    const employees = await db.aIEmployee.findMany({ where: { companyId: company.id }, select: { templateKey: true } });
    body = <EmployeesStep selected={employees.map((e) => e.templateKey).filter((k): k is string => Boolean(k))} industry={company.industry} />;
  } else if (step === 3) {
    const employees = await db.aIEmployee.findMany({ where: { companyId: company.id }, include: { responsibilities: true }, orderBy: { createdAt: "asc" } });
    body = (
      <ResponsibilitiesStep
        employees={employees.map((e) => ({
          id: e.id,
          role: e.role,
          department: e.department,
          templateKey: e.templateKey,
          mission: e.mission,
          responsibilities: e.responsibilities.map((r) => ({ key: r.key, label: r.label })),
        }))}
      />
    );
  } else if (step === 4) {
    const [employees, integrations] = await Promise.all([
      db.aIEmployee.findMany({ where: { companyId: company.id }, include: { responsibilities: { select: { key: true } } }, orderBy: { createdAt: "asc" } }),
      db.integration.findMany({ where: { companyId: company.id } }),
    ]);
    body = (
      <ConnectionsStep
        employees={employees.map((e) => ({ id: e.id, role: e.role, department: e.department, templateKey: e.templateKey, responsibilityKeys: e.responsibilities.map((r) => r.key) }))}
        integrations={integrations.map((i) => ({ provider: i.provider, status: i.status, accountLabel: i.accountLabel, secretHint: i.secretHint, lastError: i.lastError }))}
        googleReady={googleOAuthConfigured()}
        connected={typeof sp.connected === "string" ? sp.connected : undefined}
        connectError={typeof sp.connect_error === "string" ? sp.connect_error : undefined}
      />
    );
  } else if (step === 5) {
    const [employees, integrations] = await Promise.all([
      db.aIEmployee.findMany({ where: { companyId: company.id }, include: { connectionAccess: true, responsibilities: { select: { key: true } } }, orderBy: { createdAt: "asc" } }),
      db.integration.findMany({ where: { companyId: company.id, status: "CONNECTED" }, select: { provider: true } }),
    ]);
    const withPolicies = await Promise.all(
      employees.map(async (e) => ({
        id: e.id,
        role: e.role,
        department: e.department,
        templateKey: e.templateKey,
        responsibilityKeys: e.responsibilities.map((r) => r.key),
        connectionAccess: e.connectionAccess.map((a) => a.provider),
        toolPolicies: await effectivePolicies(db, e.id),
      })),
    );
    body = <PermissionsStep employees={withPolicies} connected={integrations.map((i) => i.provider)} />;
  } else {
    const [employees, responsibilities, connected] = await Promise.all([
      db.aIEmployee.count({ where: { companyId: company.id } }),
      db.aIEmployeeResponsibility.count({ where: { companyId: company.id } }),
      db.integration.findMany({ where: { companyId: company.id, status: "CONNECTED" }, select: { provider: true } }),
    ]);
    body = <LaunchStep companyName={company.name} employees={employees} responsibilities={responsibilities} connections={connected.length} hasAI={connected.some((c) => ["anthropic", "openai", "gemini"].includes(c.provider))} />;
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-4 sm:px-6">
          <Logo className="text-lg" />
          <div className="flex-1">
            <Stepper current={step} reached={reached} />
          </div>
          {ctx.user.email === DEMO_EMAIL ? (
            <form action={demoBackToSampleAction}>
              <button className="whitespace-nowrap text-xs text-info hover:underline">デモ会社に戻る</button>
            </form>
          ) : null}
          <form action={logoutAction}>
            <button className="text-xs text-faint hover:text-fg">ログアウト</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">{body}</main>
    </div>
  );
}
