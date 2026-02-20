# Phase 1 — Personal Build Plan

A personal-use iOS app for health & fitness tracking. No AI features in this phase.

---

## Features

### 1. Calorie Tracking
- Log daily food/meals with calorie counts
- Set a daily calorie goal based on user profile
- View daily calorie intake vs. goal (progress bar / summary)
- Breakdown by meal (breakfast, lunch, dinner, snacks)
- Running calorie total for the day

### 2. Water Tracking
- Log water intake in oz or ml (user preference)
- Set a daily hydration goal
- Quick-add buttons (e.g. 8oz, 16oz, custom)
- Daily progress indicator
- History view (past 7 days)

### 3. Exercise Tracking
- Log workouts manually (type, duration, estimated calories burned)
- Predefined exercise categories (cardio, strength, flexibility, etc.)
- View workout history
- Net calorie calculation (calories consumed - calories burned)

### 4. Heart Rate Tracking
- Read heart rate data from Apple HealthKit
- Display resting heart rate
- Show heart rate trends over time (daily/weekly view)
- Log manual heart rate readings as a fallback

### 5. Meal Planning
- Create weekly meal plans (assign meals to days)
- Save meals as templates for reuse
- View planned meals for the current week
- Attach calorie info to planned meals

### 6. Grocery List
- Add items to a grocery list manually
- Check off items as purchased
- Organize items by category (produce, dairy, protein, etc.)
- Clear completed items or reset the full list
- Optionally generate a grocery list from a meal plan

---

## Tech Stack

### iOS App
| Layer | Technology |
|---|---|
| Language | Swift 5.9+ |
| UI Framework | SwiftUI |
| Architecture | MVVM |
| State Management | `@Observable` / Combine |
| Navigation | NavigationStack (iOS 16+) |
| Health Data | HealthKit (heart rate) |
| Local Storage | UserDefaults (lightweight prefs) |
| Networking | URLSession + async/await |

### Backend
| Layer | Technology |
|---|---|
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| API | Supabase auto-generated REST API |
| Realtime | Supabase Realtime (optional for sync) |
| Storage | Supabase Storage (if images needed) |
| Swift Client | `supabase-swift` SDK |

---

## Database Tables (Supabase)

### `users`
| Column | Type |
|---|---|
| id | uuid (PK) |
| email | text |
| name | text |
| height_cm | float |
| weight_kg | float |
| age | int |
| daily_calorie_goal | int |
| daily_water_goal_ml | int |
| created_at | timestamp |

### `calorie_logs`
| Column | Type |
|---|---|
| id | uuid (PK) |
| user_id | uuid (FK) |
| food_name | text |
| calories | int |
| meal_type | text (breakfast/lunch/dinner/snack) |
| logged_at | timestamp |

### `water_logs`
| Column | Type |
|---|---|
| id | uuid (PK) |
| user_id | uuid (FK) |
| amount_ml | int |
| logged_at | timestamp |

### `exercise_logs`
| Column | Type |
|---|---|
| id | uuid (PK) |
| user_id | uuid (FK) |
| exercise_name | text |
| category | text |
| duration_minutes | int |
| calories_burned | int |
| logged_at | timestamp |

### `heart_rate_logs`
| Column | Type |
|---|---|
| id | uuid (PK) |
| user_id | uuid (FK) |
| bpm | int |
| source | text (healthkit/manual) |
| recorded_at | timestamp |

### `meal_plans`
| Column | Type |
|---|---|
| id | uuid (PK) |
| user_id | uuid (FK) |
| name | text |
| planned_date | date |
| meal_type | text |
| calories | int |
| created_at | timestamp |

### `grocery_items`
| Column | Type |
|---|---|
| id | uuid (PK) |
| user_id | uuid (FK) |
| name | text |
| category | text |
| is_purchased | bool |
| meal_plan_id | uuid (FK, nullable) |
| created_at | timestamp |

---

## Key Decisions & Notes

- **No AI in Phase 1.** All tracking is manual input or pulled from HealthKit.
- **Supabase Auth** handles login — use email/password or Sign in with Apple.
- **HealthKit** is read-only in Phase 1 — we pull heart rate data, we don't write back.
- **Offline first is not a priority** for personal use — app assumes network connectivity.
- **`supabase-swift`** is the official Swift SDK and supports async/await natively.
- Meal plan → grocery list link is optional for Phase 1 but the schema supports it via `meal_plan_id`.
