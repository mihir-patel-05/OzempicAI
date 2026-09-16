## User value

Show progress beyond scale weight through private, user-selected milestones and comparable strength/activity trends.

## Product requirements

- Track completed strength sessions, sets, repetitions, load, and optional exertion.
- Offer short reviewed routines filtered by ability and available equipment.
- Let users select private daily-life milestones such as improved confidence preparing meals or an activity becoming easier.
- Let users hide weight charts.
- Show trends only when exercises and units are comparable.
- Do not claim to measure or guarantee muscle preservation.

## Technical implementation

- Reuse `exercise_logs` and its sets/repetitions fields.
- Add `workout_templates`, `workout_sessions`, session exercise records, and `user_milestones`.
- Store exercise load with explicit unit and conversion rules.
- Paginate history and query only the period needed for a chart.
- Preserve incomplete sessions and make resume/discard explicit.
- Apply user-scoped RLS and cross-account tests to every new table.

## Acceptance criteria

- [ ] Users can start, pause, resume, complete, and abandon a routine
- [ ] Incomplete sessions do not appear as completed progress
- [ ] Load conversions and comparable-exercise trends are correct
- [ ] Users can create and update private milestones
- [ ] The progress view handles missing data honestly
- [ ] Measure repeat participation and perceived usefulness, not inferred health outcomes

