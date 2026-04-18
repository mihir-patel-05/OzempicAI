# macOS Frontend Integration Guide

Drop-in replacement for the macOS target. Reuses the iOS redesign's `Color.theme.*` warm tokens and Fraunces font helpers — so no theme changes needed.

## File map

| New / replaced file | Path in Xcode project |
|---|---|
| **Replace** `MacMainView.swift` | `OzempicAIMac/Views/MacMainView.swift` |
| **New** `MacHomeView.swift` | `OzempicAIMac/Views/MacHomeView.swift` |
| **New** `MacNewScreens.swift` | `OzempicAIMac/Views/MacNewScreens.swift` (contains Water, Heart Rate, Fasting) |
| **New** `MacComponents.swift` | `OzempicAIMac/Views/Components/MacComponents.swift` |

## Steps

1. **Prerequisite** — the iOS redesign (`Theme.swift`, `ViewModifiers.swift`, Fraunces) must already be installed. The shared `OzempicAI/Utilities/Theme.swift` is linked to the Mac target too (verify in Xcode → OzempicAIMac → Build Phases → Compile Sources).

2. **Replace** `MacMainView.swift` with the new version. Sidebar now has 11 items in 5 sections (OVERVIEW, TRACK, PLAN, BODY, ACCOUNT) instead of 6 items in 2.

3. **Add new files** to the `OzempicAIMac` target:
   - `MacHomeView.swift` — new dashboard landing screen
   - `MacNewScreens.swift` — `MacWaterView`, `MacHeartRateView`, `MacFastingView`
   - `Components/MacComponents.swift` — `MacCard`, `MacRing`, `MacStatCard`, `MacPageHeader`, `MacSectionTitle`

4. **Update `OzempicAIMacApp.swift`** — change default selection:
   ```swift
   @State private var sidebarSelection: MacSidebarItem? = .home
   ```
   Also update the launch screen tint:
   ```swift
   Color.theme.cream.ignoresSafeArea()
   // ...
   .foregroundStyle(Color.theme.terracotta)
   ```

5. **Restyle existing Mac views** (`MacCalorieOverview`, `MacMealPlannerView`, `MacGroceryListView`, `MacWorkoutPlannerView`, `MacExerciseLogView`, `MacWeightView`, `MacSettingsView`) to match the redesign. Key changes per view:
   - Wrap content in `ScrollView { VStack(alignment: .leading, spacing: 24) { ... } .padding(32) }`
   - Add `.background(Color.theme.cream)` to the root
   - Replace page titles with `MacPageHeader(title:, subtitle:)`
   - Replace any existing card containers with `MacCard { ... }`
   - Replace stat tiles with `MacStatCard`
   - Replace circular progress with `MacRing`
   - Swap hard-coded colors for `Color.theme.*` tokens
   - Swap system fonts for `.font(.fraunces(n))` for numbers/headlines and `.font(.inter(n))` for body/UI

6. **Delete shortcut keys for removed mappings** in `NavigationCommands` — the new version already has the full 10-item list.

## Model/VM compatibility

The new views instantiate existing view models (`CalorieViewModel`, `WaterViewModel`, `WeightViewModel`, `HeartRateViewModel`, `FastingViewModel`) directly with `@StateObject`. If your app relies on these being `@EnvironmentObject`s, inject them in `OzempicAIMacApp.swift` instead.

The sample data in `MacHomeView`, `MacWaterView`, `MacHeartRateView`, `MacFastingView` is hard-coded for the design. Replace with your VM's published properties once wired up:
```swift
Text("\(calorieVM.remaining)")  // instead of "1,060"
```

## Window chrome

The new design doesn't use a traditional toolbar — the sidebar has the brand block at top and profile at bottom. If you prefer to keep `.navigationTitle`, remove the brand HStack from `MacSidebarView`.
