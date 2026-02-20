import SwiftUI

struct WaterTrackerView: View {
    @StateObject private var viewModel = WaterViewModel()

    let quickAddOptions = [240, 360, 480, 600]

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                Gauge(value: viewModel.progressFraction) {
                    Text("Water")
                } currentValueLabel: {
                    Text("\(viewModel.totalMlToday) ml")
                }
                .gaugeStyle(.accessoryCircularCapacity)
                .scaleEffect(2)
                .padding(.top, 40)

                Text("Goal: \(viewModel.dailyGoalMl) ml")
                    .foregroundStyle(.secondary)

                HStack(spacing: 12) {
                    ForEach(quickAddOptions, id: \.self) { ml in
                        Button("+\(ml)ml") {
                            Task { await viewModel.logWater(amountMl: ml) }
                        }
                        .buttonStyle(.bordered)
                    }
                }

                Spacer()
            }
            .navigationTitle("Water")
            .task { await viewModel.loadTodaysLogs() }
        }
    }
}
