import Foundation

struct ExerciseLog: Codable, Identifiable {
    let id: UUID
    let userId: UUID
    var exerciseName: String
    var category: ExerciseCategory
    var durationMinutes: Int
    var caloriesBurned: Int
    // Strength-only fields (nil for cardio, flexibility, etc.)
    var sets: Int?
    var repsPerSet: Int?
    var bodyPart: BodyPart?
    var weight: Double?
    var weightUnit: WeightUnit?
    var source: Source?
    var healthkitId: String?
    let loggedAt: Date

    enum ExerciseCategory: String, Codable, CaseIterable {
        case cardio, strength, flexibility, sports, other
    }

    enum BodyPart: String, Codable, CaseIterable {
        case chest, back, shoulders, arms, legs, core, fullBody = "full_body"

        var displayName: String {
            switch self {
            case .fullBody: return "Full Body"
            default: return rawValue.capitalized
            }
        }
    }

    enum WeightUnit: String, Codable, CaseIterable {
        case lb, kg
    }

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case exerciseName = "exercise_name"
        case category
        case durationMinutes = "duration_minutes"
        case caloriesBurned = "calories_burned"
        case sets
        case repsPerSet = "reps_per_set"
        case bodyPart = "body_part"
        case weight
        case weightUnit = "weight_unit"
        case loggedAt = "logged_at"
    }
}
