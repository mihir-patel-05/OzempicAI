import Foundation

struct User: Codable, Identifiable {
    let id: UUID
    var email: String
    var name: String
    var heightCm: Double?
    var weightKg: Double?
    var age: Int?
    var dailyCalorieGoal: Int
    var dailyWaterGoalMl: Int
    let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id, email, name, age
        case heightCm = "height_cm"
        case weightKg = "weight_kg"
        case dailyCalorieGoal = "daily_calorie_goal"
        case dailyWaterGoalMl = "daily_water_goal_ml"
        case createdAt = "created_at"
    }
}
