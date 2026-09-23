import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden border-r border-line lg:block">
        <div className="grid-bg absolute inset-0 opacity-60" />
        <div className="absolute -bottom-40 -left-20 h-[520px] w-[820px] rounded-[100%] bg-[radial-gradient(ellipse_at_center,var(--accent-ring),transparent_65%)] blur-2xl" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Link href="/" className="text-2xl">
            <Logo subtitle />
          </Link>
          <div>
            <p className="text-4xl font-light leading-tight tracking-tight">
              Your vision.
              <br />
              <span className="text-accent">Our AI team.</span>
            </p>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-muted">
              AI社員を雇い、仕事を任せ、承認するだけ。FLUXA は、あなたの会社専用の AI 組織を動かすための OS です。
            </p>
          </div>
          <p className="text-xs text-faint">Build Your AI Company.</p>
        </div>
      </aside>
      <main className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <Link href="/" className="mb-10 block text-2xl lg:hidden">
            <Logo subtitle />
          </Link>
          {children}
        </div>
      </main>
    </div>
  );
}
