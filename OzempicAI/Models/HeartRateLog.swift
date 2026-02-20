import Foundation

struct HeartRateLog: Codable, Identifiable {
    let id: UUID
    let userId: UUID
    var bpm: Int
    var source: Source
    let recordedAt: Date

    enum Source: String, Codable {
        case healthkit, manual
    }

    enum CodingKeys: String, CodingKey {
        case id, bpm, source
        case userId = "user_id"
        case recordedAt = "recorded_at"
    }
}
