// Pure helpers describing whether Google OAuth is configured correctly (used by the login page,
// the server env check and `npm run google:check`).

export interface GoogleSetupStatus {
  configured: boolean;
  issues: string[];
  warnings: string[];
  appUrl: string;
  javascriptOrigin: string;
  redirectUris: { login: string; connect: string };
}

export function googleSetupStatus(env: Record<string, string | undefined>): GoogleSetupStatus {
  const issues: string[] = [];
  const warnings: string[] = [];
  const rawAppUrl = (env.APP_URL || "http://localhost:3000").trim();
  let origin = rawAppUrl.replace(/\/+$/, "");
  try {
    const u = new URL(rawAppUrl);
    origin = u.origin;
    if (u.pathname !== "/" && u.pathname !== "") warnings.push(`APP_URL にはパスを含めないでください（${u.origin} を使用します）`);
    if (u.protocol === "http:" && !["localhost", "127.0.0.1"].includes(u.hostname)) {
      issues.push("本番環境の APP_URL は https:// にしてください（Google は localhost 以外の http を許可しません）");
    }
  } catch {
    issues.push("APP_URL が正しい URL ではありません（例: http://localhost:3000）");
  }

  const id = env.GOOGLE_CLIENT_ID?.trim();
  const secret = env.GOOGLE_CLIENT_SECRET?.trim();
  if (!id) issues.push("GOOGLE_CLIENT_ID が設定されていません");
  else if (!id.endsWith(".apps.googleusercontent.com")) issues.push("GOOGLE_CLIENT_ID の形式が正しくありません（…apps.googleusercontent.com で終わる値です）");
  if (!secret) issues.push("GOOGLE_CLIENT_SECRET が設定されていません");
  else if (!secret.startsWith("GOCSPX-")) warnings.push("GOOGLE_CLIENT_SECRET は通常 GOCSPX- で始まります。値を確認してください");

  return {
    configured: issues.length === 0,
    issues,
    warnings,
    appUrl: origin,
    javascriptOrigin: origin,
    redirectUris: { login: `${origin}/api/auth/google/callback`, connect: `${origin}/api/connections/google/callback` },
  };
}
