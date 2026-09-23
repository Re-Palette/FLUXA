"use client";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="grid min-h-[60vh] place-items-center px-6 text-center">
      <div>
        <p className="text-lg font-medium">エラーが発生しました</p>
        <p className="mt-2 text-sm text-muted">時間をおいて再度お試しください。</p>
        <Button className="mt-6" onClick={reset}>
          再読み込み
        </Button>
      </div>
    </div>
  );
}
