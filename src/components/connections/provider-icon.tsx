import { cn } from "../ui/cn";

const STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  anthropic: { bg: "#d97757", fg: "#fff", label: "C" },
  openai: { bg: "#10a37f", fg: "#fff", label: "O" },
  gemini: { bg: "linear-gradient(135deg,#4285f4,#9b72cb,#d96570)", fg: "#fff", label: "G" },
  google_drive: { bg: "#1fa463", fg: "#fff", label: "Dr" },
  google_sheets: { bg: "#0f9d58", fg: "#fff", label: "Sh" },
  gmail: { bg: "#ea4335", fg: "#fff", label: "M" },
  google_calendar: { bg: "#4285f4", fg: "#fff", label: "31" },
  notion: { bg: "#f5f5f4", fg: "#111", label: "N" },
  slack: { bg: "#4a154b", fg: "#fff", label: "S" },
  github: { bg: "#24292f", fg: "#fff", label: "GH" },
  instagram: { bg: "linear-gradient(135deg,#f58529,#dd2a7b,#8134af)", fg: "#fff", label: "IG" },
  youtube: { bg: "#ff0000", fg: "#fff", label: "YT" },
  x: { bg: "#000", fg: "#fff", label: "X" },
  google_analytics: { bg: "#f9ab00", fg: "#fff", label: "GA" },
  meta_ads: { bg: "#0866ff", fg: "#fff", label: "Ad" },
  shopify: { bg: "#95bf47", fg: "#fff", label: "Sp" },
  stripe: { bg: "#635bff", fg: "#fff", label: "St" },
  hubspot: { bg: "#ff7a59", fg: "#fff", label: "H" },
};

export function ProviderIcon({ provider, size = 32, className }: { provider: string; size?: number; className?: string }) {
  const s = STYLE[provider] ?? { bg: "var(--panel-2)", fg: "var(--muted)", label: provider.slice(0, 2).toUpperCase() };
  return (
    <span
      className={cn("grid shrink-0 place-items-center rounded-lg font-semibold", className)}
      style={{ width: size, height: size, background: s.bg, color: s.fg, fontSize: size * 0.34 }}
      aria-hidden
    >
      {s.label}
    </span>
  );
}
