# OzempicAI — macOS App Implementation Plan

## Why macOS?

The iOS app works great for on-the-go logging (water, calories, exercise). But planning workflows — building a weekly workout routine, designing a meal plan, and creating a grocery list — benefit from a larger screen, keyboard input, and the ability to see multiple things side-by-side. The macOS app focuses on **planning**, while the iOS app stays the primary tool for **daily tracking**.

---

## Approach: Separate macOS Target (Same Xcode Project)

Rather than converting the iOS app to a universal app with Catalyst or requiring full multiplatform rewrites, the recommended approach is:

- **Add a macOS target** to the existing Xcode project / `project.yml`
- **Share Models, ViewModels, and Services** — these are platform-agnostic
- **Write new macOS-specific Views** — optimized for large screens, keyboard, and mouse
- **No HealthKit on macOS** — HealthKit is iOS/watchOS only; hide those features on Mac

### What's Shared (No Changes Needed)

| Layer | Files | Notes |
|-------|-------|-------|
| Models | All 8 model structs | Pure `Codable` structs, fully cross-platform |
| ViewModels | All 11 ViewModels | `@MainActor` + `ObservableObject`, no UIKit deps |
| Services | `SupabaseService.swift`, `AuthService.swift` | Supabase SDK supports macOS |
| Utilities | `Constants.swift`, `Theme.swift` | Colors and spacing work on both platforms |

### What's macOS-Only (New Files)

| Layer | New Files | Purpose |
|-------|-----------|---------|
| App | `OzempicAIMacApp.swift` | macOS entry point |
| Views | `MacMainView.swift` | Sidebar + detail NavigationSplitView |
| Views | `MacWorkoutPlannerView.swift` | Full-width weekly workout planner |
| Views | `MacMealPlannerView.swift` | Weekly meal plan with drag-and-drop |
| Views | `MacGroceryListView.swift` | Multi-column grocery list |
| Views | `MacCalorieOverview.swift` | Weekly calorie summary dashboard |
| Views | `MacSettingsView.swift` | macOS Settings window |
| Utilities | `MacViewModifiers.swift` | macOS-specific card styles, toolbar items |

### What's iOS-Only (Excluded from macOS Target)

- `HealthKitService.swift` — not available on macOS
- `HeartRateView.swift`, `HeartRateViewModel.swift` — depends on HealthKit
- `WaterTrackerView.swift` — quick-logging is better on phone
- `FastingView.swift` — timer-based, better as phone notification

---

## macOS UI Layout

### Navigation: Sidebar + Detail (NavigationSplitView)

```
┌──────────────────────────────────────────────────────────────────┐
│  OzempicAI                                              ─ □ ✕   │
├──────────┬───────────────────────────────────────────────────────┤
│          │                                                       │
│ PLAN     │              [ Detail Area ]                          │
│          │                                                       │
│ ◉ Weekly │   Changes based on sidebar selection                  │
│   Workouts│                                                      │
│          │                                                       │
│ ◉ Meal   │                                                       │
│   Plan   │                                                       │
│          │                                                       │
│ ◉ Grocery│                                                       │
│   List   │                                                       │
│          │                                                       │
│──────────│                                                       │
│ TRACK    │                                                       │
│          │                                                       │
│ ◉ Calories│                                                      │
│          │                                                       │
│ ◉ Exercise│                                                      │
│   Log    │                                                       │
│          │                                                       │
│ ◉ Weight │                                                       │
│          │                                                       │
│──────────│                                                       │
│ ◉ Settings│                                                      │
│          │                                                       │
└──────────┴───────────────────────────────────────────────────────┘
```

Minimum window size: **1000 × 700 pts**. Sidebar width: **220 pts**.

---

## Screen-by-Screen Design

### 1. Weekly Workout Planner (`MacWorkoutPlannerView.swift`)

The hero screen. A full 7-day view so users can plan an entire week at a glance.

```
┌─────────────────────────────────────────────────────────────────┐
│  Weekly Workouts           ◀ Week of Mar 2 – Mar 8 ▶   [+ Add] │
├─────────┬─────────┬─────────┬─────────┬─────────┬────────┬─────┤
│   Mon   │   Tue   │   Wed   │   Thu   │   Fri   │  Sat   │ Sun │
│ Mar 2   │ Mar 3   │ Mar 4   │ Mar 5   │ Mar 6   │ Mar 7  │ M 8 │
├─────────┼─────────┼─────────┼─────────┼─────────┼────────┼─────┤
│         │         │         │         │         │        │     │
│ ┌─────┐ │ ┌─────┐ │  Rest   │ ┌─────┐ │ ┌─────┐ │ ┌────┐ │Rest │
│ │Bench│ │ │ Run │ │  Day    │ │Squat│ │ │HIIT │ │ │Yoga│ │ Day │
│ │Press│ │ │ 30m │ │         │ │ 4×8 │ │ │ 25m │ │ │45m │ │     │
│ │ 4×10│ │ │     │ │         │ │     │ │ │     │ │ │    │ │     │
│ └─────┘ │ └─────┘ │         │ └─────┘ │ └─────┘ │ └────┘ │     │
│ ┌─────┐ │         │         │ ┌─────┐ │         │        │     │
│ │Curls│ │         │         │ │Deads│ │         │        │     │
│ │ 3×12│ │         │         │ │ 3×5 │ │         │        │     │
│ └─────┘ │         │         │ └─────┘ │         │        │     │
│         │         │         │         │         │        │     │
│ [+ Add] │ [+ Add] │ [+ Add] │ [+ Add] │ [+ Add] │[+ Add]│[+] │
└─────────┴─────────┴─────────┴─────────┴─────────┴────────┴─────┘
```

**Key features:**
- **7-column grid** using `LazyVGrid` — one column per day
- Each workout is a **card** showing: name, category icon, sets×reps (strength) or duration (cardio)
- **Click a card** → popover/sheet to edit details (name, category, sets, reps, body part, weight, notes)
- **"+ Add" button per day** → inline form or popover to add a workout
- **Week navigation** arrows to move between weeks
- **Drag-and-drop** cards between days to reschedule (using SwiftUI `.draggable` / `.dropDestination`)
- **Right-click context menu**: Duplicate, Delete, Move to another day
- **Past exercise autocomplete**: When typing an exercise name, suggest from `pastExercises` fetched by `WorkoutPlanViewModel`
- **Color-coded by category**: Cardio = blue, Strength = orange, Flexibility = green, Sports = amber

**Data:** Uses existing `WorkoutPlanViewModel` + `WorkoutPlan` model. No schema changes needed.

---

### 2. Weekly Meal Planner (`MacMealPlannerView.swift`)

Same 7-day grid concept applied to meals.

```
┌──────────────────────────────────────────────────────────────────┐
│  Meal Plan                 ◀ Week of Mar 2 – Mar 8 ▶    [+ Add] │
├──────────┬─────────┬────────┬────────┬────────┬────────┬────────┤
│          │  Mon    │  Tue   │  Wed   │  Thu   │  Fri   │  Sat   │
├──────────┼─────────┼────────┼────────┼────────┼────────┼────────┤
│Breakfast │ Oatmeal │ Eggs + │Smoothie│ Oatmeal│ Eggs + │Pancakes│
│          │ 350 cal │ Toast  │ 280cal │ 350cal │ Toast  │ 450cal │
│          │         │ 400cal │        │        │ 400cal │        │
├──────────┼─────────┼────────┼────────┼────────┼────────┼────────┤
│ Lunch    │ Chicken │ Salad  │ Wrap   │Chicken │ Salad  │ Burger │
│          │ + Rice  │ Bowl   │ 520cal │+ Rice  │ Bowl   │ 650cal │
│          │ 600cal  │ 450cal │        │ 600cal │ 450cal │        │
├──────────┼─────────┼────────┼────────┼────────┼────────┼────────┤
│ Dinner   │ Salmon  │ Pasta  │ Stir   │ Tacos  │ Pizza  │ Steak  │
│          │ + Veg   │ 700cal │ Fry    │ 550cal │ 800cal │ + Veg  │
│          │ 550cal  │        │ 480cal │        │        │ 600cal │
├──────────┼─────────┼────────┼────────┼────────┼────────┼────────┤
│ Snack    │ Apple   │ Yogurt │ Nuts   │ Apple  │ Bar    │ —      │
│          │ 95cal   │ 150cal │ 200cal │ 95cal  │ 180cal │        │
├──────────┼─────────┼────────┼────────┼────────┼────────┼────────┤
│ TOTAL    │ 1595    │ 1700   │ 1480   │ 1595   │ 1830   │ 1700   │
└──────────┴─────────┴────────┴────────┴────────┴────────┴────────┘
```

**Key features:**
- **Grid layout**: Rows = meal types (breakfast, lunch, dinner, snack), Columns = days
- Each cell is a **clickable card** — click to edit, double-click to open detail
- **Empty cells** show a subtle "+" to add a meal
- **Row totals** at the bottom showing daily calorie totals
- **Daily goal indicator**: Green if under goal, amber if close, red if over
- **Drag-and-drop** meals between cells to rearrange
- **Copy week**: Button to duplicate an entire week's plan to next week
- **"Send to Grocery List"** button: Scans all planned meals and prompts user to add ingredients to grocery list

**Data:** Uses existing `MealPlanViewModel` + `MealPlan` model. The ViewModel's `loadWeeklyPlans()` already supports week-based queries.

---

### 3. Grocery List (`MacGroceryListView.swift`)

A multi-column, keyboard-friendly grocery list.

```
┌──────────────────────────────────────────────────────────────────┐
│  Grocery List                    [Clear Purchased] [+ Add Item]  │
├──────────────────────┬──────────────────────┬────────────────────┤
│ 🥬 PRODUCE           │ 🥩 PROTEIN           │ 🧈 DAIRY           │
│                      │                      │                    │
│ ☐ Spinach            │ ☐ Chicken breast     │ ☐ Greek yogurt     │
│ ☐ Broccoli           │ ☐ Salmon fillet      │ ☐ Eggs (dozen)     │
│ ☐ Avocados (3)       │ ✓ Ground turkey      │ ☐ Milk             │
│ ☐ Bananas            │                      │ ✓ Butter           │
│ ✓ Apples             │                      │                    │
│                      │                      │                    │
├──────────────────────┼──────────────────────┼────────────────────┤
│ 🌾 GRAINS            │ 🥤 BEVERAGES         │ 🍿 SNACKS          │
│                      │                      │                    │
│ ☐ Brown rice         │ ☐ Almond milk        │ ☐ Mixed nuts       │
│ ☐ Whole wheat bread  │ ☐ Protein powder     │ ☐ Protein bars     │
│ ☐ Oats               │                      │                    │
│                      │                      │                    │
└──────────────────────┴──────────────────────┴────────────────────┘
```

**Key features:**
- **3-column layout** grouping items by category (uses existing `GroceryItem.Category` enum)
- **Checkbox toggle** — click to mark purchased (strikethrough + dimmed)
- **Inline add**: Press Enter in a category column to add an item directly to that category
- **Quick-add bar** at top: Type item name → auto-suggest category → press Enter
- **Keyboard shortcuts**: ⌘N to add item, ⌘⌫ to delete selected, ⌘K to clear purchased
- **Link to meal plan**: Items linked to a `mealPlanId` show a small meal icon badge
- **Purchased items** sink to the bottom of each category

**Data:** Uses existing `GroceryViewModel` + `GroceryItem` model unchanged.

---

### 4. Calorie Overview (`MacCalorieOverview.swift`)

A weekly dashboard view (not the daily tracker from iOS — that stays on the phone).

```
┌──────────────────────────────────────────────────────────────────┐
│  Calories This Week              Goal: 2000/day      [Edit Goal] │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  2500 ┤                                                          │
│  2000 ┤─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ goal ─ ─ ─ ─ ─ ─ ─   │
│  1500 ┤    ██                   ██                               │
│  1000 ┤    ██  ██          ██   ██   ██                          │
│   500 ┤    ██  ██   ██     ██   ██   ██   ██                    │
│     0 └────Mon──Tue──Wed──Thu──Fri──Sat──Sun─                    │
│                                                                  │
├─────────────────────┬────────────────────────────────────────────┤
│  Today's Log        │  Quick Add                                 │
│                     │                                            │
│  🍳 Breakfast       │  Food: [____________]                      │
│    Oatmeal  350cal  │  Calories: [____]                          │
│                     │  Meal: ○ B  ● L  ○ D  ○ S                 │
│  🥗 Lunch           │                                            │
│    (nothing logged) │  [Log Food]                                │
│                     │                                            │
│  🍽 Dinner          │                                            │
│    (nothing logged) │                                            │
│                     │                                            │
│  Total: 350 / 2000  │                                            │
└─────────────────────┴────────────────────────────────────────────┘
```

**Key features:**
- **Weekly bar chart** at the top showing daily calorie totals vs goal
- **Today's breakdown** on the left grouped by meal type
- **Quick-add form** on the right — log food without opening a modal
- **Click any day's bar** to see that day's breakdown

**Data:** Uses existing `CalorieViewModel`. May need a small addition to load an entire week's logs at once.

---

### 5. Exercise Log (`MacExerciseLogView.swift`)

A table-style view for browsing and logging exercise history.

```
┌──────────────────────────────────────────────────────────────────┐
│  Exercise Log                              [+ Log Exercise]      │
├──────────────────────────────────────────────────────────────────┤
│  Today's Burn: 380 cal                                           │
├──────┬──────────────┬──────────┬────────┬────────┬───────────────┤
│ Date │ Exercise     │ Category │Duration│Calories│ Details       │
├──────┼──────────────┼──────────┼────────┼────────┼───────────────┤
│ 3/2  │ Bench Press  │ Strength │ 25 min │ 180cal │ 4×10 · 135lb │
│ 3/2  │ Running      │ Cardio   │ 30 min │ 300cal │              │
│ 3/1  │ Squats       │ Strength │ 20 min │ 150cal │ 4×8 · 185lb  │
│ 3/1  │ Pull-ups     │ Strength │ 10 min │  80cal │ 3×12         │
│ 2/28 │ Yoga         │ Flex     │ 45 min │ 120cal │              │
└──────┴──────────────┴──────────┴────────┴────────┴───────────────┘
```

**Key features:**
- **Table view** using SwiftUI `Table` (macOS native) with sortable columns
- **Inline editing**: Double-click a cell to edit
- **Filter bar**: Filter by category, date range, body part
- **"+ Log Exercise"** opens a panel (not a sheet) on the right side

**Data:** Uses existing `ExerciseViewModel` + `ExerciseLog` model.

---

### 6. Weight Tracker (`MacWeightView.swift`)

- Line chart showing weight trend over time (last 30/90/365 days)
- Table of entries below the chart
- Quick-add form on the side
- Uses existing `WeightViewModel`

---

## project.yml Changes

```yaml
targets:
  OzempicAI:
    # ... existing iOS target unchanged ...

  OzempicAIMac:
    type: application
    platform: macOS
    deploymentTarget: "13.0"
    sources:
      - path: OzempicAI/Models
      - path: OzempicAI/ViewModels
      - path: OzempicAI/Services
        excludes:
          - HealthKitService.swift    # Not available on macOS
      - path: OzempicAI/Utilities
      - path: OzempicAIMac           # macOS-specific views
    settings:
      base:
        PRODUCT_BUNDLE_IDENTIFIER: com.mihirpatel.OzempicAI.Mac
        PRODUCT_NAME: OzempicAI
        INFOPLIST_FILE: OzempicAIMac/Info.plist
        CODE_SIGN_ENTITLEMENTS: OzempicAIMac/OzempicAIMac.entitlements
    dependencies:
      - package: supabase-swift
    entitlements:
      path: OzempicAIMac/OzempicAIMac.entitlements
      properties:
        com.apple.security.app-sandbox: true
        com.apple.security.network.client: true   # Supabase API calls
```

---

## New File Structure

```
OzempicAI/
├── project.yml                          # Updated with macOS target
├── OzempicAI/                           # Shared + iOS
│   ├── Models/          ← shared
│   ├── ViewModels/      ← shared
│   ├── Services/        ← shared (except HealthKit)
│   └── Utilities/       ← shared
│
└── OzempicAIMac/                        # macOS-only
    ├── App/
    │   └── OzempicAIMacApp.swift         # @main entry point
    ├── Info.plist
    ├── OzempicAIMac.entitlements
    ├── Assets.xcassets/                  # macOS app icon
    └── Views/
        ├── MacMainView.swift             # NavigationSplitView sidebar
        ├── MacWorkoutPlannerView.swift    # 7-day workout grid
        ├── MacMealPlannerView.swift       # 7-day meal grid
        ├── MacGroceryListView.swift       # Multi-column grocery list
        ├── MacCalorieOverview.swift       # Weekly calorie dashboard
        ├── MacExerciseLogView.swift       # Table-based exercise log
        ├── MacWeightView.swift            # Weight chart + log
        ├── MacSettingsView.swift          # Preferences window
        ├── MacLoginView.swift             # Auth screen for macOS
        └── Components/
            ├── WorkoutCard.swift          # Reusable workout card
            ├── MealCell.swift             # Meal grid cell
            └── WeekNavigator.swift        # Week forward/back control
```

---

## macOS-Specific Considerations

### Window Management
- **Minimum window size**: 1000 × 700
- **Default window size**: 1200 × 800
- **Settings**: Use SwiftUI `Settings` scene (appears under app menu > Preferences)
- **Title bar**: Use `.toolbar` for top-level actions

### Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| `⌘1` – `⌘6` | Switch sidebar sections |
| `⌘N` | Add new item (context-aware) |
| `⌘S` | Save current edits |
| `⌘⌫` | Delete selected item |
| `⌘←` / `⌘→` | Previous / next week |

### HealthKit Exclusion
- `HealthKitService.swift` is excluded from the macOS target
- `ExerciseViewModel.swift` uses HealthKit — wrap those calls with:
  ```swift
  #if canImport(HealthKit)
  import HealthKit
  // HealthKit-specific code
  #endif
  ```
- Hide "Import from Apple Watch" button on macOS

### Menu Bar
```swift
CommandGroup(replacing: .newItem) {
    Button("New Workout Plan") { ... }
        .keyboardShortcut("n", modifiers: [.command])
    Button("New Meal") { ... }
        .keyboardShortcut("n", modifiers: [.command, .shift])
    Button("New Grocery Item") { ... }
        .keyboardShortcut("n", modifiers: [.command, .option])
}
```

---

## Implementation Order

### Phase 1 — Foundation
1. Create `OzempicAIMac/` directory structure
2. Update `project.yml` with macOS target
3. Add `#if canImport(HealthKit)` guards to shared ViewModels
4. Create `OzempicAIMacApp.swift` entry point
5. Create `MacMainView.swift` with sidebar navigation
6. Create `MacLoginView.swift` for authentication

### Phase 2 — Core Planning Views (the main value-add)
7. Build `MacWorkoutPlannerView.swift` — weekly workout grid
8. Build `MacMealPlannerView.swift` — weekly meal grid
9. Build `MacGroceryListView.swift` — multi-column grocery list

### Phase 3 — Tracking Views
10. Build `MacCalorieOverview.swift` — weekly calorie dashboard
11. Build `MacExerciseLogView.swift` — table-based log
12. Build `MacWeightView.swift` — chart + log

### Phase 4 — Polish
13. Add keyboard shortcuts and menu bar commands
14. Add drag-and-drop for workout and meal rearranging
15. Add `MacSettingsView.swift`
16. App icon and final styling

---

## ViewModel Changes Needed

The existing ViewModels are mostly reusable. Minor additions:

| ViewModel | Change | Reason |
|-----------|--------|--------|
| `WorkoutPlanViewModel` | Add `loadWeeklyPlans()` method | Currently loads monthly; need week-scoped query for the 7-day grid |
| `CalorieViewModel` | Add `loadWeekLogs()` method | Currently loads single day; need full week for bar chart |
| `ExerciseViewModel` | `#if canImport(HealthKit)` guards | HealthKit not on macOS |
| `MealPlanViewModel` | No changes | Already has `loadWeeklyPlans()` |
| `GroceryViewModel` | No changes | Already loads all items |

---

## Styling Notes

- Reuse the existing `Theme.swift` color palette (lightBlue, mediumBlue, darkNavy, amber, orange)
- macOS cards should have slightly less corner radius (8pt vs 12pt) to feel native
- Use `.formStyle(.grouped)` for edit forms — feels natural on macOS
- Sidebar should use macOS-native styling (no custom backgrounds)
- Tables should use the native `Table` view, not custom lists
