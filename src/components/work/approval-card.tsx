"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Loader2, X } from "lucide-react";
import { RISK_LABELS, type RiskTag } from "@/lib/tool-catalog";
import { decideApprovalAction } from "@/server/actions-shared/work";
import { timeAgo } from "@/lib/format";
import { EmployeeAvatar } from "../employees/avatar";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/form";

export interface ApprovalView {
  id: string;
  title: string;
  summary: string;
  riskTags: string[];
  payload: unknown;
  createdAt: string;
  employee: { role: string; department: string };
}

export function ApprovalCard({ approval }: { approval: ApprovalView }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const decide = (d: "APPROVED" | "REJECTED") =>
    start(async () => {
      setError(null);
      const r = await decideApprovalAction(approval.id, d, d === "REJECTED" ? reason : undefined);
      if (!r.ok) setError(r.error);
      router.refresh();
    });

  return (
    <div className="rounded-xl border border-warning/40 bg-panel p-4">
      <div className="flex items-start gap-3">
        <EmployeeAvatar department={approval.employee.department} size={34} />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">
            {approval.employee.role} · {timeAgo(approval.createdAt)}
          </p>
          <p className="mt-0.5 text-sm font-medium">「{approval.title}」を実行しようとしています</p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {approval.riskTags.map((t) => (
              <Badge key={t} tone="warning">
                {RISK_LABELS[t as RiskTag] ?? t}
              </Badge>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-3 whitespace-pre-wrap rounded-lg bg-bg-elev p-3 text-xs leading-relaxed text-muted">{approval.summary}</p>
      <details className="mt-2">
        <summary className="flex cursor-pointer list-none items-center gap-1 text-[11px] text-faint hover:text-fg">
          <ChevronDown className="h-3 w-3" /> View（実行内容の詳細）
        </summary>
        <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-bg-elev p-3 text-[11px] leading-relaxed text-muted">{JSON.stringify(approval.payload, null, 2)}</pre>
      </details>
      {rejecting ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="却下の理由（任意・AI社員に伝わります）" maxLength={500} className="h-9 flex-1" />
          <Button size="sm" variant="danger" disabled={pending} onClick={() => decide("REJECTED")}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />} 却下する
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setRejecting(false)}>
            戻る
          </Button>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <Button size="sm" disabled={pending} onClick={() => decide("APPROVED")}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Approve
          </Button>
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => setRejecting(true)}>
            <X className="h-3.5 w-3.5" /> Reject
          </Button>
        </div>
      )}
      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
    </div>
  );
}
