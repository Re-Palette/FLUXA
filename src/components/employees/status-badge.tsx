import { EMPLOYEE_STATUS } from "@/lib/status";
import { StatusDot } from "../ui/badge";
import { cn } from "../ui/cn";

export function EmployeeStatus({ status, className, english = false }: { status: string; className?: string; english?: boolean }) {
  const s = EMPLOYEE_STATUS[status] ?? EMPLOYEE_STATUS.IDLE;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs text-muted", className)}>
      <StatusDot tone={s.tone} pulse={s.pulse} />
      {english ? s.en : s.label}
    </span>
  );
}
