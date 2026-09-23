import { Brain, CalendarClock, Pin } from "lucide-react";
import { requireCompany, MANAGE_ROLES } from "@/server/auth/guards";
import { SCHEDULE_PRESETS } from "@/lib/cron";
import { formatDateTime, timeAgo } from "@/lib/format";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { AddMemoryForm, CompanyProfileForm, MemoryRowActions, ScheduleForm, ScheduleRowActions } from "./forms";

export const metadata = { title: "会社" };

const KIND_LABEL: Record<string, string> = { profile: "会社概要", goal: "目標", mission: "ミッション", brand: "ブランド", preference: "方針", decision: "決定", instruction: "指示", note: "メモ", report_summary: "過去のレポート" };

export default async function CompanyPage() {
  const { db, company, membership } = await requireCompany();
  const canManage = MANAGE_ROLES.includes(membership.role);
  const [memories, schedules, employees, members] = await Promise.all([
    db.companyMemory.findMany({ where: { companyId: company.id }, orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }], take: 100 }),
    db.schedule.findMany({ where: { companyId: company.id }, orderBy: { createdAt: "asc" }, include: { employee: { select: { role: true } } } }),
    db.aIEmployee.findMany({ where: { companyId: company.id }, select: { id: true, role: true }, orderBy: { createdAt: "asc" } }),
    db.$queryRaw<{ email: string; name: string | null; role: string }[]>`SELECT u.email, u.name, m.role::text AS role FROM "CompanyMember" m JOIN "User" u ON u.id = m."userId" WHERE m."companyId" = ${company.id} ORDER BY m."createdAt" ASC`,
  ]);
  return (
    <div className="space-y-6">
      <PageHeader en="Company" title={company.name} description={`${company.industry} · ${company.size}${company.launchedAt ? ` · ${formatDateTime(company.launchedAt)} 起動` : ""}`} />
      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="会社プロフィール" description="AI社員はこの情報をもとに仕事をします" />
            <CardBody>{canManage ? <CompanyProfileForm company={company} /> : <p className="text-sm text-muted">{company.description}</p>}</CardBody>
          </Card>
          <Card>
            <CardHeader title="定期実行" description="Scheduler — 決まった時間にAI社員へ仕事を依頼します（/api/cron/tick で実行）" />
            <CardBody className="space-y-4">
              {schedules.length === 0 ? <p className="flex items-center gap-2 text-sm text-faint"><CalendarClock className="h-4 w-4" /> 定期実行はまだありません</p> : null}
              <ul className="divide-y divide-line">
                {schedules.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        {s.name} {!s.enabled ? <Badge>停止中</Badge> : null}
                      </p>
                      <p className="text-xs text-muted">
                        {SCHEDULE_PRESETS.find((p) => p.cron === s.cron)?.label ?? s.cron} · {s.employee?.role ?? "自動割り当て"}
                        {s.enabled && s.nextRunAt ? ` · 次回 ${formatDateTime(s.nextRunAt)}` : ""}
                      </p>
                    </div>
                    {canManage ? <ScheduleRowActions id={s.id} enabled={s.enabled} /> : null}
                  </li>
                ))}
              </ul>
              {canManage ? <ScheduleForm employees={employees} /> : null}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="メンバー" description="Members" />
            <CardBody className="pt-3">
              <ul className="space-y-2">
                {members.map((m) => (
                  <li key={m.email} className="flex items-center gap-3 text-sm">
                    <span className="flex-1 truncate">{m.name ?? m.email}</span>
                    <span className="text-xs text-faint">{m.email}</span>
                    <Badge>{m.role}</Badge>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>
        <Card>
          <CardHeader title="Company Memory" description="AI社員が参照する会社の長期記憶。あなたの会社の中だけで使われます。" />
          <CardBody className="space-y-4">
            {canManage ? <AddMemoryForm /> : null}
            {memories.length === 0 ? <p className="flex items-center gap-2 text-sm text-faint"><Brain className="h-4 w-4" /> まだ記憶はありません</p> : null}
            <ul className="space-y-2">
              {memories.map((m) => (
                <li key={m.id} className="rounded-lg border border-line p-3">
                  <div className="flex items-center gap-2">
                    {m.pinned ? <Pin className="h-3 w-3 text-accent" /> : null}
                    <Badge>{KIND_LABEL[m.kind] ?? m.kind}</Badge>
                    <p className="min-w-0 flex-1 truncate text-sm font-medium">{m.title}</p>
                    {canManage ? <MemoryRowActions id={m.id} pinned={m.pinned} editable={m.source !== "system"} /> : null}
                  </div>
                  <p className="mt-1.5 line-clamp-4 whitespace-pre-wrap text-xs leading-relaxed text-muted">{m.content}</p>
                  <p className="mt-1 text-[10px] text-faint">
                    {m.source === "employee" ? "AI社員が記録" : m.source === "system" ? "自動" : "あなたが追加"} · {timeAgo(m.updatedAt)}
                  </p>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
