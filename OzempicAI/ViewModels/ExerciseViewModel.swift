import Foundation

@MainActor
class ExerciseViewModel: ObservableObject {
    @Published var logs: [ExerciseLog] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let client = SupabaseService.shared.client

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
        bodyPart: ExerciseLog.BodyPart? = nil
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
            }

            let entry = NewExerciseLog(
                user_id: userId,
                exercise_name: name,
                category: category.rawValue,
                duration_minutes: duration,
                calories_burned: caloriesBurned,
                sets: sets,
                reps_per_set: repsPerSet,
                body_part: bodyPart?.rawValue
            )

            try await client.from("exercise_logs").insert(entry).execute()
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
}
