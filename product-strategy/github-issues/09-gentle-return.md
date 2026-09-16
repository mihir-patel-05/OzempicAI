## User value

Help people resume after a gap without streak pressure. Maintenance mode should emphasize routines and confidence instead of continual weight loss.

## Product requirements

- Returning users see one familiar, low-effort action based on explicit history.
- Users can choose active-loss or maintenance emphasis without losing history.
- Reminders have per-category controls, quiet hours, frequency, pause, and complete opt-out.
- Notification text is neutral and excludes sensitive health or medication details.
- Do not use shame, broken-streak language, medication stopping advice, or tapering advice.
- Skip a reminder when the relevant action is already complete when platform delivery guarantees permit it.

## Technical implementation

- Add `lifecycle_preferences`, `user_action_days`, and notification-delivery records.
- Deduplicate delivery server-side and record rules version and reason code.
- Store timezone and quiet-hour preferences explicitly.
- Use generic push payloads; fetch sensitive state after authenticated app open.
- Support a server-side kill switch and category-specific suspension.
- Clear notification identifiers and local user caches on sign-out or deletion.

## Acceptance criteria

- [ ] Reminder consent is separate from research and AI-processing consent
- [ ] Quiet hours and timezone changes behave correctly
- [ ] Duplicate jobs do not generate duplicate notifications
- [ ] Pausing or opting out prevents future sends
- [ ] Tapping a reminder opens the relevant PWA destination when supported
- [ ] Measure seven-day return after re-entry and notification opt-outs against a holdout

