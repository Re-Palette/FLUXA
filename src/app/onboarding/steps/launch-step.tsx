"use client";
import { useState, useTransition } from "react";
import { AlertTriangle, ArrowLeft, Loader2, Rocket } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { launchCompanyAction } from "../actions";

export function LaunchStep({ companyName, employees, responsibilities, connections, hasAI }: { companyName: string; employees: number; responsibilities: number; connections: number; hasAI: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const stats = [
    { n: employees, label: "AI Employees" },
    { n: responsibilities, label: "Responsibilities" },
    { n: connections, label: "Connected Services" },
  ];
  return (
    <div className="relative mx-auto max-w-3xl overflow-hidden rounded-3xl border border-line px-6 py-16 text-center sm:px-12">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_120%,var(--accent-ring),transparent_60%)]" />
      <div className="grid-bg absolute inset-0 -z-10 opacity-60" />
      <p className="text-xs font-medium tracking-[0.3em] text-accent">STEP 06 · LAUNCH</p>
      <h1 className="mt-4 text-3xl font-light tracking-[0.08em] sm:text-4xl">
        YOUR AI COMPANY
        <br />
        <span className="font-semibold">IS READY.</span>
      </h1>
      <p className="mt-4 text-sm text-muted">{companyName} の AI 組織の準備が整いました。</p>
      <div className="mx-auto mt-10 grid max-w-xl grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="panel p-4">
            <p className="text-3xl font-semibold tabular-nums">{s.n}</p>
            <p className="mt-1 text-[11px] text-muted">{s.label}</p>
          </div>
        ))}
      </div>
      {!hasAI ? (
        <p className="mx-auto mt-6 flex max-w-md items-start gap-2 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-left text-xs text-warning">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          AI がまだ接続されていません。起動後、Connections から Claude などを接続すると AI社員が仕事を始められます。
        </p>
      ) : null}
      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
      <div className="mt-10 flex items-center justify-center gap-3">
        <ButtonLink href="/onboarding?step=5" variant="secondary">
          <ArrowLeft className="h-4 w-4" /> 戻る
        </ButtonLink>
        <Button
          size="lg"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await launchCompanyAction();
              if (r && !r.ok) setError(r.error);
            })
          }
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />} Launch AI Company
        </Button>
      </div>
    </div>
  );
}
