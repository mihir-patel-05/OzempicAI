import SwiftUI

struct DashboardView: View {
    @EnvironmentObject var authViewModel: AuthViewModel

    var body: some View {
        TabView {
            CalorieTrackerView()
                .tabItem { Label("Calories", systemImage: "flame.fill") }

            WaterTrackerView()
                .tabItem { Label("Water", systemImage: "drop.fill") }

            ExerciseTrackerView()
                .tabItem { Label("Exercise", systemImage: "figure.run") }

            HeartRateView()
                .tabItem { Label("Heart Rate", systemImage: "heart.fill") }

            MealPlanView()
                .tabItem { Label("Meal Plan", systemImage: "calendar") }

            GroceryListView()
                .tabItem { Label("Grocery", systemImage: "cart.fill") }

            FastingView()
                .tabItem { Label("Fasting", systemImage: "moon.stars.fill") }
        }
        .tint(Color.theme.mediumBlue)
        .onAppear {
            let appearance = UITabBarAppearance()
            appearance.configureWithOpaqueBackground()
            appearance.backgroundColor = UIColor(Color.theme.lightBlue.opacity(0.08))
            UITabBar.appearance().standardAppearance = appearance
            UITabBar.appearance().scrollEdgeAppearance = appearance
        }
    }
}
