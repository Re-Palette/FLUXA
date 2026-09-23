"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { departmentJa } from "@/lib/catalog";
import { EmployeeAvatar } from "@/components/employees/avatar";
import { ResponsibilityEditor, type RespItem } from "@/components/employees/responsibility-editor";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { saveResponsibilitiesAction } from "../actions";
import { StepHeader } from "./step-header";

interface Emp {
  id: string;
  role: string;
  department: string;
  templateKey: string | null;
  mission: string;
  responsibilities: RespItem[];
}

export function ResponsibilitiesStep({ employees }: { employees: Emp[] }) {
  const router = useRouter();
  const [state, setState] = useState(() => Object.fromEntries(employees.map((e) => [e.id, { mission: e.mission, responsibilities: e.responsibilities }])));
  const [activeId, setActiveId] = useState(employees[0]?.id);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const active = employees.find((e) => e.id === activeId);

  return (
    <div>
      <StepHeader n={3} title="仕事内容を設定" question="What should they work on?" subtitle="それぞれのAI社員が行う業務と Mission を選びます。" />
      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <nav className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
          {employees.map((e) => {
            const count = state[e.id]?.responsibilities.length ?? 0;
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => setActiveId(e.id)}
                className={cn(
                  "flex shrink-0 items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                  e.id === activeId ? "border-accent/60 bg-accent-soft/40" : "border-line hover:border-line-strong",
                )}
              >
                <EmployeeAvatar department={e.department} size={30} />
                <span className="min-w-0">
                  <span className="block truncate text-sm">{e.role}</span>
                  <span className={cn("block text-[11px]", count ? "text-muted" : "text-danger")}>{count} 業務</span>
                </span>
              </button>
            );
          })}
        </nav>
        {active ? (
          <Card className="p-5 sm:p-6">
            <div className="mb-5">
              <h2 className="text-lg font-semibold">{active.role} の仕事内容を設定</h2>
              <p className="text-xs text-muted">
                {active.department} · {departmentJa(active.department)} — このAI社員が行う業務を選択してください。
              </p>
            </div>
            <ResponsibilityEditor
              role={active.role}
              department={active.department}
              templateKey={active.templateKey}
              value={state[active.id].responsibilities}
              onChange={(v) => setState((s) => ({ ...s, [active.id]: { ...s[active.id], responsibilities: v } }))}
              mission={state[active.id].mission}
              onMissionChange={(m) => setState((s) => ({ ...s, [active.id]: { ...s[active.id], mission: m } }))}
            />
          </Card>
        ) : null}
      </div>
      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
      <div className="sticky bottom-0 mt-8 flex items-center justify-between gap-3 border-t border-line bg-bg/90 py-4 backdrop-blur">
        <ButtonLink href="/onboarding?step=2" variant="secondary">
          <ArrowLeft className="h-4 w-4" /> 戻る
        </ButtonLink>
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const r = await saveResponsibilitiesAction(employees.map((e) => ({ employeeId: e.id, ...state[e.id] })));
              if (!r.ok) setError(r.error);
              else router.push("/onboarding?step=4");
            })
          }
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} 次へ <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
