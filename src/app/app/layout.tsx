import Link from "next/link";
import { requireCompany } from "@/server/auth/guards";
import { companyPulse } from "@/server/services/pulse";
import { LiveProvider } from "@/components/shell/live";
import { MobileNav, Sidebar } from "@/components/shell/sidebar";
import { NotificationBell } from "@/components/shell/notifications";
import { UserFooter } from "@/components/shell/user-menu";
import { StatusDot } from "@/components/ui/badge";
import { Logo } from "@/components/brand/logo";
import { DEMO_EMAIL } from "@/server/services/demo";
import { resetDemoAction } from "@/app/(auth)/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireCompany();
  const pulse = await companyPulse(ctx.db, ctx.company.id, ctx.user.id);
  const footer = <UserFooter name={ctx.user.name} email={ctx.user.email} role={ctx.membership.role} />;
  const online = ctx.company.status === "ACTIVE";
  return (
    <LiveProvider initial={pulse}>
      <Sidebar footer={footer} />
      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
            <Link href="/app" className="text-base lg:hidden">
              <Logo />
            </Link>
            <div className="hidden min-w-0 items-center gap-3 lg:flex">
              <span className="truncate text-sm font-medium">{ctx.company.name}</span>
              <span className="flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[11px] text-muted">
                <StatusDot tone={online ? "success" : "neutral"} pulse={online && pulse.running > 0} />
                {online ? "AI Company Online" : "Paused"}
              </span>
            </div>
            <div className="ml-auto flex items-center gap-1">
              <NotificationBell />
            </div>
          </div>
        </header>
        {ctx.user.email === DEMO_EMAIL ? (
          <div className="flex flex-wrap items-center gap-3 border-b border-info/30 bg-info-soft px-4 py-2 text-xs text-info sm:px-6">
            <span className="flex-1">デモ環境です。表示されているのはサンプルデータで、ツールは接続されていません。自由に操作して大丈夫です。</span>
            <form action={resetDemoAction}>
              <button className="rounded-md border border-info/40 px-2 py-1 hover:bg-info/10">デモをリセット</button>
            </form>
          </div>
        ) : null}
        <main className="mx-auto max-w-[1400px] px-4 pb-28 pt-6 sm:px-6 lg:pb-12">{children}</main>
      </div>
      <MobileNav footer={footer} />
    </LiveProvider>
  );
}
