import Link from "next/link";
import { ONBOARDING_STEPS } from "@/lib/catalog";
import { cn } from "@/components/ui/cn";

export function Stepper({ current, reached }: { current: number; reached: number }) {
  return (
    <ol className="flex items-center gap-1 sm:gap-2" aria-label="進捗">
      {ONBOARDING_STEPS.map((s, i) => {
        const done = s.n < current;
        const active = s.n === current;
        const reachable = s.n <= reached;
        const dot = (
          <span className="flex flex-col items-center gap-1.5">
            <span
              className={cn(
                "grid h-7 w-7 place-items-center rounded-full border text-[11px] font-semibold tabular-nums transition-colors",
                active ? "border-accent bg-accent text-white glow-accent" : done ? "border-accent/60 bg-accent-soft text-accent" : "border-line-strong text-faint",
              )}
            >
              {String(s.n).padStart(2, "0")}
            </span>
            <span className={cn("hidden text-[10px] sm:block", active ? "text-accent" : "text-faint")}>{s.label}</span>
          </span>
        );
        return (
          <li key={s.key} className="flex flex-1 items-center gap-1 sm:gap-2 last:flex-none">
            {reachable && !active ? <Link href={`/onboarding?step=${s.n}`}>{dot}</Link> : dot}
            {i < ONBOARDING_STEPS.length - 1 ? <span className={cn("mb-0 h-px flex-1 sm:mb-5", done ? "bg-accent/60" : "bg-line")} /> : null}
          </li>
        );
      })}
    </ol>
  );
}
