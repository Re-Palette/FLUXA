"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pause, Play, Trash2 } from "lucide-react";
import type { Policy } from "@/lib/tool-catalog";
import { deleteEmployeeAction, setEmployeePausedAction, updateEmployeeAction, updatePermissionsAction } from "@/server/actions-shared/employees";
import { PermissionEditor, type PermissionValue } from "@/components/employees/permission-editor";
import { ResponsibilityEditor, type RespItem } from "@/components/employees/responsibility-editor";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm";
import { Field, Input, Select, Textarea } from "@/components/ui/form";

function SaveBar({ pending, onSave, msg, error }: { pending: boolean; onSave: () => void; msg: string | null; error: string | null }) {
  return (
    <div className="mt-6 flex items-center justify-end gap-3">
      {error ? <span className="text-sm text-danger">{error}</span> : msg ? <span className="text-sm text-success">{msg}</span> : null}
      <Button onClick={onSave} disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} 保存
      </Button>
    </div>
  );
}

export function EmployeeActions({ id, role, paused }: { id: string; role: string; paused: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await setEmployeePausedAction(id, !paused);
            router.refresh();
          })
        }
      >
        {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />} {paused ? "再開" : "一時停止"}
      </Button>
      <ConfirmButton
        title={`${role} を削除しますか？`}
        description="この社員の設定・権限・タスク履歴は削除されます（作成済みのレポートは残ります）。この操作は取り消せません。"
        confirmLabel="削除する"
        action={async () => {
          const r = await deleteEmployeeAction(id);
          if (r.ok) router.push("/app/employees");
          return r;
        }}
      >
        <Trash2 className="h-3.5 w-3.5" /> 削除
      </ConfirmButton>
    </>
  );
}

export function EmployeeProfileForm({
  employee,
  modelOptions,
}: {
  employee: { id: string; name: string; role: string; department: string; templateKey: string | null; mission: string; instructions: string; model: string | null; responsibilities: RespItem[] };
  modelOptions: { value: string; label: string }[];
}) {
  const router = useRouter();
  const [name, setName] = useState(employee.name);
  const [role, setRole] = useState(employee.role);
  const [mission, setMission] = useState(employee.mission);
  const [instructions, setInstructions] = useState(employee.instructions);
  const [model, setModel] = useState(employee.model ?? "");
  const [resp, setResp] = useState<RespItem[]>(employee.responsibilities);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="役職">
          <Input value={role} onChange={(e) => setRole(e.target.value)} maxLength={80} />
        </Field>
        <Field label="名前">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </Field>
        <Field label="AIモデル" hint="空欄なら会社の既定を使用">
          <Select value={model} onChange={(e) => setModel(e.target.value)}>
            <option value="">会社の既定</option>
            {modelOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="mt-6">
        <ResponsibilityEditor role={role} department={employee.department} templateKey={employee.templateKey} value={resp} onChange={setResp} mission={mission} onMissionChange={setMission} />
      </div>
      <Field label="追加の指示" className="mt-6" hint="この社員が常に守るルールやトーン">
        <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} maxLength={4000} />
      </Field>
      <SaveBar
        pending={pending}
        msg={msg}
        error={error}
        onSave={() =>
          start(async () => {
            setMsg(null);
            setError(null);
            const r = await updateEmployeeAction(employee.id, { name, role, mission, instructions, model: model || null, responsibilities: resp });
            if (r.ok) {
              setMsg(r.message ?? "保存しました");
              router.refresh();
            } else setError(r.error);
          })
        }
      />
    </div>
  );
}

export function EmployeePermissionsForm({
  employeeId,
  initial,
  connected,
  templateKey,
  responsibilityKeys,
}: {
  employeeId: string;
  initial: { connectionAccess: string[]; toolPolicies: Record<string, Policy> };
  connected: string[];
  templateKey: string | null;
  responsibilityKeys: (string | null)[];
}) {
  const router = useRouter();
  const [value, setValue] = useState<PermissionValue>(initial);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <PermissionEditor value={value} onChange={setValue} connected={connected} templateKey={templateKey} responsibilityKeys={responsibilityKeys} />
      <SaveBar
        pending={pending}
        msg={msg}
        error={error}
        onSave={() =>
          start(async () => {
            setMsg(null);
            setError(null);
            const r = await updatePermissionsAction(employeeId, value);
            if (r.ok) {
              setMsg(r.message ?? "保存しました");
              router.refresh();
            } else setError(r.error);
          })
        }
      />
    </div>
  );
}
