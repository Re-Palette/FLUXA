"use client";
import { useActionState } from "react";
import { Field, FormError, Input } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { loginAction, signupAction, type AuthState } from "./actions";

export function AuthForm({ mode, next }: { mode: "login" | "signup"; next?: string }) {
  const [state, action] = useActionState<AuthState, FormData>(mode === "login" ? loginAction : signupAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <FormError message={state?.error} />
      {mode === "signup" ? (
        <Field label="お名前" htmlFor="name">
          <Input id="name" name="name" autoComplete="name" required defaultValue={state?.fields?.name} placeholder="山田 太郎" />
        </Field>
      ) : null}
      <Field label="メールアドレス" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state?.fields?.email} placeholder="you@company.com" />
      </Field>
      <Field label="パスワード" htmlFor="password" hint={mode === "signup" ? "10文字以上" : undefined}>
        <Input id="password" name="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} required minLength={mode === "signup" ? 10 : 1} />
      </Field>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <SubmitButton className="w-full" pendingText={mode === "login" ? "ログイン中…" : "作成中…"}>
        {mode === "login" ? "ログイン" : "アカウントを作成"}
      </SubmitButton>
    </form>
  );
}
