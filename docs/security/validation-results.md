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
