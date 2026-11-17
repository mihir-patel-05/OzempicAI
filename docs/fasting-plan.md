# Intermittent Fasting Plan

**Goal:** let the user pick how long a fast should last, start it, and watch a timer count it down.
Fasting gets its own screen with history and analytics, a card on Today, and notifications when the
goal is near and when it is reached, even with the app closed.

**Status (2026-11-17):** phases 1 (backend), 2 (Fasting screen), 3 (Today card) and 4 (stats and
chart) are built on `Fasting_Feature`.

### Decisions (2026-11-17)

| Question | Answer | Effect on the plan |
|----------|--------|--------------------|
| Where does Fasting live in navigation? | Desktop: its own sidebar tab. Phone: reached from the Today card. | The phone tab bar stays at Today, Plans, +, Analytics, Profile. `/fasting` is still a normal route on both. |
| Which notifications? | "1 hour left" and "Goal reached" | Two timestamps on `fasts` record that each was sent, so each is sent once. |
| Longest fast? | 72 hours | `target_minutes` is 60 to 4,320. A fast left running past its goal can still be ended; it shows as overtime. |
| Push library? | `web-push` on the API | No hand-written VAPID signing or payload encryption. |

---

## 1. Data model

`public.fasts` (migration `00021_fasts.sql`):

| Column | Notes |
|--------|-------|
| `started_at` | When the fast began. May be backdated; never in the future. |
| `target_minutes` | The goal: 60 to 4,320 (72 h). |
| `ended_at` | Null while the fast is running. Must be after `started_at`. |
| `notes` | Optional, up to 2,000 characters through the API. |
| `reminder_notified_at`, `goal_notified_at` | Set by the notifier (phase 5) when it sends "1 hour left" and "Goal reached". Cleared when an edit moves the goal back into the future, so the notification is sent again at the new time. |

- **No overlaps, one running fast.** An exclusion constraint (`btree_gist`) stops two of a user's
  fasts from covering the same time. A running fast covers `[started_at, ∞)`, so it also means at
  most one fast runs at a time. The API checks first so the user gets a clear message; the
  constraint is the backstop for concurrent requests.
- Row level security: own rows only, like every other table. Deleted with the account.
- The timer is computed from `started_at` on the client, so it survives reloads, closing the app and
  switching devices. Nothing about a running fast is kept in the browser.

## 2. API (`server/src/routes/fasting.ts`)

| Route | Does |
|-------|------|
| `GET /api/fasts/active` | The running fast, or `null`. |
| `GET /api/fasts?from=&to=&limit=` | Fasts overlapping the window, newest first. |
| `POST /api/fasts` | Start a fast (`target_minutes`, optional backdated `started_at`, `notes`). With `ended_at` it records a finished fast instead. 409 if one is already running. |
| `POST /api/fasts/:id/end` | End a running fast now, or at a given `ended_at`. 409 if already ended. |
| `PATCH /api/fasts/:id` | Fix `started_at`, `target_minutes`, `ended_at` (null reopens it) or `notes`. |
| `DELETE /api/fasts/:id` | Remove it. |

Times may not be in the future (one minute of slack for clock differences).

## 3. Notifications

Web Push, sent by the API, so they arrive with the app closed.

- **iPhone:** only after the app is added to the Home Screen (iOS 16.4+). The app shows how when it
  is opened in a Safari tab.
- Permission is requested from a button press, never on load.
- A loop in the API (every 30 s, next to the hourly housekeeping) claims due fasts with
  `update … where goal_notified_at is null … for update skip locked … returning`, then sends. A
  restart or a second instance cannot send the same notification twice.
- Notifications are tagged `fast-<id>`, so if the open app also shows one the OS keeps one.
- Configured by `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` on `api`. Unset means
  notifications are off and nothing else changes.
- The service worker handler is `public/push-sw.js`, loaded through Workbox `importScripts`, so the
  existing `generateSW` setup stays.

---

## 4. Commits

Each phase can be deployed, and reverted, on its own. Notifications come last.

**Phase 1: backend**
1. `docs: add intermittent fasting plan`
2. `db: add fasts with no overlaps and one running fast per user`
3. `api: start, end, edit and list fasts`
4. `test: cover fasting routes`

**Phase 2: Fasting screen**
5. `web: add fasting types and hooks`
6. `web: add a ticking clock hook, fasting presets and time formatting` (13:11, 16:8, 18:6, 20:4, OMAD, 36 h, custom)
7. `web: add the fasting timer component` (its own `--dusk` ring colour, light and dark)
8. `web: add the Fasting screen with start, end and history`
9. `web: edit, delete and add past fasts`
10. `web: add Fasting to the desktop sidebar`

**Phase 3: Today**
11. `web: share the end-fast confirmation so Today can use it`
12. `web: add a compact fasting card for Today` (countdown and End when running; one-tap start with
    the last goal otherwise; its header links to Fasting, the way in on phones)
13. `web: show the running fast on Today` (under calories on phones, top of the right column on desktop)

**Phase 4: analytics**
14. `web: make the fasting colour strong enough to chart` (`--dusk` is now `#4466b0`, dark `#6688d8`:
    the first blue read as grey in bars)
15. `web: compute fasting stats` (streaks, goal rate, average and longest, total hours; a fast counts
    toward the local day it ended)
16. `web: show fasting stats on the Fasting screen` (7 / 30 / 90 days; the streak ignores the range)
17. `web: chart each day's fasting against its goal` (lazy-loaded, so Recharts stays out of the main
    bundle)

**Phase 5: notifications**
18. `db: add push subscriptions`
19. `api: register devices for push and send VAPID web push`
20. `api: notify when a fast is 1 hour from its goal and when it reaches it`
21. `web: handle push in the service worker`
22. `web: turn on fasting notifications`

**Phase 6 (optional): AI**
23. `tools: let the coach and AI apps read fasting history`
