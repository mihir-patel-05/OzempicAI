# Web-Only Migration Plan

Turn the multi-target Swift + partial React project into a single React/Vite PWA hosted at a URL you bookmark on your phone. No Xcode, no App Store, no paid Apple Developer account.

## Current state (July 2026)

- **iOS app** — `OzempicAI/` (SwiftUI, HealthKit, Supabase). Feature-complete.
- **macOS app** — `OzempicAIMac/`, `OzempicAIMacTests/` (SwiftUI shell reusing shared models). Partial.
- **Web app** — `Ozempic_AI_Webapp/` (Vite + React 18 + TS + Supabase + `vite-plugin-pwa`, Vercel-ready). Roughly 40% parity: auth, Today ring stats, and log screens for calories/water/weight/exercise/heart-rate. Stubs for Plans and Profile.
- **Backend** — Supabase already live. Migrations for `users`, `calorie_logs`, `water_logs`, `exercise_logs`, `heart_rate_logs`, `meal_plans`, `grocery_items`, `day_labels`, `weight_logs` with RLS. Done: the loose dashboard-only SQL was folded into `supabase/migrations/` as `00002`/`00003`/`00005`, so the schema now reproduces from the repo.

## Target state

One repo, one deployable: React PWA on Vercel talking to the existing Supabase project. Add-to-Home-Screen on iOS Safari gives a full-screen "app" experience with no store distribution and no signing.

---

## Phase 1 — Repo cleanup (small, mechanical)

Remove everything Apple-specific so the repo stops reading like a Swift project.

- Delete `OzempicAI/`, `OzempicAIMac/`, `OzempicAIMacTests/`, `OzempicAI.xcodeproj/`, `project.yml`, `mac-swift/`, `swift/`, `.DS_Store`.
- Delete obsolete planning docs: `macOS-implementation-plan.md`, `phase1-plan.md`, `docker-setup.md` (unless still used), `techstack.html`, `schedhule.html`, `Product Documents - Ozempic AI.docx` (or move to a `docs/` folder if you want to keep them).
- ~~Delete `supabase_add_weight.sql`, `supabase_fix_rls.sql`, `supabase-schema.md`, `supabase-weight-logs.md` once they've been folded into `supabase/migrations/`.~~ Done.
- Move `Ozempic_AI_Webapp/*` up to the repo root (or keep the subdir and adjust `vercel.json` root — see open question below).
- Rewrite root `README.md` to describe the web app + Supabase setup only.
- Prune `.gitignore` of Xcode/Swift patterns; add `dist/`, `.env.local`, `node_modules/`.
- Keep `Icons/` and `Logo/` only if used for the PWA icons; otherwise delete.

Estimated effort: half an hour. Nothing here is technically risky — but do it in one commit so bisecting isn't miserable later.

## Phase 2 — Consolidate the Supabase schema

Everything the web app talks to should live in `supabase/migrations/` and be reproducible from scratch.

- New migration `00005_weight_logs.sql` — promote the doc-only table to a real migration.
- New migration `00006_workout_plans.sql` — port from `WorkoutPlan.swift` / `WorkoutPlanViewModel.swift`. Likely one `workout_plans` table (name, planned_date, notes) and either a `workout_plan_exercises` join table or a JSONB `exercises` column. Read the ViewModel first before choosing.
- New migration `00007_fasting_sessions.sql` — `id`, `user_id`, `started_at`, `ended_at nullable`, `target_hours`. Port from `FastingViewModel.swift`.
- Audit RLS on every table. Every policy should be `auth.uid() = user_id`.
- Regenerate `src/types/db.ts` from the live schema (`supabase gen types typescript` or the equivalent MCP tool) so the client stays typed.

Verification: run migrations against a scratch Supabase project (or local Docker stack in `supabase/docker-compose.yml`) and confirm the web app still builds against the new `db.ts`.

## Phase 3 — Feature parity port

For each iOS feature that's missing on web, port the ViewModel to a React Query hook and the SwiftUI view to a React screen. Existing web patterns (`hooks/useCalorieLogs.ts`, `features/calories/CalorieScreen.tsx`) are the template — copy that shape.

| iOS feature | Backend | Web status | Work needed |
|---|---|---|---|
| Auth (email/password) | ✅ | ✅ done | — |
| Today / ring stats | — | ✅ done | — |
| Calorie logs | ✅ | ✅ done | — |
| Water logs | ✅ | ✅ done | — |
| Weight logs | ⚠️ doc only | ✅ screen exists | Land the migration (Phase 2) |
| Exercise logs | ✅ | ✅ done | — |
| Heart rate logs | ✅ | ✅ done | manual entry only (HealthKit gone) |
| Meal plans | ✅ | ❌ Plans screen is a stub | New hook + screen; edit/delete/add |
| Grocery list | ✅ | ❌ | New feature dir, hook, screen |
| Fasting timer | ❌ needs table | ❌ | Phase 2 migration + timer screen (localStorage for the running state, DB for history) |
| Workout plans | ❌ needs table | ❌ | Phase 2 migration + list/detail/add screens |
| Dashboard analytics (weekly trends, streaks) | uses existing logs | partial (Today) | Add trend cards to Today or a separate Dashboard route |
| Day labels | ✅ | ❌ | Small UI on Today/log to set the day's label |
| Account / Settings | — | ❌ ProfileScreen is a stub | Edit profile, calorie/water goals, sign out |

Rough order (biggest user-facing wins first): Meal Plans → Grocery → Profile/Settings → Workout Plans → Fasting → Dashboard analytics → Day Labels.

## Phase 4 — HealthKit replacement decision

iOS auto-synced heart rate and exercise data from HealthKit. The web has no equivalent. Options:

1. **Manual entry only** (recommended). Cheapest — the log screens already accept manual input. Just remove any UI copy that promises auto-sync.
2. **Web Bluetooth** to pair a compatible chest strap / HR monitor. Works in Chrome on Android, doesn't work in Safari on iOS. Not worth building unless you're on Android.
3. **Apple Health export → CSV import**. One-off, tedious, but preserves history if you want your existing HealthKit data.

Recommend (1) for now, keep (3) as a documented one-time script if you care about historical data.

## Phase 5 — PWA polish for iOS Home Screen

The scaffold already registers a service worker and manifest. Round out the iOS-specific bits so it actually feels native when you launch from the home screen:

- `<meta name="apple-mobile-web-app-capable" content="yes">` and `apple-mobile-web-app-status-bar-style` in `index.html`.
- `apple-touch-icon` at 180×180 (verify `public/` already ships one).
- Optional per-device splash images (iOS ignores manifest splashes) — skip unless the white flash bothers you.
- Safe-area padding via `env(safe-area-inset-*)` in `theme/base.css` so the notch/home indicator don't clip content.
- Test add-to-home-screen on your actual iPhone before calling it done. That flow catches manifest issues nothing else does.
- (Optional) iOS 16.4+ supports web push for installed PWAs — nice-to-have, not required.

## Phase 6 — Deploy and cutover

- Vercel project already exists (`vercel.json` present). Confirm the root-directory setting matches wherever `Ozempic_AI_Webapp/` lands after Phase 1.
- Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel project env vars.
- Point a custom domain if you want a nicer bookmark (e.g. `ozempic.yourdomain.com`). Optional.
- End-to-end smoke test on iPhone: sign up, log every entity type, install to home screen, kill the browser, relaunch from the icon.

## Open questions

Not blockers — I'll pick sensible defaults if you don't answer, but flagging so you can course-correct:

1. **Repo layout after cleanup.** Keep the `Ozempic_AI_Webapp/` subdirectory or promote its contents to the repo root? Root is cleaner but means moving every file; subdirectory keeps history intact. Default: promote to root.
2. **Delete Swift now or preserve in history.** `git rm` still leaves the code recoverable from history. Default: delete now.
3. **Fasting/workout backing store.** Full Supabase tables, or localStorage-only until you're sure you want the history? Default: Supabase from the start, since the point is having your data on any device.
4. **Docs folder.** Keep `Product Documents - Ozempic AI.docx` and the HTML mockups in a `docs/` folder, or purge? Default: purge.

## What I'd do first

If you approve this plan, the order I'd tackle it is: Phase 1 (delete Swift, promote webapp), Phase 2 (fold weight_logs migration, add workout_plans / fasting_sessions), Phase 3 top-of-list (Meal Plans + Grocery — these already have tables and are the biggest visible gaps), then work down. That gets a usable, fully-migrated-off-Swift app in the fewest commits.
