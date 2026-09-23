import { ChevronDown, LogOut } from "lucide-react";
import { logoutAction } from "@/app/(auth)/actions";

export function UserFooter({ name, email, role }: { name: string | null; email: string; role: string }) {
  const initials = (name ?? email).trim().slice(0, 1).toUpperCase();
  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-lg px-2 py-2 hover:bg-panel-hover">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-accent to-accent-2 text-xs font-semibold text-white">{initials}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm">{name ?? email}</span>
          <span className="block text-[11px] text-faint">{role === "OWNER" ? "Owner" : role === "ADMIN" ? "Admin" : "Member"}</span>
        </span>
        <ChevronDown className="h-4 w-4 text-faint transition-transform group-open:rotate-180" />
      </summary>
      <div className="absolute bottom-12 left-0 right-0 rounded-lg border border-line bg-panel p-1 shadow-xl">
        <p className="truncate px-3 py-2 text-xs text-faint">{email}</p>
        <form action={logoutAction}>
          <button className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted hover:bg-panel-hover hover:text-fg">
            <LogOut className="h-4 w-4" /> ログアウト
          </button>
        </form>
      </div>
    </details>
  );
}
