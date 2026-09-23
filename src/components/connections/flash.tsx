import { providerInfo } from "@/lib/catalog";

const ERRORS: Record<string, string> = {
  denied: "連携がキャンセルされました。",
  scope: "必要な権限が許可されませんでした。すべての項目を許可してもう一度お試しください。",
  state: "連携の有効期限が切れました。もう一度お試しください。",
  session: "ログイン中のアカウントが異なるため連携できませんでした。",
  google_not_configured: "Google 連携がまだ設定されていません（GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET）。",
  unsupported: "このサービスはまだ接続できません。",
  oauth: "連携に失敗しました。もう一度お試しください。",
};

export function ConnectFlash({ connected, error }: { connected?: string; error?: string }) {
  if (connected) {
    return <div className="rounded-lg border border-success/30 bg-success-soft px-4 py-2.5 text-sm text-success">✓ {providerInfo(connected)?.name ?? connected} を接続しました</div>;
  }
  if (error) return <div className="rounded-lg border border-danger/30 bg-danger-soft px-4 py-2.5 text-sm text-danger">{ERRORS[error] ?? ERRORS.oauth}</div>;
  return null;
}
