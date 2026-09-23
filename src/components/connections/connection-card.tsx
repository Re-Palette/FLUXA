"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ExternalLink, KeyRound, Loader2, AlertTriangle, ShieldCheck } from "lucide-react";
import type { ProviderInfo } from "@/lib/catalog";
import { connectApiKeyAction, disconnectAction, retestConnectionAction } from "@/server/actions-shared/connections";
import { Badge } from "../ui/badge";
import { Button, buttonClass } from "../ui/button";
import { ConfirmButton } from "../ui/confirm";
import { Input } from "../ui/form";
import { cn } from "../ui/cn";
import { ProviderIcon } from "./provider-icon";

export interface ConnectionState {
  status: "CONNECTED" | "ERROR" | "DISCONNECTED";
  accountLabel: string | null;
  secretHint: string | null;
  lastError: string | null;
}

export function ConnectionCard({
  provider,
  state,
  returnTo,
  recommendation,
  canManage = true,
  googleReady = true,
  compact = false,
}: {
  provider: ProviderInfo;
  state: ConnectionState | null;
  returnTo: string;
  recommendation?: "recommended" | "optional";
  canManage?: boolean;
  googleReady?: boolean;
  compact?: boolean;
}) {
  const connected = state?.status === "CONNECTED";
  const errored = state?.status === "ERROR";
  const comingSoon = provider.status === "coming_soon";
  return (
    <div className={cn("flex flex-col rounded-xl border bg-panel transition-colors", connected ? "border-success/30" : "border-line", compact ? "p-3" : "p-4")}>
      <div className="flex items-start gap-3">
        <ProviderIcon provider={provider.key} size={compact ? 30 : 36} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-sm font-medium">{provider.name}</p>
            {recommendation === "recommended" ? <Badge tone="accent">推奨</Badge> : recommendation === "optional" ? <Badge>任意</Badge> : null}
            {comingSoon ? <Badge>Coming Soon</Badge> : null}
          </div>
          {!compact ? <p className="mt-1 text-xs leading-relaxed text-muted">{provider.description}</p> : null}
          {connected ? (
            <p className="mt-1.5 flex items-center gap-1 text-xs text-success">
              <CheckCircle2 className="h-3.5 w-3.5" /> Connected
              {state?.accountLabel ? <span className="truncate text-muted">· {state.accountLabel}</span> : null}
              {state?.secretHint ? <span className="font-mono text-faint">· {state.secretHint}</span> : null}
            </p>
          ) : errored ? (
            <p className="mt-1.5 flex items-center gap-1 text-xs text-danger">
              <AlertTriangle className="h-3.5 w-3.5" /> {state?.lastError ?? "再接続が必要です"}
            </p>
          ) : null}
        </div>
      </div>
      {!comingSoon && canManage ? (
        <div className={cn("flex flex-wrap items-center gap-2", compact ? "mt-3" : "mt-4")}>
          {connected ? (
            <ConnectedActions provider={provider} />
          ) : provider.authType === "oauth" ? (
            googleReady ? (
              <a href={`/api/connections/google/start?provider=${provider.key}&returnTo=${encodeURIComponent(returnTo)}`} className={buttonClass("primary", "sm")}>
                <ExternalLink className="h-3.5 w-3.5" /> {provider.connectLabel}
              </a>
            ) : (
              <span className="text-xs text-faint">管理者が Google 連携を設定すると接続できます</span>
            )
          ) : (
            <ApiKeyConnect provider={provider} reconnect={errored} />
          )}
        </div>
      ) : null}
    </div>
  );
}

function ConnectedActions({ provider }: { provider: ProviderInfo }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <>
      {provider.authType === "api_key" ? (
        <Button
          variant="secondary"
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await retestConnectionAction(provider.key);
              setMsg(r.ok ? (r.message ?? "OK") : r.error);
              router.refresh();
            })
          }
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />} 接続テスト
        </Button>
      ) : null}
      <ConfirmButton
        variant="ghost"
        title={`${provider.name} の接続を解除しますか？`}
        description="このサービスを使うAI社員の仕事は実行できなくなります。保存された認証情報は削除されます。"
        confirmLabel="接続を解除"
        action={async () => {
          const r = await disconnectAction(provider.key);
          router.refresh();
          return r;
        }}
      >
        接続を解除
      </ConfirmButton>
      {msg ? <span className="text-xs text-muted">{msg}</span> : null}
    </>
  );
}

function ApiKeyConnect({ provider, reconnect }: { provider: ProviderInfo; reconnect: boolean }) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState("");
  return (
    <>
      <Button size="sm" onClick={() => ref.current?.showModal()}>
        <KeyRound className="h-3.5 w-3.5" /> {reconnect ? "再接続" : provider.connectLabel}
      </Button>
      <dialog
        ref={ref}
        onClose={() => {
          setKey("");
          setError(null);
        }}
        className="m-auto w-[min(92vw,460px)] rounded-2xl border border-line bg-panel p-0 text-fg backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <form
          className="p-6"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              setError(null);
              const r = await connectApiKeyAction(provider.key, key);
              if (!r.ok) setError(r.error);
              else {
                setKey("");
                ref.current?.close();
                router.refresh();
              }
            });
          }}
        >
          <div className="flex items-center gap-3">
            <ProviderIcon provider={provider.key} />
            <div>
              <h3 className="text-base font-semibold">{provider.connectLabel}</h3>
              <p className="text-xs text-muted">{provider.description}</p>
            </div>
          </div>
          <label className="mt-5 block text-xs font-medium text-muted" htmlFor={`key-${provider.key}`}>
            {provider.name} のキー
          </label>
          <Input
            id={`key-${provider.key}`}
            type="password"
            autoComplete="off"
            spellCheck={false}
            className="mt-1.5 font-mono"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="貼り付けてください"
            required
          />
          {provider.keyHint ? (
            <p className="mt-1.5 text-xs text-faint">
              {provider.keyHint}
              {provider.keyUrl ? (
                <>
                  {" · "}
                  <a href={provider.keyUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                    キーを発行する
                  </a>
                </>
              ) : null}
            </p>
          ) : null}
          <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-panel-2 p-2.5 text-[11px] leading-relaxed text-muted">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
            接続テストに成功した場合のみ、暗号化してサーバーに保存します。キーがブラウザに保存・再表示されることはありません。
          </p>
          {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
          <div className="mt-6 flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => ref.current?.close()} disabled={pending}>
              キャンセル
            </Button>
            <Button type="submit" size="sm" disabled={pending || key.trim().length < 8}>
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {pending ? "接続テスト中…" : "Test & Connect"}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
