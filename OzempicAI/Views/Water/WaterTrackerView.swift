import SwiftUI

struct WaterTrackerView: View {
    @StateObject private var viewModel = WaterViewModel()

    let quickAddOptions = [240, 360, 480, 600]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: AppSpacing.lg) {
                    // Wave visualization
                    WaterWaveView(progress: viewModel.progressFraction)
                        .frame(width: 200, height: 280)
                        .overlay(
                            VStack(spacing: AppSpacing.xs) {
                                Image(systemName: "drop.fill")
                                    .font(.title2)
                                    .foregroundStyle(.white.opacity(0.8))

                                Text("\(viewModel.totalMlToday)")
                                    .font(.system(size: 40, weight: .bold, design: .rounded))
                                    .foregroundColor(.white)

                                Text("/ \(viewModel.dailyGoalMl) ml")
                                    .font(.subheadline)
                                    .foregroundColor(.white.opacity(0.8))
                            }
                        )
                        .padding(.top, AppSpacing.xl)

                    // Percentage
                    Text("\(Int(viewModel.progressFraction * 100))% of daily goal")
                        .font(.title3.bold())
                        .foregroundColor(Color.theme.mediumBlue)

                    // Quick add buttons
                    HStack(spacing: 12) {
                        ForEach(quickAddOptions, id: \.self) { ml in
                            Button {
                                Task { await viewModel.logWater(amountMl: ml) }
                            } label: {
                                VStack(spacing: 4) {
                                    Image(systemName: "drop.fill")
                                        .font(.caption)
                                    Text("+\(ml)")
                                        .font(.caption.bold())
                                    Text("ml")
                                        .font(.caption2)
                                }
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 12)
                                .background(Color.theme.mediumBlue)
                                .clipShape(RoundedRectangle(cornerRadius: AppRadius.medium))
                            }
                        }
                    }
                    .padding(.horizontal)

                    Spacer().frame(height: AppSpacing.lg)
                }
                .padding(.horizontal)
            }
            .screenBackground()
            .navigationTitle("Water")
            .task { await viewModel.loadTodaysLogs() }
        }
    }
}
