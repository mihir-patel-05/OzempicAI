## User value

Let users describe, scan, or photograph a meal, review the proposed foods and portions, and save the corrected version for later reuse. The system must reduce total entry time including corrections.

## Scope and sequence

1. Repeat meals and text-assisted food search
2. Barcode lookup for packaged foods
3. Photo-assisted estimates after benchmark and usability gates pass
4. Voice input only after browser support and demand are validated

## Technical implementation

- Add `food_catalog_refs`, `meal_items`, and `inference_jobs`.
- Implement a provider-neutral server adapter backed by a licensed nutrition source.
- `POST /meal-estimates` accepts text, barcode, or a short-lived private media reference plus `request_id` and returns candidate foods, quantities, provenance, uncertainty, and `requires_confirmation: true`.
- `POST /meals/confirm` accepts reviewed items, meal type, event time, and `request_id`, then saves the meal and items atomically.
- The model/provider never writes committed logs directly.
- Keep all provider secrets server-side.
- Strip image location metadata, compress before processing, and use short-lived private storage access.
- Delete transient media immediately after successful processing when possible and within the documented retention window in all cases.
- Cache safe catalog results and track provider cost per confirmed assisted meal.
- Fall back to manual entry after timeout or provider failure.

## Quality gate

Benchmark 100 consented or licensed representative meals, including mixed dishes and regional foods. Define acceptable nutrient and severe portion error thresholds with the clinical reviewer before evaluation.

## Acceptance criteria

- [ ] Users must review and confirm every assisted result
- [ ] Item, portion, serving, and nutrient edits are supported before confirmation
- [ ] Unknown barcodes and poor photos recover to manual entry
- [ ] Assisted capture times out within 8 seconds and preserves entered context
- [ ] No unconfirmed provider result becomes a health-data record
- [ ] Personal corrections take precedence on later reuse
- [ ] Roll out photo capture only if confirmed task time improves without unacceptable error or correction burden

