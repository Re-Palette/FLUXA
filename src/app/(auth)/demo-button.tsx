import { Eye, ListChecks } from "lucide-react";
import { DEMO_EMAIL, DEMO_NAME, DEMO_PASSWORD, demoLoginEnabled } from "@/server/services/demo";
import { SubmitButton } from "@/components/ui/submit-button";
import { demoLoginAction, demoOnboardingTrialAction } from "./actions";

/** "Look inside" entry with sample data. Only rendered when demo login is enabled. */
export function DemoButton({ className, showCredentials = false }: { className?: string; showCredentials?: boolean }) {
  if (!demoLoginEnabled()) return null;
  return (
    <div className={className}>
      <form action={demoLoginAction}>
        <SubmitButton variant="outline" className="w-full" pendingText="デモを準備中…">
          <Eye className="h-4 w-4" /> デモで中を見る（登録不要）
        </SubmitButton>
      </form>
      {showCredentials ? (
        <form action={demoOnboardingTrialAction} className="mt-2">
          <SubmitButton variant="ghost" className="w-full" pendingText="準備中…">
            <ListChecks className="h-4 w-4" /> 初期設定（会社作成〜AI社員選択）から体験する
          </SubmitButton>
        </form>
      ) : null}
      {showCredentials ? (
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg border border-line bg-panel-2 px-3 py-2.5 text-xs">
          <dt className="text-faint">名前</dt>
          <dd>{DEMO_NAME}</dd>
          <dt className="text-faint">メール</dt>
          <dd className="select-all font-mono">{DEMO_EMAIL}</dd>
          <dt className="text-faint">パスワード</dt>
          <dd className="select-all font-mono">{DEMO_PASSWORD}</dd>
          <dd className="col-span-2 mt-1 text-[11px] text-faint">下のフォームにこのメールとパスワードを入れてもログインできます（デモ用アカウント）。</dd>
        </dl>
      ) : null}
    </div>
  );
}
