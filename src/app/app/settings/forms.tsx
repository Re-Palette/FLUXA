"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Moon, Sun } from "lucide-react";
import { revokeSessionAction, setDefaultModelAction, updateUsageLimitsAction } from "@/server/actions-shared/settings";
import { setThemeAction } from "@/server/actions-shared/preferences";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Field, Input, Select } from "@/components/ui/form";

export function ThemeSwitch({ current }: { current: "dark" | "light" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="inline-grid grid-cols-2 gap-1 rounded-lg border border-line bg-panel-2 p-1">
      {(["dark", "light"] as const).map((t) => (
        <button
          key={t}
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await setThemeAction(t);
              router.refresh();
            })
          }
          className={cn("flex items-center gap-2 rounded-md px-4 py-1.5 text-sm", current === t ? "bg-accent text-white" : "text-muted hover:text-fg")}
        >
          {t === "dark" ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />} {t === "dark" ? "Dark" : "Light"}
        </button>
      ))}
    </div>
  );
}

export function DefaultModelForm({ current, options }: { current: string | null; options: { value: string; label: string }[] }) {
  const router = useRouter();
  const [v, setV] = useState(current ?? "");
  const [custom, setCustom] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-end gap-3">
      <Field label="既定のAIモデル" className="min-w-[260px] flex-1">
        <Select value={v} onChange={(e) => setV(e.target.value)}>
          <option value="">自動（接続済みのプロバイダーから選択）</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
          <option value="__custom">カスタム…</option>
        </Select>
      </Field>
      {v === "__custom" ? (
        <Field label="provider:model" className="min-w-[240px] flex-1">
          <Input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="anthropic:claude-sonnet-5" />
        </Field>
      ) : null}
      <Button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await setDefaultModelAction(v === "__custom" ? custom : v || null);
            setMsg(r.ok ? (r.message ?? "OK") : r.error);
            router.refresh();
          })
        }
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} 保存
      </Button>
      {msg ? <span className="text-sm text-muted">{msg}</span> : null}
    </div>
  );
}

type Limits = { dailyRequestLimit: number | null; monthlyRequestLimit: number | null; dailyTokenLimit: number | null; monthlyTokenLimit: number | null; monthlyCostLimitUsd: number | null };

export function UsageLimitsForm({ initial }: { initial: Limits }) {
  const router = useRouter();
  const [v, setV] = useState<Record<keyof Limits, string>>(() => Object.fromEntries(Object.entries(initial).map(([k, x]) => [k, x == null ? "" : String(x)])) as Record<keyof Limits, string>);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const fields: { k: keyof Limits; l: string }[] = [
    { k: "dailyRequestLimit", l: "1日のAIリクエスト上限" },
    { k: "monthlyRequestLimit", l: "月間AIリクエスト上限" },
    { k: "dailyTokenLimit", l: "1日のトークン上限" },
    { k: "monthlyTokenLimit", l: "月間トークン上限" },
    { k: "monthlyCostLimitUsd", l: "月間推定コスト上限 (USD)" },
  ];
  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map((f) => (
          <Field key={f.k} label={f.l} hint="空欄 = 無制限">
            <Input type="number" min={0} step={f.k === "monthlyCostLimitUsd" ? "0.01" : "1"} value={v[f.k]} onChange={(e) => setV({ ...v, [f.k]: e.target.value })} />
          </Field>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-end gap-3">
        {msg ? <span className={msg.ok ? "text-sm text-success" : "text-sm text-danger"}>{msg.t}</span> : null}
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const payload = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x === "" ? null : Number(x)]));
              const r = await updateUsageLimitsAction(payload);
              setMsg(r.ok ? { ok: true, t: r.message ?? "OK" } : { ok: false, t: r.error });
              router.refresh();
            })
          }
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} 上限を保存
        </Button>
      </div>
    </div>
  );
}

export function RevokeSessionButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await revokeSessionAction(id);
          router.refresh();
        })
      }
    >
      ログアウトさせる
    </Button>
  );
}
