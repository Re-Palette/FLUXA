import Link from "next/link";
import { cookies } from "next/headers";
import { requireCompany, MANAGE_ROLES } from "@/server/auth/guards";
import { prisma } from "@/server/db";
import { getAIProvider } from "@/server/ai/registry";
import { startOfDay, startOfMonth, usageTotals } from "@/server/ai/runtime";
import { providerInfo } from "@/lib/catalog";
import { formatDateTime, formatNumber, formatUsd } from "@/lib/format";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { DefaultModelForm, RevokeSessionButton, ThemeSwitch, UsageLimitsForm } from "./forms";

export const metadata = { title: "設定" };

const TABS = [
  { k: "general", l: "一般" },
  { k: "ai", l: "AI Providers" },
  { k: "usage", l: "Usage" },
  { k: "billing", l: "Billing" },
  { k: "notifications", l: "通知" },
  { k: "security", l: "Security" },
] as const;

export default async function SettingsPage({ searchParams }: PageProps<"/app/settings">) {
  const sp = await searchParams;
  const tab = TABS.find((t) => t.k === sp.tab)?.k ?? "general";
  const { db, company, user, session, membership } = await requireCompany();
  const canManage = MANAGE_ROLES.includes(membership.role);
  let body: React.ReactNode;

  if (tab === "general") {
    const theme = (await cookies()).get("fluxa_theme")?.value === "light" ? "light" : "dark";
    body = (
      <div className="space-y-6">
        <Card>
          <CardHeader title="表示テーマ" description="Appearance" />
          <CardBody>
            <ThemeSwitch current={theme} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="会社・AI社員・連携・権限" />
          <CardBody className="flex flex-wrap gap-2">
            <ButtonLink href="/app/company" variant="secondary" size="sm">Company</ButtonLink>
            <ButtonLink href="/app/employees" variant="secondary" size="sm">AI Employees</ButtonLink>
            <ButtonLink href="/app/connections" variant="secondary" size="sm">Connections</ButtonLink>
            <ButtonLink href="/app/employees" variant="secondary" size="sm">Permissions（各社員ページ）</ButtonLink>
          </CardBody>
        </Card>
      </div>
    );
  } else if (tab === "ai") {
    const connected = await db.integration.findMany({ where: { companyId: company.id, provider: { in: ["anthropic", "openai", "gemini"] }, status: "CONNECTED" } });
    const options = connected.map((c) => {
      const p = getAIProvider(c.provider)!;
      return { value: `${c.provider}:${p.defaultModel}`, label: `${providerInfo(c.provider)?.name} · ${p.defaultModel}` };
    });
    body = (
      <div className="space-y-6">
        <Card>
          <CardHeader title="AI Providers" description="BYOK — ご自身のキーで AI を利用します。AI 利用料は各プロバイダーから直接請求されます。" />
          <CardBody className="space-y-3">
            {["anthropic", "openai", "gemini"].map((p) => {
              const c = connected.find((x) => x.provider === p);
              return (
                <div key={p} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2.5 text-sm">
                  <span className="flex-1">{providerInfo(p)?.name}</span>
                  {c ? <Badge tone="success">Connected {c.secretHint}</Badge> : <Badge>未接続</Badge>}
                </div>
              );
            })}
            <ButtonLink href="/app/connections" size="sm" variant="secondary">Connections で管理</ButtonLink>
          </CardBody>
        </Card>
        {canManage ? (
          <Card>
            <CardHeader title="既定のモデル" description="AI社員ごとの設定がない場合に使用します" />
            <CardBody>
              <DefaultModelForm current={company.defaultModel} options={options} />
            </CardBody>
          </Card>
        ) : null}
      </div>
    );
  } else if (tab === "usage") {
    const [today, month, limit, byModel] = await Promise.all([
      usageTotals(db, company.id, startOfDay()),
      usageTotals(db, company.id, startOfMonth()),
      db.usageLimit.findUnique({ where: { companyId: company.id } }),
      db.usageRecord.groupBy({ by: ["provider", "model"], where: { companyId: company.id, createdAt: { gte: startOfMonth() } }, _sum: { inputTokens: true, outputTokens: true, requests: true, costMicroUsd: true } }),
    ]);
    const stat = (l: string, v: string) => (
      <div className="panel p-4">
        <p className="text-xs text-muted">{l}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{v}</p>
      </div>
    );
    body = (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stat("本日のリクエスト", formatNumber(today.requests))}
          {stat("本日のトークン", formatNumber(today.tokens))}
          {stat("今月のトークン", formatNumber(month.tokens))}
          {stat("今月の推定コスト", formatUsd(month.costMicroUsd))}
        </div>
        <Card>
          <CardHeader title="モデル別の利用量（今月）" />
          <CardBody className="pt-3">
            {byModel.length === 0 ? (
              <p className="text-sm text-faint">まだ利用はありません</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted">
                  <tr>
                    <th className="py-2 font-medium">Provider / Model</th>
                    <th className="py-2 text-right font-medium">Requests</th>
                    <th className="py-2 text-right font-medium">Input</th>
                    <th className="py-2 text-right font-medium">Output</th>
                    <th className="py-2 text-right font-medium">Est. cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {byModel.map((m) => (
                    <tr key={`${m.provider}:${m.model}`}>
                      <td className="py-2">{providerInfo(m.provider)?.name} · <span className="font-mono text-xs">{m.model}</span></td>
                      <td className="py-2 text-right tabular-nums">{formatNumber(m._sum.requests ?? 0)}</td>
                      <td className="py-2 text-right tabular-nums">{formatNumber(m._sum.inputTokens ?? 0)}</td>
                      <td className="py-2 text-right tabular-nums">{formatNumber(m._sum.outputTokens ?? 0)}</td>
                      <td className="py-2 text-right tabular-nums">{formatUsd(m._sum.costMicroUsd ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="mt-3 text-[11px] text-faint">推定コストは公開価格からの概算です。価格が未登録のモデルは $0 と表示されます。</p>
          </CardBody>
        </Card>
        {canManage ? (
          <Card>
            <CardHeader title="使用量の上限" description="Cost Control — 上限に達すると、AI社員は新しいAI呼び出しを行いません" />
            <CardBody>
              <UsageLimitsForm
                initial={{
                  dailyRequestLimit: limit?.dailyRequestLimit ?? null,
                  monthlyRequestLimit: limit?.monthlyRequestLimit ?? null,
                  dailyTokenLimit: limit?.dailyTokenLimit ?? null,
                  monthlyTokenLimit: limit?.monthlyTokenLimit ?? null,
                  monthlyCostLimitUsd: limit?.monthlyCostLimitMicroUsd != null ? limit.monthlyCostLimitMicroUsd / 1_000_000 : null,
                }}
              />
            </CardBody>
          </Card>
        ) : null}
      </div>
    );
  } else if (tab === "billing") {
    const [sub, plans] = await Promise.all([db.subscription.findUnique({ where: { companyId: company.id }, include: { plan: true } }), prisma.plan.findMany({ where: { isPublic: true }, orderBy: { sortOrder: "asc" } })]);
    body = (
      <div className="space-y-6">
        <Card>
          <CardHeader title="現在のプラン" />
          <CardBody className="flex flex-wrap items-center gap-3">
            <span className="text-xl font-semibold">{sub?.plan.name ?? "Free"}</span>
            <Badge tone="accent">{sub?.billingMode === "PLATFORM" ? "AI 利用料込み" : "BYOK（ご自身のキー）"}</Badge>
            {sub?.plan.maxEmployees ? <span className="text-sm text-muted">AI社員 最大 {sub.plan.maxEmployees} 名</span> : null}
          </CardBody>
        </Card>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {plans.map((p) => (
            <div key={p.key} className={cn("panel p-4", sub?.planKey === p.key && "border-accent/60")}>
              <p className="text-sm font-medium">{p.name}</p>
              <p className="mt-1 text-xs text-muted">{p.description}</p>
              <p className="mt-3 text-lg font-semibold">{p.monthlyPriceCents == null ? "近日公開" : p.monthlyPriceCents === 0 ? "無料" : `$${(p.monthlyPriceCents / 100).toFixed(0)}/月`}</p>
              <p className="mt-1 text-[11px] text-faint">{p.maxEmployees ? `AI社員 ${p.maxEmployees} 名まで` : "AI社員 無制限"}{p.allowsPlatformAI ? " · AI 利用料込み" : ""}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-faint">有料プランと決済は準備中です。料金はコードではなくプラン設定（データベース）で管理されます。</p>
      </div>
    );
  } else if (tab === "notifications") {
    body = (
      <Card>
        <CardHeader title="通知" description="現在はアプリ内通知でお知らせします" />
        <CardBody className="space-y-2 text-sm">
          {["AI社員の仕事完了", "承認が必要な操作", "エラー", "ツール連携の切断", "定期レポートの完成", "AI会社の重要な問題"].map((l) => (
            <div key={l} className="flex items-center justify-between rounded-lg border border-line px-3 py-2.5">
              <span>{l}</span>
              <span className="flex gap-2">
                <Badge tone="success">アプリ内</Badge>
                <Badge>メール（近日公開）</Badge>
              </span>
            </div>
          ))}
        </CardBody>
      </Card>
    );
  } else {
    const [sessions, audits] = await Promise.all([
      prisma.session.findMany({ where: { userId: user.id }, orderBy: { lastSeenAt: "desc" }, take: 20 }),
      prisma.auditLog.findMany({ where: canManage ? { OR: [{ companyId: company.id }, { userId: user.id }] } : { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50 }),
    ]);
    body = (
      <div className="space-y-6">
        <Card>
          <CardHeader title="ログイン中のセッション" />
          <CardBody className="pt-3">
            <ul className="divide-y divide-line">
              {sessions.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                  <span className="min-w-0 flex-1 truncate text-xs text-muted">{s.userAgent ?? "Unknown device"}</span>
                  <span className="text-[11px] text-faint">{s.ip} · {formatDateTime(s.lastSeenAt)}</span>
                  {s.id === session.id ? <Badge tone="success">このデバイス</Badge> : <RevokeSessionButton id={s.id} />}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="監査ログ" description="Audit Log — ログイン、連携、権限の変更などセキュリティに関わる操作" />
          <CardBody className="pt-3">
            <ul className="divide-y divide-line text-sm">
              {audits.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-2">
                  <span className="font-mono text-xs">{a.action}</span>
                  <span className="ml-auto text-[11px] text-faint">{a.ip ? `${a.ip} · ` : ""}{formatDateTime(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-xs leading-relaxed text-muted">
            API キーと OAuth トークンは AES-256-GCM で暗号化して保存され、ブラウザに送信されることはありません。すべてのデータは会社ごとに分離され、他の会社から参照されることはありません。
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader en="Settings" title="設定" />
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <Link key={t.k} href={`/app/settings?tab=${t.k}`} className={cn("-mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm", tab === t.k ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg")}>
            {t.l}
          </Link>
        ))}
      </div>
      {body}
    </div>
  );
}
