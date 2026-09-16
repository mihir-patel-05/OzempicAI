## User value

Provide a concise weekly reflection about verified activity and a user-reviewed export for a healthcare visit.

## Product requirements

- Summarize what the user logged, which meals were marked useful, and one optional experiment for the next week.
- Distinguish unlogged days from zero intake.
- Avoid causal claims, diagnosis, and treatment advice.
- Allow users to choose which fields appear in a visit brief.
- Include date range, nutrition coverage, weight history, exercise summary, hydration, and optional user-entered symptom notes.
- Export CSV for raw selected data and PDF for the reviewed summary.
- Never send a report automatically to a clinician or third party.

## Technical implementation

- Create a weekly aggregate job over authorized user records.
- Store immutable snapshots in `weekly_reviews` with source row IDs and rules version.
- Use deterministic templates first; language generation may summarize verified facts only.
- Suppress conclusions when coverage is insufficient.
- Generate exports on demand in private storage with short expiry and one-account access.
- Handle deleted source records according to a documented snapshot policy.
- Keep export access after subscription cancellation for the user's own history.

## Acceptance criteria

- [ ] Every summary statement can be traced to source rows or explicit user input
- [ ] Missing days are never represented as zero intake
- [ ] Users preview and remove fields before download
- [ ] CSV headers, units, timestamps, and date range are explicit
- [ ] PDF remains readable with large text and long values
- [ ] Cross-account and expired-link export requests fail
- [ ] Deleting an account removes generated exports and queued jobs under the retention policy

