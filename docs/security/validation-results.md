# Security validation results

2026-11-15; commit `92f956dbd8eb9dbb0668f7727b3372e850f19d02`.

All tests used synthetic data in a fresh loopback-only PostgreSQL 18 cluster with all 16 server migrations. No live service, real health records, model requests or email delivery were used.

- Existing frontend suite: 24 passed.
- Existing server suite with `TEST_DATABASE_URL`: 54 passed, zero skipped.
- Focused reproduction harness: 11 passed (asserting vulnerable behavior, not remediation).
- Server npm audit: zero reported advisories.
- Root npm audit: see dependency inventory and raw JSON.

```text
REPRODUCED: SEC-01: reset revokes web session but access token, refresh token and pending authorization code survive
REPRODUCED: SEC-04: scope=read refresh returns an access token with write scope
REPRODUCED: SEC-10: another registered client with a used code revokes its grant without valid PKCE
REPRODUCED: SEC-02: rotating X-Real-IP bypasses the 20-attempt signup rate limit
REPRODUCED: SEC-05: 60 invalid unauthenticated requests block a valid public-client token exchange
REPRODUCED: SEC-06: foreign meal/workout IDs accepted, nonexistent IDs rejected; direct row reads remain isolated
REPRODUCED: SEC-08: different Unicode password suffix authenticates because bcrypt truncates at 72 bytes
REPRODUCED: SEC-07: bearer session alone changes password without old password or fresh verification
REPRODUCED: SEC-03: ordinary REST write persists a 200 KB item name without field limit
REPRODUCED: SEC-11: ten bad logins block the correct password from a different IP
Email validation timings: [{"emailBytes":10004,"milliseconds":41},{"emailBytes":30004,"milliseconds":343},{"emailBytes":60004,"milliseconds":1366}]
REPRODUCED: SEC-12: bounded malicious email inputs exercise superlinear synchronous validation on signup
11 focused reproductions passed. All data is synthetic.
```

Timings are local observations, not a production benchmark. Full load/DoS testing was intentionally not performed. Run instructions and safety guard are in `reproduce.mts`. The harness adds synthetic rows to its disposable database; it is outside the normal app test suite.

## Second pass

2026-11-15; commit `1d18a64`. Same conditions: synthetic data in a fresh loopback-only PostgreSQL 18 cluster with all 16 migrations, email provider stubbed, no model requests. The cluster was deleted afterwards.

- Additional reproduction harness: 8 passed (asserting vulnerable behavior, not remediation), plus 3 control checks that held.
- Git history secret search across 406 commits on all branches: placeholders and local Docker defaults only.

```text
Health check latency: 0 ms idle, 20 ms while 6 batched MCP requests (600 tool calls) were in flight
REPRODUCED: SEC-16: 2 MCP requests ran 200 tool calls (limit is 120 requests/15 min); 8 requests ran 800 without a 429
CONTROL HELD: batched MCP writes are still capped at 40 per 15 minutes
CONTROL HELD: Alice's MCP connection cannot read or edit Bob's workout plan by id
Limiter memory: 120 requests with 200 KB emails left 24.2 MB retained after GC (202 KB per request)
REPRODUCED: SEC-17: oversized emails become long-lived rate-limit keys; retained heap grows by roughly the email size per request
List amplification: 8 stored rows returned 2.0 MB in one response; at the 2,000-row limit that is about 500 MB per GET
Same rows through the MCP get_grocery_list tool: 2.0 MB (tool returns up to 300 rows)
REPRODUCED: SEC-18: a few stored rows produce multi-megabyte responses; the row limits allow hundreds of megabytes per request
Reset with an invalid token: 0 ms when the password is too short, 65 ms when it is valid (bcrypt runs before the token is checked)
Password change: 25 of 25 back-to-back requests accepted, 66 ms of hashing each
REPRODUCED: SEC-19: bogus reset tokens still cost a bcrypt hash; password change accepts unlimited requests
Database messages returned: ["new row for relation \"calorie_logs\" violates check constraint \"calorie_logs_calories_positive\"","invalid input syntax for type uuid: \"not-a-uuid\"","insert or update on table \"grocery_items\" violates foreign key constraint \"grocery_items_meal_plan_id_fkey\""]
REPRODUCED: SEC-20: constraint, table and type names from PostgreSQL are returned verbatim in API errors
Recovery timing with a 300 ms simulated email provider: 302 ms for a registered address, 2 ms for an unknown one
REPRODUCED: SEC-21: recovery returns 500 (provider outage) or responds late (normal) only for registered emails
Redirect schemes accepted at registration: ["tel:+15555550100","sms:+15555550100","shortcuts://run-shortcut?name=audit","ms-settings:privacy"]
CONTROL HELD: a javascript: redirect URI is rejected at registration
REPRODUCED: SEC-22: the consent screen Deny button receives an attacker-registered tel: URL to navigate to
REPRODUCED: SEC-23: 150 token requests from one address were all processed (one database lookup each, never 429); request logs include full query strings
8 additional reproductions passed. All data is synthetic.
```

Timings and memory figures are local observations from small, bounded runs. The health-check latency under batched MCP load varied between runs (20 ms and 91 ms). No test was run to memory exhaustion or sustained load. Run instructions and the safety guard are in `reproduce-additional.mts`.

## After remediation

2026-11-15; commit `e250cf3`. Fresh loopback-only PostgreSQL 18 cluster with all 19 migrations; synthetic data; email provider stubbed; no model requests.

- Server suite with `TEST_DATABASE_URL`: 81 passed, zero skipped. This includes 21 regression tests in `server/src/security.test.ts`, each named after the finding it covers, and unit tests for email validation, client address handling, rate-limit keys, sign-up mode and database TLS settings.
- Frontend suite: 24 passed. Typecheck and production build pass.
- Root `npm audit`: 8 advisories (1 high, 5 moderate, 2 low), down from 20; all in the Vite dev and build chain. Server `npm audit`: zero.
- Production check for SEC-02: 21 invalid sign-up requests with one forged `X-Real-IP` value ended in 429, and requests with different forged values then also returned 429. The edge replaces the header, so the limit follows the real address.
- Caddyfile validated with `caddy validate` in the `caddy:2-alpine` image. The built bundle contains no inline scripts and no `eval`, which is what the content security policy requires. Not loaded in a browser.

The two reproduction harnesses asserted the vulnerable behaviour and were removed; they remain in git history. Run the replacement with `cd server && TEST_DATABASE_URL=postgres://… npm test`.
