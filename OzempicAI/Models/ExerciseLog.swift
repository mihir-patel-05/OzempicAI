import Foundation

struct ExerciseLog: Codable, Identifiable {
    let id: UUID
    let userId: UUID
    var exerciseName: String
    var category: ExerciseCategory
    var durationMinutes: Int
    var caloriesBurned: Int
    let loggedAt: Date

    enum ExerciseCategory: String, Codable, CaseIterable {
        case cardio, strength, flexibility, sports, other
    }

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case exerciseName = "exercise_name"
        case category
        case durationMinutes = "duration_minutes"
        case caloriesBurned = "calories_burned"
        case loggedAt = "logged_at"
    }
}
