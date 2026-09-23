import type { Tone } from "@/components/ui/badge";

export const EMPLOYEE_STATUS: Record<string, { label: string; en: string; tone: Tone; pulse?: boolean }> = {
  IDLE: { label: "待機中", en: "Idle", tone: "neutral" },
  WORKING: { label: "作業中", en: "Working", tone: "success", pulse: true },
  THINKING: { label: "思考中", en: "Thinking", tone: "info", pulse: true },
  WAITING: { label: "待機", en: "Waiting", tone: "neutral" },
  WAITING_APPROVAL: { label: "承認待ち", en: "Waiting for Approval", tone: "warning", pulse: true },
  COMPLETED: { label: "完了", en: "Completed", tone: "success" },
  ERROR: { label: "エラー", en: "Error", tone: "danger" },
  PAUSED: { label: "一時停止中", en: "Paused", tone: "neutral" },
  OFFLINE: { label: "オフライン", en: "Offline", tone: "neutral" },
};

export const TASK_STATUS: Record<string, { label: string; tone: Tone }> = {
  PENDING: { label: "待機中", tone: "neutral" },
  PLANNING: { label: "計画中", tone: "info" },
  RUNNING: { label: "実行中", tone: "success" },
  WAITING: { label: "順番待ち", tone: "neutral" },
  APPROVAL_REQUIRED: { label: "承認待ち", tone: "warning" },
  COMPLETED: { label: "完了", tone: "success" },
  FAILED: { label: "失敗", tone: "danger" },
  CANCELLED: { label: "キャンセル", tone: "neutral" },
};

export const WORKFLOW_STATUS: Record<string, { label: string; tone: Tone }> = {
  PLANNING: { label: "計画中", tone: "info" },
  RUNNING: { label: "実行中", tone: "success" },
  WAITING_APPROVAL: { label: "承認待ち", tone: "warning" },
  COMPLETED: { label: "完了", tone: "success" },
  FAILED: { label: "失敗", tone: "danger" },
  CANCELLED: { label: "キャンセル", tone: "neutral" },
};

export const PRIORITY_LABEL: Record<string, string> = { LOW: "低", NORMAL: "通常", HIGH: "高", URGENT: "緊急" };
