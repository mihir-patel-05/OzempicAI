import Foundation

@MainActor
class WorkoutPlanViewModel: ObservableObject {
    @Published var selectedDate: Date = .now
    @Published var plansForSelectedDate: [WorkoutPlan] = []
    @Published var monthlyPlans: [WorkoutPlan] = []
    @Published var weeklyPlans: [WorkoutPlan] = []
    @Published var pastExercises: [ExerciseLog] = []
    @Published var pastWorkoutPlans: [WorkoutPlan] = []
    @Published var mealsForSelectedDate: [MealPlan] = []
    @Published var weeklyDayLabels: [String: String] = [:]  // "yyyy-MM-dd" -> label
    @Published var selectedDayLabel: String?
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let client = SupabaseService.shared.client

    // MARK: - Unified History

    struct HistoryExercise: Identifiable {
        let id: UUID
        let exerciseName: String
        let category: ExerciseLog.ExerciseCategory
        let durationMinutes: Int?
        let caloriesBurned: Int?
        let sets: Int?
        let repsPerSet: Int?
        let bodyPart: ExerciseLog.BodyPart?
        let weight: Double?
        let weightUnit: ExerciseLog.WeightUnit?
    }

    var allPastExercises: [HistoryExercise] {
        var items: [HistoryExercise] = []

        // Exercise logs first (actual completions take priority)
        for log in pastExercises {
            items.append(HistoryExercise(
                id: log.id,
                exerciseName: log.exerciseName,
                category: log.category,
                durationMinutes: log.durationMinutes,
                caloriesBurned: log.caloriesBurned,
                sets: log.sets,
                repsPerSet: log.repsPerSet,
                bodyPart: log.bodyPart,
                weight: log.weight,
                weightUnit: log.weightUnit
            ))
        }

        // Workout plans second
        for plan in pastWorkoutPlans {
            items.append(HistoryExercise(
                id: plan.id,
                exerciseName: plan.exerciseName,
                category: plan.category,
                durationMinutes: plan.durationMinutes,
                caloriesBurned: plan.caloriesBurned,
                sets: plan.sets,
                repsPerSet: plan.repsPerSet,
                bodyPart: plan.bodyPart,
                weight: plan.weight,
                weightUnit: plan.weightUnit
            ))
        }

        return items
    }

    private static let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    var datesWithPlans: Set<DateComponents> {
        let calendar = Calendar.current
        var result = Set<DateComponents>()
        for plan in monthlyPlans {
            if let date = plan.plannedDateValue {
                let comps = calendar.dateComponents([.year, .month, .day], from: date)
                result.insert(comps)
            }
        }
        return result
    }

    func selectDate(_ date: Date) {
        selectedDate = date
        Task {
            await loadPlansForDate(date)
            await loadMealsForDate(date)
            await loadDayLabel(for: date)
        }
    }

    func loadWeeklyPlans(for weekStart: Date) async {
        isLoading = true
        errorMessage = nil
        do {
            let userId = try await SupabaseService.shared.currentUserId
            let calendar = Calendar.current
            let endOfWeek = calendar.date(byAdding: .day, value: 7, to: weekStart)!

            weeklyPlans = try await client
                .from("workout_plans")
                .select()
                .eq("user_id", value: userId.uuidString)
                .gte("planned_date", value: Self.dateFormatter.string(from: weekStart))
                .lt("planned_date", value: Self.dateFormatter.string(from: endOfWeek))
                .order("planned_date", ascending: true)
                .execute()
                .value
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    // MARK: - Day Labels

    func loadDayLabel(for date: Date) async {
        do {
            let userId = try await SupabaseService.shared.currentUserId
            let dateString = Self.dateFormatter.string(from: date)

            let labels: [DayLabel] = try await client
                .from("day_labels")
                .select()
                .eq("user_id", value: userId.uuidString)
                .eq("label_date", value: dateString)
                .execute()
                .value

            selectedDayLabel = labels.first?.label
        } catch {
            selectedDayLabel = nil
        }
    }

    func loadWeeklyDayLabels(for weekStart: Date) async {
        do {
            let userId = try await SupabaseService.shared.currentUserId
            let calendar = Calendar.current
            let endOfWeek = calendar.date(byAdding: .day, value: 7, to: weekStart)!

            let labels: [DayLabel] = try await client
                .from("day_labels")
                .select()
                .eq("user_id", value: userId.uuidString)
                .gte("label_date", value: Self.dateFormatter.string(from: weekStart))
                .lt("label_date", value: Self.dateFormatter.string(from: endOfWeek))
                .execute()
                .value

            var map: [String: String] = [:]
            for label in labels {
                map[label.labelDate] = label.label
            }
            weeklyDayLabels = map
        } catch {
            // Don't override other error messages for label loading failures
        }
    }

    func saveDayLabel(date: Date, label: String) async {
        do {
            let userId = try await SupabaseService.shared.currentUserId
            let dateString = Self.dateFormatter.string(from: date)

            struct UpsertDayLabel: Encodable {
                let user_id: UUID
                let label_date: String
                let label: String
            }

            let entry = UpsertDayLabel(
                user_id: userId,
                label_date: dateString,
                label: label
            )

            if label.isEmpty {
                // Delete label if empty
                try await client
                    .from("day_labels")
                    .delete()
                    .eq("user_id", value: userId.uuidString)
                    .eq("label_date", value: dateString)
                    .execute()
                weeklyDayLabels.removeValue(forKey: dateString)
            } else {
                try await client
                    .from("day_labels")
                    .upsert(entry, onConflict: "user_id,label_date")
                    .execute()
                weeklyDayLabels[dateString] = label
            }
        } catch {
            errorMessage = error.localizedDescription
        }
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
        durationMinutes: Int? = nil,
        caloriesBurned: Int? = nil,
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
                let duration_minutes: Int?
                let calories_burned: Int?
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

    // MARK: - Meals for Selected Date

    private static let mealTypeOrder: [MealPlan.MealType: Int] = [
        .breakfast: 0, .lunch: 1, .dinner: 2, .snack: 3
    ]

    func loadMealsForDate(_ date: Date) async {
        do {
            let userId = try await SupabaseService.shared.currentUserId
            let dateString = Self.dateFormatter.string(from: date)

            let fetched: [MealPlan] = try await client
                .from("meal_plans")
                .select()
                .eq("user_id", value: userId.uuidString)
                .eq("planned_date", value: dateString)
                .execute()
                .value

            mealsForSelectedDate = fetched.sorted {
                (Self.mealTypeOrder[$0.mealType] ?? 4) < (Self.mealTypeOrder[$1.mealType] ?? 4)
            }
        } catch {
            // Don't override workout error messages for meal loading failures
        }
    }

    func deleteMeal(_ meal: MealPlan) async {
        do {
            try await client
                .from("meal_plans")
                .delete()
                .eq("id", value: meal.id.uuidString)
                .execute()
            await loadMealsForDate(selectedDate)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Workout Completion Toggle

    func toggleWorkoutCompletion(_ plan: WorkoutPlan) async {
        let newValue = !plan.isCompleted
        do {
            struct CompletionUpdate: Encodable {
                let is_completed: Bool
            }
            try await client
                .from("workout_plans")
                .update(CompletionUpdate(is_completed: newValue))
                .eq("id", value: plan.id.uuidString)
                .execute()

            // Update local state immediately
            if let index = plansForSelectedDate.firstIndex(where: { $0.id == plan.id }) {
                plansForSelectedDate[index].isCompleted = newValue
            }
            if let index = monthlyPlans.firstIndex(where: { $0.id == plan.id }) {
                monthlyPlans[index].isCompleted = newValue
            }
            if let index = weeklyPlans.firstIndex(where: { $0.id == plan.id }) {
                weeklyPlans[index].isCompleted = newValue
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
