import Foundation

@MainActor
class HeartRateViewModel: ObservableObject {
    @Published var logs: [HeartRateLog] = []
    @Published var restingHeartRate: Double?
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let client = SupabaseService.shared.client
    private let healthKitService = HealthKitService()

    func requestHealthKitAccess() async {
        try? await healthKitService.requestAuthorization()
    }

    func fetchFromHealthKit() async {
        restingHeartRate = try? await healthKitService.fetchRestingHeartRate()
    }

    func loadLogs() async {
        isLoading = true
        errorMessage = nil
        do {
            let userId = try await SupabaseService.shared.currentUserId

            logs = try await client
                .from("heart_rate_logs")
                .select()
                .eq("user_id", value: userId.uuidString)
                .order("recorded_at", ascending: false)
                .execute()
                .value
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    func logManualReading(bpm: Int) async {
        do {
            let userId = try await SupabaseService.shared.currentUserId

            struct NewHeartRateLog: Encodable {
                let user_id: UUID
                let bpm: Int
                let source: String
            }

            let entry = NewHeartRateLog(user_id: userId, bpm: bpm, source: "manual")
            try await client.from("heart_rate_logs").insert(entry).execute()
            await loadLogs()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
