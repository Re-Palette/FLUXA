# Vercel で公開する手順

FLUXA は PostgreSQL が必須です。Vercel 側でデータベースと環境変数を設定すると、次のデプロイ時に
テーブル作成（`prisma migrate deploy`）と初期データ投入（`prisma db seed`）が自動で行われます（`vercel-build` スクリプト）。

## 1. データベースを用意する

どちらか一つ:

- **Vercel の Storage から作る（いちばん簡単）**: Vercel のプロジェクト →「Storage」→「Create Database」→ Neon（Postgres）を選び、
  プロジェクトに接続。`DATABASE_URL` が自動で追加されます。
- **Supabase を使う**: Supabase でプロジェクトを作成 →「Connect」→ **Session pooler** の接続文字列をコピー
  （`postgresql://postgres.xxxx:[パスワード]@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres`）→ `DATABASE_URL` に設定。

## 2. 環境変数を設定する

Vercel のプロジェクト →「Settings」→「Environment Variables」で追加（Production と Preview の両方）:

| 名前 | 値 |
|---|---|
| `DATABASE_URL` | 手順 1 の接続文字列 |
| `AUTH_SECRET` | ランダムな文字列 48 文字程度（`openssl rand -base64 48`） |
| `ENCRYPTION_KEY` | 32 バイトの base64（`openssl rand -base64 32`）。一度決めたら変更しない |
| `APP_URL` | 公開 URL（例: `https://fluxa-iota-nine.vercel.app`） |
| `DEMO_LOGIN` | `true`（デモアカウント demo@fluxa.demo / fluxa-demo-2026 で中を見たい場合のみ。誰でも入れるようになります） |

`openssl` がない場合は <https://generate-random.org/api-key-generator> などで作成しても構いません。

## 3. 再デプロイ

「Deployments」→ 最新のデプロイの「…」→「Redeploy」。ビルドログに `migrate deploy` と `Seeded 24 employee templates` が出れば成功です。

## 4. 確認

`https://<公開URL>/api/health` を開き、`"ok": true` になっていれば準備完了です。

| `database` の値 | 意味 |
|---|---|
| `not_configured` | `DATABASE_URL` が設定されていない |
| `unreachable` | 接続できない（URL・パスワード・接続方式を確認） |
| `not_migrated` | テーブルが未作成（再デプロイする） |

## 補足

- Vercel の「Deployment Protection（Vercel Authentication）」が有効だと、Vercel にログインしていない人はサイトを開けません。
  誰でも見られるようにするには「Settings」→「Deployment Protection」で無効にします（本番ドメインには通常かかりません）。
- 定期実行を使う場合は `CRON_SECRET` を設定し、`/api/cron/tick` を定期的に呼び出してください。
