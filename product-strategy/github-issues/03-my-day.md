## User value

Turn Today into a configurable home screen that helps users complete a useful action quickly. A familiar meal should be reusable in a few taps and remain fully editable.

## Product requirements

- User-configurable Today modules for nutrition, hydration, activity, and chosen progress measures.
- Prominent “repeat meal” action using the previous portion and nutrient provenance.
- Save a confirmed meal as a favorite and reuse it on another date or meal type.
- Allow amount, serving, date, time, and meal type edits before and after save.
- Show nutrient coverage when some entries contain calories only.
- Let users reduce or hide calorie and weight emphasis.
- Do not use punitive streak loss or rewards for eating less.

## Technical implementation

- Add a `favorite_meals` table and normalized favorite meal items linked to nutrition-source versions.
- Reuse the idempotent confirmed-meal write contract from the foundations issue.
- Invalidate meal, daily-total, and favorite queries after successful mutations.
- Add optimistic UI only when rollback restores the full prior entry.
- Use local calendar keys consistently and expose stale cached totals as stale.

## Acceptance criteria

- [ ] A usability participant can repeat and confirm a known meal in under 10 seconds
- [ ] Repeated meals can be edited without changing the saved favorite unless explicitly requested
- [ ] Duplicate taps and reconnect retries create one meal
- [ ] Missing nutrients display as unknown and daily totals show coverage
- [ ] Today remains useful for users who do not use medication
- [ ] Keyboard, screen reader, large-text, and reduced-motion checks pass

