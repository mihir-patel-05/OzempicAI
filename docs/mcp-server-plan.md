# MCP Server Plan: Bring Your Own AI

**Goal:** let users connect the AI they already pay for (Claude, ChatGPT, Cursor, Claude Code, and
others) to their OzempicAI account, so that their own agent can read and edit their **workout
plan**, **meal plan**, and **grocery list** directly.

**Approach:** expose the coach's existing tool registry as a remote MCP server on the API. The tools,
validation, and row-level security stay as they are. The new work is an adapter, an auth layer,
a few missing tools, and guardrails for edits the app doesn't see happen.

---

## 1. Summary

| Phase | What ships | Who can connect |
|-------|------------|-----------------|
| **P1** | `/api/mcp` endpoint over the existing tools, plus personal access tokens and a Settings page to manage them | Claude Code, Cursor, Claude Desktop, VS Code, the Claude API MCP connector: anything that accepts a URL and a header |
| **P2** | The missing tools (edit and delete for groceries, meals, and workouts), plus an in-app "Agent activity" feed with Undo | Same as P1 |
| **P3** | An OAuth 2.1 authorization server and a consent screen | Claude.ai and ChatGPT custom connectors (Pro and Plus subscribers) |

```
User's AI (Claude.ai, ChatGPT, Cursor, ...)
        │  MCP over Streamable HTTP
        │  Authorization: Bearer <access token>
        ▼
web (Caddy) ── /api/* proxy ──► api (Hono)
                                 routes/mcp.ts
                                   │ resolve token → user + scopes
                                   │ rate limit per token
                                   │ tools/list → REGISTRY (filtered by scope)
                                   │ tools/call → executeTool() inside withUser(userId)  ──► Postgres (RLS)
                                   │ write → agent_activity row (for the feed and Undo)
```

**Why this is cheap:** every tool in `server/src/ai/tools/` already has a name, a description, a
JSON input schema, zod validation, and a `run(input, ctx)` handler that gets a user-scoped `db`.
That is exactly what an MCP tool needs. There is no business logic to rewrite.

**Side benefit:** model cost for these interactions is paid by the user's subscription, not our
Anthropic bill. Only the built-in coach costs us tokens.

---

## 2. Decisions

| Topic | Decision | Why |
|-------|----------|-----|
| Transport | Remote MCP, **Streamable HTTP**, **stateless** (no session IDs) | Users add a URL and nothing is installed. Every tool is request/response, so there's no session state to hold, and it works with one API replica. |
| SDK | Official `@modelcontextprotocol/sdk` (TypeScript) | Handles the JSON-RPC and protocol details. Use its Web Standard (fetch) transport if the installed version has it, since Hono is fetch-based; otherwise use the Node transport through `@hono/node-server`'s raw `req`/`res`. |
| Mount point | `/api/mcp` | Caddy already proxies `/api/*`, so P1 and P2 need no Caddy change. |
| Auth, P1 | Personal access tokens (PATs) | About a day of work. Gets real agents testing quickly. |
| Auth, P3 | OAuth 2.1 with PKCE, following the MCP authorization spec | Claude.ai and ChatGPT connectors require it. Users never handle a raw key. |
| Scopes | `read` and `write` (each tool declares which one it needs) | Users can give an agent read-only access. Tools without the right scope are hidden from `tools/list`. |
| Data access | Every call runs inside `withUser(userId)` | Same RLS guarantee as the coach. An agent can never reach rows the user can't. |
| Timezone | Add `users.timezone`, set by the web app on sign-in. MCP falls back to `UTC`. | Today the browser sends the timezone with each coach request. External agents don't, and tools need `today` to validate dates. |
| Shared registry | One `REGISTRY` serves both the coach and MCP | One set of tools, tests, and limits. A tool can opt out of either surface with a flag. |

---

## 3. Phase 1: Endpoint and personal access tokens

### 3.1 Dependencies and config

- `server/package.json`: add `@modelcontextprotocol/sdk`.
- Env: `MCP_ENABLED=true` (kill switch) and `PUBLIC_BASE_URL` (used in the Settings page and,
  later, in OAuth metadata).

### 3.2 Migration `server/migrations/00013_mcp_access_tokens.sql`

```sql
create table public.mcp_access_tokens (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  name          text not null,                 -- "Claude Desktop on laptop"
  token_hash    text not null unique,          -- sha256, same scheme as auth.sessions
  token_prefix  text not null,                 -- first 8 chars, shown in Settings
  scopes        text[] not null default '{read}',
  last_used_at  timestamptz,
  expires_at    timestamptz,                   -- null = no expiry
  revoked_at    timestamptz,
  created_at    timestamptz not null default now()
);
-- RLS: users can select and update (revoke) their own rows only.

alter table public.users add column timezone text;
```

Tokens are generated with `randomBytes(32)`, prefixed `oza_` so they are easy to spot in leaks and
secret scanners, and shown once at creation. Only the hash is stored.

### 3.3 Server layout

```
server/src/
  mcp/
    server.ts       buildMcpServer(ctx): registers REGISTRY tools on an McpServer
    auth.ts         requireMcpToken middleware: Bearer → user, scopes, rate limit
    tokens.ts       create, list, and revoke PATs
  routes/
    mcp.ts          POST /api/mcp (GET and DELETE return 405 in stateless mode)
    mcpTokens.ts    /api/mcp-tokens CRUD, behind requireUser (the web session)
```

### 3.4 Registry changes (`server/src/ai/tools/types.ts`)

Add metadata to `CoachTool`:

```ts
scope: 'read' | 'write'
annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean }
surfaces?: { coach?: boolean; mcp?: boolean }   // default: both
```

The MCP adapter maps `definition.name` and `definition.description` straight across,
`definition.input_schema` to `inputSchema`, and drops `strict`. Calls go through the existing
`executeTool()` so that `ToolInputError` and `DateInputError` come back as `isError` results the
agent can correct, while unexpected errors roll back the transaction.

### 3.5 Context the agent needs

The coach's system prompt gives the model the profile and today's date. External agents get neither.
To cover that:

- `get_profile` returns `today`, `timezone`, and `unit_system` alongside the profile fields.
- The MCP server's `instructions` field says: "Call `get_profile` first. Dates are YYYY-MM-DD in
  the user's timezone. Read before you write so you don't create duplicates."

### 3.6 Settings page

Add a "Connected AI apps" section in `ProfileScreen`:

- Create a token: name it, choose read-only or read and write, then copy the token once.
- List tokens with name, prefix, scopes, last used, and a **Revoke** button.
- Copy-paste setup snippets for Claude Desktop, Claude Code (`claude mcp add --transport http ...`),
  and Cursor.

### 3.7 Rate limits

Reuse `rateLimit()` from `auth.ts`, keyed per token:

- 120 calls per 15 minutes overall
- 40 writes per 15 minutes

The existing per-call caps (`MAX_GROCERY_ITEMS`, `MAX_WORKOUTS`, `MAX_PLAN_MEALS`, `MAX_EXERCISES`)
still apply because they live in the tools.

---

## 4. Phase 2: Missing tools and the activity feed

### 4.1 Tool gaps

The coach's tools were built for chat with an Undo button, so they mostly add. External agents need
full editing. Reads also need to return row `id`s so the agent can target edits.

| Area | Exists today | Add |
|------|--------------|-----|
| Groceries | `get_grocery_list`, `add_grocery_items` | Return `id` in reads. `update_grocery_items` (rename, recategorize, mark purchased or unpurchased). `remove_grocery_items`. `clear_purchased_groceries`. |
| Meal plans | `get_meal_plans`, `create_meal_plan` | Return `id` in reads. `update_planned_meal`. `delete_planned_meals` (by id or by date range). |
| Workouts | `get_workout_plans`, `create_workout_plans`, `update_workout_plan` | `delete_workout_plans`. `complete_workout_plan` (sets `completed_at`). |

Every delete tool gets `destructiveHint: true`, so the user's AI app asks them before running it.
Every new tool gets unit tests in `tools.test.ts`, matching the existing style.

### 4.2 Migration `server/migrations/00014_agent_activity.sql`

```sql
create table public.agent_activity (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  token_id     uuid references public.mcp_access_tokens(id) on delete set null,
  client_name  text,                 -- from MCP clientInfo, e.g. "claude-ai"
  tool_name    text not null,
  summary      text,                 -- reuses ToolOutcome.summary
  resource     text,                 -- reuses ToolOutcome.resource
  created_ids  uuid[] not null default '{}',
  before       jsonb,                -- snapshot of updated or deleted rows, for Undo
  undone_at    timestamptz,
  created_at   timestamptz not null default now()
);
```

Each tool returns a `before` snapshot in its `ToolOutcome` when it updates or deletes rows.

### 4.3 Activity feed and Undo

- Add an "Agent activity" list to the Plans and Groceries screens, e.g. "Claude added 9 grocery
  items · 2 min ago · **Undo**".
- Undo for inserts deletes `created_ids`, the same as the coach does today.
- Undo for updates and deletes restores the rows from `before`.
- The web app polls or refetches on focus, so edits made by an agent show up without a manual
  refresh.

---

## 5. Phase 3: OAuth for Claude.ai and ChatGPT

### 5.1 What the MCP authorization spec needs

| Piece | Path | Notes |
|-------|------|-------|
| Protected resource metadata (RFC 9728) | `/.well-known/oauth-protected-resource` | Points to our authorization server. **Needs a Caddy route**, since it's outside `/api`. |
| Authorization server metadata (RFC 8414) | `/.well-known/oauth-authorization-server` | Lists endpoints, PKCE `S256`, and scopes. Also needs a Caddy route. |
| `401` with `WWW-Authenticate` | on `/api/mcp` | Includes `resource_metadata="..."` so clients can discover the above. |
| Client registration | `/api/oauth/register` | Dynamic Client Registration (RFC 7591), and/or Client ID Metadata Documents, depending on which the target clients support at build time. **Check Claude.ai's and ChatGPT's current docs before building.** |
| Authorize | `/oauth/authorize` (web route) | Reuses the normal login, then shows a consent screen: "Allow **Claude** to read and edit your workouts, meals, and groceries?" with scope checkboxes. |
| Token | `/api/oauth/token` | `authorization_code` with PKCE, plus `refresh_token`. Access tokens last 1 hour; refresh tokens rotate. |
| Revocation | `/api/oauth/revoke` | Revoking from the app also kills the refresh token. |

### 5.2 Migration `server/migrations/00015_oauth.sql`

Tables: `oauth_clients`, `oauth_authorization_codes` (short-lived, single use, PKCE challenge
stored), and `oauth_refresh_tokens`. OAuth access tokens can reuse `mcp_access_tokens` with a
`client_id` column, so the token middleware, scopes, Settings list, and activity feed work the same
for PATs and OAuth.

### 5.3 Settings

"Connected AI apps" lists OAuth grants next to PATs (for example "Claude.ai · read and write · last
used today") with a **Disconnect** button.

---

## 6. Security checklist

- [ ] Tokens are stored only as sha256 hashes, shown once, and revocable. `last_used_at` is updated.
- [ ] Every tool call runs in `withUser()`. No tool takes a `user_id` input.
- [ ] Scopes are enforced on both `tools/list` and `tools/call`.
- [ ] Per-token rate limits apply, and the existing per-call size caps still apply.
- [ ] `destructiveHint` is set on every delete, and the activity feed records every write.
- [ ] Tool results return only the fields an agent needs. No emails, password data, or other users' rows.
- [ ] Text the user typed (grocery names, notes) goes back to agents as data. Tool descriptions
      don't tell agents to follow instructions found in results.
- [ ] Origin validation and HTTPS only (Caddy already terminates TLS).
- [ ] The `MCP_ENABLED` kill switch is tested.
- [ ] OAuth: PKCE required, exact redirect URI match, single-use codes, rotating refresh tokens.

---

## 7. Testing

- **Unit:** the new tools in `tools.test.ts`; scope filtering; token hashing and revocation; Undo
  restores from `before`.
- **Protocol:** run MCP Inspector (`npx @modelcontextprotocol/inspector`) against a local
  `/api/mcp` to check `initialize`, `tools/list`, and `tools/call`, including error results.
- **Real clients:**
  - P1: Claude Code (`claude mcp add --transport http ozempicai <url> --header "Authorization: Bearer ..."`),
    Claude Desktop, and Cursor.
  - P3: Claude.ai custom connector and ChatGPT connector, through the full OAuth flow.
- **Scenario script:** "Plan next week's push/pull/legs, build a 1,800 kcal meal plan, then put
  everything I need on my grocery list." Check that there are no duplicates, dates are correct in a
  non-UTC timezone, and every write appears in the activity feed and can be undone.

---

## 8. Rollout

1. Ship P1 behind `MCP_ENABLED` and test with my own account in Claude Code and Claude Desktop.
2. Invite a few users to create tokens. Watch logs, rate-limit hits, and tool error rates.
3. Ship P2 before announcing widely, since edit and delete tools and Undo make outside agents safe
   to recommend.
4. Ship P3, then publish a "Connect your AI" help page with setup steps for Claude.ai and ChatGPT.

---

## 9. Open questions

- Should read-only access to calorie, weight, and exercise history be exposed too? The tools
  already exist (`get_calorie_summary`, `get_weight_trend`, `get_exercise_summary`). Health data is
  sensitive, so it might need its own `health:read` scope.
- Should there be MCP **prompts** (for example "Plan my week") as well as tools? They are cheap to
  add and show up as slash commands in some clients.
- Should agents be able to log food and workouts, not just plan them? That's a natural follow-up
  once P2's Undo exists.
- Should this be free, or a paid-tier feature?
