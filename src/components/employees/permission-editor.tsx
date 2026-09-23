"use client";
import { providerInfo } from "@/lib/catalog";
import { APPROVAL_FLOOR_TAGS, POLICY_LABELS, RISK_LABELS, TOOLS, type Policy } from "@/lib/tool-catalog";
import { recommendConnections } from "@/lib/recommend";
import { Badge } from "../ui/badge";
import { Checkbox } from "../ui/form";
import { cn } from "../ui/cn";
import { ProviderIcon } from "../connections/provider-icon";

export interface PermissionValue {
  connectionAccess: string[];
  toolPolicies: Record<string, Policy>;
}

const POLICY_ORDER: Policy[] = ["ALLOW", "REQUIRE_APPROVAL", "DENY"];

/** Data access (which services) + actions (per-tool Allow / Approval / Deny) for one employee. */
export function PermissionEditor({
  value,
  onChange,
  connected,
  templateKey,
  responsibilityKeys,
}: {
  value: PermissionValue;
  onChange: (v: PermissionValue) => void;
  connected: string[];
  templateKey: string | null;
  responsibilityKeys: (string | null)[];
}) {
  const recommended = recommendConnections({ templateKey, responsibilityKeys }).map((r) => r.provider as string);
  const providers = [...new Set([...recommended, ...connected, ...value.connectionAccess])].filter((p) => providerInfo(p)?.category !== "AI");
  const granted = new Set(value.connectionAccess);
  const tools = TOOLS.filter((t) => t.provider === "builtin" || granted.has(t.provider) || (!t.available && recommended.includes(t.provider)));

  const setPolicy = (tool: string, policy: Policy) => onChange({ ...value, toolPolicies: { ...value.toolPolicies, [tool]: policy } });
  const toggleProvider = (p: string) =>
    onChange({ ...value, connectionAccess: granted.has(p) ? value.connectionAccess.filter((x) => x !== p) : [...value.connectionAccess, p] });

  const approvalTools = tools.filter((t) => value.toolPolicies[t.name] === "REQUIRE_APPROVAL");

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section>
        <h3 className="text-xs font-semibold tracking-[0.14em] text-muted">DATA ACCESS</h3>
        <p className="mt-1 text-[11px] text-faint">このAI社員が参照・操作できるサービス</p>
        <div className="mt-3 space-y-2">
          {providers.length === 0 ? <p className="text-xs text-faint">対象のサービスはありません</p> : null}
          {providers.map((p) => {
            const info = providerInfo(p);
            const isConnected = connected.includes(p);
            return (
              <label key={p} className="flex cursor-pointer items-center gap-3 rounded-lg border border-line bg-bg-elev px-3 py-2">
                <Checkbox checked={granted.has(p)} onChange={() => toggleProvider(p)} disabled={info?.status === "coming_soon"} />
                <ProviderIcon provider={p} size={22} />
                <span className="flex-1 text-sm">{info?.name ?? p}</span>
                {info?.status === "coming_soon" ? <Badge>Coming Soon</Badge> : isConnected ? <Badge tone="success">接続済</Badge> : <Badge>未接続</Badge>}
              </label>
            );
          })}
        </div>
        {approvalTools.length ? (
          <div className="mt-5 rounded-lg border border-warning/30 bg-warning-soft p-3">
            <p className="text-xs font-medium text-warning">Approval Required</p>
            <ul className="mt-1.5 space-y-0.5 text-xs text-muted">
              {approvalTools.map((t) => (
                <li key={t.name}>✓ {t.label}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
      <section>
        <h3 className="text-xs font-semibold tracking-[0.14em] text-muted">ACTIONS</h3>
        <p className="mt-1 text-[11px] text-faint">実行できる操作と、人間の承認が必要な操作</p>
        <div className="mt-3 space-y-2">
          {tools.map((t) => {
            const current = value.toolPolicies[t.name] ?? t.defaultPolicy;
            const floor = t.riskTags.some((r) => APPROVAL_FLOOR_TAGS.includes(r));
            return (
              <div key={t.name} className={cn("rounded-lg border border-line bg-bg-elev px-3 py-2", !t.available && "opacity-60")}>
                <div className="flex items-center gap-2">
                  {t.provider !== "builtin" ? <ProviderIcon provider={t.provider} size={18} /> : null}
                  <span className="flex-1 text-sm">{t.label}</span>
                  {!t.available ? <Badge>Coming Soon</Badge> : null}
                </div>
                {t.riskTags.length ? (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {t.riskTags.map((r) => (
                      <Badge key={r} tone="warning">
                        {RISK_LABELS[r]}
                      </Badge>
                    ))}
                  </div>
                ) : null}
                <div className="mt-2 grid grid-cols-3 gap-1 rounded-md bg-panel-2 p-0.5" role="radiogroup" aria-label={t.label}>
                  {POLICY_ORDER.map((p) => {
                    const disabled = !t.available || (p === "ALLOW" && floor);
                    return (
                      <button
                        key={p}
                        type="button"
                        role="radio"
                        aria-checked={current === p}
                        disabled={disabled}
                        onClick={() => setPolicy(t.name, p)}
                        className={cn(
                          "rounded px-2 py-1 text-[11px] transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                          current === p ? (p === "ALLOW" ? "bg-success-soft text-success" : p === "REQUIRE_APPROVAL" ? "bg-warning-soft text-warning" : "bg-danger-soft text-danger") : "text-muted hover:text-fg",
                        )}
                        title={p === "ALLOW" && floor ? "この操作は常に承認が必要です" : undefined}
                      >
                        {POLICY_LABELS[p]}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
