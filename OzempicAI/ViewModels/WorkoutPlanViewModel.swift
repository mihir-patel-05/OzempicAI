import Foundation

@MainActor
class WorkoutPlanViewModel: ObservableObject {
    @Published var selectedDate: Date = .now
    @Published var plansForSelectedDate: [WorkoutPlan] = []
    @Published var monthlyPlans: [WorkoutPlan] = []
    @Published var pastExercises: [ExerciseLog] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let client = SupabaseService.shared.client

    private static let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    var datesWithPlans: Set<DateComponents> {
        let calendar = Calendar.current
        var result = Set<DateComponents>()
        for plan in monthlyPlans {
            let comps = calendar.dateComponents([.year, .month, .day], from: plan.plannedDate)
            result.insert(comps)
        }
        return result
    }

    func selectDate(_ date: Date) {
        selectedDate = date
        Task { await loadPlansForDate(date) }
    }

    func loadMonthlyPlans() async {
        isLoading = true
        errorMessage = nil
        do {
            let userId = try await SupabaseService.shared.currentUserId
            let calendar = Calendar.current
            let startOfMonth = calendar.dateInterval(of: .month, for: selectedDate)!.start
            let endOfMonth = calendar.date(byAdding: .month, value: 1, to: startOfMonth)!

            monthlyPlans = try await client
                .from("workout_plans")
                .select()
                .eq("user_id", value: userId.uuidString)
                .gte("planned_date", value: Self.dateFormatter.string(from: startOfMonth))
                .lt("planned_date", value: Self.dateFormatter.string(from: endOfMonth))
                .order("planned_date", ascending: true)
                .execute()
                .value
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    func loadPlansForDate(_ date: Date) async {
        errorMessage = nil
        do {
            let userId = try await SupabaseService.shared.currentUserId
            let calendar = Calendar.current
            let startOfDay = calendar.startOfDay(for: date)
            let endOfDay = calendar.date(byAdding: .day, value: 1, to: startOfDay)!

            plansForSelectedDate = try await client
                .from("workout_plans")
                .select()
                .eq("user_id", value: userId.uuidString)
                .gte("planned_date", value: Self.dateFormatter.string(from: startOfDay))
                .lt("planned_date", value: Self.dateFormatter.string(from: endOfDay))
                .order("planned_date", ascending: true)
                .execute()
                .value
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func addWorkoutPlan(
        exerciseName: String,
        category: ExerciseLog.ExerciseCategory,
        plannedDate: Date,
        durationMinutes: Int,
        caloriesBurned: Int,
        sets: Int? = nil,
        repsPerSet: Int? = nil,
        bodyPart: ExerciseLog.BodyPart? = nil,
        weight: Double? = nil,
        weightUnit: ExerciseLog.WeightUnit? = nil,
        notes: String? = nil
    ) async {
        errorMessage = nil
        do {
            let userId = try await SupabaseService.shared.currentUserId

            struct NewWorkoutPlan: Encodable {
                let user_id: UUID
                let exercise_name: String
                let category: String
                let planned_date: String
                let duration_minutes: Int
                let calories_burned: Int
                let sets: Int?
                let reps_per_set: Int?
                let body_part: String?
                let weight: Double?
                let weight_unit: String?
                let notes: String?
            }

            let entry = NewWorkoutPlan(
                user_id: userId,
                exercise_name: exerciseName,
                category: category.rawValue,
                planned_date: Self.dateFormatter.string(from: plannedDate),
                duration_minutes: durationMinutes,
                calories_burned: caloriesBurned,
                sets: sets,
                reps_per_set: repsPerSet,
                body_part: bodyPart?.rawValue,
                weight: weight,
                weight_unit: weightUnit?.rawValue,
                notes: notes
            )

            try await client.from("workout_plans").insert(entry).execute()
            await loadMonthlyPlans()
            await loadPlansForDate(selectedDate)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func deleteWorkoutPlan(_ plan: WorkoutPlan) async {
        do {
            try await client
                .from("workout_plans")
                .delete()
                .eq("id", value: plan.id.uuidString)
                .execute()
            await loadMonthlyPlans()
            await loadPlansForDate(selectedDate)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func loadPastExercises() async {
        do {
            let userId = try await SupabaseService.shared.currentUserId

            pastExercises = try await client
                .from("exercise_logs")
                .select()
                .eq("user_id", value: userId.uuidString)
                .order("logged_at", ascending: false)
                .execute()
                .value
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
