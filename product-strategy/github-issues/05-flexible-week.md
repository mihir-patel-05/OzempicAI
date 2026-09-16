## User value

Replace the Plans placeholder with an editable three-day plan, leftovers, an aggregated grocery checklist, and a Rescue Meal action that swaps only the meal that no longer works.

## Product requirements

- Create, edit, delete, and reorder planned meals.
- Adjust servings without rebuilding the plan.
- Mark a planned meal used, skipped, or replaced.
- Aggregate compatible ingredient quantities into a grocery checklist.
- Preserve purchased items and manual grocery additions.
- Rescue Meal proposes reviewed replacements that match current appetite, time, and preferences.
- Show the grocery delta before confirmation and provide undo after a swap.

## Technical implementation

- Reuse `meal_plans` and `grocery_items`, adding `meal_plan_items`, `recipe_version_id`, servings, status, and `plan_version`.
- Store structured ingredients with canonical IDs, units, and conversion rules.
- Use a transactional RPC or server operation for a confirmed swap and grocery recalculation.
- Require `expected_version`; return a conflict for stale concurrent edits.
- Make swap requests idempotent with a client request ID.
- Store a plan revision that makes undo possible.
- Do not combine incompatible units or infer household allergies from one account.

## Acceptance criteria

- [ ] Three-day plan CRUD works end to end
- [ ] Grocery aggregation handles compatible units and preserves incompatible units separately
- [ ] Rescue Meal changes one meal and only the affected grocery quantities
- [ ] Purchased and manually added groceries survive recalculation
- [ ] Repeating a request produces one revision
- [ ] Concurrent edits produce a recoverable conflict
- [ ] Measure planned meals marked used, not only plans generated

