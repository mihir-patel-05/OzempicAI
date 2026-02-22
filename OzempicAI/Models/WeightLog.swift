import Foundation

struct WeightLog: Codable, Identifiable {
    let id: UUID
    let userId: UUID
    var weightKg: Double
    let loggedAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case userId   = "user_id"
        case weightKg = "weight_kg"
        case loggedAt = "logged_at"
    }
}
