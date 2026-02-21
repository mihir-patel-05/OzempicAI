import Foundation

@MainActor
class CalorieViewModel: ObservableObject {
    @Published var logs: [CalorieLog] = []
    @Published var dailyGoal: Int = Constants.Health.defaultCalorieGoal
    @Published var selectedDate: Date = Date()
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let client = SupabaseService.shared.client

    var totalCalories: Int {
        logs.reduce(0) { $0 + $1.calories }
    }

    var logsByMeal: [CalorieLog.MealType: [CalorieLog]] {
        Dictionary(grouping: logs, by: \.mealType)
    }

    var isToday: Bool {
        Calendar.current.isDateInToday(selectedDate)
    }

    // MARK: - Date Navigation

    func goToPreviousDay() {
        selectedDate = Calendar.current.date(byAdding: .day, value: -1, to: selectedDate) ?? selectedDate
        Task { await loadLogs() }
    }

    func goToNextDay() {
        guard !isToday else { return }
        selectedDate = Calendar.current.date(byAdding: .day, value: 1, to: selectedDate) ?? selectedDate
        Task { await loadLogs() }
    }

    func goToToday() {
        selectedDate = Date()
        Task { await loadLogs() }
    }

    // MARK: - Load Data

    func loadLogs() async {
        isLoading = true
        errorMessage = nil
        do {
            let userId = try await SupabaseService.shared.currentUserId
            let startOfDay = Calendar.current.startOfDay(for: selectedDate)
            let endOfDay = Calendar.current.date(byAdding: .day, value: 1, to: startOfDay)!

            logs = try await client
                .from("calorie_logs")
                .select()
                .eq("user_id", value: userId.uuidString)
                .gte("logged_at", value: startOfDay.ISO8601Format())
                .lt("logged_at", value: endOfDay.ISO8601Format())
                .order("logged_at", ascending: false)
                .execute()
                .value
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    func loadUserGoal() async {
        do {
            let userId = try await SupabaseService.shared.currentUserId

            struct UserGoal: Decodable {
                let dailyCalorieGoal: Int

                enum CodingKeys: String, CodingKey {
                    case dailyCalorieGoal = "daily_calorie_goal"
                }
            }

            let rows: [UserGoal] = try await client
                .from("users")
                .select("daily_calorie_goal")
                .eq("id", value: userId.uuidString)
                .execute()
                .value

            if let goal = rows.first?.dailyCalorieGoal {
                dailyGoal = goal
            }
        } catch {
            // Fall back to default — don't show error for this
        }
    }

    // MARK: - Update Goal

    func updateDailyGoal(_ goal: Int) async {
        errorMessage = nil
        dailyGoal = goal
        do {
            let userId = try await SupabaseService.shared.currentUserId

            struct GoalUpdate: Encodable {
                let daily_calorie_goal: Int
            }

            try await client
                .from("users")
                .update(GoalUpdate(daily_calorie_goal: goal))
                .eq("id", value: userId.uuidString)
                .execute()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Log Food

    func logFood(name: String, calories: Int, mealType: CalorieLog.MealType, date: Date) async {
        errorMessage = nil
        do {
            let userId = try await SupabaseService.shared.currentUserId

            struct NewCalorieLog: Encodable {
                let user_id: UUID
                let food_name: String
                let calories: Int
                let meal_type: String
                let logged_at: String
            }

            // Set logged_at to noon of the selected date to avoid timezone edge cases
            let logDate = Calendar.current.startOfDay(for: date)
                .addingTimeInterval(12 * 3600)

            let entry = NewCalorieLog(
                user_id: userId,
                food_name: name,
                calories: calories,
                meal_type: mealType.rawValue,
                logged_at: logDate.ISO8601Format()
            )

            try await client.from("calorie_logs").insert(entry).execute()
            await loadLogs()
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
            await loadLogs()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
