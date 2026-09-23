export function GoogleButton({ enabled, next }: { enabled: boolean; next?: string }) {
  const href = `/api/auth/google${next ? `?next=${encodeURIComponent(next)}` : ""}`;
  const icon = (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.3 12 2.3 6.7 2.3 2.4 6.6 2.4 12s4.3 9.7 9.6 9.7c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z" />
    </svg>
  );
  if (!enabled) {
    return (
      <div className="flex h-10 w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-line text-sm text-faint" title="GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET を設定すると有効になります">
        {icon} Google でログイン（未設定）
      </div>
    );
  }
  return (
    // Plain <a>: this is a full-page OAuth redirect, not client navigation.
    <a href={href} className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-line-strong text-sm font-medium transition-colors hover:bg-panel-hover">
      {icon} Google でログイン
    </a>
  );
}
