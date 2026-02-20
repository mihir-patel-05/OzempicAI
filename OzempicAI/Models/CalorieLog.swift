import Foundation

struct CalorieLog: Codable, Identifiable {
    let id: UUID
    let userId: UUID
    var foodName: String
    var calories: Int
    var mealType: MealType
    let loggedAt: Date

    enum MealType: String, Codable, CaseIterable {
        case breakfast, lunch, dinner, snack
    }

    enum CodingKeys: String, CodingKey {
        case id, calories
        case userId = "user_id"
        case foodName = "food_name"
        case mealType = "meal_type"
        case loggedAt = "logged_at"
    }
}
