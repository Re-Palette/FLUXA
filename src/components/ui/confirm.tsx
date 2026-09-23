"use client";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "./button";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";

/** Button that opens a confirmation dialog before running a server action. */
export function ConfirmButton({
  children,
  title,
  description,
  confirmLabel = "実行する",
  action,
  variant = "danger",
  size = "sm",
  className,
}: {
  children: ReactNode;
  title: string;
  description?: string;
  confirmLabel?: string;
  action: () => Promise<{ ok: boolean; error?: string } | void>;
  variant?: Variant;
  size?: "sm" | "md";
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <Button type="button" variant={variant} size={size} className={className} onClick={() => ref.current?.showModal()}>
        {children}
      </Button>
      <dialog ref={ref} className="m-auto w-[min(92vw,420px)] rounded-2xl border border-line bg-panel p-0 text-fg backdrop:bg-black/60 backdrop:backdrop-blur-sm">
        <div className="p-6">
          <h3 className="text-base font-semibold">{title}</h3>
          {description ? <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p> : null}
          {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
          <div className="mt-6 flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => ref.current?.close()} disabled={pending}>
              キャンセル
            </Button>
            <Button
              type="button"
              variant={variant === "danger" ? "danger" : "primary"}
              size="sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await action();
                  if (res && !res.ok) setError(res.error ?? "エラーが発生しました");
                  else ref.current?.close();
                })
              }
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {confirmLabel}
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
