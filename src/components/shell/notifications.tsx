"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Bell, CheckCircle2, AlertTriangle, FileText, ShieldAlert, Unplug } from "lucide-react";
import { markNotificationsReadAction } from "@/server/actions-shared/notifications";
import { timeAgo } from "@/lib/format";
import { cn } from "../ui/cn";
import { usePulse } from "./live";

const ICON: Record<string, typeof Bell> = {
  task_completed: CheckCircle2,
  approval_required: ShieldAlert,
  error: AlertTriangle,
  connection_lost: Unplug,
  report_ready: FileText,
  alert: AlertTriangle,
};
const TONE: Record<string, string> = {
  task_completed: "text-success",
  approval_required: "text-warning",
  error: "text-danger",
  connection_lost: "text-danger",
  report_ready: "text-accent",
  alert: "text-danger",
};

export function NotificationBell() {
  const pulse = usePulse();
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const unread = pulse?.unread ?? 0;

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={`通知 ${unread} 件`}
        onClick={() => {
          setOpen((o) => !o);
          if (!open && unread > 0) start(() => void markNotificationsReadAction());
        }}
        className="relative grid h-9 w-9 place-items-center rounded-lg text-muted transition-colors hover:bg-panel-hover hover:text-fg"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 ? <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent ring-2 ring-bg" /> : null}
      </button>
      {open ? (
        <div className="absolute right-0 top-11 z-50 w-[min(92vw,360px)] overflow-hidden rounded-xl border border-line bg-panel shadow-2xl">
          <div className="border-b border-line px-4 py-3 text-sm font-medium">通知</div>
          <ul className="max-h-[60vh] overflow-y-auto">
            {(pulse?.notifications ?? []).length === 0 ? <li className="px-4 py-8 text-center text-xs text-faint">通知はありません</li> : null}
            {(pulse?.notifications ?? []).map((n) => {
              const Icon = ICON[n.type] ?? Bell;
              const inner = (
                <div className={cn("flex gap-3 px-4 py-3 transition-colors hover:bg-panel-hover", !n.read && "bg-accent-soft/30")}>
                  <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", TONE[n.type] ?? "text-muted")} />
                  <div className="min-w-0">
                    <p className="text-sm">{n.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted">{n.body}</p>
                    <p className="mt-1 text-[11px] text-faint">{timeAgo(n.createdAt)}</p>
                  </div>
                </div>
              );
              return <li key={n.id}>{n.link ? <Link href={n.link} onClick={() => setOpen(false)}>{inner}</Link> : inner}</li>;
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
