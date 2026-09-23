import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <Logo className="text-2xl" />
        <p className="mt-10 text-5xl font-light tabular-nums text-accent">404</p>
        <p className="mt-3 text-sm text-muted">ページが見つかりません。</p>
        <Link href="/app" className="mt-6 inline-block text-sm text-accent hover:underline">
          ダッシュボードへ戻る
        </Link>
      </div>
    </div>
  );
}
