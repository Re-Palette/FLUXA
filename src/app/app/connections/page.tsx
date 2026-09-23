import { requireCompany, MANAGE_ROLES } from "@/server/auth/guards";
import { googleOAuthConfigured } from "@/server/env";
import { PROVIDERS, PROVIDER_CATEGORIES } from "@/lib/catalog";
import { recommendConnections } from "@/lib/recommend";
import { ConnectionCard } from "@/components/connections/connection-card";
import { ConnectFlash } from "@/components/connections/flash";
import { PageHeader } from "@/components/shell/page-header";

export const metadata = { title: "ツール連携" };

const CATEGORY_JA: Record<string, string> = { AI: "AI", Google: "Google", Productivity: "Productivity", Social: "Social", Business: "Business" };

export default async function ConnectionsPage({ searchParams }: PageProps<"/app/connections">) {
  const sp = await searchParams;
  const { db, company, membership } = await requireCompany();
  const [integrations, employees] = await Promise.all([
    db.integration.findMany({ where: { companyId: company.id } }),
    db.aIEmployee.findMany({ where: { companyId: company.id }, select: { templateKey: true, responsibilities: { select: { key: true } } } }),
  ]);
  const states = new Map(integrations.map((i) => [i.provider, i]));
  const recs = new Map<string, "recommended" | "optional">();
  for (const e of employees) {
    for (const r of recommendConnections({ templateKey: e.templateKey, responsibilityKeys: e.responsibilities.map((x) => x.key) })) {
      if (recs.get(r.provider) !== "recommended") recs.set(r.provider, r.strength);
    }
  }
  const canManage = MANAGE_ROLES.includes(membership.role);
  const connectedCount = integrations.filter((i) => i.status === "CONNECTED").length;
  return (
    <div className="space-y-8">
      <PageHeader en="Connections" title="ツール連携" description={`${connectedCount} 件のサービスが接続されています。AI社員はここで接続したサービスだけを使います。`} />
      <ConnectFlash connected={typeof sp.connected === "string" ? sp.connected : undefined} error={typeof sp.connect_error === "string" ? sp.connect_error : undefined} />
      {PROVIDER_CATEGORIES.map((cat) => (
        <section key={cat}>
          <h2 className="mb-3 text-xs font-semibold tracking-[0.18em] text-muted">{CATEGORY_JA[cat].toUpperCase()}</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {PROVIDERS.filter((p) => p.category === cat).map((p) => {
              const s = states.get(p.key);
              return (
                <ConnectionCard
                  key={p.key}
                  provider={p}
                  state={s ? { status: s.status, accountLabel: s.accountLabel, secretHint: s.secretHint, lastError: s.lastError } : null}
                  returnTo="/app/connections"
                  recommendation={cat === "AI" ? undefined : recs.get(p.key)}
                  canManage={canManage}
                  googleReady={googleOAuthConfigured()}
                />
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
