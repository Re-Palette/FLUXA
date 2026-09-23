"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Loader2, Sparkles } from "lucide-react";
import { createWorkflowAction } from "@/server/actions-shared/work";
import { Select } from "../ui/form";
import { cn } from "../ui/cn";

const EXAMPLES = ["競合他社を調査して、新しいマーケティング施策を考えて", "今週の営業レポートを作成して", "来月の SNS 投稿カレンダーを作って"];

export function RequestBox({ employees, defaultEmployeeId, compact = false }: { employees: { id: string; role: string; paused: boolean }[]; defaultEmployeeId?: string; compact?: boolean }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [target, setTarget] = useState(defaultEmployeeId ?? "");
  const [priority, setPriority] = useState("NORMAL");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      setError(null);
      const r = await createWorkflowAction({ request: text, targetEmployeeId: target || null, priority });
      if (!r.ok) setError(r.error);
      else {
        setText("");
        router.push(`/app/tasks/${r.data!.workflowId}`);
      }
    });

  return (
    <div className={cn("panel relative overflow-hidden", compact ? "p-3" : "p-4")}>
      <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-[radial-gradient(circle,var(--accent-ring),transparent_70%)] opacity-60" />
      <div className="relative">
        <label htmlFor="request" className="flex items-center gap-2 text-xs font-medium text-muted">
          <Sparkles className="h-3.5 w-3.5 text-accent" /> AI会社に仕事を依頼する
        </label>
        <textarea
          id="request"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && text.trim().length >= 3) submit();
          }}
          rows={compact ? 2 : 3}
          maxLength={8000}
          placeholder="例）競合他社を調査して、新しいマーケティング施策を考えて"
          className="mt-2 w-full resize-none bg-transparent text-[15px] leading-relaxed text-fg placeholder:text-faint focus:outline-none"
        />
        {!compact && !text ? (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {EXAMPLES.map((ex) => (
              <button key={ex} type="button" onClick={() => setText(ex)} className="rounded-full border border-line px-2.5 py-1 text-[11px] text-muted transition-colors hover:border-line-strong hover:text-fg">
                {ex}
              </button>
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <div className="w-full sm:w-60">
          <Select value={target} onChange={(e) => setTarget(e.target.value)} className="h-8 text-xs" aria-label="担当">
            <option value="">自動で割り当て（Orchestrator）</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id} disabled={e.paused}>
                {e.role}
                {e.paused ? "（一時停止中）" : ""}
              </option>
            ))}
          </Select>
          </div>
          <div className="w-[calc(100%-3rem)] sm:w-36">
          <Select value={priority} onChange={(e) => setPriority(e.target.value)} className="h-8 text-xs" aria-label="優先度">
            <option value="LOW">優先度: 低</option>
            <option value="NORMAL">優先度: 通常</option>
            <option value="HIGH">優先度: 高</option>
            <option value="URGENT">優先度: 緊急</option>
          </Select>
          </div>
          {error ? <span className="text-xs text-danger">{error}</span> : null}
          <button
            type="button"
            onClick={submit}
            disabled={pending || text.trim().length < 3}
            className="ml-auto grid h-9 w-9 place-items-center rounded-lg bg-accent text-white transition-colors hover:bg-accent-2 disabled:opacity-40"
            aria-label="依頼する"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
