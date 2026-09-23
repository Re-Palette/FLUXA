"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Sparkles, Wand2 } from "lucide-react";
import { DEPARTMENTS, EMPLOYEE_TEMPLATES, TEAM_PACKS, departmentJa, responsibilityInfo, templateInfo } from "@/lib/catalog";
import { addTeamPackAction, createEmployeeAction } from "@/server/actions-shared/employees";
import { EmployeeAvatar } from "@/components/employees/avatar";
import { ResponsibilityEditor, type RespItem } from "@/components/employees/responsibility-editor";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { Field, Input, Select, Textarea } from "@/components/ui/form";

export function EmployeeBuilder({ existingTemplateKeys }: { existingTemplateKeys: string[] }) {
  const router = useRouter();
  const [templateKey, setTemplateKey] = useState<string | null>(null);
  const [role, setRole] = useState("");
  const [name, setName] = useState("");
  const [department, setDepartment] = useState<string>("Marketing");
  const [mission, setMission] = useState("");
  const [instructions, setInstructions] = useState("");
  const [resp, setResp] = useState<RespItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const pick = (key: string | null) => {
    setTemplateKey(key);
    const t = templateInfo(key);
    if (t) {
      setRole(t.name);
      setDepartment(t.department);
      setMission(t.defaultMission);
      setResp(t.defaultResponsibilities.map((k) => ({ key: k, label: responsibilityInfo(k)?.ja ?? k })));
    } else {
      setRole("");
      setMission("");
      setResp([]);
    }
  };

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-xs font-semibold tracking-[0.16em] text-muted">TEAM TEMPLATES</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {TEAM_PACKS.map((p) => (
            <div key={p.key} className="panel flex flex-col p-4">
              <p className="flex items-center gap-2 text-sm font-medium">
                <Sparkles className="h-4 w-4 text-accent" /> {p.name}
              </p>
              <p className="mt-1 text-xs text-muted">{p.description}</p>
              <p className="mt-2 text-[11px] text-faint">{p.templates.map((t) => templateInfo(t)?.name).join(" · ")}</p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-3 self-start"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    setError(null);
                    const r = await addTeamPackAction(p.key);
                    if (!r.ok) setError(r.error);
                    else {
                      setNotice(r.data!.added ? `${r.data!.added} 名を追加しました` : "すでに全員在籍しています");
                      router.refresh();
                    }
                  })
                }
              >
                一括追加
              </Button>
            </div>
          ))}
        </div>
        {notice ? <p className="mt-3 text-sm text-success">{notice}</p> : null}
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold tracking-[0.16em] text-muted">1. START FROM</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <button
            type="button"
            onClick={() => pick(null)}
            className={cn("panel flex items-center gap-3 p-3 text-left transition-colors hover:border-line-strong", templateKey === null && "border-accent/60 bg-accent-soft/40")}
          >
            <span className="grid h-9 w-9 place-items-center rounded-full border border-dashed border-accent/60 text-accent">
              <Wand2 className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-sm font-medium">オリジナル</span>
              <span className="block text-[11px] text-faint">ゼロから作成</span>
            </span>
          </button>
          {EMPLOYEE_TEMPLATES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => pick(t.key)}
              className={cn("panel relative flex items-center gap-3 p-3 text-left transition-colors hover:border-line-strong", templateKey === t.key && "border-accent/60 bg-accent-soft/40")}
            >
              <EmployeeAvatar department={t.department} size={36} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{t.name}</span>
                <span className="block text-[11px] text-faint">{departmentJa(t.department)}</span>
              </span>
              {existingTemplateKeys.includes(t.key) ? <Check className="absolute right-2 top-2 h-3.5 w-3.5 text-success" aria-label="在籍中" /> : null}
            </button>
          ))}
        </div>
      </section>

      <Card className="p-5 sm:p-6">
        <h2 className="mb-5 text-xs font-semibold tracking-[0.16em] text-muted">2. PROFILE</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="役職 (Role)" required>
            <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="例) Brand Manager" maxLength={80} />
          </Field>
          <Field label="名前（任意）" hint="空欄なら役職名を使います">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例) Aoi" maxLength={80} />
          </Field>
          <Field label="部署 (Department)" required>
            <Select value={department} onChange={(e) => setDepartment(e.target.value)} disabled={templateKey !== null}>
              {DEPARTMENTS.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.key} · {d.ja}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <h2 className="mb-4 mt-8 text-xs font-semibold tracking-[0.16em] text-muted">3. RESPONSIBILITIES & MISSION</h2>
        <ResponsibilityEditor role={role || "AI Employee"} department={department} templateKey={templateKey} value={resp} onChange={setResp} mission={mission} onMissionChange={setMission} />
        <Field label="追加の指示（任意）" hint="トーン、禁止事項、必ず守ってほしいルールなど" className="mt-6">
          <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} maxLength={4000} placeholder="例) 常にデータの出典を明記すること。競合を誹謗しないこと。" />
        </Field>
        <p className="mt-6 text-xs text-muted">ツール連携と権限は、作成後の社員ページで設定できます（仕事内容から推奨設定が自動で適用されます）。</p>
        {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
        <div className="mt-6 flex justify-end">
          <Button
            disabled={pending || !role.trim() || !mission.trim() || resp.length === 0}
            onClick={() =>
              start(async () => {
                setError(null);
                const r = await createEmployeeAction({ templateKey, role, name, department, mission, instructions, responsibilities: resp });
                if (!r.ok) setError(r.error);
                else router.push(`/app/employees/${r.data!.id}?created=1`);
              })
            }
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Create Employee
          </Button>
        </div>
      </Card>
    </div>
  );
}
