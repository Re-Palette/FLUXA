import { Eye } from "lucide-react";
import { demoLoginEnabled } from "@/server/services/demo";
import { SubmitButton } from "@/components/ui/submit-button";
import { demoLoginAction } from "./actions";

/** "Look inside" entry with sample data. Only rendered when demo login is enabled. */
export function DemoButton({ className }: { className?: string }) {
  if (!demoLoginEnabled()) return null;
  return (
    <form action={demoLoginAction} className={className}>
      <SubmitButton variant="outline" className="w-full" pendingText="デモを準備中…">
        <Eye className="h-4 w-4" /> デモで中を見る（登録不要）
      </SubmitButton>
    </form>
  );
}
