# FLUXA — AI Company OS: Architecture

> Build your AI Company.

FLUXA is a multi-tenant SaaS where each user builds their own **AI company**: they pick AI employees,
define what each one does, connect tools, set permissions, and then hand work to the company. An
orchestrator splits a request into a chain of tasks, routes each to the right employee, executes tools
under permission checks, pauses for human approval on risky actions, and files reports.

The product is the *system that builds, manages, connects and runs AI employees* — not the employees
themselves. Every employee's role, mission, responsibilities, tools and permissions are per-company data.

## 1. Stack

| Layer | Choice | Notes |
|---|---|---|
| Web | Next.js 16 (App Router), React 19, TypeScript | Server Components for reads, Server Actions for mutations, Route Handlers for OAuth + polling + cron |
| UI | Tailwind CSS v4 + in-repo components (`src/components/ui`) | shadcn-style primitives, dark-first design tokens with a light theme |
| DB | PostgreSQL + Prisma 6 | `prisma/schema.prisma`, migrations in `prisma/migrations` |
| Auth | In-house session auth | Email + password (scrypt) and Google Sign-In (OAuth 2.0 + PKCE). DB-backed sessions, hashed tokens |
| AI | Provider abstraction (`src/server/ai`) | Anthropic (`@anthropic-ai/sdk`), OpenAI (`openai`), Gemini (`@google/genai`) |
| Tests | Vitest | Unit tests + DB integration tests (tenant isolation, orchestrator, approvals) |

## 2. Directory layout

```
prisma/                 schema, migrations, seed (employee catalog, plans, model prices)
src/proxy.ts            optimistic auth redirect + security headers (Next 16 "proxy", formerly middleware)
src/app/                routes
  (marketing)/          landing page
  (auth)/login, signup  email + Google sign-in
  onboarding/           6-step "Create your AI Company" wizard
  app/                  the OS: overview, employees, tasks, approvals, reports, connections, activity, company, settings
  api/                  OAuth callbacks, polling endpoints, cron tick
src/components/         UI primitives + feature components
src/lib/                client-safe shared code (catalog, types, formatting)
src/server/             server-only code (imports "server-only")
  db.ts                 Prisma client + tenantDb(companyId) scoped client
  auth/                 password hashing, sessions, Google OAuth, guards
  security/             encryption, rate limiting, origin checks, audit log
  catalog/              employee/responsibility/tool catalog + recommendation rules
  integrations/         connection registry, API-key + OAuth connectors, credential vault
  ai/                   AIProvider interface, providers, registry, usage + limits
  tools/                Tool interface, registry, built-in + integration tools
  orchestrator/         planner, employee agent loop, approval gate, runner/queue
  services/             domain services (companies, employees, tasks, approvals, reports, notifications, activity)
tests/                  vitest suites
```

## 3. Multi-tenant model

**Tenant = Company.** A user can belong to several companies through `CompanyMember` (role: OWNER, ADMIN, MEMBER).
The active company is stored on the session row (`Session.activeCompanyId`), never trusted from the client.

Isolation is enforced in three layers:

1. **Request guard** — `requireCompany()` (src/server/auth/guards.ts) loads the session, verifies the user is a
   member of the active company, and returns `{ user, company, membership, db }`.
2. **Scoped Prisma client** — `tenantDb(companyId)` is a Prisma client extension that, for every tenant model,
   injects `companyId` into `where` for reads/updates/deletes and into `data` for creates. Code in server actions
   and services receives *only* the scoped client, so a forgotten filter cannot leak another company's rows.
   Looking up a row by id from another tenant returns `null`, i.e. a 404, never someone else's data.
3. **Database** — every tenant table has a non-null `companyId` FK with `onDelete: Cascade` and indexes that lead
   with `companyId`. Credentials are additionally bound to their tenant cryptographically (AES-GCM AAD =
   `companyId:integrationId`), so a ciphertext copied to another tenant fails to decrypt.

Postgres Row Level Security is a planned hardening step (policies keyed on `app.company_id`); the schema is
already shaped for it.

## 4. Data model (summary)

Identity: `User`, `AuthAccount` (Google login link), `Session`, `AuditLog`
Tenant: `Company`, `CompanyMember`
Catalog (global, read-only, seeded): `EmployeeTemplate`, `Plan`, `ModelPrice`
Workforce: `AIEmployee`, `AIEmployeeResponsibility`, `EmployeeToolPermission`, `EmployeeConnectionAccess`
Connections: `Integration` (one per company+provider), `Credential` (encrypted blob, never sent to the client)
Work: `Workflow` (a user request), `Task` (a step owned by one employee), `ToolCall`, `Approval`
Output: `Report`, `ActivityLog`, `Notification`
Memory: `CompanyMemory`, `KnowledgeDocument`, `KnowledgeChunk` (RAG-ready: `embedding` column reserved)
Operations: `Schedule`, `UsageRecord`, `UsageLimit`, `Subscription`, `RateLimitBucket`

See `prisma/schema.prisma` for the authoritative definition.

## 5. Authentication

- **Email + password**: scrypt (N=2^15, per-user salt), constant-time compare, rate-limited by IP+email.
- **Google Sign-In**: authorization-code flow with PKCE + `state` in a short-lived httpOnly cookie. Scopes:
  `openid email profile` only. Login is kept separate from Google *tool* connections so signing in never grants
  Drive/Gmail access.
- **Sessions**: 32-byte random token in cookie `fluxa_session` (`HttpOnly`, `SameSite=Lax`, `Secure` in production,
  30-day rolling). Only `sha256(token)` is stored.
- **CSRF**: Server Actions are POST-only with Next's Origin/Host check; custom POST route handlers call
  `assertSameOrigin()`; cookies are `SameSite=Lax`.
- `proxy.ts` does an optimistic cookie check for `/app` and `/onboarding`; the real check is server-side.

## 6. AI employees

An employee = template (optional) + per-company overrides:
`name, role, department, mission, responsibilities[], connection access[], tool permissions[], status`.
Two companies can both have a "Marketing Manager" doing entirely different work.

The prompt for each run is assembled by `buildEmployeeSystemPrompt()` from:
role, mission, responsibilities, available tools, permission rules, company context (profile + memory),
and fixed security rules. Untrusted content (tool output, prior employee output, documents) is wrapped in
`<untrusted_data>` blocks with an explicit rule that instructions inside them are data, not commands.

## 7. Connections

`src/server/integrations/registry.ts` declares every provider with `category`, `authType` (`oauth` | `api_key`),
`status` (`available` | `coming_soon`), and the tools it unlocks. Coming-soon providers render with a badge and
cannot enter a connected state.

- **API-key providers** (Claude, OpenAI, Gemini, Notion, GitHub, Slack bot): key is posted to a Server Action,
  tested live against the provider, then encrypted with AES-256-GCM (`ENCRYPTION_KEY`) and stored in `Credential`.
  The key never returns to the browser; the UI shows `••••` + last 4 chars captured at save time.
- **Google services** (Drive, Sheets, Gmail, Calendar): OAuth with incremental, minimal scopes per service
  (`drive.file`, `spreadsheets.readonly`, `gmail.compose`, `calendar.events`). Refresh tokens are encrypted;
  access tokens are refreshed server-side on use.
- **Recommendations**: `recommendConnections(responsibilities)` is rule-based (responsibility → providers).

## 8. Tools, permissions, approvals

`Tool` interface: `name`, `provider`, `description`, `input` (zod schema → JSON schema), `effect`
(`read` | `internal_write` | `external_write`), `riskTags` (`email`, `social_post`, `ads`, `delete`, `money`,
`contract`, `external_write`), `execute(ctx, input)`.

Before any tool runs, `checkToolAccess(employee, tool)` evaluates:
1. provider connected for the company and granted to the employee (`EmployeeConnectionAccess`),
2. `EmployeeToolPermission.policy` ∈ `ALLOW | REQUIRE_APPROVAL | DENY` (defaults derived from risk tags:
   anything external-facing defaults to `REQUIRE_APPROVAL`),
3. `isApprovalRequired(tool, employee, company)` → pauses the task and creates an `Approval`.

Approval flow: `ToolCall(AWAITING_APPROVAL)` → `Approval(PENDING)` → user approves/rejects in the Approval Center
→ approved calls execute exactly once (idempotency by `ToolCall.status`), rejected calls return a
"rejected by user" tool result → the employee's agent loop resumes from its persisted transcript.

## 9. Orchestrator

```
User request ─▶ Workflow ─▶ Planner (LLM, JSON plan, max 5 steps) ─▶ Task chain
   Task N ─▶ Employee agent loop ─▶ tool selection ─▶ permission/approval gate ─▶ tool execution
          ─▶ result validation ─▶ output handed (as untrusted data) to Task N+1
Final task done ─▶ Workflow COMPLETED ─▶ Report filed ─▶ activity + notification
```

- Employees never call each other directly; the orchestrator passes outputs down the chain.
- Execution is queue-based: tasks are claimed atomically (`UPDATE … WHERE status='PENDING'`), run by
  `runQueue()` which is kicked via `after()` on mutation and by `/api/cron/tick` (for schedules and recovery).
- Transient AI errors (429/5xx/network) retry with backoff inside the provider call. Tool calls with external
  side effects are **never** retried automatically.
- Failures set `Task.error`, `Workflow.status=FAILED`, log activity and notify the user; the user can retry a
  failed task (which re-runs the agent from its transcript without re-executing completed tool calls).

## 10. Usage, limits, pricing

Every model call writes `UsageRecord` (provider, model, input/output tokens, estimated cost, billing mode
BYOK/PLATFORM). Costs use the seeded `ModelPrice` table. `UsageLimit` (per company: daily/monthly
requests, tokens, cost) is checked before each call. `Plan` rows (seeded, editable — no prices in code) carry
`includedUsage`/limits for future hosted-AI plans; `Subscription` links a company to a plan.

## 11. Realtime

The OS polls `/api/company/pulse` (employee statuses, KPIs, unread notifications) every few seconds.
The endpoint returns a single JSON snapshot so it can later be swapped for SSE/WebSocket without UI changes.

## 12. Scheduler (designed, minimal)

`Schedule` rows (cron expression + employee + instruction). `/api/cron/tick` (protected by `CRON_SECRET`)
creates workflows for due schedules and advances `nextRunAt`. Daily/weekly/monthly company reports use the
same path with the `report.company_summary` built-in.

## 13. Security checklist

- AuthN (sessions) + AuthZ (membership + role) on every server entry point
- Tenant-scoped Prisma client; cross-tenant ids resolve to 404
- AES-256-GCM secret encryption with tenant-bound AAD; secrets never logged, never sent to the client
- OAuth: PKCE + state, minimal scopes, tokens encrypted at rest
- CSRF: Origin checks + SameSite cookies; XSS: React escaping, no `dangerouslySetInnerHTML` on user/AI content,
  strict security headers
- Rate limiting (DB-backed buckets) on auth, connection tests, task creation
- Zod validation on every input
- Audit log for auth and credential events; activity log for company work
- Prompt-injection containment: untrusted data fencing, tool permission gate independent of the model,
  approval gate for external side effects
