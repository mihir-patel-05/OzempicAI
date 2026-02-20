import Foundation

struct MealPlan: Codable, Identifiable {
    let id: UUID
    let userId: UUID
    var name: String
    var plannedDate: Date
    var mealType: MealType
    var calories: Int
    let createdAt: Date

    enum MealType: String, Codable, CaseIterable {
        case breakfast, lunch, dinner, snack
    }

    enum CodingKeys: String, CodingKey {
        case id, name, calories
        case userId = "user_id"
        case plannedDate = "planned_date"
        case mealType = "meal_type"
        case createdAt = "created_at"
    }
}
