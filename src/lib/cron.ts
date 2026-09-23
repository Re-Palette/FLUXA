// Minimal 5-field cron support for schedules: each field is "*" or a single number (or "a,b" lists).
// Evaluated in an IANA timezone without external deps.

function parseField(f: string, min: number, max: number): number[] | null {
  if (f === "*") return null;
  const vals = f.split(",").map((x) => Number(x));
  if (vals.some((v) => !Number.isInteger(v) || v < min || v > max)) throw new Error(`invalid cron field: ${f}`);
  return vals;
}

export function validateCron(expr: string): boolean {
  try {
    const p = expr.trim().split(/\s+/);
    if (p.length !== 5) return false;
    parseField(p[0], 0, 59);
    parseField(p[1], 0, 23);
    parseField(p[2], 1, 31);
    parseField(p[3], 1, 12);
    parseField(p[4], 0, 6);
    return true;
  } catch {
    return false;
  }
}

/** Offset (ms) of `tz` from UTC at the given instant. */
function tzOffset(date: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - date.getTime();
}

function zonedToUtc(y: number, mo: number, d: number, h: number, mi: number, tz: string): Date {
  const guess = Date.UTC(y, mo, d, h, mi);
  const off = tzOffset(new Date(guess), tz);
  return new Date(guess - off);
}

/** Next fire time strictly after `after`. Searches up to ~400 days. */
export function nextCronRun(expr: string, tz: string, after = new Date()): Date | null {
  const [mf, hf, domf, monf, dowf] = expr.trim().split(/\s+/);
  const minutes = parseField(mf, 0, 59) ?? [0];
  const hours = parseField(hf, 0, 23) ?? Array.from({ length: 24 }, (_, i) => i);
  const doms = parseField(domf, 1, 31);
  const mons = parseField(monf, 1, 12);
  const dows = parseField(dowf, 0, 6);
  const startLocal = new Date(after.getTime() + tzOffset(after, tz));
  for (let i = 0; i < 400; i++) {
    const day = new Date(Date.UTC(startLocal.getUTCFullYear(), startLocal.getUTCMonth(), startLocal.getUTCDate() + i));
    const y = day.getUTCFullYear();
    const mo = day.getUTCMonth();
    const d = day.getUTCDate();
    if (mons && !mons.includes(mo + 1)) continue;
    if (doms && !doms.includes(d)) continue;
    if (dows && !dows.includes(day.getUTCDay())) continue;
    for (const h of [...hours].sort((a, b) => a - b)) {
      for (const mi of [...minutes].sort((a, b) => a - b)) {
        const t = zonedToUtc(y, mo, d, h, mi, tz);
        if (t.getTime() > after.getTime()) return t;
      }
    }
  }
  return null;
}

export const SCHEDULE_PRESETS = [
  { key: "daily", label: "毎日 9:00", cron: "0 9 * * *" },
  { key: "weekly", label: "毎週月曜 9:00", cron: "0 9 * * 1" },
  { key: "monthly", label: "毎月1日 9:00", cron: "0 9 1 * *" },
] as const;
