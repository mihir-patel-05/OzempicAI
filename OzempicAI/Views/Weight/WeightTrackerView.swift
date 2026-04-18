import SwiftUI
import Charts

struct WeightTrackerView: View {
    @EnvironmentObject var viewModel: WeightViewModel
    @State private var showLogSheet = false

    var body: some View {
        ScrollView {
            VStack(spacing: AppSpacing.md) {
                ScreenHeader(title: "Weight", subtitle: "Body") {
                    showLogSheet = true
                }

                if let error = viewModel.errorMessage {
                    errorBanner(error)
                        .padding(.horizontal, AppSpacing.md + 4)
                }

                if let latest = viewModel.latestWeight {
                    statsCard(latest: latest)
                } else {
                    emptyStatsCard
                }

                if viewModel.canShowChart {
                    chartCard
                } else {
                    chartPlaceholder
                }

                if !viewModel.logs.isEmpty {
                    entriesList
                }

                Spacer(minLength: 40)
            }
            .padding(.bottom, 100)
        }
        .screenBackground()
        .sheet(isPresented: $showLogSheet) {
            LogWeightView(viewModel: viewModel)
        }
        .task { await viewModel.loadLogs() }
    }

    // MARK: - Stats card

    private func statsCard(latest: WeightLog) -> some View {
        VStack(spacing: 10) {
            HStack(alignment: .lastTextBaseline, spacing: 6) {
                Text(String(format: "%.1f", latest.weightKg))
                    .font(AppFont.display(56, weight: .regular))
                    .foregroundColor(Color.theme.espresso)
                    .kerning(-1.2)
                Text("kg")
                    .font(AppFont.ui(16, weight: .medium))
                    .foregroundColor(Color.theme.coffee)
                    .padding(.bottom, 4)
            }
            if viewModel.logs.count >= 2 {
                trendRow
            }
            Text("Last logged \(latest.loggedAt.formatted(.relative(presentation: .named)))")
                .font(AppFont.ui(12))
                .foregroundColor(Color.theme.dust)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, AppSpacing.lg)
        .background(Color.theme.paper)
        .cornerRadius(AppRadius.large)
        .shadow(color: Color.theme.shadow, radius: 10, x: 0, y: 2)
        .padding(.horizontal, AppSpacing.md + 4)
    }

    private var emptyStatsCard: some View {
        VStack(spacing: 10) {
            Image(systemName: "scalemass.fill")
                .font(.system(size: 32))
                .foregroundColor(Color.theme.dust)
            Text("No weigh-ins yet")
                .font(AppFont.display(18, weight: .medium))
                .foregroundColor(Color.theme.espresso)
            Text("Tap + to log your first.")
                .font(AppFont.ui(13))
                .foregroundColor(Color.theme.coffee)
        }
        .padding(.vertical, AppSpacing.xl)
        .frame(maxWidth: .infinity)
        .background(Color.theme.paper)
        .cornerRadius(AppRadius.large)
        .shadow(color: Color.theme.shadow, radius: 10, x: 0, y: 2)
        .padding(.horizontal, AppSpacing.md + 4)
    }

    private var trendRow: some View {
        HStack(spacing: 6) {
            Image(systemName: trendIcon).foregroundColor(trendColor)
            Text(trendLabel)
                .font(AppFont.ui(13, weight: .semibold))
                .foregroundColor(trendColor)
        }
    }

    private var trendIcon: String {
        switch viewModel.trend {
        case .losing:  return "arrow.down.circle.fill"
        case .gaining: return "arrow.up.circle.fill"
        case .stable:  return "minus.circle.fill"
        }
    }

    private var trendColor: Color {
        switch viewModel.trend {
        case .losing:  return Color.theme.sageDeep
        case .gaining: return Color.theme.ember
        case .stable:  return Color.theme.coffee
        }
    }

    private var trendLabel: String {
        let delta = abs(viewModel.trendDelta)
        switch viewModel.trend {
        case .losing:  return String(format: "−%.1f kg from last entry", delta)
        case .gaining: return String(format: "+%.1f kg from last entry", delta)
        case .stable:  return "Stable since last entry"
        }
    }

    // MARK: - Chart

    private var chartCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline) {
                Text("Progress")
                    .font(AppFont.display(20, weight: .medium))
                    .foregroundColor(Color.theme.espresso)
                Spacer()
                CapsLabel(text: "\(viewModel.logs.count) entries")
            }

            Chart {
                ForEach(viewModel.logs) { log in
                    AreaMark(
                        x: .value("Date", log.loggedAt),
                        y: .value("kg", log.weightKg)
                    )
                    .foregroundStyle(
                        LinearGradient(
                            colors: [Color.theme.terracotta.opacity(0.28), Color.theme.terracotta.opacity(0)],
                            startPoint: .top, endPoint: .bottom
                        )
                    )

                    LineMark(
                        x: .value("Date", log.loggedAt),
                        y: .value("kg", log.weightKg)
                    )
                    .foregroundStyle(Color.theme.terracotta)
                    .lineStyle(StrokeStyle(lineWidth: 2.5))
                    .interpolationMethod(.catmullRom)

                    PointMark(
                        x: .value("Date", log.loggedAt),
                        y: .value("kg", log.weightKg)
                    )
                    .foregroundStyle(Color.theme.terracotta)
                    .symbolSize(40)
                }
            }
            .frame(height: 200)
            .chartXAxis {
                AxisMarks(values: .automatic) {
                    AxisValueLabel(format: .dateTime.month(.abbreviated).day())
                        .foregroundStyle(Color.theme.coffee)
                    AxisGridLine().foregroundStyle(Color.theme.divider)
                }
            }
            .chartYAxis {
                AxisMarks {
                    AxisValueLabel().foregroundStyle(Color.theme.coffee)
                    AxisGridLine().foregroundStyle(Color.theme.divider)
                }
            }
        }
        .padding(AppSpacing.md)
        .background(Color.theme.paper)
        .cornerRadius(AppRadius.large)
        .shadow(color: Color.theme.shadow, radius: 10, x: 0, y: 2)
        .padding(.horizontal, AppSpacing.md + 4)
    }

    private var chartPlaceholder: some View {
        VStack(spacing: 10) {
            Image(systemName: "chart.line.uptrend.xyaxis")
                .font(.system(size: 36))
                .foregroundColor(Color.theme.dust)
            Text("Log at least 2 weigh-ins to see your trend")
                .font(AppFont.ui(13))
                .foregroundColor(Color.theme.coffee)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, AppSpacing.xl)
        .background(Color.theme.paper)
        .cornerRadius(AppRadius.large)
        .shadow(color: Color.theme.shadow, radius: 10, x: 0, y: 2)
        .padding(.horizontal, AppSpacing.md + 4)
    }

    // MARK: - Entries list

    private var entriesList: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("All entries")
                .font(AppFont.display(20, weight: .medium))
                .foregroundColor(Color.theme.espresso)
                .padding(.horizontal, 4)

            VStack(spacing: 0) {
                let reversed = Array(viewModel.logs.reversed())
                ForEach(Array(reversed.enumerated()), id: \.element.id) { idx, log in
                    HStack(spacing: 12) {
                        ZStack {
                            Circle().fill(Color.theme.terracotta.opacity(0.12))
                            Image(systemName: "scalemass.fill")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundColor(Color.theme.terracotta)
                        }
                        .frame(width: 32, height: 32)
                        Text(String(format: "%.1f kg", log.weightKg))
                            .font(AppFont.ui(14, weight: .semibold))
                            .foregroundColor(Color.theme.espresso)
                        Spacer()
                        Text(log.loggedAt, style: .date)
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
                    if idx < reversed.count - 1 {
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

// MARK: - Log Weight Sheet

struct LogWeightView: View {
    @ObservedObject var viewModel: WeightViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var weightText = ""
    @FocusState private var isFocused: Bool

    var body: some View {
        NavigationStack {
            VStack(spacing: AppSpacing.lg) {
                VStack(alignment: .leading, spacing: 8) {
                    CapsLabel(text: "Body weight (kg)")
                    TextField("e.g. 75.5", text: $weightText)
                        .keyboardType(.decimalPad)
                        .textFieldStyle(ThemedTextFieldStyle())
                        .focused($isFocused)
                }

                Button("Log weight") {
                    guard let kg = Double(weightText), kg > 0 else { return }
                    Task {
                        await viewModel.logWeight(kg)
                        dismiss()
                    }
                }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(Double(weightText) == nil)

                Spacer()
            }
            .padding()
            .screenBackground()
            .navigationTitle("Log weight")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            .onAppear { isFocused = true }
        }
    }
}
