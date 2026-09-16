## Goal

Provide the platform reliability, privacy, authorization, and rollback controls required by every feature in this initiative.

## Offline and consistency

- Add an IndexedDB outbox for user-confirmed mutations, scoped to the signed-in account.
- Show pending, failed, retriable, and confirmed states.
- Retry on reconnect and app foreground without depending on background execution.
- Preserve original event time and timezone.
- Prevent another account from replaying or reading queued records.
- Clear sensitive cached records and queued writes at sign-out or account deletion after safe reconciliation.

## Authorization and privacy

- Enable RLS on every exposed user table.
- Revoke broad grants and grant only required operations.
- Add ownership checks for SELECT, INSERT, UPDATE, and DELETE; UPDATE must validate both existing and resulting ownership.
- Keep service credentials and provider secrets server-side.
- Use private storage with short-lived signed access.
- Add separate consent for research, optional medication context, and external AI processing.
- Document media, export, job, database, and backup retention.

## Reliability and operations

- Server-owned flags for recommendations, plan swaps, notifications, and capture providers.
- Manual logging remains available during provider failure or feature rollback.
- Redacted telemetry for latency, failure rate, duplicate saves, queue age, and provider cost.
- No meal text, symptoms, medication details, email, or photos in general analytics or application logs.
- Support representative iPhone Safari PWA and Android Chrome flows.

## Acceptance criteria

- [ ] Anonymous and cross-account access tests pass for every user-data table and bucket
- [ ] Retry and reconnect tests produce no duplicate records
- [ ] Valid manual-save success is at least 99% during beta
- [ ] p95 manual save is under 2 seconds on the agreed test network, excluding offline queuing
- [ ] Keyboard, screen-reader, large-text, and reduced-motion tests pass for critical flows
- [ ] Rollback preserves confirmed logs, user plan edits, and downloaded data
- [ ] Cross-account exposure or harmful advice disables the affected feature immediately

