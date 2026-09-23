/* npm run google:check — validates Google OAuth settings in .env and tests the credentials against Google. */
import { googleSetupStatus } from "../src/lib/google-setup";

const s = googleSetupStatus(process.env);
const ok = (m: string) => console.log(`  ✓ ${m}`);
const ng = (m: string) => console.log(`  ✗ ${m}`);
const warn = (m: string) => console.log(`  ! ${m}`);

console.log("\nGoogle OAuth 設定チェック\n");
console.log("Google Cloud Console のクライアントに、次の値を登録してください:");
console.log(`  承認済みの JavaScript 生成元 : ${s.javascriptOrigin}`);
console.log(`  承認済みのリダイレクト URI  : ${s.redirectUris.login}`);
console.log(`                               ${s.redirectUris.connect}\n`);

s.issues.forEach(ng);
s.warnings.forEach(warn);
if (!s.configured) {
  console.log("\n→ .env を修正してから再実行してください（手順: docs/google-login-setup.md）\n");
  process.exit(1);
}
ok("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET の形式");

async function main() {
  // Exchange a deliberately invalid code: Google answers invalid_grant when the client credentials are
  // valid, and invalid_client / unauthorized_client when they are not. Nothing is created or changed.
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: "fluxa-config-check",
        client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
        client_secret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
        redirect_uri: s.redirectUris.login,
        grant_type: "authorization_code",
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string; error_description?: string };
    if (body.error === "invalid_grant") {
      ok("Google がクライアント ID / シークレットを認識しました");
    } else if (body.error === "invalid_client" || body.error === "unauthorized_client") {
      ng(`クライアント ID またはシークレットが正しくありません (${body.error})`);
      process.exitCode = 1;
    } else {
      warn(`想定外の応答: ${res.status} ${body.error ?? ""} ${body.error_description ?? ""}`);
    }
  } catch (err) {
    warn(`Google に接続できませんでした（ネットワークを確認してください）: ${(err as Error).message}`);
  }
  console.log("\nリダイレクト URI の登録漏れは、実際にログインしたときに Google の画面で redirect_uri_mismatch として表示されます。\n");
}

void main();
