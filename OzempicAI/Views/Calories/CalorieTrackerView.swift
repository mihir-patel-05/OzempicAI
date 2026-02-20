import SwiftUI

struct CalorieTrackerView: View {
    @StateObject private var viewModel = CalorieViewModel()
    @State private var showLogMeal = false

    var body: some View {
        NavigationStack {
            List {
                Section("Today's Summary") {
                    HStack {
                        Text("Consumed")
                        Spacer()
                        Text("\(viewModel.totalCaloriesToday) / \(viewModel.dailyGoal) cal")
                            .foregroundStyle(.secondary)
                    }
                    ProgressView(value: Double(viewModel.totalCaloriesToday), total: Double(viewModel.dailyGoal))
                        .tint(.orange)
                }

                ForEach(CalorieLog.MealType.allCases, id: \.self) { mealType in
                    let logs = viewModel.logsByMeal[mealType] ?? []
                    if !logs.isEmpty {
                        Section(mealType.rawValue.capitalized) {
                            ForEach(logs) { log in
                                HStack {
                                    Text(log.foodName)
                                    Spacer()
                                    Text("\(log.calories) cal")
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle("Calories")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button { showLogMeal = true } label: { Image(systemName: "plus") }
                }
            }
            .sheet(isPresented: $showLogMeal) {
                LogMealView(viewModel: viewModel)
            }
            .task { await viewModel.loadTodaysLogs() }
        }
    }
}
