# FLUXA — AI Company OS

> Build your AI Company.

FLUXA is a multi-tenant SaaS where each user builds their own **AI company**: choose AI employees, define
their responsibilities and mission, connect tools, set permissions, and hand work to the company. An
orchestrator splits each request into a task chain, routes steps to the right employee, runs tools behind a
server-side permission gate, pauses for **human approval** on risky actions, and files reports.

Architecture: [`docs/architecture.md`](docs/architecture.md)

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · PostgreSQL + Prisma 6 ·
in-house session auth (email/password + Google) · AI provider abstraction (Claude / OpenAI / Gemini) · Vitest

## Getting started

```bash
cp .env.example .env            # fill AUTH_SECRET and ENCRYPTION_KEY (see comments)
npm install
npx prisma migrate dev          # creates tables
npm run db:seed                 # AI employee templates, plans, model prices
npm run dev                     # http://localhost:3000
```

Want to look around first? Click **「デモで中を見る」** on the login page — it signs you into a sample company
(AI employees, finished tasks, reports, a pending approval) with no registration. You can also type the demo account into the login form:
**`demo@fluxa.demo` / `fluxa-demo-2026`** (created on first use). Demo login is on in development and for local
builds (`APP_URL` on localhost), off on real deployments unless `DEMO_LOGIN=true`. Use **デモをリセット** in the app to restore the sample data.

Then: **Sign up → Create company → Pick AI employees → Responsibilities & Mission → Connect tools →
Permissions → Launch → Dashboard**. To let employees actually work, connect an AI provider in
**Connections** (e.g. *Connect Claude* with your Anthropic API key — keys are tested, encrypted, and never
sent back to the browser). Google Sign-In and Google service connections require `GOOGLE_CLIENT_ID/SECRET` —
see [`docs/google-login-setup.md`](docs/google-login-setup.md) (Japanese) and check with `npm run google:check`.

Work is processed right after each request (`after()`); in production also call the cron endpoint every
minute so schedules fire and interrupted work is recovered:

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-app/api/cron/tick
```

## Scripts

| Command | What |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` / `lint` | TypeScript / ESLint |
| `npm test` | Vitest — unit + DB integration tests (uses `fluxa_test` DB, override with `TEST_DATABASE_URL`) |
| `npm run db:migrate` / `db:deploy` / `db:seed` | Prisma |

## What's implemented

- **Auth**: email/password (scrypt), Google Sign-In (PKCE), DB sessions (hashed tokens, httpOnly cookies), rate limiting, audit log
- **Multi-tenancy**: every tenant row has `companyId`; all app code uses `tenantDb(companyId)`, a Prisma extension that forces the tenant filter on every read/write (cross-tenant ids resolve to 404; tested)
- **Onboarding wizard** (6 steps), team packs (Startup / E-commerce / SaaS), 24 employee templates, custom responsibilities, mission suggestion
- **AI employee management**: add (template or fully custom builder), edit, pause/resume, delete (with confirmation), per-employee model, tools & permissions
- **Connections**: Claude/OpenAI/Gemini, Notion, Slack, GitHub (key → live test → AES-256-GCM); Google Drive/Sheets/Gmail/Calendar via OAuth with minimal per-service scopes; rule-based recommended connections; unimplemented services shown as *Coming Soon*
- **Orchestrator**: LLM planner → task chain → employee agent loop with tools → approval gate → resume → workflow report; retries for transient AI errors, never for side-effecting tools
- **Approval Center**, **Reports** (Markdown export), **Activity log**, **in-app notifications**, live status polling
- **Company memory** (pinned context injected into prompts; RAG-ready knowledge tables), **Scheduler** (cron presets)
- **Usage tracking & cost control** (tokens, requests, estimated cost, daily/monthly limits), plans stored as data (no hard-coded prices)
- **Prompt-injection containment**: untrusted content fenced as data, permissions enforced server-side independent of the model

## Not yet implemented

Real payment/billing, email notifications, full RAG ingestion (tables exist), Instagram/X/YouTube/Ads/Shopify/Stripe/HubSpot connectors,
Postgres Row Level Security (planned hardening), PDF export.
