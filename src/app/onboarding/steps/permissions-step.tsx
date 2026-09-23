"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import type { Policy } from "@/lib/tool-catalog";
import { EmployeeAvatar } from "@/components/employees/avatar";
import { PermissionEditor, type PermissionValue } from "@/components/employees/permission-editor";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { savePermissionsAction } from "../actions";
import { StepHeader } from "./step-header";

interface Emp {
  id: string;
  role: string;
  department: string;
  templateKey: string | null;
  responsibilityKeys: (string | null)[];
  connectionAccess: string[];
  toolPolicies: Record<string, Policy>;
}

export function PermissionsStep({ employees, connected }: { employees: Emp[]; connected: string[] }) {
  const router = useRouter();
  const [state, setState] = useState<Record<string, PermissionValue>>(() =>
    Object.fromEntries(employees.map((e) => [e.id, { connectionAccess: e.connectionAccess, toolPolicies: e.toolPolicies }])),
  );
  const [activeId, setActiveId] = useState(employees[0]?.id);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const active = employees.find((e) => e.id === activeId);

  return (
    <div>
      <StepHeader n={5} title="権限を設定" question="Set permissions" subtitle="AI社員ごとに、見られるデータ・実行できる操作・承認が必要な操作を決めます。" />
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-line bg-panel p-4 text-xs leading-relaxed text-muted">
        <ShieldCheck className="h-4 w-4 shrink-0 text-success" />
        外部へのメール送信・SNS投稿・広告出稿・金銭や契約に関わる操作は、初期設定で「承認が必要」になっています。承認されるまで実行されることはありません。
      </div>
      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <nav className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
          {employees.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => setActiveId(e.id)}
              className={cn("flex shrink-0 items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors", e.id === activeId ? "border-accent/60 bg-accent-soft/40" : "border-line hover:border-line-strong")}
            >
              <EmployeeAvatar department={e.department} size={30} />
              <span className="truncate text-sm">{e.role}</span>
            </button>
          ))}
        </nav>
        {active ? (
          <Card className="p-5 sm:p-6">
            <h2 className="mb-5 text-lg font-semibold">{active.role}</h2>
            <PermissionEditor
              value={state[active.id]}
              onChange={(v) => setState((s) => ({ ...s, [active.id]: v }))}
              connected={connected}
              templateKey={active.templateKey}
              responsibilityKeys={active.responsibilityKeys}
            />
          </Card>
        ) : null}
      </div>
      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
      <div className="sticky bottom-0 mt-8 flex items-center justify-between gap-3 border-t border-line bg-bg/90 py-4 backdrop-blur">
        <ButtonLink href="/onboarding?step=4" variant="secondary">
          <ArrowLeft className="h-4 w-4" /> 戻る
        </ButtonLink>
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const r = await savePermissionsAction(employees.map((e) => ({ employeeId: e.id, ...state[e.id] })));
              if (!r.ok) setError(r.error);
              else router.push("/onboarding?step=6");
            })
          }
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} 次へ <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
