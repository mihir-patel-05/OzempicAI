import Foundation

struct WorkoutPlan: Codable, Identifiable {
    let id: UUID
    let userId: UUID
    var exerciseName: String
    var category: ExerciseLog.ExerciseCategory
    var plannedDate: String
    var durationMinutes: Int?
    var caloriesBurned: Int?
    var sets: Int?
    var repsPerSet: Int?
    var bodyPart: ExerciseLog.BodyPart?
    var weight: Double?
    var weightUnit: ExerciseLog.WeightUnit?
    var notes: String?
    var isCompleted: Bool
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id, category, sets, weight, notes
        case userId = "user_id"
        case exerciseName = "exercise_name"
        case plannedDate = "planned_date"
        case durationMinutes = "duration_minutes"
        case caloriesBurned = "calories_burned"
        case repsPerSet = "reps_per_set"
        case bodyPart = "body_part"
        case weightUnit = "weight_unit"
        case isCompleted = "is_completed"
        case createdAt = "created_at"
    }

    private static let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    var plannedDateValue: Date? {
        Self.dateFormatter.date(from: plannedDate)
    }
}
