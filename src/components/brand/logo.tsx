import { cn } from "../ui/cn";

/** FLUXA wordmark: wide-tracked caps with an open Λ for the final A. */
export function Logo({ className, subtitle = false }: { className?: string; subtitle?: boolean }) {
  return (
    <span className={cn("inline-flex flex-col leading-none", className)}>
      <span className="wordmark text-[1.05em] text-fg">
        FLUX<span className="text-accent">Λ</span>
      </span>
      {subtitle ? <span className="mt-1.5 text-[0.42em] tracking-[0.42em] text-muted">AI COMPANY OS</span> : null}
    </span>
  );
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-8 w-8", className)} aria-hidden>
      <defs>
        <linearGradient id="fx-g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="var(--accent-2)" />
          <stop offset="1" stopColor="var(--accent)" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="9" fill="var(--panel-2)" stroke="var(--border-strong)" />
      <path d="M9 23 L16 9 L23 23" fill="none" stroke="url(#fx-g)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
