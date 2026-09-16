## User value

Offer an optional check-in for appetite, available time, and preferred meal size, then show a few reviewed options that fit those stated needs. Remember explicit feedback about what worked.

## Experience requirements

- Ask only for information that changes the recommendation.
- Show two or three editable, reviewed meal options.
- Support smaller portions, saving part for later, texture preferences, dietary preferences, available ingredients, and preparation time.
- Explain each result with concise reason codes.
- Allow dismiss, replace, and “worked for me” feedback.
- Never infer medication effects or automatically lower nutrition goals.
- Optional symptom journaling stays separate and does not drive treatment advice.

## Technical implementation

- Add `check_ins`, `recipe_versions`, `recipe_tags`, `user_food_preferences`, and `recommendation_feedback`.
- Start with deterministic rules and 30–50 dietitian-reviewed recipes.
- Apply allergy exclusions and content eligibility before ranking.
- Rank by explicit preferences, prep time, available ingredients, and prior feedback.
- Persist recommendation ID, rules version, eligible candidate set, selected result, and reason codes.
- Derive user identity from verified authentication; never trust a client-supplied `user_id`.
- Put the feature behind a server-owned flag with an immediate kill switch.

## Acceptance criteria

- [ ] Allergy exclusions cannot be bypassed by ranking or sparse data
- [ ] Missing goals and new users receive safe reviewed defaults
- [ ] Rejected suggestions affect future ranking only as defined by the rules version
- [ ] Users can save a suggested meal after editing it
- [ ] No diagnosis, dose advice, medication changes, or causal claims appear
- [ ] Beta measures accepted suggestions, correction burden, perceived usefulness, and W4 useful retention

