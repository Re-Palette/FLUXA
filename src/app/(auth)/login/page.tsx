import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/server/auth/session";
import { googleOAuthConfigured } from "@/server/env";
import { AuthForm } from "../auth-form";
import { GoogleButton } from "../google-button";

export const metadata = { title: "ログイン" };

const ERRORS: Record<string, string> = {
  oauth: "Google でのログインに失敗しました。もう一度お試しください。",
  oauth_email: "Google アカウントのメールアドレスが確認されていません。",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  if (await getSession()) redirect("/app");
  const next = typeof sp.next === "string" ? sp.next : undefined;
  const error = typeof sp.error === "string" ? ERRORS[sp.error] : undefined;
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">おかえりなさい</h1>
      <p className="mt-2 text-sm text-muted">あなたの AI 会社にログインします。</p>
      {error ? <p className="mt-4 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p> : null}
      <div className="mt-8 space-y-6">
        <GoogleButton enabled={googleOAuthConfigured()} next={next} />
        <div className="flex items-center gap-3 text-xs text-faint">
          <span className="h-px flex-1 bg-line" /> または <span className="h-px flex-1 bg-line" />
        </div>
        <AuthForm mode="login" next={next} />
      </div>
      <p className="mt-8 text-center text-sm text-muted">
        アカウントをお持ちでない方は{" "}
        <Link href="/signup" className="font-medium text-accent hover:underline">
          無料で始める
        </Link>
      </p>
    </div>
  );
}
