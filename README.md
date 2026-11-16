# OzempicAI

Personal health & fitness tracker. Delivered as an installable PWA — bookmark it to your iPhone home screen and it opens full-screen.

The web app includes email/password authentication, password recovery, a daily dashboard,
calorie/meal tracking, water, exercise, weight and heart-rate logs, workout planning and
tracking, a range-based analytics dashboard, meal planning, groceries, and editable personal
goals. Every user-owned table is protected with Postgres Row Level Security.

Vite + React 18 + TypeScript · `@tanstack/react-query` · `react-router-dom` · `vite-plugin-pwa` (Workbox).
API: Node + Hono + `pg` (`server/`). Hosted on Railway.

## Workouts

Plans (Plans → Workouts) and logged sessions (Log → Workouts) share one shape: pick a split —
push, pull, legs, full body, cardio or other — then add exercises, each with the machine used
and either sets, reps and load or, for cardio, minutes and distance. A planned workout can be
tapped in the tracker to prefill the whole form, and ticked off once it is done.

## Units

Every measurement is stored in metric (kg, cm, km). Profile → Units switches the whole app
between metric and imperial, which relabels and converts what you read and type without
touching stored history. Conversions live in one place, `src/lib/units.ts`.

## Architecture

Everything runs in one Railway project (`OzempicAI`, environment `production`):

| Service    | What it is                                                                 | Source                           |
|------------|----------------------------------------------------------------------------|----------------------------------|
| `web`      | The built PWA served by Caddy; forwards `/api/*` to `api` over the private network | repo root (`Dockerfile`, `Caddyfile`) |
| `api`      | Node + Hono REST API: email/password auth, data endpoints, analytics      | `server/` (`server/Dockerfile`)  |
| `Postgres` | Railway Postgres                                                            | Railway template                 |

The browser only ever talks to `web`, so the API shares the app's origin (no CORS, no
build-time API URL) and `api` has no public domain.

**Data access and security.** The API connects as the database owner, and every user request
runs in a transaction that does `set local role authenticated` and sets
`request.jwt.claim.sub` to the caller's id. `auth.uid()` therefore resolves to the signed-in
user and the row level security policies from the migrations stay the authority on who sees
which row, exactly as they were on Supabase. The analytics SQL functions are unchanged.

**Auth.** Email/password with bcrypt hashes in `auth.users`. Signing in returns an opaque
bearer token (only its SHA-256 is stored in `auth.sessions`), valid for 30 days and extended
while the app is in use. Changing the password signs out other devices. Password reset emails a
single-use link (`/reset-password#token=…`, valid 60 minutes) through
[Resend](https://resend.com).

**AI coach (backend).** `POST /api/ai/chat` runs a Claude tool-use loop (`server/src/ai/`) and
streams the reply as server-sent events. The coach reads calorie, weight and exercise history,
the grocery list and meal plans, and can *insert* grocery items and planned meals; it has no
tool that deletes or edits existing rows. Every tool runs through `withUser()`, so row level
security applies to the AI exactly as it does to the user. Conversations are stored in
`ai_conversations` / `ai_messages` (migration `00012`), with the raw API content blocks kept
append-only. Limits: 4,000 characters per message, `AI_MAX_TURNS_PER_HOUR` messages per user per
hour, 8 model calls per message. Design and rationale: `docs/ai-coach-integration-plan.md`.

| Route | |
|-------|-|
| `POST /api/ai/chat` `{ conversation_id?, message, timezone }` | SSE: `conversation`, `text`, `tool_start`, `tool`, `error`, `ping`, `done` |
| `GET /api/ai/conversations` | latest first |
| `GET /api/ai/conversations/:id` | chat bubbles for the UI, with write cards |
| `DELETE /api/ai/conversations/:id` | |

**Connect your own AI (MCP).** `POST /api/mcp` is a remote MCP server (Streamable HTTP,
stateless, JSON responses) that exposes the coach's tools to the user's own AI app, such as
Claude on claude.ai and in the iPhone app. It sits behind an OAuth 2.1 authorization server in
the API: discovery at `/.well-known/oauth-protected-resource/api/mcp` and
`/.well-known/oauth-authorization-server`, Dynamic Client Registration at
`/api/oauth/register`, the consent screen at `/oauth/authorize` (a web route), and
`/api/oauth/token` and `/api/oauth/revoke`. Access tokens last an hour; refresh tokens last
60 days and rotate. Users choose read-only or read-and-edit, and every call runs through
`withUser()` like the coach. Besides the coach's tools, AI apps get edit and delete tools
for groceries, planned meals and workouts (kept out of the coach's prompt). Every write is
logged to `agent_activity` with before/after row snapshots (migrations `00015`, `00019`), and
Plans → AI activity lists them with Undo (`GET /api/agent-activity`,
`POST /api/agent-activity/:id/undo`), which refuses if the rows changed since.
Profile → Connected AI apps lists connections and disconnects them. Off unless
`MCP_ENABLED=true`. Design: `docs/mcp-server-plan.md`.

To connect Claude: on claude.ai, Settings → Connectors → Add custom connector with
`https://<app>/api/mcp`, leaving the advanced client id and secret empty. Allow it on the
OzempicAI consent screen, and it then works from the Claude iPhone app. For Claude Code:
`claude mcp add --transport http ozempicai https://<app>/api/mcp`, then `/mcp` to sign in.

## Local development

```bash
# API (needs a Postgres you can reach)
cd server
npm install
cp .env.example .env          # set DATABASE_URL
npm run migrate:dev           # apply server/migrations
npm run dev                   # http://localhost:8787

# Web (in another terminal, from the repo root)
npm install
npm run dev                   # http://localhost:5173, proxies /api to :8787
```

Open `http://localhost:5173` (or your LAN IP — `--host` is on) in mobile Safari to test the PWA flow.

## Build

```bash
npm run build      # tsc + vite build → dist/
npm run preview    # serve dist locally (also proxies /api)
npm run typecheck  # tsc --noEmit
npm test           # analytics unit tests
(cd server && npm run build)
(cd server && npm test)                # AI coach, OAuth and MCP unit tests
# OAuth + MCP end to end against a disposable, migrated Postgres:
(cd server && TEST_DATABASE_URL=postgres://… npm test)
(cd server && npm run smoke:ai -- --yes)  # real Claude API, ~$1-2; never against production
```

## Deploy (Railway)

Both app services build from this GitHub repo with their Dockerfiles and redeploy on push.

- `web`: root directory `/`, healthcheck `/`. Variable `API_UPSTREAM=http://${{api.RAILWAY_PRIVATE_DOMAIN}}:8080`.
- `api`: root directory `/server`, pre-deploy command `node dist/migrate.js` (applies any new
  file in `server/migrations/`, each in a transaction, tracked in
  `platform.schema_migrations`), healthcheck `/api/health`. Variables:
  - `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `PORT=8080`
  - `APP_URL=https://${{web.RAILWAY_PUBLIC_DOMAIN}}` (or the custom domain) — base of reset links
  - `RESEND_API_KEY`, `EMAIL_FROM` — password reset email. Without them, reset requests are
    accepted but no email is sent (a warning is logged).
  - `SIGNUP_MODE` — `open` or `closed`. Unset means **closed in production**: the sign-up form
    returns "New sign-ups are closed right now." Set `open` when you are onboarding
    people. Every signup also requires a single-use, email-bound invitation.
    On a trusted machine with the API database configured, run
    `npm --prefix server run invite -- person@example.com` (or `node dist/invite.js`
    in the API container). Set `APP_URL` to the public web origin. Give the
    resulting link only to that person over a trusted channel; it expires in
    seven days. Invitation links are credentials: do not post them publicly.
    This controls admission; it does not independently verify mailbox ownership.
  - `ANTHROPIC_API_KEY` — enables the AI coach. Without it every `/api/ai/*` route returns 503
    and the rest of the app works normally (this is also the rollback switch).
  - `AI_MODEL` (default `claude-opus-5-5`, e.g. `claude-sonnet-5-5` to cut cost) and
    `AI_MAX_TURNS_PER_HOUR` (default `40`, per user) — optional. `AI_MAX_TURNS_PER_HOUR_TOTAL`
    (default `300`) and `AI_MAX_CONCURRENT_TURNS` (default `8`) cap coach use across all users.
  - `MCP_ENABLED=true` — lets users connect their own AI apps (OAuth + `/api/mcp`). Needs
    `APP_URL` set to the public https origin, which becomes the OAuth issuer; changing it later
    invalidates existing connections. Unset it to switch the feature off (connections are kept,
    and Disconnect in Profile still works).

Schema changes: add the next numbered `.sql` file to `server/migrations/`. Never edit one that
has already run.

Before release, verify:

- A newly created account can add and delete an entry in each tracker without seeing another user's data.
- The Analytics tab loads the 30-day view and cannot expose another account's aggregates.
- Password reset sends an email and the link signs you in.
- The AI coach streams token by token through `web` (not in one burst), and another account's
  conversation id returns 404.
- With `MCP_ENABLED=true`: `https://<app>/.well-known/oauth-authorization-server` returns JSON
  (not the SPA's HTML), a Claude custom connector can connect through the consent screen, and
  Disconnect in Profile cuts it off.

## Importing data from the old Supabase project

`server/src/import-supabase.ts` copies accounts (ids and bcrypt password hashes, so everyone
keeps their password) and every tracker table into the Railway database, in one transaction.
It copies only columns present on both sides and skips ids that already exist, so it is safe to
rerun. Use `--dry-run` first.

```bash
cd server && npm ci && npm run build
SOURCE_DATABASE_URL='<Supabase → Connect → session pooler URI>' \
DATABASE_URL='<Railway → Postgres → Variables → DATABASE_PUBLIC_URL>' \
npm run import:supabase -- --dry-run      # then again without --dry-run
```

Signed-in sessions don't carry over: after the switch, everyone signs in once with their
existing password.

## Legacy Supabase files

`supabase/` holds the old hosted-Supabase migrations and local Docker stack. They are kept only
as the reference for importing data from the hosted project; `server/migrations/` is the source
of truth (its `00001`–`00010` are those files, renumbered, on top of `00000_platform.sql`).

## Theme

Design tokens in `src/theme/tokens.css`. Fraunces (display) + Inter (UI) via Google Fonts in `fonts.css`.

## Migration status

The Swift iOS/macOS targets were retired; see `web-migration-plan.md` for the phased plan to reach full parity in this webapp.
