## Goal

Roll out the initiative through evidence gates and measure retention without confusing feature engagement with customer or health outcomes.

## Rollout plan

- **Weeks 1–2:** discovery, baseline instrumentation, foundations, editable goals, and repeat-meal prototype.
- **Weeks 3–6:** internal cohort, then approximately 30–50 consented target users for defect discovery and qualitative feedback; add curated Appetite Compass rules and basic Flexible Week.
- **Weeks 7–12:** account-level randomized holdout and treatment, stratified by new versus existing users; ramp treatment from 5% to 25% to 50% after reliability reviews; keep a 10% holdout during wider availability.
- Dates never override quality gates. Extend measurement when enrollment is slow.

## Metrics

Primary: W4 useful retention as defined in the initiative.

Supporting:

- First-day activation
- Median time to confirmed meal
- Correction rate and severe correction rate
- Planned meals marked used
- Recommendation usefulness
- Valid-save success and duplicate rate
- Support complaints and notification opt-outs
- Provider cost per confirmed assisted meal
- Paid renewal and cancellation using verified billing events when available

## Experiment implementation

- Assign at account level and store assignment independently from exposure.
- Pre-register one primary hypothesis and analysis window.
- Analyze new and existing accounts separately.
- Check sample balance and log feature exposure.
- Do not repeatedly peek and stop based on transient significance.
- Recalculate sample size from observed baseline and traffic. The strategy's 1,250 accounts per arm is illustrative for 25% versus 30%, two-sided 5% alpha and 80% power.

## Acceptance criteria

- [ ] Assignment is stable across devices and sessions
- [ ] Holdout cannot access treatment through alternate entry points
- [ ] Primary metric query is reviewed and reproducible
- [ ] Guardrail metrics are available before treatment ramp
- [ ] Week 2, 6, and 12 decisions are recorded with evidence and uncertainty
- [ ] Expansion stops for critical privacy/clinical defects, cross-account access, save success below threshold, or material correction burden

