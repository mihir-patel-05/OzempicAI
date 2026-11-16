# Security and correctness review — 2026-11-16

## Executive summary

Reviewed commit `0a991c61b0e781b3b3d342538b55106fb6e88e3d`. **Fix findings 01 and 02 before public release:** an in-flight login using the old password can survive password recovery, and concurrent coach requests bypass the intended model concurrency limits. Both were reproduced against an isolated local database. Four medium-priority issues and two lower-priority client bugs are also documented below.

No intentional backdoor, arbitrary cross-user database read, SQL injection, or remote code execution was demonstrated. This is a bounded review, not proof that these vulnerabilities cannot exist. The code has substantial protections: parameterized queries, transaction-local RLS roles, owner checks, hashed random session tokens, PKCE, OAuth scope enforcement, input limits, and production security headers.

This is a **new review of the current implementation**. The existing root security report describes earlier findings and fixes; it was preserved. Findings 05 and 06 below are remaining issues already recognized there. Application code and deployment settings were not changed.

| ID | Severity | Finding | Evidence |
| --- | --- | --- | --- |
| 01 | High | Old-password login can create a session after recovery | Local API reproduction with controlled scheduling |
| 02 | High | AI concurrency checks race with slot reservation | Ten simultaneous mocked model calls |
| 03 | Medium | Tabs can display one account while sending another account's token | Actual client module with simulated storage/network |
| 04 | Medium | Undo loses relationships removed by parent deletion | Local API/database reproduction |
| 05 | Medium | Opening signup allows unverified identity claims and account multiplication | Source-confirmed; conditional on opening signup |
| 06 | Medium | Vulnerable development/build dependency tree remains | Fresh npm audit; not a demonstrated production exploit |
| 07 | Low | A delayed unauthorized response clears a newer session | Actual client module reproduction |
| 08 | Low | Storage failure produces a false signed-in state | Actual client module reproduction |

## Remediation status

The findings below describe the reviewed baseline. Fixes are being committed separately, authored by Mihir Patel with Codex as co-author.

| Finding | Status | Validation |
| --- | --- | --- |
| 01 | Fixed | Login session creation locks and rechecks the verified password hash; stale password changes also fail. Two real-database reset/change race tests pass. |
| 02 | Fixed | Slots are reserved synchronously before database setup and released on setup/stream failures. Database-backed admission tests cover both caps and failure cleanup. |
| 03 | Fixed | External session changes clear the account view, reload the tab and block stale work. Old-account responses are rejected. Three client tests pass. |
| 04–08 | Pending | See the original evidence below. |

## High-priority security findings

### 01 — An old-password login can survive password recovery

**Impact:** Someone who knows a compromised password can retain health-data access if their login overlaps the owner's password reset or change.

**Evidence:** [auth.ts:377](/Users/mihirpatel/Downloads/OzempicAI/server/src/auth.ts:377) reads the password hash, awaits password verification, then [auth.ts:390](/Users/mihirpatel/Downloads/OzempicAI/server/src/auth.ts:390) inserts a session outside a credential-validation transaction. Password reset updates the hash and deletes existing sessions at [auth.ts:503](/Users/mihirpatel/Downloads/OzempicAI/server/src/auth.ts:503). There is no credential-version check when the login creates its session. Ordinary password change uses the same vulnerable ordering relative to login.

**Reproduction:** A synthetic old-password login was paused immediately before its session insertion. A legitimate password reset completed. Resuming the login returned HTTP 200 and its newly issued token successfully read `/api/profile`. This exercises actual handlers and SQL, with a test-only scheduling barrier. It does not measure how reliably an attacker could win the race over the public network.

**Prerequisite:** Knowledge of the old password and a login already in progress during recovery. This is not an unauthenticated password bypass. The sequential OAuth-revocation tests still pass; they do not cover this session-issuance race.

**Fix:** Verify the password against a captured credential version, then lock the user row in a transaction, confirm that version is unchanged, and create the session in that transaction. Password reset/change must update the version under the same lock. Avoid holding a database connection throughout expensive password hashing if a version recheck suffices.

**Regression test:** Pause login after password verification, complete reset/change, resume login, and require rejection. Also test the reverse ordering: a session committed before reset must be revoked.

### 02 — Concurrent coach requests bypass both concurrency limits

**Impact:** An authenticated account can exceed the intended simultaneous AI workload, consuming shared capacity and increasing burst spending.

**Evidence:** [ai.ts:80](/Users/mihirpatel/Downloads/OzempicAI/server/src/routes/ai.ts:80) checks per-user and global counts before awaiting a profile/conversation transaction. Slots are added only at [ai.ts:127](/Users/mihirpatel/Downloads/OzempicAI/server/src/routes/ai.ts:127); only the conversation-ID check is repeated there. Independent new conversations therefore pass the same old counts. [client.ts:18](/Users/mihirpatel/Downloads/OzempicAI/server/src/ai/client.ts:18) configures eight global slots and two per user.

**Reproduction:** Ten requests for one synthetic user were held in the profile transaction after admission checks. Once released, **all ten entered the mocked model stream concurrently**, exceeding both limits. No real model calls or paid tokens were used. The hourly request limits remain effective; this is not unlimited spending or a measured service outage.

**Fix:** Reserve global and user slots synchronously before the first asynchronous operation after the checks. Include pending conversation creation in the count and release reservations in a `finally` covering every failure and streaming exit. Keep a separate conversation lock. If deploying multiple API instances, move admission control to shared storage.

**Regression test:** Hold the model response pending, submit concurrent new chats, and assert that at most two enter for one user and eight across users. Verify that failed database setup returns its reservation.

## Medium-priority findings

### 03 — Cross-tab session changes can make writes target the wrong account

**Evidence:** [api.ts:48](/Users/mihirpatel/Downloads/OzempicAI/src/lib/api.ts:48) notifies only listeners in the current JavaScript instance. There is no `storage` event or broadcast listener. [AuthProvider.tsx:39](/Users/mihirpatel/Downloads/OzempicAI/src/auth/AuthProvider.tsx:39) subscribes only to those local notifications. Meanwhile, every request independently reloads the shared localStorage token at [api.ts:83](/Users/mihirpatel/Downloads/OzempicAI/src/lib/api.ts:83).

**Trigger and impact:** Tab A displays account A. In tab B, sign out and sign into account B. Tab A keeps account A's React state and cached health information, but its next request uses account B's token. A mutation can therefore write to B while the interface still identifies A. This requires account switching within one browser profile; it is not access to an arbitrary remote user's account.

**Validation:** Executed the actual API module with fake browser storage. After an external storage change, the session listener still held A while a PATCH used `Bearer synthetic-B`. A two-tab browser UI test remains necessary to verify the full presentation behavior.

**Fix:** Use one authoritative session store, synchronize changes across tabs, invalidate account-bound caches and in-flight work, and reject mutations if their captured user/token no longer matches the active session. Test signout, account switching, and late responses across two tabs.

### 04 — Undo restores deleted plans but loses their dependent relationships

**Evidence:** Meal snapshots include only the meal row at [snapshots.ts:30](/Users/mihirpatel/Downloads/OzempicAI/server/src/ai/tools/snapshots.ts:30). Deletion sets grocery `meal_plan_id` to null through [00001_init_schema.sql:81](/Users/mihirpatel/Downloads/OzempicAI/server/migrations/00001_init_schema.sql:81). Undo at [activity.ts:95](/Users/mihirpatel/Downloads/OzempicAI/server/src/mcp/activity.ts:95) restores the meal but does not restore those grocery links. Workout-session links have the same `ON DELETE SET NULL` behavior at [00007_workouts.sql:69](/Users/mihirpatel/Downloads/OzempicAI/server/migrations/00007_workouts.sql:69), while workout snapshots include exercises but not linked sessions.

**Reproduction:** Created a meal and a linked grocery item, deleted the meal through an MCP tool, then successfully undid that activity through the API. The meal returned; the grocery's `meal_plan_id` remained null. The workout variant is source-confirmed rather than separately reproduced.

**Impact:** Undo reports success while permanently losing part of the original relationship data. This is a correctness/data-integrity issue, not cross-user access.

**Fix:** Snapshot affected dependent links and restore them transactionally, with conflict checks that preserve subsequent user edits. Alternatively, soft-delete plans or explicitly restrict undo when the original state cannot be restored. Test linked grocery items and logged workout sessions, including concurrent edits after deletion.

### 05 — Public signup still does not verify email ownership

**Evidence:** [auth.ts:322](/Users/mihirpatel/Downloads/OzempicAI/server/src/auth.ts:322) opens signup when configured; [auth.ts:330](/Users/mihirpatel/Downloads/OzempicAI/server/src/auth.ts:330) creates an immediately usable account/session without mailbox verification. Production defaults to closed signup, which substantially limits current exposure. This is a remaining issue from the earlier report, not a newly discovered regression.

**Impact when signup is opened:** Attackers can claim someone else's address, block that person's normal signup, and create multiple usable accounts to multiply per-account allowances. Global hourly AI limits remain present, although finding 02 weakens concurrency controls. Email recovery revokes existing sessions and integrations sequentially, subject to finding 01; unverified signup alone does not prove takeover of an existing account.

**Fix:** Require verified email or an invitation before granting usable health-data, AI, or OAuth access; expire pending registrations and limit attempts to resend verification. Add shared account/storage quotas appropriate to a public service. Keep signup closed until the onboarding policy is implemented. Test that an unverified account cannot consume paid AI capacity or establish lasting OAuth access.

### 06 — Development/build dependencies retain published vulnerabilities

**Evidence:** [package-lock.json:6672](/Users/mihirpatel/Downloads/OzempicAI/package-lock.json:6672) resolves Vite 5.4.21. Fresh npm audits reported eight affected web dependency entries: one high, five moderate and two low; the server reported zero. These are package counts, not eight independently exploitable application vulnerabilities.

Relevant advisories include Vite [optimized-dependency source-map path traversal](https://github.com/advisories/GHSA-4w7w-66w2-5vf9), [files outside the allowlist under matching paths](https://github.com/advisories/GHSA-rq7h-c2jc-7f22), and esbuild [development-server cross-origin reads](https://github.com/advisories/GHSA-67mh-4wv8-2f99). The audit's high Vite advisory concerns Windows path handling; it is not evidence of that exploit on this Mac or the production Linux containers.

**Exposure:** Primarily the developer/build environment. Vite binds to localhost by default, and production serves static assets with Caddy. No exploitation of the production deployment was demonstrated. Localhost binding does not address every advisory involving a malicious page visited by the developer.

**Fix:** Upgrade the compatible Vite/plugin/PWA dependency set to supported patched releases and rerun audits, build, and PWA checks. Do not blindly apply a forced audit upgrade. Preserve a static production serving path. This remains open from the earlier report.

## Lower-priority correctness findings

### 07 — A delayed 401 for an old token clears the new session

**Evidence:** [api.ts:100](/Users/mihirpatel/Downloads/OzempicAI/src/lib/api.ts:100) clears storage when the request used any session and returns 401, without comparing that token with the currently stored token.

**Reproduction:** Start a request under A, store a newly authenticated session B, then complete A's request with 401. B is removed. This can occur during account switching or reauthentication with slow requests and causes unexpected logout; it does not revoke B's server-side session.

**Fix/test:** Clear the current session only if its token still equals the request's token. Add a delayed-response regression test.

### 08 — The advertised in-memory session fallback does not exist

**Evidence:** [api.ts:48](/Users/mihirpatel/Downloads/OzempicAI/src/lib/api.ts:48) catches storage errors and says the session will live for the tab, but saves no in-memory copy. [api.ts:37](/Users/mihirpatel/Downloads/OzempicAI/src/lib/api.ts:37) reads only localStorage and returns null on failure.

**Reproduction:** Make storage reads/writes throw, then store a session. Subscribers receive the signed-in user, but `loadSession()` returns null and subsequent requests have no Authorization header.

**Impact:** Users with blocked or failing storage appear signed in but cannot load or save their data. Not every private-browsing mode blocks localStorage; the prerequisite is an actual storage failure.

**Fix/test:** Implement an authoritative in-memory session with optional persistent storage, or fail sign-in visibly if persistence is mandatory. Test reads and writes failing independently.

## Validation, scope and limits

- Reviewed the current React/Vite client session handling, Hono authentication and data routes, OAuth/MCP authorization and tools, AI execution/admission, database isolation/migrations, and Caddy/build configuration. No Hono-specific reference was available in the security skill; backend findings are grounded in source and local execution.
- Applied all **20 server migrations** to a fresh PostgreSQL 18 cluster bound to localhost. Used synthetic accounts only and stopped the cluster afterward. An occupied initial port was avoided without touching its existing service.
- Existing frontend tests: **24 passed**. Existing server tests against the disposable database: **98 passed, zero skipped**. Both TypeScript checks passed. Passing tests do not cover the new findings.
- Backend reproduction: three confirmed findings. Client-module reproduction: three confirmed findings using simulated storage/network, not a browser. Controlled barriers make the backend race interleavings deterministic; they are not public-network exploit success measurements.
- No production requests, live-user inspection, real password-reset emails, paid AI calls, destructive load testing, browser testing, cloud configuration inspection, or exhaustive dependency-source/Git-history audit. Legacy Supabase deployment configuration was not separately validated. No production build was rerun because application/build inputs were not modified.
- Deployment-dependent controls, including whether the edge overwrites `X-Real-IP`, were not retested. The prior report records that check; this review does not independently certify it. Process-local limits also require revisiting before adding replicas.
- Long-lived bearer tokens in browser storage remain a hardening concern if script execution is compromised; no XSS chain was established here. Server-side RLS and safe React text rendering are useful existing protections, not guarantees against every future endpoint or rendering change.

### Reproduction artifacts

- [Backend harness](/Users/mihirpatel/Downloads/OzempicAI/docs/security/review-2026-11-16/reproduce.mts) — from the repository root, run `TEST_DATABASE_URL=<disposable migrated database URL> node --import tsx docs/security/review-2026-11-16/reproduce.mts`. It creates synthetic rows and intentionally asserts current vulnerable behavior. Never point it at production.
- [Backend results](/Users/mihirpatel/Downloads/OzempicAI/docs/security/review-2026-11-16/reproduction-results.log).
- [Client harness](/Users/mihirpatel/Downloads/OzempicAI/docs/security/review-2026-11-16/reproduce-client.mjs) — run `node docs/security/review-2026-11-16/reproduce-client.mjs` from the repository root; no database needed.
- [Web dependency audit](/Users/mihirpatel/Downloads/OzempicAI/docs/security/review-2026-11-16/npm-audit-web.json) and [server dependency audit](/Users/mihirpatel/Downloads/OzempicAI/docs/security/review-2026-11-16/npm-audit-server.json).

**Recommended order:** close the recovery and AI admission races; address account synchronization and incomplete undo; implement verified onboarding before opening registration; update the development toolchain and fix the remaining session bugs. Recheck the corrected behavior and actual deployed configuration before treating the app as ready for multiple users.
