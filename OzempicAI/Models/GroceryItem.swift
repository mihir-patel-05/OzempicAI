import Foundation

struct GroceryItem: Codable, Identifiable {
    let id: UUID
    let userId: UUID
    var name: String
    var category: GroceryCategory
    var isPurchased: Bool
    var mealPlanId: UUID?
    let createdAt: Date

    enum GroceryCategory: String, Codable, CaseIterable {
        case produce, dairy, protein, grains, beverages, snacks, other
    }

    enum CodingKeys: String, CodingKey {
        case id, name, category
        case userId = "user_id"
        case isPurchased = "is_purchased"
        case mealPlanId = "meal_plan_id"
        case createdAt = "created_at"
    }
}
