import SwiftUI

struct ExerciseTrackerView: View {
    @StateObject private var viewModel = ExerciseViewModel()
    @State private var showLogExercise = false

    var body: some View {
        NavigationStack {
            List {
                Section("Today") {
                    HStack {
                        Text("Calories Burned")
                        Spacer()
                        Text("\(viewModel.totalCaloriesBurnedToday) cal")
                            .foregroundStyle(.secondary)
                    }
                }

                Section("History") {
                    ForEach(viewModel.logs) { log in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(log.exerciseName).font(.headline)
                            HStack {
                                Text(log.category.rawValue.capitalized)
                                Text("·")
                                Text("\(log.durationMinutes) min")
                                Text("·")
                                Text("\(log.caloriesBurned) cal")
                            }
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        }
                    }
                }
            }
            .navigationTitle("Exercise")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button { showLogExercise = true } label: { Image(systemName: "plus") }
                }
            }
            .sheet(isPresented: $showLogExercise) {
                LogExerciseView(viewModel: viewModel)
            }
            .task { await viewModel.loadLogs() }
        }
    }
}
