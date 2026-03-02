import Foundation
import HealthKit

@MainActor
class ExerciseViewModel: ObservableObject {
    @Published var logs: [ExerciseLog] = []
    @Published var isLoading = false
    @Published var isSyncing = false
    @Published var errorMessage: String?

    private let client = SupabaseService.shared.client
    private let healthKitService = HealthKitService()

    var totalCaloriesBurnedToday: Int {
        let today = Calendar.current.startOfDay(for: .now)
        return logs
            .filter { Calendar.current.startOfDay(for: $0.loggedAt) == today }
            .reduce(0) { $0 + $1.caloriesBurned }
    }

    func loadLogs() async {
        isLoading = true
        errorMessage = nil
        do {
            let userId = try await SupabaseService.shared.currentUserId

            logs = try await client
                .from("exercise_logs")
                .select()
                .eq("user_id", value: userId.uuidString)
                .order("logged_at", ascending: false)
                .execute()
                .value
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    func logExercise(
        name: String,
        category: ExerciseLog.ExerciseCategory,
        duration: Int,
        caloriesBurned: Int,
        sets: Int? = nil,
        repsPerSet: Int? = nil,
        bodyPart: ExerciseLog.BodyPart? = nil,
        weight: Double? = nil,
        weightUnit: ExerciseLog.WeightUnit? = nil
    ) async {
        errorMessage = nil
        do {
            let userId = try await SupabaseService.shared.currentUserId

            struct NewExerciseLog: Encodable {
                let user_id: UUID
                let exercise_name: String
                let category: String
                let duration_minutes: Int
                let calories_burned: Int
                let sets: Int?
                let reps_per_set: Int?
                let body_part: String?
                let weight: Double?
                let weight_unit: String?
            }

            let entry = NewExerciseLog(
                user_id: userId,
                exercise_name: name,
                category: category.rawValue,
                duration_minutes: duration,
                calories_burned: caloriesBurned,
                sets: sets,
                reps_per_set: repsPerSet,
                body_part: bodyPart?.rawValue,
                weight: weight,
                weight_unit: weightUnit?.rawValue
            )

            try await client.from("exercise_logs").insert(entry).execute()
            await loadLogs()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func updateLog(
        _ log: ExerciseLog,
        name: String,
        category: ExerciseLog.ExerciseCategory,
        duration: Int,
        caloriesBurned: Int,
        sets: Int? = nil,
        repsPerSet: Int? = nil,
        bodyPart: ExerciseLog.BodyPart? = nil,
        weight: Double? = nil,
        weightUnit: ExerciseLog.WeightUnit? = nil
    ) async {
        errorMessage = nil
        do {
            struct ExerciseUpdate: Encodable {
                let exercise_name: String
                let category: String
                let duration_minutes: Int
                let calories_burned: Int
                let sets: Int?
                let reps_per_set: Int?
                let body_part: String?
                let weight: Double?
                let weight_unit: String?
            }

            let update = ExerciseUpdate(
                exercise_name: name,
                category: category.rawValue,
                duration_minutes: duration,
                calories_burned: caloriesBurned,
                sets: sets,
                reps_per_set: repsPerSet,
                body_part: bodyPart?.rawValue,
                weight: weight,
                weight_unit: weightUnit?.rawValue
            )

            try await client
                .from("exercise_logs")
                .update(update)
                .eq("id", value: log.id.uuidString)
                .execute()
            await loadLogs()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func deleteLog(_ log: ExerciseLog) async {
        do {
            try await client
                .from("exercise_logs")
                .delete()
                .eq("id", value: log.id.uuidString)
                .execute()
            await loadLogs()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - HealthKit Sync

    func requestHealthKitAccess() async {
        try? await healthKitService.requestAuthorization()
    }

    func syncFromHealthKit() async {
        isSyncing = true
        errorMessage = nil
        do {
            let userId = try await SupabaseService.shared.currentUserId
            let workouts = try await healthKitService.fetchWorkouts()

            let existingIds = Set(logs.compactMap { $0.healthkitId })

            for workout in workouts {
                let hkId = workout.uuid.uuidString
                guard !existingIds.contains(hkId) else { continue }

                let durationMinutes = Int(workout.duration / 60)
                let caloriesBurned = Int(
                    workout.totalEnergyBurned?.doubleValue(for: .kilocalorie()) ?? 0
                )

                struct HealthKitExerciseInsert: Encodable {
                    let user_id: UUID
                    let exercise_name: String
                    let category: String
                    let duration_minutes: Int
                    let calories_burned: Int
                    let source: String
                    let healthkit_id: String
                    let logged_at: Date
                }

                let entry = HealthKitExerciseInsert(
                    user_id: userId,
                    exercise_name: HealthKitService.displayName(for: workout.workoutActivityType),
                    category: HealthKitService.mapCategory(workout.workoutActivityType).rawValue,
                    duration_minutes: durationMinutes,
                    calories_burned: caloriesBurned,
                    source: "healthkit",
                    healthkit_id: hkId,
                    logged_at: workout.startDate
                )

                try await client.from("exercise_logs").insert(entry).execute()
            }

            await loadLogs()
        } catch {
            errorMessage = error.localizedDescription
        }
        isSyncing = false
    }
}
