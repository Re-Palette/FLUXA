"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw } from "lucide-react";
import { cancelWorkflowAction, retryPlanningAction, retryTaskAction } from "@/server/actions-shared/work";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm";

export function RetryTaskButton({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      <Button
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await retryTaskAction(taskId);
            if (!r.ok) setError(r.error);
            router.refresh();
          })
        }
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} 再試行
      </Button>
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </span>
  );
}

export function RetryPlanningButton({ workflowId }: { workflowId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await retryPlanningAction(workflowId);
          router.refresh();
        })
      }
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} もう一度実行
    </Button>
  );
}

export function CancelWorkflowButton({ workflowId }: { workflowId: string }) {
  const router = useRouter();
  return (
    <ConfirmButton
      variant="ghost"
      title="この依頼をキャンセルしますか？"
      description="未実行のステップと承認待ちのアクションはすべて取り消されます。実行中のステップは完了まで続く場合があります。"
      confirmLabel="キャンセルする"
      action={async () => {
        const r = await cancelWorkflowAction(workflowId);
        router.refresh();
        return r;
      }}
    >
      キャンセル
    </ConfirmButton>
  );
}
