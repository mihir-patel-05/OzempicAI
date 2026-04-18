//  DashboardView.swift
//  Replaces the old 10-tab DashboardView. Drop into OzempicAI/Views/Dashboard/
//  5 tabs: Home · Nutrition · Movement · Plan · You
//  (All existing 10 screens still accessible — nested inside the 5 sections.)

import SwiftUI

struct DashboardView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @EnvironmentObject var themeManager: ThemeManager

    init() {
        // Warm tab bar appearance
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

            // Nutrition = Calories tracker (existing view — will adopt new theme automatically)
            NavigationStack { CalorieTrackerView() }
                .tabItem { Label("Nutrition", systemImage: "fork.knife") }

            // Movement = Exercise + Water + Fasting combined via segmented picker
            MovementView()
                .tabItem { Label("Movement", systemImage: "figure.run") }

            // Plan = Meal plan + Workouts + Grocery via segmented picker
            PlanView()
                .tabItem { Label("Plan", systemImage: "calendar") }

            // You = Weight + Heart rate + Settings
            YouView()
                .tabItem { Label("You", systemImage: "person.crop.circle.fill") }
        }
        .tint(Color.theme.terracotta)
    }
}

// MARK: - Movement wrapper (holds Exercise / Water / Fasting)

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

// MARK: - Plan wrapper

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

// MARK: - You wrapper

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
