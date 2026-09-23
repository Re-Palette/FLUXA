import {
  Briefcase,
  Calculator,
  Code2,
  Megaphone,
  Microscope,
  Scale,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../ui/cn";

const DEPT: Record<string, { icon: LucideIcon; hue: number }> = {
  Executive: { icon: Briefcase, hue: 24 },
  Marketing: { icon: Megaphone, hue: 14 },
  Sales: { icon: TrendingUp, hue: 145 },
  Research: { icon: Microscope, hue: 205 },
  "Product/Engineering": { icon: Code2, hue: 260 },
  Finance: { icon: Calculator, hue: 45 },
  HR: { icon: Users, hue: 320 },
  Administration: { icon: Scale, hue: 180 },
};

export function departmentIcon(department: string): LucideIcon {
  return DEPT[department]?.icon ?? Briefcase;
}

export function EmployeeAvatar({ department, size = 36, className }: { department: string; size?: number; className?: string }) {
  const d = DEPT[department] ?? DEPT.Executive;
  const Icon = d.icon;
  return (
    <span
      className={cn("relative grid shrink-0 place-items-center rounded-full border", className)}
      style={{
        width: size,
        height: size,
        borderColor: `hsl(${d.hue} 70% 55% / 0.35)`,
        background: `radial-gradient(circle at 30% 25%, hsl(${d.hue} 80% 60% / 0.28), hsl(${d.hue} 60% 20% / 0.25) 70%)`,
        color: `hsl(${d.hue} 85% 65%)`,
      }}
    >
      <Icon style={{ width: size * 0.46, height: size * 0.46 }} strokeWidth={1.8} />
    </span>
  );
}
