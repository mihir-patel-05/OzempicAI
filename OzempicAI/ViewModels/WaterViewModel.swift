import Foundation

@MainActor
class WaterViewModel: ObservableObject {
    @Published var todaysLogs: [WaterLog] = []
    @Published var dailyGoalMl: Int = Constants.Health.defaultWaterGoalMl
    @Published var weekHistory: [WaterLog] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let client = SupabaseService.shared.client

    var totalMlToday: Int {
        todaysLogs.reduce(0) { $0 + $1.amountMl }
    }

    var progressFraction: Double {
        min(Double(totalMlToday) / Double(dailyGoalMl), 1.0)
    }

    func loadTodaysLogs() async {
        isLoading = true
        errorMessage = nil
        do {
            let userId = try await SupabaseService.shared.currentUserId
            let startOfDay = Calendar.current.startOfDay(for: .now)

            todaysLogs = try await client
                .from("water_logs")
                .select()
                .eq("user_id", value: userId.uuidString)
                .gte("logged_at", value: startOfDay.ISO8601Format())
                .order("logged_at", ascending: false)
                .execute()
                .value
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    func logWater(amountMl: Int) async {
        errorMessage = nil
        do {
            let userId = try await SupabaseService.shared.currentUserId

            struct NewWaterLog: Encodable {
                let user_id: UUID
                let amount_ml: Int
            }

            let entry = NewWaterLog(user_id: userId, amount_ml: amountMl)
            try await client.from("water_logs").insert(entry).execute()
            await loadTodaysLogs()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func loadWeekHistory() async {
        do {
            let userId = try await SupabaseService.shared.currentUserId
            let sevenDaysAgo = Calendar.current.date(byAdding: .day, value: -7, to: .now)!

            weekHistory = try await client
                .from("water_logs")
                .select()
                .eq("user_id", value: userId.uuidString)
                .gte("logged_at", value: sevenDaysAgo.ISO8601Format())
                .order("logged_at", ascending: false)
                .execute()
                .value
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
