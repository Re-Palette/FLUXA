import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/server/auth/session";
import { googleOAuthConfigured } from "@/server/env";
import { AuthForm } from "../auth-form";
import { GoogleButton } from "../google-button";
import { GoogleSetupHint } from "../google-setup-hint";
import { DemoButton } from "../demo-button";

export const metadata = { title: "無料で始める" };

export default async function SignupPage() {
  if (await getSession()) redirect("/app");
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Build your AI Company</h1>
      <p className="mt-2 text-sm text-muted">アカウントを作成して、あなた専用の AI 会社をつくりましょう。</p>
      <div className="mt-8 space-y-6">
        <DemoButton />
        <GoogleButton enabled={googleOAuthConfigured()} />
        <GoogleSetupHint />
        <div className="flex items-center gap-3 text-xs text-faint">
          <span className="h-px flex-1 bg-line" /> または <span className="h-px flex-1 bg-line" />
        </div>
        <AuthForm mode="signup" />
      </div>
      <p className="mt-8 text-center text-sm text-muted">
        すでにアカウントをお持ちの方は{" "}
        <Link href="/login" className="font-medium text-accent hover:underline">
          ログイン
        </Link>
      </p>
    </div>
  );
}
