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
        }
    }
}
