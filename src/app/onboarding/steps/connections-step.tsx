import { ArrowLeft, ArrowRight, Brain } from "lucide-react";
import { PROVIDERS, PROVIDER_CATEGORIES, providerInfo } from "@/lib/catalog";
import { recommendConnections } from "@/lib/recommend";
import { ConnectionCard, type ConnectionState } from "@/components/connections/connection-card";
import { ConnectFlash } from "@/components/connections/flash";
import { ProviderIcon } from "@/components/connections/provider-icon";
import { ButtonLink } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { finishConnectionsAction } from "../actions";
import { StepHeader } from "./step-header";

export function ConnectionsStep({
  employees,
  integrations,
  googleReady,
  connected,
  connectError,
}: {
  employees: { id: string; role: string; department: string; templateKey: string | null; responsibilityKeys: (string | null)[] }[];
  integrations: (ConnectionState & { provider: string })[];
  googleReady: boolean;
  connected?: string;
  connectError?: string;
}) {
  const states = new Map(integrations.map((i) => [i.provider, i]));
  const recs = new Map<string, "recommended" | "optional">();
  const perEmployee = employees.map((e) => {
    const r = recommendConnections({ templateKey: e.templateKey, responsibilityKeys: e.responsibilityKeys });
    for (const x of r) if (recs.get(x.provider) !== "recommended") recs.set(x.provider, x.strength);
    return { e, r };
  });
  const aiConnected = ["anthropic", "openai", "gemini"].some((p) => states.get(p)?.status === "CONNECTED");
  const returnTo = "/onboarding?step=4";

  return (
    <div>
      <StepHeader n={4} title="Connect your tools" question="Connect your tools" subtitle="AI社員が使うサービスを接続します。あとから Connections で追加・変更できます。" />
      <div className="mb-6 space-y-3">
        <ConnectFlash connected={connected} error={connectError} />
        {!aiConnected ? (
          <div className="flex items-start gap-3 rounded-xl border border-accent/40 bg-accent-soft/40 p-4">
            <Brain className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
            <div className="text-sm">
              <p className="font-medium">まずは AI を1つ接続しましょう</p>
              <p className="mt-0.5 text-xs text-muted">Claude・OpenAI・Gemini のいずれかが、AI社員の「頭脳」になります。ご自身のキーを使うため、AI 利用料は各社から直接請求されます。</p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
        <div className="space-y-8">
          {PROVIDER_CATEGORIES.map((cat) => {
            const list = PROVIDERS.filter((p) => p.category === cat).sort(
              (a, b) => Number(a.status === "coming_soon") - Number(b.status === "coming_soon") || Number(recs.get(b.key) === "recommended") - Number(recs.get(a.key) === "recommended"),
            );
            return (
              <section key={cat}>
                <h2 className="mb-3 text-xs font-semibold tracking-[0.18em] text-muted">{cat.toUpperCase()}</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {list.map((p) => (
                    <ConnectionCard key={p.key} provider={p} state={states.get(p.key) ?? null} returnTo={returnTo} recommendation={cat === "AI" ? undefined : recs.get(p.key)} googleReady={googleReady} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
        <aside className="space-y-3 lg:sticky lg:top-24 lg:self-start">
          <p className="text-xs font-semibold tracking-[0.18em] text-muted">BY EMPLOYEE</p>
          {perEmployee.map(({ e, r }) => (
            <div key={e.id} className="rounded-xl border border-line bg-panel p-3">
              <p className="text-sm font-medium">{e.role}</p>
              <ul className="mt-2 space-y-1.5">
                {r.slice(0, 5).map((x) => {
                  const ok = states.get(x.provider)?.status === "CONNECTED";
                  return (
                    <li key={x.provider} className="flex items-center gap-2 text-xs">
                      <ProviderIcon provider={x.provider} size={18} />
                      <span className="flex-1 truncate text-muted">{providerInfo(x.provider)?.name}</span>
                      <span className={ok ? "text-success" : x.strength === "recommended" ? "text-accent" : "text-faint"}>{ok ? "✓ 接続済" : x.strength === "recommended" ? "推奨" : "任意"}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </aside>
      </div>

      <div className="sticky bottom-0 mt-8 flex items-center justify-between gap-3 border-t border-line bg-bg/90 py-4 backdrop-blur">
        <ButtonLink href="/onboarding?step=3" variant="secondary">
          <ArrowLeft className="h-4 w-4" /> 戻る
        </ButtonLink>
        <form action={finishConnectionsAction}>
          <SubmitButton variant={aiConnected ? "primary" : "secondary"}>
            {aiConnected ? "次へ" : "あとで接続する"} <ArrowRight className="h-4 w-4" />
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}
