import { ExternalLink, Info } from "lucide-react";
import { googleSetupStatus } from "@/lib/google-setup";

/**
 * Developer-facing setup guide for Google sign-in. Rendered only outside production and only while
 * Google is not configured, so end users never see it.
 */
export function GoogleSetupHint() {
  if (process.env.NODE_ENV === "production") return null;
  const s = googleSetupStatus(process.env);
  if (s.configured) return null;
  return (
    <details className="group rounded-xl border border-info/30 bg-info-soft/40 text-xs">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-info">
        <Info className="h-3.5 w-3.5" /> Google ログインを有効にするには（開発者向け）
      </summary>
      <div className="space-y-3 border-t border-info/20 px-3 py-3 leading-relaxed text-muted">
        {s.issues.length ? (
          <ul className="space-y-0.5 text-warning">
            {s.issues.map((i) => (
              <li key={i}>• {i}</li>
            ))}
          </ul>
        ) : null}
        <ol className="list-decimal space-y-1.5 pl-4">
          <li>
            <a href="https://console.cloud.google.com/auth/overview" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-accent hover:underline">
              Google Cloud Console <ExternalLink className="h-3 w-3" />
            </a>{" "}
            で OAuth 同意画面（Google Auth Platform）を設定
          </li>
          <li>「クライアント」→「クライアントを作成」→ 種類「ウェブ アプリケーション」</li>
          <li>
            承認済みの JavaScript 生成元:
            <code className="mt-1 block select-all break-all rounded bg-bg-elev px-2 py-1 font-mono text-[11px] text-fg">{s.javascriptOrigin}</code>
          </li>
          <li>
            承認済みのリダイレクト URI（2つとも追加）:
            <code className="mt-1 block select-all break-all rounded bg-bg-elev px-2 py-1 font-mono text-[11px] text-fg">{s.redirectUris.login}</code>
            <code className="mt-1 block select-all break-all rounded bg-bg-elev px-2 py-1 font-mono text-[11px] text-fg">{s.redirectUris.connect}</code>
          </li>
          <li>
            発行されたクライアント ID とシークレットを <code className="font-mono text-fg">.env</code> に設定してサーバーを再起動:
            <pre className="mt-1 overflow-x-auto rounded bg-bg-elev px-2 py-1 font-mono text-[11px] text-fg">{`GOOGLE_CLIENT_ID="…apps.googleusercontent.com"\nGOOGLE_CLIENT_SECRET="GOCSPX-…"`}</pre>
          </li>
          <li>
            <code className="font-mono text-fg">npm run google:check</code> で設定を確認
          </li>
        </ol>
        <p>詳しい手順: docs/google-login-setup.md</p>
      </div>
    </details>
  );
}
