"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pin, PinOff, Plus, Trash2 } from "lucide-react";
import type { Company } from "@prisma/client";
import { COMPANY_SIZES, INDUSTRIES } from "@/lib/catalog";
import { SCHEDULE_PRESETS } from "@/lib/cron";
import { addMemoryAction, createScheduleAction, deleteMemoryAction, deleteScheduleAction, toggleMemoryPinAction, toggleScheduleAction, updateCompanyAction } from "@/server/actions-shared/company";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";

type Result = { ok: boolean; error?: string; message?: string };

function useSubmit() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => Promise<Result>, onOk?: () => void) =>
    start(async () => {
      setMsg(null);
      const r = await fn();
      setMsg(r.ok ? (r.message ? { ok: true, text: r.message } : null) : { ok: false, text: r.error ?? "エラー" });
      if (r.ok) {
        onOk?.();
        router.refresh();
      }
    });
  return { pending, msg, run };
}

export function CompanyProfileForm({ company }: { company: Company }) {
  const [v, setV] = useState({ name: company.name, industry: company.industry, size: company.size, description: company.description, goal: company.goal, website: company.website ?? "" });
  const { pending, msg, run } = useSubmit();
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((s) => ({ ...s, [k]: e.target.value }));
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="会社名" required>
          <Input value={v.name} onChange={set("name")} maxLength={100} />
        </Field>
        <Field label="業種" required>
          <Select value={v.industry} onChange={set("industry")}>
            {INDUSTRIES.map((i) => (
              <option key={i}>{i}</option>
            ))}
          </Select>
        </Field>
        <Field label="規模" required>
          <Select value={v.size} onChange={set("size")}>
            {COMPANY_SIZES.map((i) => (
              <option key={i}>{i}</option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="会社の説明" required>
        <Textarea value={v.description} onChange={set("description")} maxLength={2000} />
      </Field>
      <Field label="会社の目標" required>
        <Textarea value={v.goal} onChange={set("goal")} maxLength={1000} className="min-h-[64px]" />
      </Field>
      <Field label="Web サイト">
        <Input value={v.website} onChange={set("website")} placeholder="https://" />
      </Field>
      <div className="flex items-center justify-end gap-3">
        {msg ? <span className={msg.ok ? "text-sm text-success" : "text-sm text-danger"}>{msg.text}</span> : null}
        <Button disabled={pending} onClick={() => run(() => updateCompanyAction(v))}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} 保存
        </Button>
      </div>
    </div>
  );
}

const KINDS = [
  { v: "brand", l: "ブランドガイドライン" },
  { v: "preference", l: "好み・方針" },
  { v: "decision", l: "重要な決定" },
  { v: "instruction", l: "全社員への指示" },
  { v: "note", l: "メモ" },
];

export function AddMemoryForm() {
  const [v, setV] = useState({ kind: "brand", title: "", content: "", pinned: true });
  const { pending, msg, run } = useSubmit();
  return (
    <div className="space-y-3 rounded-xl border border-line bg-panel-2 p-4">
      <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
        <Select value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value })}>
          {KINDS.map((k) => (
            <option key={k.v} value={k.v}>
              {k.l}
            </option>
          ))}
        </Select>
        <Input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="タイトル（例: トーン＆マナー）" maxLength={200} />
      </div>
      <Textarea value={v.content} onChange={(e) => setV({ ...v, content: e.target.value })} placeholder="AI社員に覚えておいてほしい内容" maxLength={10_000} />
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-muted">
          <Checkbox checked={v.pinned} onChange={(e) => setV({ ...v, pinned: e.target.checked })} /> 常にAI社員に共有する（ピン留め）
        </label>
        {msg && !msg.ok ? <span className="text-xs text-danger">{msg.text}</span> : null}
        <Button size="sm" className="ml-auto" disabled={pending || !v.title.trim() || !v.content.trim()} onClick={() => run(() => addMemoryAction(v), () => setV({ ...v, title: "", content: "" }))}>
          <Plus className="h-3.5 w-3.5" /> 記憶を追加
        </Button>
      </div>
    </div>
  );
}

export function MemoryRowActions({ id, pinned, editable }: { id: string; pinned: boolean; editable: boolean }) {
  const { pending, run } = useSubmit();
  return (
    <span className="flex gap-1">
      <button type="button" disabled={pending} onClick={() => run(() => toggleMemoryPinAction(id))} className="rounded p-1 text-faint hover:text-accent" aria-label={pinned ? "ピン留めを外す" : "ピン留め"}>
        {pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
      </button>
      {editable ? (
        <button type="button" disabled={pending} onClick={() => run(() => deleteMemoryAction(id))} className="rounded p-1 text-faint hover:text-danger" aria-label="削除">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </span>
  );
}

export function ScheduleForm({ employees }: { employees: { id: string; role: string }[] }) {
  const [v, setV] = useState({ name: "", employeeId: "", cron: SCHEDULE_PRESETS[1].cron as string, timezone: "Asia/Tokyo", instruction: "" });
  const { pending, msg, run } = useSubmit();
  return (
    <div className="space-y-3 rounded-xl border border-line bg-panel-2 p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="名前（例: 週次レポート）" maxLength={100} />
        <Select value={v.cron} onChange={(e) => setV({ ...v, cron: e.target.value })}>
          {SCHEDULE_PRESETS.map((p) => (
            <option key={p.key} value={p.cron}>
              {p.label}
            </option>
          ))}
        </Select>
        <Select value={v.employeeId} onChange={(e) => setV({ ...v, employeeId: e.target.value })}>
          <option value="">自動で割り当て</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.role}
            </option>
          ))}
        </Select>
      </div>
      <Textarea value={v.instruction} onChange={(e) => setV({ ...v, instruction: e.target.value })} placeholder="例) 今週の会社全体の活動をまとめ、完了タスク・失敗・重要な発見・次のアクションを含むレポートを作成して" maxLength={4000} />
      <div className="flex items-center gap-3">
        <span className="text-[11px] text-faint">タイムゾーン: {v.timezone}</span>
        {msg && !msg.ok ? <span className="text-xs text-danger">{msg.text}</span> : null}
        <Button size="sm" className="ml-auto" disabled={pending || !v.name.trim() || v.instruction.trim().length < 3} onClick={() => run(() => createScheduleAction({ ...v, employeeId: v.employeeId || null }), () => setV({ ...v, name: "", instruction: "" }))}>
          <Plus className="h-3.5 w-3.5" /> 定期実行を追加
        </Button>
      </div>
    </div>
  );
}

export function ScheduleRowActions({ id, enabled }: { id: string; enabled: boolean }) {
  const { pending, run } = useSubmit();
  return (
    <span className="flex items-center gap-2">
      <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => toggleScheduleAction(id))}>
        {enabled ? "停止" : "再開"}
      </Button>
      <button type="button" disabled={pending} onClick={() => run(() => deleteScheduleAction(id))} className="rounded p-1 text-faint hover:text-danger" aria-label="削除">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}
