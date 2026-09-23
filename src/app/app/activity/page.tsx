import Link from "next/link";
import { Activity } from "lucide-react";
import { requireCompany } from "@/server/auth/guards";
import { formatTime } from "@/lib/format";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata = { title: "アクティビティ" };

const ACTOR_TONE: Record<string, string> = { USER: "bg-info", EMPLOYEE: "bg-accent", SYSTEM: "bg-faint" };

function targetHref(type: string | null, id: string | null, workflowByTask: Map<string, string | null>) {
  if (!type || !id) return null;
  if (type === "workflow") return `/app/tasks/${id}`;
  if (type === "task") {
    const wf = workflowByTask.get(id);
    return wf ? `/app/tasks/${wf}` : null;
  }
  if (type === "employee") return `/app/employees/${id}`;
  if (type === "approval") return "/app/approvals";
  return null;
}

export default async function ActivityPage({ searchParams }: PageProps<"/app/activity">) {
  const sp = await searchParams;
  const { db, company } = await requireCompany();
  const actor = typeof sp.actor === "string" && ["USER", "EMPLOYEE", "SYSTEM"].includes(sp.actor) ? (sp.actor as "USER" | "EMPLOYEE" | "SYSTEM") : undefined;
  const logs = await db.activityLog.findMany({ where: { companyId: company.id, ...(actor ? { actorType: actor } : {}) }, orderBy: { createdAt: "desc" }, take: 200 });
  const taskIds = logs.filter((l) => l.targetType === "task" && l.targetId).map((l) => l.targetId!);
  const tasks = taskIds.length ? await db.task.findMany({ where: { id: { in: taskIds } }, select: { id: true, workflowId: true } }) : [];
  const workflowByTask = new Map(tasks.map((t) => [t.id, t.workflowId]));

  const groups = new Map<string, typeof logs>();
  for (const l of logs) {
    const day = l.createdAt.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short" });
    groups.set(day, [...(groups.get(day) ?? []), l]);
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader en="Activity Log" title="アクティビティ" description="誰が・いつ・何をしたか。AI会社全体の活動履歴です。" />
      <div className="mb-4 flex gap-1.5">
        {[
          { k: undefined, l: "すべて" },
          { k: "EMPLOYEE", l: "AI社員" },
          { k: "USER", l: "あなた" },
          { k: "SYSTEM", l: "システム" },
        ].map((f) => (
          <Link key={f.l} href={f.k ? `/app/activity?actor=${f.k}` : "/app/activity"} className={cn("rounded-lg border px-3 py-1.5 text-xs", actor === f.k ? "border-accent bg-accent text-white" : "border-line text-muted hover:text-fg")}>
            {f.l}
          </Link>
        ))}
      </div>
      <Card className="p-5">
        {logs.length === 0 ? (
          <EmptyState icon={<Activity className="h-5 w-5" />} title="まだアクティビティはありません" />
        ) : (
          [...groups.entries()].map(([day, items]) => (
            <section key={day} className="mb-6 last:mb-0">
              <h2 className="mb-3 text-xs font-medium text-muted">{day}</h2>
              <ol className="space-y-0.5">
                {items.map((l) => {
                  const href = targetHref(l.targetType, l.targetId, workflowByTask);
                  const row = (
                    <div className="flex items-start gap-4 rounded-lg px-2 py-2 hover:bg-panel-hover">
                      <span className="w-12 shrink-0 pt-0.5 text-xs tabular-nums text-faint">{formatTime(l.createdAt)}</span>
                      <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", ACTOR_TONE[l.actorType])} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm">{l.message}</span>
                        <span className="block text-[11px] text-faint">{l.actorName}</span>
                      </span>
                    </div>
                  );
                  return <li key={l.id}>{href ? <Link href={href}>{row}</Link> : row}</li>;
                })}
              </ol>
            </section>
          ))
        )}
      </Card>
    </div>
  );
}
