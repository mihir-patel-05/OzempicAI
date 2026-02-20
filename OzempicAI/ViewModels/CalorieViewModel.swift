import Foundation

@MainActor
class CalorieViewModel: ObservableObject {
    @Published var todaysLogs: [CalorieLog] = []
    @Published var dailyGoal: Int = Constants.Health.defaultCalorieGoal
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let client = SupabaseService.shared.client

    var totalCaloriesToday: Int {
        todaysLogs.reduce(0) { $0 + $1.calories }
    }

    var logsByMeal: [CalorieLog.MealType: [CalorieLog]] {
        Dictionary(grouping: todaysLogs, by: \.mealType)
    }

    func loadTodaysLogs() async {
        isLoading = true
        errorMessage = nil
        do {
            let userId = try await SupabaseService.shared.currentUserId
            let startOfDay = Calendar.current.startOfDay(for: .now)

            todaysLogs = try await client
                .from("calorie_logs")
                .select()
                .eq("user_id", value: userId.uuidString)
                .gte("logged_at", value: startOfDay.ISO8601Format())
                .order("logged_at", ascending: false)
                .execute()
                .value
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    func logFood(name: String, calories: Int, mealType: CalorieLog.MealType) async {
        do {
            let userId = try await SupabaseService.shared.currentUserId

            struct NewCalorieLog: Encodable {
                let user_id: UUID
                let food_name: String
                let calories: Int
                let meal_type: String
            }

            let entry = NewCalorieLog(
                user_id: userId,
                food_name: name,
                calories: calories,
                meal_type: mealType.rawValue
            )

            try await client.from("calorie_logs").insert(entry).execute()
            await loadTodaysLogs()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func deleteLog(_ log: CalorieLog) async {
        do {
            try await client
                .from("calorie_logs")
                .delete()
                .eq("id", value: log.id.uuidString)
                .execute()
            await loadTodaysLogs()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
