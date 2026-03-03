import Foundation

struct DayLabel: Codable, Identifiable {
    let id: UUID
    let userId: UUID
    var labelDate: String
    var label: String
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id, label
        case userId = "user_id"
        case labelDate = "label_date"
        case createdAt = "created_at"
    }
}
