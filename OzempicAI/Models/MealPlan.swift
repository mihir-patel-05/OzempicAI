import Foundation

struct MealPlan: Codable, Identifiable {
    let id: UUID
    let userId: UUID
    var name: String
    var plannedDate: String
    var mealType: MealType
    var calories: Int
    let createdAt: String

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

    private static let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    var plannedDateValue: Date? {
        Self.dateFormatter.date(from: plannedDate)
    }
}
