"use client";
import { useMemo, useState } from "react";
import { Plus, Sparkles, X } from "lucide-react";
import { providerInfo, responsibilityInfo } from "@/lib/catalog";
import { recommendConnections, responsibilityOptions, suggestMission } from "@/lib/recommend";
import { Checkbox, Input, Textarea } from "../ui/form";
import { Button } from "../ui/button";
import { ProviderIcon } from "../connections/provider-icon";

export interface RespItem {
  key: string | null;
  label: string;
}

export function ResponsibilityEditor({
  role,
  department,
  templateKey,
  value,
  onChange,
  mission,
  onMissionChange,
}: {
  role: string;
  department: string;
  templateKey: string | null;
  value: RespItem[];
  onChange: (v: RespItem[]) => void;
  mission: string;
  onMissionChange: (m: string) => void;
}) {
  const [custom, setCustom] = useState("");
  const options = useMemo(() => {
    const base = responsibilityOptions(templateKey, department);
    const extra = value.filter((v) => v.key && !base.includes(v.key)).map((v) => v.key!);
    return [...base, ...extra];
  }, [templateKey, department, value]);
  const selectedKeys = new Set(value.filter((v) => v.key).map((v) => v.key));
  const customs = value.filter((v) => !v.key);
  const recs = recommendConnections({ templateKey, responsibilityKeys: value.map((v) => v.key) }).slice(0, 6);

  const toggle = (key: string) => {
    if (selectedKeys.has(key)) onChange(value.filter((v) => v.key !== key));
    else onChange([...value, { key, label: responsibilityInfo(key)?.ja ?? key }]);
  };
  const addCustom = () => {
    const label = custom.trim();
    if (!label || value.some((v) => v.label === label)) return;
    onChange([...value, { key: null, label: label.slice(0, 120) }]);
    setCustom("");
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div>
        <p className="mb-3 text-xs font-medium text-muted">主な業務（複数選択可）</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {options.map((key) => {
            const info = responsibilityInfo(key);
            return (
              <label key={key} className="flex cursor-pointer items-center gap-3 rounded-lg border border-line bg-bg-elev px-3 py-2.5 text-sm transition-colors hover:border-line-strong has-[:checked]:border-accent/50">
                <Checkbox checked={selectedKeys.has(key)} onChange={() => toggle(key)} />
                <span className="min-w-0">
                  <span className="block">{info?.ja ?? key}</span>
                  <span className="block text-[11px] text-faint">{info?.en}</span>
                </span>
              </label>
            );
          })}
          {customs.map((c) => (
            <div key={c.label} className="flex items-center gap-3 rounded-lg border border-accent/40 bg-bg-elev px-3 py-2.5 text-sm">
              <Checkbox checked readOnly />
              <span className="min-w-0 flex-1 truncate">{c.label}</span>
              <button type="button" aria-label="削除" onClick={() => onChange(value.filter((v) => v !== c))} className="text-faint hover:text-danger">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <Input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustom();
              }
            }}
            placeholder="+ Custom Responsibility（自由入力）"
            maxLength={120}
          />
          <Button type="button" variant="secondary" onClick={addCustom} disabled={!custom.trim()}>
            <Plus className="h-4 w-4" /> 追加
          </Button>
        </div>

        <div className="mt-6">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-xs font-medium text-muted">Mission</p>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
              onClick={() => onMissionChange(suggestMission(role, value.map((v) => v.label), templateKey))}
            >
              <Sparkles className="h-3 w-3" /> 仕事内容から提案
            </button>
          </div>
          <Textarea value={mission} onChange={(e) => onMissionChange(e.target.value)} maxLength={500} className="min-h-[64px]" />
        </div>
      </div>

      <div className="rounded-xl border border-line bg-panel-2 p-4">
        <p className="text-xs font-medium text-muted">Recommended Connections</p>
        <p className="mt-1 text-[11px] text-faint">選んだ仕事内容から、必要なツールを提案します。</p>
        <ul className="mt-3 space-y-2">
          {recs.length === 0 ? <li className="text-xs text-faint">特に必要な連携はありません</li> : null}
          {recs.map((r) => {
            const p = providerInfo(r.provider);
            return (
              <li key={r.provider} className="flex items-center gap-2.5 text-sm">
                <ProviderIcon provider={r.provider} size={22} />
                <span className="flex-1 truncate">{p?.name}</span>
                <span className={r.strength === "recommended" ? "text-xs text-accent" : "text-xs text-faint"}>{r.strength === "recommended" ? "✓ 推奨" : "○ 任意"}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
