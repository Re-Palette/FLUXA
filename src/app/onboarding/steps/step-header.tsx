export function StepHeader({ n, title, question, subtitle }: { n: number; title: string; question: string; subtitle: string }) {
  return (
    <div className="mb-8">
      <p className="text-xs font-medium tracking-[0.2em] text-accent">STEP {String(n).padStart(2, "0")}</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
      <p className="mt-2 text-sm text-muted">
        <span className="text-fg/80">{question}</span> — {subtitle}
      </p>
    </div>
  );
}
