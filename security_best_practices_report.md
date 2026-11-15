# OzempicAI application and MCP security review

## Executive summary

Reviewed 2026-11-15 at commit `92f956dbd8eb9dbb0668f7727b3372e850f19d02`. The owner confirmed they are currently the only user. **The most urgent reproduced issues are incomplete account recovery, bypassable IP rate limits, and unauthenticated event-loop denial of service in email validation.** Before adding users, also address resource/cost controls, OAuth scope reduction, consent-page framing, and cross-user foreign-key references.

The first pass records 15 findings with distinct prerequisites and confidence levels; the second pass brings the total to 23. Eleven focused local reproductions passed in the first pass and eight more in the second. No unauthenticated arbitrary health-record read, SQL injection, remote code execution, or general RLS bypass was demonstrated. This is not a guarantee that these classes are absent. There are useful existing controls: parameterized queries, transaction-local user roles, RLS, hashed opaque credentials, mandatory S256 PKCE, refresh rotation, and MCP scope checks.

**Second pass (2026-11-15, commit `1d18a64`).** A follow-up review looked specifically for backdoors, data-theft paths and ways to take the service down. It adds eight findings, SEC-16 to SEC-23, all reproduced locally. **The most serious new issues are two ways to exhaust the API process's memory: oversized emails kept as rate-limit keys (SEC-17, unauthenticated) and list endpoints that return up to 2,000 unbounded rows (SEC-18, any signed-up account).** No backdoor, hidden account, debug route, committed secret, or cross-user read of health records was found; see "Second review pass" below for what was checked.

## Remediation status

Updated 2026-11-15 at commit `e250cf3`. All 23 findings have a code change on this branch, one commit each, and server/src/security.test.ts holds a regression test for each fix. Server tests: 81 passed. Web tests: 24 passed. Typecheck and production build pass. **Nothing is deployed yet, and six findings are only partly closed; those are marked "Partly" below.** The sections further down describe the system as it was before these changes.

| ID | Status | What changed | Commit |
| --- | --- | --- | --- |
| SEC-01 | Fixed | Password reset and password change revoke every connected app, its tokens and unused codes in the same transaction. Issuing a code re-checks the session under a row lock. | `873466f`, `189ffef` |
| SEC-02 | Fixed | Tested on production: Railway overwrites `X-Real-IP`, so the bypass never worked there. The API now accepts only a well-formed IP from that header, ignores `X-Forwarded-For`, and groups IPv6 by /64. | `7e36583` |
| SEC-03 | Partly | Sign-ups are closed by default in production (`SIGNUP_MODE`). Fields are size-checked, the coach has global and per-user caps, and each account is limited to 600 changes per 15 minutes. Email verification is not built. | `a7ede9d`, `f4d3c26`, `e769df4`, `e250cf3` |
| SEC-04 | Fixed | Access tokens store their own scopes; a narrowed refresh cannot write. | `7221788` |
| SEC-05 | Fixed | Only requests with a valid code or refresh token count against a public client. A per-address limit runs first. | `acab4cb` |
| SEC-06 | Fixed | A database trigger rejects links to another user's plan, with the same error as a missing one. | `8472d0a` |
| SEC-07 | Fixed | Changing the password requires the current one; the Profile form asks for it. | `cd4fccd` |
| SEC-08 | Fixed | Passwords are limited to 72 bytes. | `44cfebe` |
| SEC-09 | Partly | Caddy sends `frame-ancestors 'none'`, `X-Frame-Options`, HSTS, nosniff, a referrer policy and a content security policy. Consent defaults to read-only. The policy was validated by Caddy and against the build output but not loaded in a browser. | `59cf376` |
| SEC-10 | Fixed | Client and PKCE are verified before a replayed code revokes anything. | `4a9b9ef` |
| SEC-11 | Partly | Only failures count; ten from one address lock out that address, and the account-wide lock needs 40. Several addresses working together can still lock an account for 15 minutes. | `010e982`, `e871071`, `52d08fc` |
| SEC-12 | Fixed | Emails are capped at 254 characters and checked without a regex. | `abe6dcd` |
| SEC-13 | Fixed | `DATABASE_SSL=true` now verifies the certificate; `no-verify` must be chosen explicitly. | `b38a291` |
| SEC-14 | Partly | Advisories fell from 20 to 8. React Router is on 7. The rest need Vite 8, whose install fails on a peer-dependency conflict; they affect the dev server and build only, and the dev server now binds to localhost. | `ed4e748`, `795aff7` |
| SEC-15 | Partly | Unknown emails cost the same login time as known ones. The sign-up form still says when an email is taken, which matters only while sign-ups are open. | `010e982`, `a7ede9d` |
| SEC-16 | Fixed | MCP rejects JSON-RPC batches. | `2599c96` |
| SEC-17 | Fixed | Limiter keys are hashed when long, each limiter has a key budget, and auth bodies are capped at 8 KB. | `82dea03`, `0b918df` |
| SEC-18 | Fixed | Every stored field has a type and size check in the API and a length ceiling in the database. | `f4d3c26` |
| SEC-19 | Partly | Reset tokens are checked before hashing, password changes are limited to five an hour, and two hashes run at once at most. Hashing still runs on the request thread. | `87e7310` |
| SEC-20 | Fixed | Database errors map to fixed messages; details are logged server-side. | `7650c79` |
| SEC-21 | Fixed | Recovery answers 204 immediately and sends the email in the background with a timeout. | `58a8492` |
| SEC-22 | Fixed | Device-action schemes are refused at registration, and Cancel never navigates to a non-web address. | `0de7af6` |
| SEC-23 | Fixed | Pool, statement and idle-transaction timeouts; 503 on overload; a per-address request ceiling; a cached health check; a limit on bad MCP tokens. | `9ab08bc` |

Hardening items also done: request logs without query strings and without row data, `Cache-Control: no-store` on API responses (`9693061`); sessions end 90 days after sign-in (`aa8f4b8`); cached data is cleared when the signed-in user changes (`eac979f`); oversized bodies return 413 (`6dc4503`).

**Before deploying:**

- **Sign-ups will be closed.** With `SIGNUP_MODE` unset, production refuses new accounts. Set `SIGNUP_MODE=open` on the `api` service only when you are ready to onboard people.
- **Check `DATABASE_SSL`.** If the `api` service has `DATABASE_SSL=true`, it will now verify the database certificate and fail to connect if the certificate is self-signed. The README's Railway setup does not set it.
- **Open the site in a browser.** The content security policy and the React Router 7 upgrade passed build and tests but were not exercised in a browser. Check sign-in, each tracker, the coach, Analytics and the consent screen.
- **Three migrations run on deploy:** `00016` (token scopes), `00017` (length ceilings, not applied to existing rows) and `00018` (ownership trigger).
- **Behaviour changes users will see:** changing or resetting a password disconnects connected AI apps; changing a password needs the current one; the consent screen starts on "Read only".

**Still open:**

- Email verification at sign-up, which is what fully closes SEC-03 and SEC-15.
- Rate-limit state in shared storage. It still lives in the API process and resets on restart.
- Password hashing off the request thread (SEC-19) and a trusted-device or challenge step for login (SEC-11).
- The Vite 8 upgrade (SEC-14).
- From the hardening list: self-hosted fonts, pinned image digests, an unprivileged Caddy container, CI with tests and audits, multi-factor sign-in, account export and deletion, confirmation before destructive AI actions, and a full access audit trail.

## Scope, method, and limits

- Reviewed the React/Vite PWA, Hono API, all runtime route families, authentication, MCP transport/tools, OAuth registration/consent/token lifecycle, AI tool execution, PostgreSQL migrations, deployment configuration, and dependency lockfiles. Legacy Supabase configuration was assessed separately from the documented current deployment.
- Used a fresh local PostgreSQL 18 database with all 16 server migrations and synthetic users. Existing tests passed: 24 frontend and 54 server tests, including database-backed OAuth/MCP tests, with no skips. Additional reproductions assert vulnerable behavior; they are not tests claiming the vulnerabilities have been fixed.
- No production requests, real-user data inspection, actual email sending, paid model calls, high-volume load tests, browser exploit trials, cloud-console inspection, container scanning, or exhaustive Git-history secret scanning were performed. No application code or deployment settings were changed.
- Baseline deployment comes from README.md:33 and Caddyfile:9: public web service proxies the otherwise private API. Private API networking does **not** make its proxied `/api/*` routes private. MCP-specific findings apply when `MCP_ENABLED=true`. No additional gateway controls were supplied or verified.
- The owner being the only current user reduces the present cross-user population, but signup remains public in code. An internet attacker can create their own account unless an external access restriction exists.
- Local evidence and commands: docs/security/validation-results.md. The reproduction harness (docs/security/reproduce.mts) was removed once the fixes landed and is in git history; server/src/security.test.ts replaces it. Registry evidence: docs/security/dependency-findings.md, docs/security/npm-audit-web.json, and docs/security/npm-audit-server.json. (The threat-model file this line originally cited, OzempicAI-threat-model.md, is not in the repository.)

Severity reflects practical confidentiality, integrity, availability, and cost impact. **Reproduced** means an isolated local test exercised the behavior. **Source-confirmed** means the code/configuration establishes the gap. **Conditional** means deployment/browser/attacker prerequisites still need validation. No finding is rated critical without evidence of the corresponding impact.

## High-priority findings

### SEC-01 — Password recovery leaves attacker-controlled MCP access active

**Severity:** High. **Confidence:** Reproduced. **Classes:** CWE-613, CWE-287.

**Evidence:** server/src/auth.ts:239 resets the password and deletes `auth.sessions`, but does not invalidate OAuth grants, tokens, or pending authorization codes. The ordinary password-change route at server/src/auth.ts:196 has the same OAuth omission. server/src/oauth/tokens.ts:139 accepts still-live refresh grants and extends them; server/src/oauth/tokens.ts:205 verifies MCP access independently of password changes. Signup at server/src/auth.ts:142 grants a session without verifying mailbox ownership.

**Attack and impact:** An attacker who obtains a web session can authorize their own MCP client. The victim resets the password, which terminates the stolen web session, yet the attacker's MCP client can continue reading health information and editing supported plans. Refreshes can keep access alive beyond the initial 60-day lifetime. A pending authorization code can also be redeemed after recovery. For a future user, an attacker can pre-register the victim's email and establish an OAuth grant before the victim recovers the account: mailbox control is never required for the initial signup. This pre-registration variant does not overwrite an already-existing account.

**Reproduction:** The harness created a grant and pending code, then redeemed a synthetic reset token. The old web session returned 401, but the old OAuth access token verified, refreshing succeeded, and the pending code exchanged successfully. This proves persistence, not a method of stealing an existing session.

**Fix:** Make recovery revoke all user OAuth grants/tokens and outstanding authorization codes in the same transaction as the password reset. Serialize recovery and token issuance using a per-user lock or credential-generation counter so concurrent exchanges cannot escape revocation. Offer a clear security recovery action for password changes and invalidate existing reset tokens on password change. Require verified email or invitations before granting new accounts usable API/AI/OAuth access. Explain any deliberate exception for retained integrations explicitly.

**Verification/detection:** Assert that all pre-recovery access, refresh, and code credentials fail after recovery, including concurrent issuance. Log and alert on new connected apps and recovery events without logging credentials. Test pre-registration followed by legitimate email recovery.

### SEC-02 — Caller-controlled proxy headers bypass IP throttles

**Severity:** High when the documented proxy path forwards attacker-supplied `X-Real-IP`. **Confidence:** Reproduced at the API; edge behavior conditional. **Class:** CWE-807.

**Evidence:** server/src/auth.ts:92 trusts `x-real-ip` first, then the first `x-forwarded-for` value. It does not check the socket peer, parse an IP, or restrict trusted proxies. Caddyfile:28 forwards API requests without an explicit rule removing/replacing `X-Real-IP`. server/src/oauth/routes.ts:36 itself acknowledges that these proxy headers can be forged. The in-memory bucket map at server/src/auth.ts:67 also has no cardinality cap.

**Attack and impact:** Changing `X-Real-IP` gives an attacker fresh signup/reset/recovery buckets. This permits account creation, bcrypt work and broad email spam beyond the intended per-IP cap, and creates many limiter entries. Per-email login and recovery limits still apply; this is **not** unlimited guessing against one email address. The global OAuth registration cap also still applies, but an attacker can consume it to delay legitimate onboarding.

**Reproduction:** Twenty-one malformed signup requests with one header value ended in 429. Twenty-one otherwise identical requests with different values all reached validation and returned 400.

**Fix:** Establish one trusted proxy chain. Strip incoming identity headers at the public edge and derive a canonical IP from trusted connection metadata. Do not blindly replace it with Caddy's peer address if that peer is a shared Railway proxy. Use bounded shared rate-limit storage and independent global resource budgets. Validate this through the actual public route before rollout.

**Verification/detection:** Repeat the bounded test through staging with forged header values and require a shared limit. Track unique buckets, registration rates, and rejected expensive requests.

### SEC-03 — Public signup opens unmetered storage and insufficiently bounded AI spending

**Severity:** High if public signup and the paid coach are enabled; Medium for storage/availability alone. **Confidence:** Source-confirmed controls gap; oversized persisted input reproduced. **Classes:** CWE-400, CWE-770.

**Evidence:** server/src/auth.ts:142 immediately enables accounts without verification or an invitation. server/src/routes/resources.ts:144 inserts allowed fields without field-length validation or per-user write quotas; the schema uses unrestricted `text` at server/migrations/00001_init_schema.sql:22. Only a per-request 256 KiB limit exists at server/src/app.ts:35. server/src/routes/ai.ts:63 limits turns per user, while its concurrency guard at line 27 is per conversation. server/src/ai/client.ts:8 defaults to 40 turns/hour/user and server/src/ai/loop.ts:15 allows up to eight model requests per turn with a 16,000 output-token ceiling per call. server/src/ai/store.ts:57 loads complete conversation history without pagination or an overall history budget.

**Attack and impact:** An attacker can create accounts, repeatedly store large rows, and use fresh accounts/conversations to multiply paid-model work and concurrency. Large persisted tool results can also consume model context and make a user's coach unusable. Existing MCP item/date caps do not protect the REST writes that feed the same tables. Long-term history growth compounds memory/input-token costs. A database pool size bounds active connections but not all queued demand or persisted data.

**Reproduction:** An authenticated REST request stored and returned a 200,000-character grocery name. No expensive model request or resource-exhaustion load test was run; full denial of service and monetary impact are not claimed as measured.

**Fix:** While this is a personal app, disable public signup or require invitations. Add shared request/row/byte quotas, consistent REST and MCP field limits, per-user and global concurrent-turn limits, model token/spend budgets, a bounded history strategy, and a global cost circuit breaker. Use query and upstream deadlines appropriate to the operation. Preserve smaller, explicit limits for health-data fields.

**Verification/detection:** Test a small quota boundary with synthetic accounts and a mocked model. Observe retained bytes, queue depth, active turns, token usage and spend; alert before capacity or budget exhaustion.

### SEC-09 — OAuth consent can be framed without an application anti-clickjacking policy

**Severity:** High if the deployed page is frameable and can access the signed-in session in that context. **Confidence:** Source-confirmed missing policy; browser exploit conditional and not exercised. **Class:** CWE-1021.

**Evidence:** Caddyfile:9 sets caching/compression/proxy behavior but no `Content-Security-Policy: frame-ancestors` or `X-Frame-Options`. No equivalent protection appears in index.html or server/src/app.ts. src/auth/AuthorizeAppScreen.tsx:36 defaults to edit access and presents an Allow action. Dynamic registration at server/src/oauth/routes.ts:34 permits an attacker to obtain a real client ID and use their own callback.

**Attack and impact:** An attacker frames their valid consent request inside deceptive UI and induces a click on Allow. If the iframe has access to the user's app session and can complete navigation, the attacker's callback receives a code which the attacker can redeem with their own PKCE verifier. This can grant health-data access without the user understanding the consent. PKCE does not stop deceptive consent. Browser storage partitioning, blocked iframe storage, navigation restrictions, or an edge-injected framing policy may prevent this; none was tested here.

**Fix:** Serve `Content-Security-Policy: frame-ancestors 'none'` on app documents, especially consent and authentication pages; add `X-Frame-Options: DENY` for compatibility. Keep this in response headers, not a meta tag. Default consent to read-only and clearly identify unverified client names; those are additional precautions, not substitutes for frame protection.

**Verification/detection:** Inspect effective staging headers and test cross-site and same-site cross-origin frames in supported browsers with a synthetic account. Require framing to be rejected before any interactive consent flow.

### SEC-12 — Email validation allows unauthenticated regular-expression denial of service

**Severity:** High. **Confidence:** Reproduced, bounded local timing test. **Class:** CWE-1333.

**Evidence:** server/src/auth.ts:22 uses `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`; server/src/auth.ts:46 runs it synchronously without an email-length limit. The two domain character classes both accept dots, allowing repeated backtracking on a long invalid domain. Signup, login and recovery call this helper. The overall body limit at server/src/app.ts:35 is much larger than a reasonable email address.

**Attack and impact:** An unauthenticated caller sends a JSON email constructed as `'a@' + 'a.'.repeat(n) + '\n!'`. The embedded newline and trailing character survive trim and force expensive failure. Node's event loop is blocked during validation, delaying unrelated authentication, MCP and health-data requests. A single request passes the initial limiter; SEC-02 makes repeated requests easier.

**Reproduction:** Actual in-process signup requests with 10,004, 30,004 and 60,004 email bytes took approximately 41 ms, 343 ms and 1,366 ms respectively, returning 400. All fit under the body limit. These are local observations; a full-size or sustained attack was not performed.

**Fix:** Reject oversized email strings before regex evaluation, using an explicit byte/character policy appropriate for supported email addresses (commonly 254 bytes). Replace ambiguous unbounded validation with a bounded parser or simple bounded checks. Keep request-size limits and rate limiting as separate controls.

**Verification/detection:** Add a regression test requiring oversized input to be rejected before expensive validation; assess bounded adversarial strings in a separate process with a deadline. Monitor event-loop lag and authentication latency.

## Medium-priority findings

### SEC-04 — OAuth refresh ignores requested scope reduction

**Severity:** Medium. **Confidence:** Reproduced. **Class:** CWE-269.

**Evidence:** server/src/oauth/tokens.ts:177 validates that requested scopes are a subset of the grant, but line 188 passes the original `granted` array to `issueTokenPair`. Tokens have no independent scope field in server/migrations/00014_mcp_oauth.sql:55; server/src/oauth/tokens.ts:208 always derives effective scopes from the parent grant.

**Attack and impact:** A client refreshing a read/write connection with `scope=read` receives another read/write token. An access token intended for a less-trusted read-only component retains modification capability. This does not elevate a grant originally approved as read-only; initial consent restrictions and normal MCP scope checks still work. The response explicitly reports `read write`, so a defensive client can detect the failure.

**Reproduction:** Refresh with `scope=read` returned `scope: "read write"`; `verifyAccessToken` still included `write`.

**Fix:** Persist and enforce scopes per access token. Issue an access token with the requested subset and intersect it with any current grant restrictions. Preserve or explicitly define refresh-token scope semantics; do not accidentally narrow or expand unrelated access tokens. Reject unsupported narrowing rather than silently ignoring it.

**Verification:** A narrowed token must fail every write tool while the intended read tools continue working. Retain the existing test that rejects scope expansion.

### SEC-05 — Public-client token throttle can be exhausted by anyone knowing its ID

**Severity:** Medium. **Confidence:** Reproduced. **Class:** CWE-307/CWE-770.

**Evidence:** server/src/oauth/clients.ts:81 correctly treats a `none` client as public, but server/src/oauth/routes.ts:126 then increments the single `oauth-token:client:<client_id>` bucket before checking the authorization code or refresh token.

**Attack and impact:** Sixty invalid token requests consume the public client's 15-minute quota. Real code exchanges and refreshes for that registration then return 429. Client IDs are identifiers, not secrets. The blast radius depends on whether a registration is shared by many users; it may be just one installation. Confidential clients require the secret and are not anonymously affected by this exact path.

**Reproduction:** After 60 invalid code requests for a synthetic public client, an otherwise valid code exchange returned 429.

**Fix:** Apply trusted-source failure limits before credential validation and use grant/user-level limits after validating credentials. Preserve a global abuse cap without making a public client ID the sole shared failure bucket. Avoid exposing whether arbitrary secret tokens exist.

**Verification/detection:** Invalid requests from one source must not exhaust another user's valid refresh allowance. Alert on client-wide failures and valid exchanges rejected by throttling.

### SEC-06 — Foreign-key references do not enforce ownership of the parent row

**Severity:** Medium; limited information disclosure/integrity issue, not full record access. **Confidence:** Reproduced. **Class:** CWE-863.

**Evidence:** server/src/routes/resources.ts:95 accepts `meal_plan_id`; server/src/routes/workouts.ts:174 accepts `plan_id`. Their foreign keys reference only parent IDs at server/migrations/00001_init_schema.sql:81 and server/migrations/00007_workouts.sql:69. RLS checks the new row's `user_id`, not ownership of its referenced parent. PostgreSQL referential-integrity checks are not an ownership authorization mechanism.

**Attack and impact:** Given another user's plan UUID, an attacker can associate their own grocery/session row with it. A real UUID succeeds while a nonexistent one produces a foreign-key failure, providing an existence oracle. Deleting the victim's plan later nulls the attacker's reference, revealing that lifecycle event. The attacker cannot read the plan contents through the reviewed endpoints, and random UUID guessing is impractical; obtaining a candidate UUID is a prerequisite.

**Reproduction:** Bob successfully created a grocery item referencing Alice's meal and a workout session referencing Alice's workout. A nonexistent meal ID returned 400. Bob's direct meal listing still returned no Alice rows.

**Fix:** Validate referenced parents under the caller's identity and enforce tenant consistency with composite foreign keys such as `(meal_plan_id, user_id)` to `(id, user_id)`. Preserve intended delete behavior: for nullable relationships, null only the parent ID, not the required user ID. Apply equivalent parent/child constraints to workout exercises as defense in depth, although their exposed creation routes currently choose the parent server-side.

**Verification/detection:** Two-user tests must reject foreign references and preserve same-user links and deletion behavior. Check existing data for mismatched parent/child owners before applying constraints.

### SEC-07 — A long-lived session is sufficient to replace the account password

**Severity:** Medium, conditional on obtaining an existing valid session. **Confidence:** Reproduced. **Class:** CWE-620.

**Evidence:** server/src/auth.ts:196 requires only `requireUser` plus the new password. It neither verifies the current password nor demands recent authentication. The current token is retained while other sessions are deleted. server/src/auth.ts:124 slides session expiry; src/lib/api.ts:50 stores the bearer in script-readable localStorage.

**Attack and impact:** A stolen bearer token or access to an unattended authenticated browser can become a password change and termination of the victim's other sessions, without knowledge of their password. An initial session-theft primitive was not found; this finding concerns the escalation available after such theft. The victim can still recover through their mailbox, subject to SEC-01.

**Reproduction:** Bob's session changed the password with only `{password: ...}` and received 204.

**Fix:** Require the current password or a short-lived, action-bound fresh-authentication proof. Rotate the current session after the change, invalidate outstanding recovery tokens, and send a security notification. Implement the recovery path separately rather than allowing a normal bearer to substitute for recovery proof.

**Verification:** A stale session alone must fail; a recently verified proof must work only for the intended account/action and expire promptly.

### SEC-11 — Anonymous failures lock out a known user's legitimate login

**Severity:** Medium. **Confidence:** Reproduced. **Class:** CWE-645.

**Evidence:** server/src/auth.ts:169 increments a fixed-window bucket keyed only by email before checking credentials. Ten unsuccessful attempts cause later requests to fail before the correct password is considered.

**Attack and impact:** An attacker who knows an email can repeatedly prevent new logins for 15-minute windows from unrelated networks. Existing sessions are not invalidated. Per-IP limits can restrict sustained attacks if corrected, but do not prevent the initial ten-attempt lockout.

**Reproduction:** Ten bad logins were followed by a correct-password login from a different synthetic IP; the correct request returned 429.

**Fix:** Combine account risk signals with source-based throttling, progressive delays and challenges without letting anonymous failures deterministically deny every legitimate login. Provide a protected recovery/verified-device path. Do not simply remove account-level password-guessing protection.

**Verification/detection:** Test both distributed guessing resistance and the ability of a legitimate verified user to regain access. Alert on concentrated failures against one account.

### SEC-13 — Enabling database TLS explicitly disables certificate verification

**Severity:** Medium, conditional on using `DATABASE_SSL=true` over a network an attacker can intercept. **Confidence:** Source-confirmed. **Class:** CWE-295.

**Evidence:** server/src/db.ts:17 sets `ssl: { rejectUnauthorized: false }`. No trusted CA configuration or peer identity requirement accompanies that option.

**Attack and impact:** A network-positioned attacker can present an untrusted certificate and intercept or alter database traffic, potentially exposing credentials and health records. This is not remotely exploitable merely by sending API requests. The current Railway connection's SSL configuration and network guarantees were not inspected; URL SSL parameters can also affect effective driver settings.

**Fix:** Require verified certificates and the correct database hostname, supplying a provider CA when necessary. Keep explicitly documented loopback/private development exceptions separate. Validate effective SSL behavior with the actual connection-string options.

**Verification:** Staging must reject an untrusted or wrong-hostname database certificate and accept the expected CA/hostname. Never disable verification to make the test pass.

### SEC-14 — Locked frontend/build dependency tree contains published advisories

**Severity:** Medium for this app's established exposure; individual registry severities vary. **Confidence:** Registry-confirmed vulnerable-version matches; application exploitability not established. **Class:** CWE-1395.

**Evidence:** The saved root `npm audit --json` reported 20 affected package entries. Examples: `vite@5.4.21` at package-lock.json:6653, `esbuild@0.21.5` at package-lock.json:3705, and `react-router-dom@6.30.3` at package-lock.json:5163. Vite binds all interfaces in development at vite.config.ts:49. The server audit reported zero known advisories.

**Attack and impact:** Developer-server exposure can make relevant Vite file-disclosure and esbuild cross-origin-read advisories significant. Build-input advisories require their specific malicious input paths. Router advisories require the affected navigation/data-router behavior; the current BrowserRouter usage did not establish a matching exploit. Production serves built assets with Caddy, so a Vite dev-server vulnerability is not automatically a production server vulnerability.

**Inventory:** docs/security/dependency-findings.md records each affected package, locked versions, individual advisory titles/links/ranges, and transitive relationships. It is part of this report, not a claim that all entries are independent exploitable flaws. Raw responses are retained for reproducibility.

**Fix:** Upgrade direct dependencies and regenerate transitive locks to supported, non-vulnerable versions; validate routing, PWA generation, and builds. Restrict dev-server binding to loopback unless deliberately needed. Evaluate major upgrades rather than applying `npm audit fix --force` indiscriminately.

**Verification:** Re-audit both projects, run tests/builds, and document any remaining advisory with a concrete reachability assessment. Container image and OS packages need a separate scan.

## Lower-priority findings

### SEC-08 — Unicode passwords can be silently truncated by bcrypt

**Severity:** Low. **Confidence:** Reproduced. **Class:** CWE-187.

**Evidence:** server/src/auth.ts:57 checks JavaScript string length against 72 while its comment correctly notes bcrypt's **byte** limit. UTF-8 characters can occupy more than one byte. Login at line 170 does not enforce a corresponding byte policy.

**Attack and impact:** Passwords with the same first 72 UTF-8 bytes authenticate even if their suffix differs. This silently removes part of a user's chosen secret. Exploitation still requires matching that 72-byte prefix; it is not a general password bypass, which is why the severity is low.

**Reproduction:** Registered with `'é'.repeat(36) + 'secret-suffix'`; logging in with `'é'.repeat(36) + 'wrong-suffix'` succeeded.

**Fix:** Prefer a versioned migration to a modern password hash without this truncation behavior, or enforce `Buffer.byteLength(password, 'utf8') <= 72` for new/changed bcrypt passwords with clear UI messaging. Avoid casually pre-hashing existing passwords and breaking imported accounts. Plan recovery for already-truncated credentials.

**Verification:** Cover multibyte boundary cases and imported bcrypt hashes, and ensure changed suffixes never silently compare equal under the new policy.

### SEC-10 — Replaying a used code revokes a grant before authenticating its binding

**Severity:** Low because the attacker must possess a valid, already-used code. **Confidence:** Reproduced. **Class:** CWE-863.

**Evidence:** server/src/oauth/tokens.ts:107 revokes `code.grant_id` for a used code before checking the client ID at line 112 or the PKCE verifier at line 117.

**Attack and impact:** Someone with a copied used callback code can register an unrelated public client and disconnect the original grant without knowing its verifier or original confidential-client secret. This is connection denial of service, not token issuance or record disclosure. Random guessing of the high-entropy code is not realistic. Code-reuse revocation is a legitimate security measure; the problem is letting an unrelated, unproven caller trigger it.

**Reproduction:** A different public client submitted the used code with an invalid verifier. Exchange failed, but the existing grant's access token stopped verifying.

**Fix:** Validate client and proof-of-possession bindings before applying destructive replay handling. Preserve replay detection for a correctly bound replay and avoid revealing whether arbitrary code strings exist.

**Verification:** A wrong-client/wrong-verifier replay must not revoke the grant; a correctly bound replay should follow the defined theft-response policy.

### SEC-15 — Signup reveals whether an email has an account

**Severity:** Low, with elevated privacy relevance for a health app. **Confidence:** Source-confirmed. **Class:** CWE-204.

**Evidence:** server/src/auth.ts:152 returns HTTP 409 with `An account with this email already exists.` for a registered address; successful signup returns 201 and a session. Login also skips bcrypt entirely for unknown users at server/src/auth.ts:180, creating a secondary timing distinction. Recovery's uniform 204 response does not conceal the explicit signup oracle.

**Attack and impact:** A caller can test a list of known email addresses for membership in this health-tracking service. This reveals account existence, not medical records or confirmed medication use. Testing nonexistent addresses also creates accounts, an additional reason to replace immediate unverified signup.

**Reproduction:** The relevant branches are explicit in source; no real email list was tested.

**Fix:** Use a verified-email/invitation onboarding flow with consistent public responses for existing and new addresses. Perform comparable password-check work for unknown users after bounding and rate-limiting inputs. Preserve useful recovery information in the email channel rather than exposing it anonymously.

**Verification:** Synthetic existing/nonexisting addresses should have equivalent public response semantics, and timing should not expose a practical repeatable distinction.

## Second review pass — additional findings (SEC-16 to SEC-23)

Added 2026-11-15 at commit `1d18a64`. Same method as the first pass: a fresh loopback-only PostgreSQL 18 database with all 16 migrations, synthetic users, no production requests, no email delivery and no model calls. Each test was bounded (small counts and sizes, then extrapolated) and none was run to the point of failure. The harness (docs/security/reproduce-additional.mts, now removed and in git history) produced the output in docs/security/validation-results.md. No application code was changed.

| ID | Finding | Severity | Who can exploit it |
| --- | --- | --- | --- |
| SEC-17 | Oversized emails become long-lived rate-limit keys | High with SEC-02, Medium alone | Anyone, no account |
| SEC-18 | List endpoints multiply unbounded rows into huge responses | High while signup is public | Any signed-up account |
| SEC-16 | MCP batches bypass the per-connection request limit | Medium | Any connected app |
| SEC-19 | Password hashing runs before cheap checks and without a throttle | Medium | Anyone (reset), any account (change) |
| SEC-23 | No throttle before authentication and no database timeouts | Medium | Anyone, no account |
| SEC-21 | Password recovery reveals which emails are registered | Low | Anyone, no account |
| SEC-22 | Consent screen buttons navigate to attacker-chosen URL schemes | Low | Anyone, needs a victim click |
| SEC-20 | Raw PostgreSQL error text is returned to clients | Low | Any signed-up account |

### SEC-17 — Oversized emails become long-lived rate-limit keys

**Severity:** High when chained with SEC-02 or sent from many addresses; Medium from a single address. **Confidence:** Reproduced, bounded memory measurement. **Classes:** CWE-770, CWE-400.

**Evidence:** server/src/auth.ts:46 accepts an email of any length up to the 256 KiB body limit. server/src/auth.ts:169 and server/src/auth.ts:219 then build the keys `login:email:<email>` and `recover:email:<email>` and store them in the in-memory `buckets` map at server/src/auth.ts:67. The sweep at server/src/auth.ts:87 removes a key only after its window ends: 15 minutes for login, 60 minutes for recovery. Nothing caps the key length or the number of keys.

**Attack and impact:** Each request with a new, well-formed, very long email pins roughly the size of that email in the API's heap for up to an hour. A well-formed long address passes the regex in linear time, so this is separate from SEC-12. About 5,000 requests of 200 KB each, roughly 1 GB of upload spread over an hour, retain about 1 GB and kill a typical Node process. The crash drops every in-flight request and coach turn, and because all throttles live in the same process it also resets every login, recovery and AI counter. The per-IP limit of 20 per action is the only brake, and SEC-02 removes it.

**Reproduction:** 120 login and recovery requests with 200 KB emails left 24.2 MB retained after a forced garbage collection, about 200 KB per request. The process was not driven to failure.

**Fix:** Reject emails longer than 254 characters before any other work (the same change fixes SEC-12). Key limiter buckets on a fixed-size value such as a hash, cap the number of buckets, and move limiter state to bounded shared storage. Lower the body limit on the auth routes to a few kilobytes.

**Verification/detection:** A regression test must show an oversized email rejected with no new bucket. Export bucket count and heap size as metrics and alert on growth.

### SEC-18 — List endpoints multiply unbounded rows into huge responses

**Severity:** High while signup is public; Medium once accounts are invitation-only. **Confidence:** Reproduced at small scale; the full-size request was not sent. **Classes:** CWE-770, CWE-789.

**Evidence:** server/src/routes/resources.ts:144 stores text fields of any size up to the body limit (SEC-03). The list handler at server/src/routes/resources.ts:108 runs `select *` with a caller-chosen limit of up to 2,000 rows for calorie, water, exercise and grocery rows (server/src/routes/resources.ts:41, 49, 67 and 99) and serializes the whole result in memory. server/src/ai/tools/groceries.ts:17 returns up to 300 grocery rows to the coach and to MCP clients with no per-field cap on rows written through REST, and server/src/ai/tools/groceries.ts:128 loads every unpurchased name with no limit on each add. server/src/ai/store.ts:57 loads a whole conversation the same way.

**Attack and impact:** An attacker signs up, stores 2,000 grocery rows of 250 KB each (about 500 MB, sent once), then requests `GET /api/grocery-items?limit=2000`. Every such request makes the API hold the database rows, the JavaScript strings and the JSON body at once, several times 500 MB. A handful of concurrent requests exhausts memory on a small container and restarts the service for all users; the stored rows make it repeatable at almost no cost. The same rows flow into the coach's prompt (cost and a wedged conversation) and into MCP responses. This is the concrete denial of service that SEC-03 left unmeasured. It does not expose other users' data.

**Reproduction:** Eight rows of 250 KB returned 2.0 MB from one `GET`, and 2.0 MB from the MCP `get_grocery_list` tool. Linear extrapolation gives about 500 MB per request at the 2,000-row limit.

**Fix:** Enforce field lengths in the REST handlers and as database `check` constraints (the MCP tools already use 80 to 200 characters). Lower the list limits, paginate, and select only the columns a screen needs. Add per-user row quotas and a response-size ceiling. Clean up any oversized rows before adding constraints.

**Verification/detection:** Test that an over-length field is rejected through REST, MCP and the coach, and that the largest possible list response stays under a set budget. Alert on response size and process memory.

### SEC-16 — MCP batches bypass the per-connection request limit

**Severity:** Medium. **Confidence:** Reproduced. **Class:** CWE-799.

**Evidence:** server/src/mcp/routes.ts:61 counts one unit per HTTP request against the limit of 120 per 15 minutes, then hands the body to the SDK transport at server/src/mcp/routes.ts:75. The transport accepts a JSON-RPC array of up to 100 messages (`MAX_BATCH_SIZE` in `@modelcontextprotocol/sdk` 1.32.2) and runs them concurrently. Each tool call opens its own transaction in server/src/mcp/server.ts:103.

**Attack and impact:** A connected app can run 12,000 read tool calls per window instead of 120, and 100 at once from a single request. Each call takes a connection from the pool of 10 (server/src/db.ts:16), so other users' requests queue behind them. Any account can connect its own client, so this needs no victim. It reads only the caller's own data; the write limit is unaffected.

**Reproduction:** Two requests ran 200 tool calls, and eight ran 800, with no 429. The health check slowed from under 1 ms to between 20 and 91 ms while 600 calls were in flight. A batch of 60 writes was correctly cut off at 40.

**Fix:** Count every JSON-RPC call against the limit, or reject batches (the current MCP specification no longer uses them). Cap concurrent tool calls per connection and per user.

**Verification:** A batch larger than the remaining allowance must be refused or partially refused, and single calls must keep working.

### SEC-19 — Password hashing runs before cheap checks and without a throttle

**Severity:** Medium. **Confidence:** Reproduced. **Class:** CWE-400.

**Evidence:** server/src/auth.ts:244 computes a bcrypt hash before the reset token is looked up at server/src/auth.ts:247. Signup hashes at server/src/auth.ts:149 before checking whether the email exists. The password-change route at server/src/auth.ts:196 has no rate limit at all. `bcryptjs` is pure JavaScript and runs on the API's only thread, at about 65 ms per hash at 10 rounds on the test machine.

**Attack and impact:** Around 15 requests a second keep the event loop busy and slow every other user. Without an account this needs the SEC-02 header rotation to pass the per-IP limit, using reset requests with a made-up token. With an account, the password-change route accepts any number of requests. Each accepted change also signs the user's other devices out.

**Reproduction:** A reset with an invalid token took 65 ms with a valid-length password and under 1 ms with a short one. Twenty-five back-to-back password changes were all accepted.

**Fix:** Validate the reset token before hashing. Rate-limit password changes per user and require the current password (SEC-07). Use a native or worker-thread password hash so hashing cannot block request handling, and cap concurrent hashes.

**Verification:** A bogus token must be rejected without measurable hashing time, and repeated password changes must hit a limit.

### SEC-23 — No throttle before authentication and no database timeouts

**Severity:** Medium as a missing safety net; it makes SEC-16 to SEC-19 worse. **Confidence:** Reproduced for the missing throttle; timeouts source-confirmed. **Class:** CWE-770.

**Evidence:** The token endpoint looks the client up in the database at server/src/oauth/routes.ts:125 before any limit applies, and the limit that follows is keyed on a valid client only. The same holds for `/api/oauth/revoke`, for any bearer sent to `/api/mcp` (server/src/mcp/routes.ts:58), for any bearer on a data route (server/src/auth.ts:112) and for `/api/health`, which queries the database for anyone (server/src/app.ts:37). The pool at server/src/db.ts:14 sets no `connectionTimeoutMillis`, `statement_timeout` or idle-transaction timeout, so waiting requests queue without limit and a slow query holds its connection until it finishes.

**Attack and impact:** An unauthenticated flood of cheap requests each takes a pool connection. With ten connections and an unbounded queue, legitimate requests wait instead of failing fast, and nothing sheds the load. This is a volume attack, so its effect depends on what the hosting edge already absorbs.

**Reproduction:** 150 token requests from one address with unknown client IDs were all processed and none returned 429.

**Fix:** Add a per-address limit ahead of every unauthenticated database lookup, once SEC-02 gives a trustworthy address. Set a pool connection timeout, a statement timeout and an idle-in-transaction timeout. Make the public health check static and keep the database check on a private path. Put edge rate limiting in front of the service.

**Verification:** Under a synthetic flood, authenticated requests should still succeed or fail quickly with 503, never hang.

### SEC-21 — Password recovery reveals which emails are registered

**Severity:** Low, with the same privacy weight as SEC-15: membership in this app suggests a health condition. **Confidence:** Reproduced with a stubbed email provider. **Classes:** CWE-204, CWE-208.

**Evidence:** server/src/auth.ts:233 awaits the email provider only when the account exists. server/src/email.ts:23 calls the provider with no timeout and no error handling, so a network failure becomes a 500. The route's comment at server/src/auth.ts:214 says the response never reveals who has an account.

**Attack and impact:** The response for a registered address arrives one provider round trip later than for an unknown one. During a provider outage the difference is a 500 against a 204. Unlike the signup oracle in SEC-15, probing this way creates no account, though it does send the target a reset email.

**Reproduction:** With a 300 ms simulated provider, a registered address took 302 ms and an unknown one 2 ms. With a failing provider, the registered address returned 500 and the unknown one 204.

**Fix:** Return 204 immediately and send the email in the background with a timeout and logged failures. Do the same token work for unknown addresses.

**Verification:** Response status and timing for registered and unknown addresses must be indistinguishable, including when the provider is down.

### SEC-22 — Consent screen buttons navigate to attacker-chosen URL schemes

**Severity:** Low. **Confidence:** Reproduced at the API; no device behavior was tested. **Class:** CWE-601.

**Evidence:** server/src/oauth/registration.ts:11 blocks a short list of schemes and server/src/oauth/registration.ts:31 allows every other one. server/src/oauth/routes.ts:97 returns the registered redirect for a declined request, and src/auth/AuthorizeAppScreen.tsx:61 navigates to it. The "Return to" button at src/auth/AuthorizeAppScreen.tsx:110 does the same for a malformed request.

**Attack and impact:** Anyone can register a client whose redirect is `tel:`, `sms:`, `shortcuts://` or another app-launching scheme, then send a signed-in user the consent link. Whichever button the user presses, including Deny, hands that URL to the browser, which may open the dialer, a shortcut or another app. An `https` redirect to a look-alike login page works the same way after Deny. No health data is exposed by this alone; the risk is phishing and unwanted app launches from a trusted screen.

**Reproduction:** Registration accepted `tel:`, `sms:`, `shortcuts://` and `ms-settings:` redirects and rejected `javascript:`. A deny decision returned a `tel:` URL as `redirect_to`.

**Fix:** On Deny, stay on an OzempicAI page unless the redirect is `https` or loopback `http`. Replace the blocklist with an allowlist: `https`, loopback `http`, and reverse-domain private schemes that contain a dot. Show the full destination before any navigation to a non-web scheme.

**Verification:** Registration of `tel:` and similar schemes must fail, and Deny must not navigate off-site for an unverified client.

### SEC-20 — Raw PostgreSQL error text is returned to clients

**Severity:** Low. **Confidence:** Reproduced. **Class:** CWE-209.

**Evidence:** server/src/http.ts:78 maps a set of PostgreSQL error codes to HTTP statuses and keeps the driver's message, which server/src/app.ts:70 sends to the browser. server/src/mcp/server.ts:115 and server/src/ai/loop.ts:105 pass the same text to MCP clients and to the model.

**Attack and impact:** A signed-in caller learns table, column, constraint and type names, which makes other attacks easier to aim. Messages can also echo submitted values. No rows belonging to other users appear in these messages.

**Reproduction:** Three malformed writes returned `violates check constraint "calorie_logs_calories_positive"`, `invalid input syntax for type uuid: "not-a-uuid"` and `violates foreign key constraint "grocery_items_meal_plan_id_fkey"`.

**Fix:** Validate input types and ranges in the handlers so most of these never reach the database. Map each error code to a fixed, friendly message and log the original server-side with a request ID.

**Verification:** Malformed input must produce messages that contain no schema identifiers.

### What the second pass checked and did not find

- **Committed secrets:** All 406 commits on every local and remote branch were searched for Anthropic, Resend, Supabase, AWS and GitHub key formats, JWTs, private keys and database URLs with passwords. The only matches were placeholders and the default passwords of the retired local Docker stack. Hosting-provider variables and build logs were not inspected.
- **Backdoors and hidden access:** Every route in server/src was read. Each one is either public by design (health, signup, login, recovery, OAuth registration, token and revocation, discovery documents), bearer-protected MCP, or behind `requireUser`. There is no debug or admin route, no hardcoded account or password, and no secret bypass header. server/src/ai/smoke.ts and server/src/import-supabase.ts are command-line scripts that are not reachable over HTTP.
- **Cross-user access:** A connected app could not edit another user's workout plan by ID, and the plan was unchanged afterwards. Row level security plus the explicit `user_id` filters held in every path exercised.
- **Browser injection:** The frontend has no `dangerouslySetInnerHTML`, `innerHTML` or `eval`. The login redirect comes from router state rather than a URL parameter, so it is not an open redirect. The only script-controlled navigation is the consent redirect covered by SEC-22.
- **Request parsing:** Bodies are copied through fixed key lists, so `__proto__` keys cannot reach an object prototype or a SQL identifier.

## Re-verification of SEC-01 to SEC-15

Done 2026-11-15 at commit `411c935`. The original harness (docs/security/reproduce.mts) was read line by line to confirm each test exercises what it claims, then re-run against a new throwaway database: all 11 reproductions passed again. The four findings without a reproduction were checked against the source, and both `npm audit` runs were repeated. **All 15 findings are real. Two severities are adjusted and SEC-02 stays unproven in production.**

| ID | Result | Note |
| --- | --- | --- |
| SEC-01 | Confirmed, re-run | Severity stands once other users exist: the pre-registration variant needs no prior compromise. |
| SEC-02 | Confirmed at the API; production unproven | See below. |
| SEC-03 | Confirmed, re-run | SEC-18 now measures the denial of service this finding left open. |
| SEC-04 | Confirmed, re-run | Closer to Low: the response states the real scope and consent limits still hold. |
| SEC-05 | Confirmed, re-run | |
| SEC-06 | Confirmed, re-run | Needs another user's plan ID, as the finding says. |
| SEC-07 | Confirmed, re-run | |
| SEC-08 | Confirmed, re-run | |
| SEC-09 | Gap confirmed in source; severity lowered | See below. |
| SEC-10 | Confirmed, re-run | |
| SEC-11 | Confirmed, re-run | |
| SEC-12 | Confirmed, re-run; worse than stated | See below. |
| SEC-13 | Confirmed in source | Only matters if `DATABASE_SSL=true` is set; the deployed value was not inspected. |
| SEC-14 | Confirmed by a fresh audit | Same 20 packages (7 high, 9 moderate, 4 low); server audit still zero. |
| SEC-15 | Confirmed in source | The 409 at server/src/auth.ts:152 is explicit. |

**SEC-02, production still unproven.** Caddy forwards a client's `X-Real-IP` unchanged, and the API trusts it, so the bypass works whenever that header reaches Caddy as the client sent it. Whether it does depends on the hosting edge, which may overwrite the header with the true address. That was not tested, because it needs requests to the live service. If the edge does overwrite it, SEC-02 is not exploitable as written, and the chained severities of SEC-12, SEC-17 and SEC-19 fall to what one address can do. Test this on the deployed site before relying on either answer.

**SEC-09, lower to Medium or below.** The missing header is real. The attack also needs the framed page to be signed in, and the session lives in `localStorage` (src/lib/api.ts:50). Current Chrome, Firefox and Safari give a cross-site frame its own empty storage, so the framed consent page would show the login screen instead of an Allow button. No browser was tested here. The header is still a one-line fix worth making.

**SEC-12, raise the stated impact.** The slowdown is quadratic: 60 KB took 1.3 s and 120 KB took 5.4 s in a direct test of the expression. A single request at the 256 KiB body limit should therefore block the API for roughly 20 seconds, so one address inside its 20-request allowance can stall the service for minutes without SEC-02.

**Corrections made to the text above.** Three references were wrong and have been fixed: the profile-name line is server/src/ai/prompt.ts:72 (not 85), the dev-server binding is vite.config.ts:49 (not 57), and the cited threat-model file does not exist in the repository.

## Additional hardening and hypotheses — not counted as demonstrated exploits

- **Prompt injection and destructive AI actions:** MCP returns user-controlled names/notes; a previously approved malicious writer could plant instructions for another connected AI. server/src/mcp/server.ts:23 warns clients to treat tool output as data, but client behavior is outside this server's control. The coach executes model-selected writes at server/src/ai/loop.ts:98 without an independent per-action confirmation gate, and profile names enter a system context at server/src/ai/prompt.ts:72. No model was called and no successful injection was demonstrated. Keep untrusted text structurally separated, require explicit confirmation for destructive edits, and exercise synthetic indirect-injection tests. RLS and tool schemas remain required even when a model follows the system prompt.
- **Browser session exposure:** src/lib/api.ts:50 keeps long-lived tokens in localStorage. No application XSS sink was demonstrated: coach text is rendered as escaped React elements in src/features/coach/MessageText.tsx:1. A future XSS or compromised same-origin script would expose tokens. Consider HttpOnly cookie-backed web sessions with an explicit CSRF design; keep OAuth bearer access separate. Add a tested CSP rather than assuming React alone prevents all injection.
- **Local privacy/cache cleanup:** src/auth/AuthProvider.tsx:85 clears the stored session but not React Query state. Most query keys include user IDs; src/hooks/useCoach.ts:44 does not. No normal cross-account UI disclosure was demonstrated. Clear/cancel sensitive queries and live-turn state on identity changes, partition every health-data key by user, and add `Cache-Control: no-store` to sensitive API/auth responses. The service worker currently caches static assets/fonts, not API health responses; do not describe it as a health-data cache vulnerability.
- **Consent transparency:** The consent list at src/auth/AuthorizeAppScreen.tsx:147 omits some attributes exposed by `get_profile` (height, age, goals/timezone) at server/src/ai/tools/profile.ts:19. Display the full categories and clarify that registered app names are self-asserted, not verified brands. Registration accepting the name “Claude” is not itself an authentication bypass.
- **Audit trail completeness:** MCP writes log activity transactionally at server/src/mcp/server.ts:63, but read accesses and ordinary REST writes lack an equivalent health-data access audit. An activity row for a workout edit does not persist the prior version needed for durable restoration. Add protected, minimally identifying access/security audit events and a defined retention/redaction policy. Do not log bearer tokens, model prompts, or full health records by default.
- **Database privilege blast radius:** server/src/db.ts:26 uses the owner role for auth/OAuth work and switches roles for user data. No injection path was found. Separate migration ownership from a least-privileged runtime role and maintain grants explicitly; owner credentials would have a large blast radius if compromised.
- **Legacy-only configuration:** supabase/docker-compose.yml:16 exposes PostgreSQL on all host interfaces; line 47 allows wildcard auth redirects and line 56 auto-confirms mail. README marks this stack as retired local reference. Do not deploy it as a production replacement unchanged. These are not findings about the current Railway runtime.
- **Operational unknowns:** Verify production gateway header normalization, HTTPS termination, backup encryption/restoration, database exposure, provider retention/access policies for AI and email, MFA for infrastructure administrators, key rotation, data deletion/export, and alerts. These settings cannot be established from this repository and are not asserted to be missing. This review does not certify regulatory compliance.

Added in the second pass:

- **Remaining browser security headers:** Beyond the framing policy in SEC-09, Caddyfile:9 sets no `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy` or script-restricting `Content-Security-Policy`. src/theme/fonts.css:1 imports Google Fonts at runtime, which sends each visitor's address to a third party and widens what a CSP must allow. Self-host the fonts and add the headers in one change.
- **Session lifetime and control:** server/src/auth.ts:124 extends a session by 30 days on use with no absolute limit, login creates a new session every time with no cap, and logout ends only the current one. There is no list of active sessions and no "sign out everywhere". Add an absolute lifetime and a session list beside Connected AI apps.
- **Throttles reset on restart:** Every limiter lives in process memory (server/src/auth.ts:67), so a deploy or a crash clears login lockouts and the coach's hourly cap. A crash caused by SEC-17 or SEC-18 therefore also resets password-guessing limits. Shared storage fixes this along with SEC-02.
- **Log contents:** The request logger at server/src/app.ts:23 records full query strings, which include analytics date ranges and OAuth `state` values. Unhandled errors are printed whole at server/src/app.ts:71, and PostgreSQL error details can contain row values. Log paths without query strings, redact error details, and set a retention period.
- **Build and supply chain:** The Dockerfiles use moving tags (`node:22-alpine`, `caddy:2-alpine`) rather than digests, and the Caddy container runs as root. The repository has no CI configuration, so tests, `npm audit` and secret scanning do not run automatically. Pin image digests, run Caddy unprivileged, and add a pipeline that blocks merges on those checks.
- **Account controls expected for health data:** There is no multi-factor option, no check of new passwords against breached-password lists, and no endpoint for a user to export or delete their account and data. Plan these before inviting other users.
- **This report:** It lists unfixed weaknesses with reproduction steps. Keep the repository private, or move this file and docs/security out of it, until the high-severity items are fixed.

## Controls verified and important non-findings

- User data queries run through `withUser()` with transaction-local `authenticated` role and `auth.uid()`; reviewed CRUD paths additionally scope by user and use bound parameters. Dynamic table/column identifiers come from fixed server allowlists.
- Existing database-backed tests confirmed read-only MCP grants cannot write, one user's tools cannot read another user's grocery rows, and users cannot disconnect another user's OAuth grant. SEC-06 concerns relationship validation, not removal of these protections.
- OAuth requires S256 PKCE and exact registered redirects, hashes stored tokens/secrets, rotates refresh tokens, checks resource bindings, and supports revocation. The app does not automatically follow invalid-authorization error redirects.
- Browser API authentication uses explicit Authorization headers, not ambient cookies. Wildcard CORS on public OAuth/MCP routes does not by itself enable authenticated CSRF or leak data to arbitrary origins.
- MCP exposes a fixed registry of bounded data tools, not arbitrary SQL, shell commands, filesystem access or arbitrary URL fetching. No generic SSRF or command execution endpoint was found.
- Analytics SQL bounds date spans to 366 days and runs with invoker permissions. An unbounded date-series attack was investigated and not substantiated.
- No hardcoded live credential was identified in reviewed tracked configuration. This is not an exhaustive historical or built-image secret scan.

## Recommended remediation order

1. Bound and replace email validation; establish trusted IP attribution. For a personal deployment, restrict signup immediately and set a global AI budget/concurrency ceiling.
2. Make account recovery invalidate all account credentials, including OAuth and pending codes; close pre-registration persistence and add password-change reauthentication.
3. Implement token-specific narrowed scopes, repair public-client throttling and code-replay binding checks, and protect consent pages against framing.
4. Enforce relationship ownership and consistent field/storage quotas. Add two-user and abuse regression tests for each correction.
5. Upgrade vulnerable dependencies, verify database TLS identity, improve privacy responses and access auditing, and inspect the actual deployment controls.

Second-pass additions, in the order they fit into the list above:

- **With step 1:** Cap email length at 254 characters and shrink the auth body limit. This one change closes SEC-12 and SEC-17. Validate reset tokens before hashing (SEC-19).
- **With step 4:** Add field-length limits and lower list limits (SEC-18). Until then this is the cheapest way for a signed-up account to take the service down, so do not open signup first.
- **With step 3:** Count MCP calls rather than requests (SEC-16) and restrict redirect schemes (SEC-22).
- **With step 5:** Add database and pool timeouts and a pre-authentication throttle (SEC-23), make recovery responses uniform (SEC-21), replace raw database messages (SEC-20), and add the remaining headers.

Re-run the focused reproductions after fixes, changing assertions to expect secure behavior. Run the existing suites as regression coverage. Validate production-dependent findings in staging before inviting additional users. Do not interpret the current passing normal test suite as evidence that these vulnerability cases are covered.
