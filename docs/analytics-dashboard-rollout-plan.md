# Analytics Dashboard Rollout Plan

## Summary

Add a dedicated `/analytics` dashboard as the fifth primary navigation tab. The first release will cover body weight, structured workouts, strength progression, cardio progression, nutrition, hydration, heart-rate readings, and consistency insights.

The feature will launch to all users after staging validation. Analytics will be descriptive rather than medical: missing logs remain “no data,” and heart-rate or weight changes will not be labeled healthy or unhealthy.

## User Experience and Metrics

- Add range controls for 30 days, 90 days, 6 months, and 1 year; default to 30 days and preserve the selection during the session.
- Present overview cards for weight change, workout count and average sessions per week, active workout weeks, most frequent workout type, and total structured workout minutes.
- Show daily latest weight, a seven-day rolling trend, starting and current weights, minimum, maximum, and net change in the user's preferred unit system.
- Let users select a normalized strength exercise and chart best load and weekly volume. Show best load, total volume, and estimated one-rep max using the Epley formula, clearly labeled as an estimate.
- Let users select a cardio exercise and chart distance, duration, and pace where available. Show total distance, total time, best recorded pace, and longest session without comparing different activity types.
- Show logged calories, hydration, and heart-rate summaries without interpreting them medically. Missing days do not count as zero, and calorie and hydration comparisons use the user's current goals.
- Show weekly workout frequency, active-week percentage, workout-type distribution, and plan completion when plans exist.
- Keep structured workout sessions and general exercise logs separate so likely duplicate entries are not combined. General exercise appears as “Other activity.”
- Give every section loading, partial-error, empty, and insufficient-data states with links to the relevant logging screen.
- Provide short metric definitions and accessible textual summaries alongside charts.

## Data, APIs, and Implementation

- Add an authenticated, security-invoker Supabase RPC for daily analytics accepting a start date, end date, and browser IANA timezone. It returns daily weight, calories, water, general exercise, workout, cardio, strength-volume, heart-rate, and plan-completion aggregates filtered by `auth.uid()`.
- Add a second authenticated RPC for structured exercise progression. Its result includes performed date, normalized exercise key, display name, machine, workout type, sets, reps, load, volume, estimated one-rep max, duration, distance, and pace.
- Normalize exercise identity using trimmed case-insensitive names, collapsed whitespace, and normalized machine text. Preserve the user-entered display name; differently worded historical exercises remain separate.
- Aggregate dates in the supplied timezone, validate the timezone and date range, cap requests at one year, revoke anonymous execution, and retain existing row-level security protections.
- Add TypeScript result types and a range-aware analytics query layer. Keep calculations in pure transformation utilities, reuse current unit conversions, and invalidate analytics queries after relevant mutations.
- Build a lazy-loaded analytics screen with reusable summary-card, line-chart, bar-chart, legend, tooltip, and empty-state components. Use responsive charts and include non-visual labels and summaries.
- Add the route and fifth tab, update the mobile tab bar to five equal columns, and reuse the existing responsive sidebar and design tokens.
- Do not add new user-entered fields in this release.

## Testing and Acceptance

- Add unit and component coverage for date bucketing, timezone boundaries, rolling averages, unit conversion, normalized exercise grouping, volume, estimated one-rep max, pace, missing values, single-point histories, range switching, loading/error/empty states, and unit changes.
- Add database tests for cross-user isolation, timezone grouping, date-range validation, aggregation accuracy, empty histories, multiple same-day entries, and null exercise measurements.
- Manually validate narrow iPhone layouts, the desktop sidebar, installed-PWA mode, keyboard navigation, reduced motion, and throttled networks.
- Require authenticated-user isolation, correct selected-range behavior, metric/imperial rendering, truthful missing-data handling, exercise-specific cardio comparisons, mutation-driven refresh, and passing typecheck, production build, and automated tests.

## Deployment and Rollout

- Apply the additive RPC migration to staging first and verify permissions and query performance with sparse and high-volume fixture accounts.
- Because the hosted Supabase migration history is currently drifted, use the established dashboard SQL process unless migration history is repaired first.
- Deploy the frontend only after the RPCs are available, then smoke-test an existing account, a new account, and an account with no history.
- Release to all users in one production deployment without a cohort feature flag.
- Monitor Supabase RPC errors and latency, frontend errors, and Vercel deployment health during the initial release window.
- Roll back the frontend if needed; the additive database functions may remain until a later cleanup migration.

## Assumptions

- Version one uses at most one year of history and does not export or share analytics.
- Exercise naming remains free text; a canonical exercise catalog and historical alias merging are deferred.
- Weight targets, body measurements, sleep, steps, wearable synchronization, and medical interpretations are outside this release.
- “Best” means best within the selected date range, not an all-time personal record.
