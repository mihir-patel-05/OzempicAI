import Foundation

@MainActor
class ExerciseViewModel: ObservableObject {
    @Published var logs: [ExerciseLog] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    var totalCaloriesBurnedToday: Int {
        let today = Calendar.current.startOfDay(for: .now)
        return logs
            .filter { Calendar.current.startOfDay(for: $0.loggedAt) == today }
            .reduce(0) { $0 + $1.caloriesBurned }
    }

    func loadLogs() async {
        // TODO: fetch from Supabase
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
        // TODO: insert into Supabase
    }

    func deleteLog(_ log: ExerciseLog) async {
        // TODO: delete from Supabase
    }
}
