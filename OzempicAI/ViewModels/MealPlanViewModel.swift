import Foundation

@MainActor
class MealPlanViewModel: ObservableObject {
    @Published var weeklyPlans: [MealPlan] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let client = SupabaseService.shared.client

    private static let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    private struct NewMealPlan: Encodable {
        let user_id: UUID
        let name: String
        let planned_date: String
        let meal_type: String
        let calories: Int
    }

    func loadWeeklyPlans(for weekStart: Date? = nil) async {
        isLoading = true
        errorMessage = nil
        do {
            let userId = try await SupabaseService.shared.currentUserId
            let calendar = Calendar.current
            let startOfWeek = weekStart ?? calendar.dateInterval(of: .weekOfYear, for: .now)!.start
            let endOfWeek = calendar.date(byAdding: .day, value: 7, to: startOfWeek)!

            weeklyPlans = try await client
                .from("meal_plans")
                .select()
                .eq("user_id", value: userId.uuidString)
                .gte("planned_date", value: Self.dateFormatter.string(from: startOfWeek))
                .lt("planned_date", value: Self.dateFormatter.string(from: endOfWeek))
                .order("planned_date", ascending: true)
                .execute()
                .value
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    func addMeal(name: String, date: Date, mealType: MealPlan.MealType, calories: Int) async {
        errorMessage = nil
        do {
            try await insertMeal(name: name, date: date, mealType: mealType, calories: calories)
            await loadWeeklyPlans()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func deleteMeal(_ plan: MealPlan) async {
        do {
            try await client
                .from("meal_plans")
                .delete()
                .eq("id", value: plan.id.uuidString)
                .execute()
            await loadWeeklyPlans()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func deleteMeal(on date: Date, mealType: MealPlan.MealType) async {
        do {
            try await deleteMeals(on: date, mealType: mealType)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func replaceMeals(on date: Date, mealType: MealPlan.MealType, with plans: [MealPlan], reloadWeek weekStart: Date? = nil) async {
        errorMessage = nil
        do {
            let originalPlans = try await meals(on: date, mealType: mealType)

            do {
                try await deleteMeals(on: date, mealType: mealType)
                for plan in plans {
                    try await insertMeal(name: plan.name, date: date, mealType: mealType, calories: plan.calories)
                }
            } catch {
                try? await deleteMeals(on: date, mealType: mealType)
                for originalPlan in originalPlans {
                    try? await insertMeal(name: originalPlan.name, date: date, mealType: mealType, calories: originalPlan.calories)
                }
                throw error
            }

            await loadWeeklyPlans(for: weekStart)
        } catch {
            errorMessage = error.localizedDescription
            await loadWeeklyPlans(for: weekStart)
        }
    }

    private func meals(on date: Date, mealType: MealPlan.MealType) async throws -> [MealPlan] {
        let userId = try await SupabaseService.shared.currentUserId

        return try await client
            .from("meal_plans")
            .select()
            .eq("user_id", value: userId.uuidString)
            .eq("planned_date", value: Self.dateFormatter.string(from: date))
            .eq("meal_type", value: mealType.rawValue)
            .order("created_at", ascending: true)
            .execute()
            .value
    }

    private func insertMeal(name: String, date: Date, mealType: MealPlan.MealType, calories: Int) async throws {
        let userId = try await SupabaseService.shared.currentUserId
        let entry = NewMealPlan(
            user_id: userId,
            name: name,
            planned_date: Self.dateFormatter.string(from: date),
            meal_type: mealType.rawValue,
            calories: calories
        )

        try await client.from("meal_plans").insert(entry).execute()
    }

    private func deleteMeals(on date: Date, mealType: MealPlan.MealType) async throws {
        let userId = try await SupabaseService.shared.currentUserId

        try await client
            .from("meal_plans")
            .delete()
            .eq("user_id", value: userId.uuidString)
            .eq("planned_date", value: Self.dateFormatter.string(from: date))
            .eq("meal_type", value: mealType.rawValue)
            .execute()
    }
}
