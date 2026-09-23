"use client";
import { useActionState } from "react";
import { ArrowRight } from "lucide-react";
import type { Company } from "@prisma/client";
import { COMPANY_SIZES, INDUSTRIES } from "@/lib/catalog";
import { Card } from "@/components/ui/card";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { saveCompanyAction, type CompanyFormState } from "../actions";
import { StepHeader } from "./step-header";

export function CompanyStep({ company }: { company: Company | null }) {
  const [state, action] = useActionState<CompanyFormState, FormData>(saveCompanyAction, undefined);
  const fe = state?.fieldErrors ?? {};
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <div>
        <StepHeader n={1} title="Create your AI Company" question="What do you want your AI company to do?" subtitle="まずは、あなたの会社について教えてください。" />
        <Card className="p-6 sm:p-8">
          <form action={action} className="space-y-5">
            <FormError message={state?.error} />
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="会社名" required htmlFor="name" error={fe.name}>
                <Input id="name" name="name" defaultValue={company?.name} placeholder="例) Re-Palette Inc." required maxLength={100} />
              </Field>
              <Field label="業種" required htmlFor="industry" error={fe.industry}>
                <Select id="industry" name="industry" defaultValue={company?.industry ?? ""} required>
                  <option value="" disabled>
                    選択してください
                  </option>
                  {INDUSTRIES.map((i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="会社の規模" required htmlFor="size" error={fe.size}>
              <Select id="size" name="size" defaultValue={company?.size ?? ""} required>
                <option value="" disabled>
                  選択してください
                </option>
                {COMPANY_SIZES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="会社の説明" required htmlFor="description" error={fe.description} hint="何を、誰に提供している会社か">
              <Textarea id="description" name="description" defaultValue={company?.description} placeholder="あなたの会社について簡単に説明してください…" required maxLength={2000} />
            </Field>
            <Field label="会社の目標" required htmlFor="goal" error={fe.goal} hint="AI社員はこの目標に向かって働きます">
              <Textarea id="goal" name="goal" defaultValue={company?.goal} placeholder="例) 美容を通じて、すべての人に自信と居場所を提供する。" required maxLength={1000} className="min-h-[72px]" />
            </Field>
            <Field label="会社の Web サイト（任意）" htmlFor="website" error={fe.website}>
              <Input id="website" name="website" type="url" defaultValue={company?.website ?? ""} placeholder="https://example.com" />
            </Field>
            <div className="flex justify-end pt-2">
              <SubmitButton pendingText="保存中…">
                次へ <ArrowRight className="h-4 w-4" />
              </SubmitButton>
            </div>
          </form>
        </Card>
      </div>
      <aside className="relative hidden overflow-hidden rounded-2xl border border-line lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_20%,var(--accent-ring),transparent_55%),linear-gradient(160deg,var(--panel-2),var(--bg))]" />
        <div className="grid-bg absolute inset-0 opacity-50" />
        <svg className="absolute inset-x-0 top-10 mx-auto h-72 w-72 opacity-80" viewBox="0 0 200 200" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => (
            <rect key={i} x={60 + i * 6} y={30 + i * 12} width={80 - i * 12} height={150 - i * 12} fill="none" stroke="var(--accent)" strokeOpacity={0.15 + i * 0.12} strokeWidth="0.8" />
          ))}
          {Array.from({ length: 12 }).map((_, i) => (
            <line key={i} x1={60} x2={140} y1={40 + i * 11} y2={40 + i * 11} stroke="var(--accent-2)" strokeOpacity={0.12 + (i % 3) * 0.1} strokeWidth="0.6" />
          ))}
        </svg>
        <div className="absolute bottom-0 p-8">
          <p className="text-3xl font-light leading-tight">
            Your vision.
            <br />
            Our AI team.
          </p>
        </div>
      </aside>
    </div>
  );
}
