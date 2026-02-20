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

    func loadWeeklyPlans() async {
        isLoading = true
        errorMessage = nil
        do {
            let userId = try await SupabaseService.shared.currentUserId
            let calendar = Calendar.current
            let startOfWeek = calendar.dateInterval(of: .weekOfYear, for: .now)!.start
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
        do {
            let userId = try await SupabaseService.shared.currentUserId

            struct NewMealPlan: Encodable {
                let user_id: UUID
                let name: String
                let planned_date: String
                let meal_type: String
                let calories: Int
            }

            let entry = NewMealPlan(
                user_id: userId,
                name: name,
                planned_date: Self.dateFormatter.string(from: date),
                meal_type: mealType.rawValue,
                calories: calories
            )

            try await client.from("meal_plans").insert(entry).execute()
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
}
