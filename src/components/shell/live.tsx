"use client";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

export interface PulseData {
  version: string;
  running: number;
  pendingApprovals: number;
  unread: number;
  employees: { id: string; status: string }[];
  notifications: { id: string; type: string; title: string; body: string; link: string | null; read: boolean; createdAt: string }[];
}

const PulseContext = createContext<PulseData | null>(null);
export const usePulse = () => useContext(PulseContext);

/**
 * Polls the company pulse and refreshes server components when anything changes.
 * Polls faster while work is running. Pauses when the tab is hidden.
 */
export function LiveProvider({ initial, children }: { initial: PulseData; children: ReactNode }) {
  const router = useRouter();
  const [pulse, setPulse] = useState(initial);
  const version = useRef(initial.version);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    let busy = initial.running > 0;
    const tick = async () => {
      if (document.visibilityState === "visible") {
        try {
          const res = await fetch("/api/company/pulse", { cache: "no-store" });
          if (res.ok) {
            const next = (await res.json()) as PulseData;
            setPulse(next);
            busy = next.running > 0;
            if (next.version !== version.current) {
              version.current = next.version;
              router.refresh();
            }
          }
        } catch {
          /* offline: try again next tick */
        }
      }
      if (!stopped) timer = setTimeout(tick, busy ? 3000 : 10000);
    };
    timer = setTimeout(tick, 3000);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  return <PulseContext.Provider value={pulse}>{children}</PulseContext.Provider>;
}
