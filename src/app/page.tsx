import Link from "next/link";
import { ArrowRight, Bot, CheckSquare, Network, Plug, ShieldCheck, Workflow } from "lucide-react";
import { getSession } from "@/server/auth/session";
import { Logo } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";
import { DemoButton } from "./(auth)/demo-button";

const ORBIT_LABELS = [
  { label: "Marketing", x: 18, y: 16 },
  { label: "Sales", x: 86, y: 20 },
  { label: "Research", x: 6, y: 44 },
  { label: "Product", x: 92, y: 46 },
  { label: "HR", x: 10, y: 70 },
  { label: "Finance", x: 90, y: 72 },
  { label: "Operations", x: 68, y: 90 },
];

function OrbitVisual() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[560px]">
      <div className="absolute inset-[18%] rounded-full bg-[radial-gradient(circle_at_40%_35%,rgba(255,255,255,0.08),transparent_60%)]" />
      <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <radialGradient id="core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--accent-2)" stopOpacity="0.5" />
            <stop offset="60%" stopColor="var(--accent)" stopOpacity="0.08" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <linearGradient id="ring" x1="0" x2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0" />
            <stop offset="0.5" stopColor="var(--accent-2)" stopOpacity="0.9" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <circle cx="200" cy="200" r="120" fill="url(#core)" />
        <circle cx="200" cy="200" r="96" fill="none" stroke="var(--border-strong)" strokeWidth="1" />
        <g className="animate-orbit">
          <ellipse cx="200" cy="200" rx="170" ry="62" fill="none" stroke="url(#ring)" strokeWidth="1.6" transform="rotate(-24 200 200)" />
          <ellipse cx="200" cy="200" rx="150" ry="110" fill="none" stroke="url(#ring)" strokeWidth="1" transform="rotate(38 200 200)" opacity="0.7" />
          <ellipse cx="200" cy="200" rx="178" ry="40" fill="none" stroke="url(#ring)" strokeWidth="0.8" transform="rotate(12 200 200)" opacity="0.5" />
        </g>
        <text x="200" y="206" textAnchor="middle" fill="var(--text)" fontSize="18" letterSpacing="7" fontWeight="300">
          FLUXΛ
        </text>
      </svg>
      {ORBIT_LABELS.map((o) => (
        <span key={o.label} className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 text-[11px] text-muted" style={{ left: `${o.x}%`, top: `${o.y}%` }}>
          <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_10px_var(--accent)]" />
          {o.label}
        </span>
      ))}
    </div>
  );
}

const FEATURES = [
  { icon: Bot, title: "AI社員を選んで雇う", body: "マーケティング、営業、リサーチ、財務…24種類のAI社員から選び、仕事内容と Mission をあなたの会社向けに設定。" },
  { icon: Workflow, title: "Orchestrator が仕事を分担", body: "「競合を調査して施策を考えて」と頼むだけ。最適なAI社員に分解・引き継ぎ、最終レビューまで自動で進みます。" },
  { icon: Plug, title: "ツールをワンクリック連携", body: "Claude・OpenAI・Gemini、Google Drive・Gmail・Calendar、Notion・Slack・GitHub。難しい設定は不要です。" },
  { icon: CheckSquare, title: "危険な操作は必ず承認制", body: "メール送信や投稿など外部に影響する操作は、あなたが承認するまで実行されません。" },
  { icon: ShieldCheck, title: "会社ごとに完全分離", body: "データ・認証情報・記憶はすべて会社単位で分離。キーは暗号化され、ブラウザに渡ることはありません。" },
  { icon: Network, title: "AI会社のダッシュボード", body: "誰が何をしているか、成果物、承認待ち、活動履歴をひと目で。AI組織を動かすための OS です。" },
];

export default async function LandingPage() {
  const session = await getSession();
  return (
    <div className="relative overflow-hidden">
      <header className="relative z-10 mx-auto flex max-w-7xl items-center gap-8 px-5 py-6 sm:px-8">
        <Link href="/" className="text-xl">
          <Logo subtitle />
        </Link>
        <nav className="hidden gap-7 text-xs text-muted md:flex">
          <a href="#product" className="hover:text-fg">Product</a>
          <a href="#features" className="hover:text-fg">Features</a>
          <a href="#security" className="hover:text-fg">Security</a>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          {session ? (
            <ButtonLink href="/app" size="sm">
              ダッシュボード <ArrowRight className="h-3.5 w-3.5" />
            </ButtonLink>
          ) : (
            <>
              <Link href="/login" className="text-xs text-muted hover:text-fg">
                ログイン
              </Link>
              <ButtonLink href="/signup" size="sm">
                無料で始める
              </ButtonLink>
            </>
          )}
        </div>
      </header>

      <section id="product" className="relative mx-auto grid max-w-7xl items-center gap-10 px-5 pb-20 pt-10 sm:px-8 lg:grid-cols-[1fr_1.05fr] lg:pt-16">
        <div className="absolute -bottom-40 left-1/2 -z-10 h-[420px] w-[1200px] -translate-x-1/2 rounded-[100%] bg-[radial-gradient(ellipse_at_center,var(--accent-ring),transparent_65%)] opacity-70 blur-2xl" />
        <div>
          <h1 className="text-4xl font-semibold leading-[1.25] tracking-tight sm:text-5xl">
            AIの力で、
            <br />
            あなたの会社を
            <br />
            <span className="bg-gradient-to-r from-accent to-accent-2 bg-clip-text text-transparent">次のステージへ。</span>
          </h1>
          <p className="mt-6 max-w-md text-sm leading-relaxed text-muted">
            FLUXA は、AI社員を構築・管理・連携し、あなたのビジネスを自動で動かす次世代の AI 会社 OS です。
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <ButtonLink href={session ? "/app" : "/signup"} size="lg">
              今すぐはじめる <ArrowRight className="h-4 w-4" />
            </ButtonLink>
            {session ? null : <DemoButton />}
            <a href="#features" className="text-sm text-muted hover:text-fg">
              できることを見る →
            </a>
          </div>
          <p className="mt-14 text-xs tracking-wide text-faint">Build Your AI Company.</p>
        </div>
        <OrbitVisual />
      </section>

      <section id="features" className="relative border-t border-line bg-bg-elev/60">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
          <p className="text-xs font-medium tracking-[0.25em] text-accent">AI COMPANY OS</p>
          <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight">AIチャットではなく、AI社員を雇って会社を動かすための OS。</h2>
          <div id="security" className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="panel p-6">
                <f.icon className="h-5 w-5 text-accent" strokeWidth={1.8} />
                <h3 className="mt-4 text-sm font-semibold">{f.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-muted">{f.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-16 flex flex-col items-center gap-4 text-center">
            <p className="text-2xl font-light">AIとつくる、あなたの理想の会社。</p>
            <ButtonLink href={session ? "/app" : "/signup"} size="lg">
              はじめる <ArrowRight className="h-4 w-4" />
            </ButtonLink>
          </div>
        </div>
      </section>
      <footer className="border-t border-line px-5 py-8 text-center text-[11px] text-faint">© {new Date().getFullYear()} FLUXA — AI Company OS</footer>
    </div>
  );
}
