import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, ListTodo } from "lucide-react";
import { requireCompany, MANAGE_ROLES } from "@/server/auth/guards";
import { googleOAuthConfigured } from "@/server/env";
import { effectivePolicies } from "@/server/services/employees";
import { getAIProvider } from "@/server/ai/registry";
import { departmentJa, providerInfo } from "@/lib/catalog";
import { recommendConnections } from "@/lib/recommend";
import { toolInfo, POLICY_LABELS } from "@/lib/tool-catalog";
import { TASK_STATUS } from "@/lib/status";
import { formatDateTime, timeAgo } from "@/lib/format";
import { EmployeeAvatar } from "@/components/employees/avatar";
import { EmployeeStatus } from "@/components/employees/status-badge";
import { ConnectionCard } from "@/components/connections/connection-card";
import { ConnectFlash } from "@/components/connections/flash";
import { RequestBox } from "@/components/work/request-box";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { EmptyState } from "@/components/ui/empty-state";
import { EmployeeActions, EmployeePermissionsForm, EmployeeProfileForm } from "./forms";

const TABS = [
  { key: "overview", label: "概要" },
  { key: "tools", label: "Tools" },
  { key: "permissions", label: "権限" },
  { key: "settings", label: "設定" },
] as const;

export default async function EmployeeDetailPage({ params, searchParams }: PageProps<"/app/employees/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const { db, company, membership } = await requireCompany();
  const employee = await db.aIEmployee.findUnique({
    where: { id },
    include: { responsibilities: { orderBy: { createdAt: "asc" } }, connectionAccess: true },
  });
  if (!employee) notFound();
  const tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as (typeof TABS)[number]["key"]) : "overview";
  const canManage = MANAGE_ROLES.includes(membership.role);
  const [integrations, allEmployees] = await Promise.all([
    db.integration.findMany({ where: { companyId: company.id } }),
    db.aIEmployee.findMany({ where: { companyId: company.id }, select: { id: true, role: true, status: true }, orderBy: { createdAt: "asc" } }),
  ]);
  const connected = integrations.filter((i) => i.status === "CONNECTED").map((i) => i.provider);
  const respKeys = employee.responsibilities.map((r) => r.key);

  let body: React.ReactNode = null;
  if (tab === "overview") {
    const [current, recent, reports, activity, policies] = await Promise.all([
      db.task.findFirst({ where: { employeeId: id, status: { in: ["RUNNING", "APPROVAL_REQUIRED", "PENDING"] } }, orderBy: { updatedAt: "desc" } }),
      db.task.findMany({ where: { employeeId: id }, orderBy: { createdAt: "desc" }, take: 8 }),
      db.report.findMany({ where: { employeeId: id }, orderBy: { createdAt: "desc" }, take: 5 }),
      db.activityLog.findMany({ where: { companyId: company.id, actorId: id }, orderBy: { createdAt: "desc" }, take: 8 }),
      effectivePolicies(db, id),
    ]);
    const granted = new Set(employee.connectionAccess.map((a) => a.provider));
    const approvalTools = Object.entries(policies).filter(([n, p]) => p === "REQUIRE_APPROVAL" && toolInfo(n)?.available && (toolInfo(n)?.provider === "builtin" || granted.has(toolInfo(n)!.provider)));
    body = (
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          <RequestBox compact employees={allEmployees.map((e) => ({ id: e.id, role: e.role, paused: e.status === "PAUSED" }))} defaultEmployeeId={employee.id} />
          <Card>
            <CardHeader title="Current Task" />
            <CardBody className="pt-3">
              {current ? (
                <Link href={current.workflowId ? `/app/tasks/${current.workflowId}` : "/app/tasks"} className="flex items-center gap-3 rounded-lg border border-line p-3 hover:border-line-strong">
                  <ListTodo className="h-4 w-4 text-accent" />
                  <span className="flex-1 truncate text-sm">{current.title}</span>
                  <Badge tone={TASK_STATUS[current.status]?.tone}>{TASK_STATUS[current.status]?.label}</Badge>
                </Link>
              ) : (
                <p className="text-sm text-faint">現在進行中の仕事はありません</p>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Recent Tasks" />
            <CardBody className="pt-3">
              {recent.length === 0 ? (
                <EmptyState title="No tasks yet." description="上のボックスからこの社員に仕事を依頼できます。" />
              ) : (
                <ul className="divide-y divide-line">
                  {recent.map((t) => (
                    <li key={t.id}>
                      <Link href={t.workflowId ? `/app/tasks/${t.workflowId}` : "/app/tasks"} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-panel-hover">
                        <span className="min-w-0 flex-1 truncate text-sm">{t.title}</span>
                        <Badge tone={TASK_STATUS[t.status]?.tone}>{TASK_STATUS[t.status]?.label}</Badge>
                        <span className="w-16 text-right text-[11px] text-faint">{timeAgo(t.createdAt)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Reports" />
            <CardBody className="pt-3">
              {reports.length === 0 ? (
                <p className="text-sm text-faint">まだレポートはありません</p>
              ) : (
                <ul className="space-y-1">
                  {reports.map((r) => (
                    <li key={r.id}>
                      <Link href={`/app/reports/${r.id}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-panel-hover">
                        <FileText className="h-4 w-4 text-accent" />
                        <span className="flex-1 truncate text-sm">{r.title}</span>
                        <span className="text-[11px] text-faint">{timeAgo(r.createdAt)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Mission" />
            <CardBody className="pt-3">
              <p className="text-sm leading-relaxed">{employee.mission}</p>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Responsibilities" />
            <CardBody className="flex flex-wrap gap-1.5 pt-3">
              {employee.responsibilities.map((r) => (
                <span key={r.id} className={cn("rounded-md border px-2 py-1 text-xs", r.isCustom ? "border-accent/40 text-accent" : "border-line text-muted")}>
                  {r.label}
                </span>
              ))}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Connected Tools & Permissions" action={<Link href="?tab=permissions" className="text-xs text-muted hover:text-accent">編集</Link>} />
            <CardBody className="space-y-3 pt-3 text-sm">
              <div className="flex flex-wrap gap-1.5">
                {employee.connectionAccess.length === 0 ? <span className="text-xs text-faint">データアクセスなし</span> : null}
                {employee.connectionAccess.map((a) => (
                  <Badge key={a.provider} tone={connected.includes(a.provider) ? "success" : "neutral"}>
                    {providerInfo(a.provider)?.name ?? a.provider}
                  </Badge>
                ))}
              </div>
              {approvalTools.length ? (
                <div>
                  <p className="text-xs text-muted">Approval Required</p>
                  <ul className="mt-1 space-y-0.5 text-xs">
                    {approvalTools.map(([n]) => (
                      <li key={n}>✓ {toolInfo(n)?.label}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Activity" />
            <CardBody className="pt-3">
              {activity.length === 0 ? (
                <p className="text-sm text-faint">アクティビティはまだありません</p>
              ) : (
                <ol className="space-y-3">
                  {activity.map((a) => (
                    <li key={a.id} className="text-xs">
                      <p>{a.message}</p>
                      <p className="mt-0.5 text-[10px] text-faint">{formatDateTime(a.createdAt)}</p>
                    </li>
                  ))}
                </ol>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    );
  } else if (tab === "tools") {
    const recs = recommendConnections({ templateKey: employee.templateKey, responsibilityKeys: respKeys });
    const states = new Map(integrations.map((i) => [i.provider, i]));
    const aiProviders = ["anthropic", "openai", "gemini"];
    body = (
      <div className="space-y-6">
        <ConnectFlash connected={typeof sp.connected === "string" ? sp.connected : undefined} error={typeof sp.connect_error === "string" ? sp.connect_error : undefined} />
        <p className="text-sm text-muted">{employee.role} の仕事内容に合わせて、必要なツールを推奨しています。ここから直接接続できます。</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[...aiProviders.map((p) => ({ provider: p, strength: undefined })), ...recs.map((r) => ({ provider: r.provider, strength: r.strength }))].map(({ provider, strength }) => {
            const info = providerInfo(provider);
            if (!info) return null;
            const s = states.get(provider);
            return (
              <ConnectionCard
                key={provider}
                provider={info}
                state={s ? { status: s.status, accountLabel: s.accountLabel, secretHint: s.secretHint, lastError: s.lastError } : null}
                returnTo={`/app/employees/${id}?tab=tools`}
                recommendation={strength}
                canManage={canManage}
                googleReady={googleOAuthConfigured()}
              />
            );
          })}
        </div>
      </div>
    );
  } else if (tab === "permissions") {
    const policies = await effectivePolicies(db, id);
    body = (
      <Card className="p-5 sm:p-6">
        {canManage ? (
          <EmployeePermissionsForm employeeId={id} initial={{ connectionAccess: employee.connectionAccess.map((a) => a.provider), toolPolicies: policies }} connected={connected} templateKey={employee.templateKey} responsibilityKeys={respKeys} />
        ) : (
          <ul className="space-y-1 text-sm">
            {Object.entries(policies).map(([n, p]) => (
              <li key={n}>
                {toolInfo(n)?.label}: {POLICY_LABELS[p]}
              </li>
            ))}
          </ul>
        )}
      </Card>
    );
  } else {
    const modelOptions = ["anthropic", "openai", "gemini"]
      .filter((p) => connected.includes(p))
      .map((p) => {
        const prov = getAIProvider(p)!;
        return { value: `${p}:${prov.defaultModel}`, label: `${providerInfo(p)?.name} · ${prov.defaultModel}` };
      });
    if (employee.model && !modelOptions.some((o) => o.value === employee.model)) modelOptions.push({ value: employee.model, label: employee.model });
    body = (
      <Card className="p-5 sm:p-6">
        {canManage ? (
          <EmployeeProfileForm
            employee={{ ...employee, responsibilities: employee.responsibilities.map((r) => ({ key: r.key, label: r.label })) }}
            modelOptions={modelOptions}
          />
        ) : (
          <p className="text-sm text-muted">設定を変更する権限がありません。</p>
        )}
      </Card>
    );
  }

  return (
    <div>
      <Link href="/app/employees" className="mb-4 inline-flex items-center gap-1 text-xs text-muted hover:text-fg">
        <ArrowLeft className="h-3.5 w-3.5" /> AI社員一覧
      </Link>
      {sp.created ? <div className="mb-4 rounded-lg border border-success/30 bg-success-soft px-4 py-2.5 text-sm text-success">✓ {employee.role} を採用しました。Tools タブから必要なサービスを接続しましょう。</div> : null}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <EmployeeAvatar department={employee.department} size={56} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{employee.role}</h1>
            <EmployeeStatus status={employee.status} english />
            {employee.isCustom ? <Badge tone="accent">Custom</Badge> : null}
          </div>
          <p className="mt-1 text-sm text-muted">
            {employee.name !== employee.role ? `${employee.name} · ` : ""}
            {employee.department} · {departmentJa(employee.department)}
          </p>
        </div>
        {canManage ? (
          <div className="flex gap-2">
            <EmployeeActions id={employee.id} role={employee.role} paused={employee.status === "PAUSED"} />
          </div>
        ) : null}
      </div>
      <div className="mb-6 flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <Link key={t.key} href={`?tab=${t.key}`} className={cn("-mb-px border-b-2 px-4 py-2.5 text-sm transition-colors", tab === t.key ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg")}>
            {t.label}
          </Link>
        ))}
      </div>
      {body}
    </div>
  );
}
