import Foundation

@MainActor
class WaterViewModel: ObservableObject {
    @Published var todaysLogs: [WaterLog] = []
    @Published var dailyGoalMl: Int = Constants.Health.defaultWaterGoalMl
    @Published var weekHistory: [WaterLog] = []
    @Published var isLoading = false

    var totalMlToday: Int {
        todaysLogs.reduce(0) { $0 + $1.amountMl }
    }

    var progressFraction: Double {
        min(Double(totalMlToday) / Double(dailyGoalMl), 1.0)
    }

    func loadTodaysLogs() async {
        // TODO: fetch from Supabase
    }

    func logWater(amountMl: Int) async {
        // TODO: insert into Supabase
    }

    func loadWeekHistory() async {
        // TODO: fetch past 7 days from Supabase
    }
}
