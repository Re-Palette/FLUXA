import { EMPLOYEE_TEMPLATES, providerInfo, responsibilityInfo, templateInfo, type ProviderKey } from "./catalog";

export interface ConnectionRecommendation {
  provider: ProviderKey;
  strength: "recommended" | "optional";
  reasons: string[]; // responsibility labels that triggered it
}

/**
 * Rule-based connection recommendations for an employee (docs/architecture.md §7).
 * Strong matches from any responsibility win over weak ones; template suggestions count as optional.
 */
export function recommendConnections(input: {
  responsibilityKeys: (string | null)[];
  templateKey?: string | null;
}): ConnectionRecommendation[] {
  const out = new Map<ProviderKey, ConnectionRecommendation>();
  const add = (provider: ProviderKey, strength: "recommended" | "optional", reason: string) => {
    const existing = out.get(provider);
    if (!existing) {
      out.set(provider, { provider, strength, reasons: [reason] });
      return;
    }
    if (strength === "recommended") existing.strength = "recommended";
    if (!existing.reasons.includes(reason)) existing.reasons.push(reason);
  };

  for (const key of input.responsibilityKeys) {
    const r = responsibilityInfo(key);
    if (!r) continue;
    r.strong.forEach((p) => add(p, "recommended", r.ja));
    r.weak.forEach((p) => add(p, "optional", r.ja));
  }
  const tpl = templateInfo(input.templateKey);
  tpl?.suggestedTools.forEach((p) => add(p, "optional", tpl.name));

  const rank = (r: ConnectionRecommendation) =>
    (r.strength === "recommended" ? 0 : 10) + (providerInfo(r.provider)?.status === "available" ? 0 : 5);
  return [...out.values()].sort((a, b) => rank(a) - rank(b) || b.reasons.length - a.reasons.length);
}

/** Responsibility keys offered for an employee: its template's list, else the union for its department. */
export function responsibilityOptions(templateKey: string | null | undefined, department: string): string[] {
  const tpl = templateInfo(templateKey);
  if (tpl) return tpl.responsibilities;
  const keys = new Set<string>();
  for (const t of EMPLOYEE_TEMPLATES) if (t.department === department) t.responsibilities.forEach((k) => keys.add(k));
  return [...keys];
}

/** Rule-based starting point for an employee's Mission; the user always edits it. */
export function suggestMission(role: string, labels: string[], templateKey?: string | null): string {
  const tpl = templateInfo(templateKey);
  if (labels.length === 0) return tpl?.defaultMission ?? "会社の目標達成に貢献する";
  const focus = labels.slice(0, 3).join("・");
  const base = tpl?.defaultMission ?? "会社の目標達成に貢献する";
  return `${focus}を通じて、${base.replace(/^.*?、/, "")}`.slice(0, 200) || `${role}として${focus}を担い、会社の成長に貢献する`;
}
