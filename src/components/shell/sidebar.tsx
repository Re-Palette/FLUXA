"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "../brand/logo";
import { cn } from "../ui/cn";
import { MOBILE_NAV, NAV } from "./nav";
import { usePulse } from "./live";

function isActive(pathname: string, href: string) {
  return href === "/app" ? pathname === "/app" : pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const pulse = usePulse();
  return (
    <nav className="space-y-0.5">
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);
        const count = item.badge === "approvals" ? (pulse?.pendingApprovals ?? 0) : 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              active ? "bg-accent-soft text-accent" : "text-muted hover:bg-panel-hover hover:text-fg",
            )}
          >
            <item.icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
            <span className="flex-1">{item.label}</span>
            {count > 0 ? <span className="rounded-full bg-warning px-1.5 text-[10px] font-semibold leading-4 text-black">{count}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar({ footer }: { footer: React.ReactNode }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-bg-elev lg:flex">
      <div className="px-5 pb-6 pt-6">
        <Link href="/app" className="text-lg">
          <Logo subtitle />
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto px-3">
        <NavLinks />
      </div>
      <div className="border-t border-line p-3">{footer}</div>
    </aside>
  );
}

export function MobileNav({ footer }: { footer: React.ReactNode }) {
  const pathname = usePathname();
  const pulse = usePulse();
  const [open, setOpen] = useState(false);
  const items = NAV.filter((n) => MOBILE_NAV.includes(n.href));
  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-bg-elev/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          const count = item.badge === "approvals" ? (pulse?.pendingApprovals ?? 0) : 0;
          return (
            <Link key={item.href} href={item.href} className={cn("relative flex flex-col items-center gap-1 py-2.5 text-[10px]", active ? "text-accent" : "text-muted")}>
              <item.icon className="h-5 w-5" strokeWidth={1.8} />
              {item.label}
              {count > 0 ? <span className="absolute right-[28%] top-1.5 h-2 w-2 rounded-full bg-warning" /> : null}
            </Link>
          );
        })}
        <button type="button" onClick={() => setOpen(true)} className="flex flex-col items-center gap-1 py-2.5 text-[10px] text-muted">
          <Menu className="h-5 w-5" strokeWidth={1.8} />
          メニュー
        </button>
      </nav>
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal>
          <button type="button" aria-label="閉じる" className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 right-0 flex w-72 flex-col border-l border-line bg-bg-elev">
            <div className="flex items-center justify-between px-5 py-5">
              <Logo />
              <button type="button" onClick={() => setOpen(false)} aria-label="閉じる" className="text-muted">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3">
              <NavLinks onNavigate={() => setOpen(false)} />
            </div>
            <div className="border-t border-line p-3">{footer}</div>
          </div>
        </div>
      ) : null}
    </>
  );
}
