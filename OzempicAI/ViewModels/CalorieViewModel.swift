import Foundation

@MainActor
class CalorieViewModel: ObservableObject {
    @Published var todaysLogs: [CalorieLog] = []
    @Published var dailyGoal: Int = Constants.Health.defaultCalorieGoal
    @Published var isLoading = false
    @Published var errorMessage: String?

    var totalCaloriesToday: Int {
        todaysLogs.reduce(0) { $0 + $1.calories }
    }

    var logsByMeal: [CalorieLog.MealType: [CalorieLog]] {
        Dictionary(grouping: todaysLogs, by: \.mealType)
    }

    func loadTodaysLogs() async {
        // TODO: fetch from Supabase
    }

    func logFood(name: String, calories: Int, mealType: CalorieLog.MealType) async {
        // TODO: insert into Supabase
    }

    func deleteLog(_ log: CalorieLog) async {
        // TODO: delete from Supabase
    }
}
