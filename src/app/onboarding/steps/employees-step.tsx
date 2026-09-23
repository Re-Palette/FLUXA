"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles } from "lucide-react";
import { DEPARTMENTS, EMPLOYEE_TEMPLATES, TEAM_PACKS, departmentJa } from "@/lib/catalog";
import { EmployeeAvatar } from "@/components/employees/avatar";
import { Button, ButtonLink } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { saveEmployeesAction } from "../actions";
import { StepHeader } from "./step-header";

const PACK_FOR_INDUSTRY: Record<string, string> = { SaaS: "saas", Technology: "saas", "E-commerce": "ecommerce" };

export function EmployeesStep({ selected: initial, industry }: { selected: string[]; industry: string }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set(initial));
  const [dept, setDept] = useState<string>("all");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const suggestedPack = PACK_FOR_INDUSTRY[industry] ?? "startup";

  const visible = useMemo(() => (dept === "all" ? EMPLOYEE_TEMPLATES : EMPLOYEE_TEMPLATES.filter((t) => t.department === dept)), [dept]);
  const toggle = (key: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  return (
    <div>
      <StepHeader n={2} title="Build Your AI Team" question="Which employees do you need?" subtitle="必要なAI社員を選択してください。あとからいつでも追加できます。" />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {TEAM_PACKS.map((p) => {
          const all = p.templates.every((t) => selected.has(t));
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => setSelected((s) => new Set([...s, ...p.templates]))}
              className={cn("panel flex items-start gap-3 p-4 text-left transition-colors hover:border-line-strong", all && "border-accent/50")}
            >
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <span>
                <span className="flex items-center gap-2 text-sm font-medium">
                  {p.name}
                  {p.key === suggestedPack ? <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[10px] text-accent">おすすめ</span> : null}
                </span>
                <span className="mt-1 block text-xs text-muted">{p.description}</span>
                <span className="mt-1.5 block text-[11px] text-faint">{p.templates.length} 名を一括追加</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mb-5 flex gap-1.5 overflow-x-auto pb-1">
        {[{ key: "all", ja: "すべて" }, ...DEPARTMENTS].map((d) => (
          <button
            key={d.key}
            type="button"
            onClick={() => setDept(d.key)}
            className={cn(
              "shrink-0 rounded-lg border px-3 py-1.5 text-xs transition-colors",
              dept === d.key ? "border-accent bg-accent text-white" : "border-line text-muted hover:text-fg",
            )}
          >
            {d.key === "all" ? d.ja : d.key}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((t) => {
          const on = selected.has(t.key);
          return (
            <button
              key={t.key}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(t.key)}
              className={cn("panel relative flex flex-col p-4 text-left transition-all hover:border-line-strong", on && "border-accent/60 bg-accent-soft/40")}
            >
              <span className={cn("absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full border", on ? "border-accent bg-accent text-white" : "border-line-strong")}>
                {on ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
              </span>
              <span className="flex items-center gap-3">
                <EmployeeAvatar department={t.department} size={38} />
                <span>
                  <span className="block text-sm font-medium">{t.name}</span>
                  <span className="block text-[11px] text-faint">{t.department} · {departmentJa(t.department)}</span>
                </span>
              </span>
              <span className="mt-3 text-xs leading-relaxed text-muted">{t.description}</span>
              <span className="mt-2 text-[11px] text-faint">おすすめ: {t.recommendedUse}</span>
            </button>
          );
        })}
      </div>

      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
      <div className="sticky bottom-0 mt-8 flex items-center justify-between gap-3 border-t border-line bg-bg/90 py-4 backdrop-blur">
        <ButtonLink href="/onboarding?step=1" variant="secondary">
          <ArrowLeft className="h-4 w-4" /> 戻る
        </ButtonLink>
        <p className="text-sm text-muted">
          <span className="font-semibold text-fg">{selected.size}</span> 名を選択中
        </p>
        <Button
          disabled={pending || selected.size === 0}
          onClick={() =>
            start(async () => {
              setError(null);
              const r = await saveEmployeesAction([...selected]);
              if (!r.ok) setError(r.error);
              else router.push("/onboarding?step=3");
            })
          }
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} 次へ <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
