## Goal

Make health-data entry reliable before adding recommendation features.

## Product requirements

- Allow users to edit calorie, water, and exercise goals in Profile.
- Allow users to edit or delete a meal entry and select its actual date and time.
- Validate all numeric health inputs in the UI and server/database boundary.
- Show user-friendly errors without losing entered form data.
- Distinguish missing nutrient values from zero.
- Replace misleading Plans and Profile placeholder copy.

## Technical implementation

- Add validated update mutations to `useUserProfile` and calorie log hooks.
- Add nullable `protein_g`, `fiber_g`, `carbs_g`, `fat_g`, `source`, `confirmed_at`, and `client_request_id` fields to meal records, or introduce normalized meal and meal-item tables if migration analysis shows that is safer.
- Add a unique `(user_id, client_request_id)` constraint for idempotent retries.
- Add explicit goal origin and timezone preferences.
- Add database constraints and per-operation RLS policies for new or changed tables.
- Preserve old calorie-only rows; never infer missing macros from calories.
- Index user histories by `user_id` and event time and paginate long histories.
- Preserve actual event timestamp and timezone across travel, midnight, and daylight-saving transitions.

## Verification

- [ ] Create, edit, delete, and retry the same mutation without duplicates
- [ ] Invalid values fail with a useful message and no database write
- [ ] Historical calorie-only records remain readable
- [ ] Cross-account select, insert, update, and delete attempts fail
- [ ] Local-day totals pass midnight, timezone-travel, and DST tests
- [ ] Sign-out clears user-scoped caches and pending sensitive data
- [ ] Valid manual saves reach at least 99% success during beta

