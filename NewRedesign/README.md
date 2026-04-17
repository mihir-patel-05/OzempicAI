# OzempicAI Redesign — SwiftUI Drop-in

These files translate the HTML mockup into SwiftUI. They re-use the names
of the theme, view modifiers, and button styles already in your project,
so the rest of your existing views (CalorieTrackerView, WaterTrackerView,
etc.) automatically adopt the new warm palette without edits.

## Files

| File                  | Goes in                                      | Replaces              |
|-----------------------|----------------------------------------------|-----------------------|
| `Theme.swift`         | `OzempicAI/Utilities/`                       | existing Theme.swift  |
| `ViewModifiers.swift` | `OzempicAI/Utilities/`                       | existing ViewModifiers|
| `Components.swift`    | `OzempicAI/Views/Components/`                | new                   |
| `HomeView.swift`      | `OzempicAI/Views/Dashboard/`                 | new                   |
| `DashboardView.swift` | `OzempicAI/Views/Dashboard/`                 | existing DashboardView|

## Install steps

1. **Replace** `Theme.swift` and `ViewModifiers.swift`.
2. **Add** `Components.swift` and `HomeView.swift`.
3. **Replace** `DashboardView.swift`.
4. **(Optional) Add Fraunces font** — download from
   <https://fonts.google.com/specimen/Fraunces>, drag all `.ttf` files into
   Xcode (copy if needed, add to target), then add this to `Info.plist`:
   ```xml
   <key>UIAppFonts</key>
   <array>
     <string>Fraunces-Regular.ttf</string>
     <string>Fraunces-Medium.ttf</string>
     <string>Fraunces-Italic.ttf</string>
   </array>
   ```
   Without it, Swift falls back to the system serif — still warm, just
   less distinctive.
5. **Build.** All the existing views pick up the new `Color.theme`
   tokens automatically.

## What changed from the old design

- **Palette**: blue/amber → terracotta/cream/espresso with sage+plum
  supporting colors. Same `Color.theme` property names — existing code
  keeps working.
- **Tab bar**: 10 tabs → 5 (Home, Nutrition, Movement, Plan, You). The
  other screens are nested under the three that have segmented pickers.
- **New Home screen**: real dashboard with hero calorie card, 2×2 stat
  grid, today's meals, weekly insight. Lives in `HomeView.swift`.
- **Typography**: Fraunces (serif) for numbers + headlines, system for UI.
- **Components**: `ProgressRing`, `StatCard`, `ScreenHeader`, `MacroBar`,
  `CapsLabel` — reusable across the app.

## Refreshing existing screens

`CalorieTrackerView`, `WaterTrackerView`, `FastingView`, etc. already use
`Color.theme.*` and `cardStyle()`, so they'll look warmer immediately.
For a full visual refresh on any specific screen, swap the progress
rings for `ProgressRing(…)` and use `ScreenHeader` + `StatCard` as the
HomeView example shows.
