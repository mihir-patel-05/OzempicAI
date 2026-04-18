import SwiftUI

struct WaterTrackerView: View {
    @EnvironmentObject var viewModel: WaterViewModel

    private let quickAddOptions = [240, 360, 480, 600]

    private var liters: String {
        String(format: "%.2fL", Double(viewModel.totalMlToday) / 1000.0)
    }

    private var goalLiters: String {
        String(format: "%.1fL", Double(viewModel.dailyGoalMl) / 1000.0)
    }

    var body: some View {
        ScrollView {
            VStack(spacing: AppSpacing.md) {
                ScreenHeader(title: "Water", subtitle: "Hydration")

                if let error = viewModel.errorMessage {
                    errorBanner(error)
                        .padding(.horizontal, AppSpacing.md + 4)
                }

                heroCard
                quickAdd
                if !viewModel.todaysLogs.isEmpty { historySection }
                Spacer(minLength: 40)
            }
            .padding(.bottom, 100)
        }
        .screenBackground()
        .task {
            if viewModel.todaysLogs.isEmpty {
                await viewModel.loadTodaysLogs()
            }
        }
        .refreshable { await viewModel.loadTodaysLogs() }
    }

    // MARK: - Hero

    private var heroCard: some View {
        VStack(spacing: AppSpacing.md) {
            ZStack {
                ProgressRing(
                    progress: viewModel.progressFraction,
                    size: 220,
                    lineWidth: 16,
                    gradient: [Color.theme.sage, Color.theme.sageDeep]
                )
                VStack(spacing: 4) {
                    Image(systemName: "drop.fill")
                        .font(.system(size: 22))
                        .foregroundColor(Color.theme.sageDeep)
                    Text(liters)
                        .font(AppFont.display(44, weight: .regular))
                        .foregroundColor(Color.theme.espresso)
                        .kerning(-0.8)
                    Text("of \(goalLiters)")
                        .font(AppFont.ui(13))
                        .foregroundColor(Color.theme.coffee)
                }
            }
            Text("\(Int(viewModel.progressFraction * 100))% of daily goal")
                .font(AppFont.display(15, weight: .regular, italic: true))
                .foregroundColor(Color.theme.sageDeep)
        }
        .padding(.vertical, AppSpacing.lg)
        .frame(maxWidth: .infinity)
        .background(Color.theme.paper)
        .cornerRadius(AppRadius.large)
        .shadow(color: Color.theme.shadow, radius: 10, x: 0, y: 2)
        .padding(.horizontal, AppSpacing.md + 4)
    }

    // MARK: - Quick add

    private var quickAdd: some View {
        VStack(alignment: .leading, spacing: 12) {
            CapsLabel(text: "Log a glass")
                .padding(.horizontal, 4)
            HStack(spacing: 10) {
                ForEach(quickAddOptions, id: \.self) { ml in
                    Button {
                        Task { await viewModel.logWater(amountMl: ml) }
                    } label: {
                        VStack(spacing: 4) {
                            Image(systemName: "plus")
                                .font(.system(size: 11, weight: .bold))
                            Text("\(ml)")
                                .font(AppFont.display(18, weight: .medium))
                            Text("ml")
                                .font(.system(size: 10, weight: .medium))
                                .foregroundColor(Color.theme.sageDeep.opacity(0.7))
                        }
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(
                            LinearGradient(
                                colors: [Color.theme.sage, Color.theme.sageDeep],
                                startPoint: .topLeading, endPoint: .bottomTrailing
                            )
                        )
                        .cornerRadius(AppRadius.medium)
                        .shadow(color: Color.theme.sage.opacity(0.3), radius: 8, x: 0, y: 3)
                    }
                }
            }
        }
        .padding(.horizontal, AppSpacing.md + 4)
    }

    // MARK: - History

    private var historySection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                Text("Today's entries")
                    .font(AppFont.display(20, weight: .medium))
                    .foregroundColor(Color.theme.espresso)
                Spacer()
                Text("\(viewModel.todaysLogs.count)")
                    .font(AppFont.ui(12, weight: .semibold))
                    .foregroundColor(Color.theme.coffee)
            }
            .padding(.horizontal, 4)

            VStack(spacing: 0) {
                ForEach(Array(viewModel.todaysLogs.enumerated()), id: \.element.id) { idx, log in
                    HStack(spacing: 14) {
                        ZStack {
                            Circle().fill(Color.theme.sage.opacity(0.15))
                            Image(systemName: "drop.fill")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundColor(Color.theme.sageDeep)
                        }
                        .frame(width: 32, height: 32)
                        Text("\(log.amountMl) ml")
                            .font(AppFont.ui(14, weight: .medium))
                            .foregroundColor(Color.theme.espresso)
                        Spacer()
                        Text(log.loggedAt, style: .time)
                            .font(AppFont.ui(12))
                            .foregroundColor(Color.theme.dust)
                        Button {
                            Task { await viewModel.deleteLog(log) }
                        } label: {
                            Image(systemName: "trash")
                                .font(.system(size: 11))
                                .foregroundColor(Color.theme.ember.opacity(0.8))
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(.horizontal, AppSpacing.md)
                    .padding(.vertical, 12)
                    if idx < viewModel.todaysLogs.count - 1 {
                        Divider().background(Color.theme.divider).padding(.leading, 60)
                    }
                }
            }
            .background(Color.theme.paper)
            .cornerRadius(AppRadius.large)
            .shadow(color: Color.theme.shadow, radius: 8, x: 0, y: 2)
        }
        .padding(.horizontal, AppSpacing.md + 4)
    }

    private func errorBanner(_ text: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundColor(Color.theme.ember)
            Text(text)
                .font(AppFont.ui(13, weight: .medium))
                .foregroundColor(Color.theme.espresso)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.theme.ember.opacity(0.12))
        .cornerRadius(AppRadius.small)
    }
}
