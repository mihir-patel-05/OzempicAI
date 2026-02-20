import Foundation

@MainActor
class HeartRateViewModel: ObservableObject {
    @Published var logs: [HeartRateLog] = []
    @Published var restingHeartRate: Double?
    @Published var isLoading = false

    private let healthKitService = HealthKitService()

    func requestHealthKitAccess() async {
        try? await healthKitService.requestAuthorization()
    }

    func fetchFromHealthKit() async {
        restingHeartRate = try? await healthKitService.fetchRestingHeartRate()
    }

    func loadLogs() async {
        // TODO: fetch from Supabase
    }

    func logManualReading(bpm: Int) async {
        // TODO: insert into Supabase
    }
}
