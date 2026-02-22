import Foundation

enum WeightTrend {
    case gaining, losing, stable
}

@MainActor
class WeightViewModel: ObservableObject {

    @Published var logs: [WeightLog] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let client = SupabaseService.shared.client

    // MARK: - Computed

    var canShowChart: Bool { logs.count >= 2 }

    var latestWeight: WeightLog? { logs.last }

    var trend: WeightTrend {
        guard logs.count >= 2 else { return .stable }
        let delta = logs[logs.count - 1].weightKg - logs[logs.count - 2].weightKg
        if delta > 0.05  { return .gaining }
        if delta < -0.05 { return .losing }
        return .stable
    }

    var trendDelta: Double {
        guard logs.count >= 2 else { return 0 }
        return logs[logs.count - 1].weightKg - logs[logs.count - 2].weightKg
    }

    // MARK: - Methods

    func loadLogs() async {
        isLoading = true
        errorMessage = nil
        do {
            let userId = try await SupabaseService.shared.currentUserId

            logs = try await client
                .from("weight_logs")
                .select()
                .eq("user_id", value: userId.uuidString)
                .order("logged_at", ascending: true)
                .execute()
                .value
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    func logWeight(_ kg: Double) async {
        errorMessage = nil
        do {
            let userId = try await SupabaseService.shared.currentUserId

            struct NewWeightLog: Encodable {
                let user_id: UUID
                let weight_kg: Double
            }

            let entry = NewWeightLog(user_id: userId, weight_kg: kg)
            try await client.from("weight_logs").insert(entry).execute()
            await loadLogs()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func deleteLog(_ log: WeightLog) async {
        do {
            try await client
                .from("weight_logs")
                .delete()
                .eq("id", value: log.id.uuidString)
                .execute()
            await loadLogs()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
