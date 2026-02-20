import Foundation

struct WaterLog: Codable, Identifiable {
    let id: UUID
    let userId: UUID
    var amountMl: Int
    let loggedAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case amountMl = "amount_ml"
        case loggedAt = "logged_at"
    }
}
