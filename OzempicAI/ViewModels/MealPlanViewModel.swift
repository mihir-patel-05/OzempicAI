import Foundation

@MainActor
class MealPlanViewModel: ObservableObject {
    @Published var weeklyPlans: [MealPlan] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    func loadWeeklyPlans() async {
        // TODO: fetch current week from Supabase
    }

    func addMeal(name: String, date: Date, mealType: MealPlan.MealType, calories: Int) async {
        // TODO: insert into Supabase
    }

    func deleteMeal(_ plan: MealPlan) async {
        // TODO: delete from Supabase
    }
}
