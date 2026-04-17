import SwiftUI

// 5-tab dashboard (Home · Nutrition · Movement · Plan · You).
// The previous 10 screens stay accessible, nested under the 3 tabs that
// wrap a segmented picker (Movement, Plan, You).

struct DashboardView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @EnvironmentObject var themeManager: ThemeManager

    init() {
        let appearance = UITabBarAppearance()
        appearance.configureWithTransparentBackground()
        appearance.backgroundColor = UIColor(Color(hex: "FBF7F0").opacity(0.92))
        appearance.shadowColor = UIColor(Color(hex: "2A1E16").opacity(0.08))

        let item = UITabBarItemAppearance()
        item.normal.iconColor = UIColor(Color(hex: "6B5A4E"))
        item.normal.titleTextAttributes = [.foregroundColor: UIColor(Color(hex: "6B5A4E"))]
        item.selected.iconColor = UIColor(Color(hex: "C76F4A"))
        item.selected.titleTextAttributes = [.foregroundColor: UIColor(Color(hex: "C76F4A"))]
        appearance.stackedLayoutAppearance = item
        appearance.inlineLayoutAppearance = item
        appearance.compactInlineLayoutAppearance = item

        UITabBar.appearance().standardAppearance = appearance
        UITabBar.appearance().scrollEdgeAppearance = appearance
    }

    var body: some View {
        TabView {
            HomeView()
                .tabItem { Label("Home", systemImage: "house.fill") }

            NavigationStack { CalorieTrackerView() }
                .tabItem { Label("Nutrition", systemImage: "fork.knife") }

            MovementView()
                .tabItem { Label("Movement", systemImage: "figure.run") }

            PlanView()
                .tabItem { Label("Plan", systemImage: "calendar") }

            YouView()
                .tabItem { Label("You", systemImage: "person.crop.circle.fill") }
        }
        .tint(Color.theme.terracotta)
    }
}

// MARK: - Movement wrapper (Exercise / Water / Fasting)

struct MovementView: View {
    enum Tab: String, CaseIterable { case exercise = "Exercise", water = "Water", fasting = "Fasting" }
    @State private var tab: Tab = .exercise

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                Picker("", selection: $tab) {
                    ForEach(Tab.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, AppSpacing.md)
                .padding(.vertical, AppSpacing.sm)

                switch tab {
                case .exercise: ExerciseTrackerView()
                case .water:    WaterTrackerView()
                case .fasting:  FastingView()
                }
            }
            .screenBackground()
            .navigationTitle("Movement")
        }
    }
}

// MARK: - Plan wrapper (Meals / Workouts / Grocery)

struct PlanView: View {
    enum Tab: String, CaseIterable { case meals = "Meals", workouts = "Workouts", grocery = "Grocery" }
    @State private var tab: Tab = .meals

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                Picker("", selection: $tab) {
                    ForEach(Tab.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, AppSpacing.md)
                .padding(.vertical, AppSpacing.sm)

                switch tab {
                case .meals:    MealPlanView()
                case .workouts: WorkoutPlanView()
                case .grocery:  GroceryListView()
                }
            }
            .screenBackground()
            .navigationTitle("Plan")
        }
    }
}

// MARK: - You wrapper (Weight / Heart / Settings)

struct YouView: View {
    enum Tab: String, CaseIterable { case weight = "Weight", heart = "Heart", settings = "Settings" }
    @State private var tab: Tab = .weight

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                Picker("", selection: $tab) {
                    ForEach(Tab.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, AppSpacing.md)
                .padding(.vertical, AppSpacing.sm)

                switch tab {
                case .weight:   WeightTrackerView()
                case .heart:    HeartRateView()
                case .settings: SettingsView()
                }
            }
            .screenBackground()
            .navigationTitle("You")
        }
    }
}
