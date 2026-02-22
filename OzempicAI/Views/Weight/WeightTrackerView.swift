import SwiftUI
import Charts

struct WeightTrackerView: View {
    @StateObject private var viewModel = WeightViewModel()
    @State private var showLogSheet = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: AppSpacing.lg) {

                    // Error banner
                    if let error = viewModel.errorMessage {
                        HStack(spacing: AppSpacing.sm) {
                            Image(systemName: "exclamationmark.triangle.fill")
                            Text(error)
                        }
                        .font(.caption.bold())
                        .foregroundColor(Color.theme.darkNavy)
                        .padding(AppSpacing.sm)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.theme.amber.opacity(0.2))
                        .cornerRadius(AppRadius.small)
                    }

                    // Stats card — only when at least 1 entry
                    if let latest = viewModel.latestWeight {
                        statsCard(latest: latest)
                    }

                    // Chart or placeholder
                    if viewModel.canShowChart {
                        chartCard
                    } else {
                        chartPlaceholder
                    }

                    // Entries list
                    if !viewModel.logs.isEmpty {
                        entriesList
                    }
                }
                .padding(.horizontal)
                .padding(.bottom, AppSpacing.lg)
            }
            .screenBackground()
            .navigationTitle("Weight")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showLogSheet = true
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .foregroundStyle(Color.theme.mediumBlue)
                            .font(.title3)
                    }
                }
            }
            .sheet(isPresented: $showLogSheet) {
                LogWeightView(viewModel: viewModel)
            }
            .task { await viewModel.loadLogs() }
        }
    }

    // MARK: - Stats Card

    private func statsCard(latest: WeightLog) -> some View {
        VStack(spacing: AppSpacing.sm) {
            HStack(alignment: .bottom, spacing: AppSpacing.xs) {
                Image(systemName: "scalemass.fill")
                    .font(.title2)
                    .foregroundStyle(Color.theme.mediumBlue)

                Text(String(format: "%.1f", latest.weightKg))
                    .font(.system(size: 48, weight: .bold, design: .rounded))
                    .foregroundColor(Color.theme.primaryText)

                Text("kg")
                    .font(.title2)
                    .foregroundColor(Color.theme.secondaryText)
                    .padding(.bottom, 6)
            }

            if viewModel.logs.count >= 2 {
                trendRow
            }

            Text("Last logged \(latest.loggedAt.formatted(.relative(presentation: .named)))")
                .font(.caption)
                .foregroundColor(Color.theme.secondaryText)
        }
        .frame(maxWidth: .infinity)
        .cardStyle()
    }

    private var trendRow: some View {
        HStack(spacing: AppSpacing.xs) {
            Image(systemName: trendIcon)
                .foregroundStyle(trendColor)
            Text(trendLabel)
                .font(.subheadline.bold())
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
        case .losing:  return Color.theme.mediumBlue
        case .gaining: return Color.theme.orange
        case .stable:  return Color.theme.secondaryText
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
        VStack(alignment: .leading, spacing: AppSpacing.md) {
            Text("Weight Progress")
                .font(.headline)
                .foregroundColor(Color.theme.primaryText)

            Chart {
                ForEach(viewModel.logs) { log in
                    AreaMark(
                        x: .value("Date", log.loggedAt),
                        y: .value("kg", log.weightKg)
                    )
                    .foregroundStyle(
                        LinearGradient(
                            colors: [Color.theme.mediumBlue.opacity(0.25), Color.theme.mediumBlue.opacity(0.0)],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )

                    LineMark(
                        x: .value("Date", log.loggedAt),
                        y: .value("kg", log.weightKg)
                    )
                    .foregroundStyle(Color.theme.mediumBlue)
                    .lineStyle(StrokeStyle(lineWidth: 2.5))
                    .interpolationMethod(.catmullRom)

                    PointMark(
                        x: .value("Date", log.loggedAt),
                        y: .value("kg", log.weightKg)
                    )
                    .foregroundStyle(Color.theme.mediumBlue)
                    .symbolSize(40)
                }
            }
            .frame(height: 200)
            .chartXAxis {
                AxisMarks(values: .automatic) {
                    AxisValueLabel(format: .dateTime.month(.abbreviated).day())
                        .foregroundStyle(Color.theme.secondaryText)
                    AxisGridLine()
                }
            }
            .chartYAxis {
                AxisMarks {
                    AxisValueLabel()
                        .foregroundStyle(Color.theme.secondaryText)
                    AxisGridLine()
                }
            }
        }
        .cardStyle()
    }

    // MARK: - Chart Placeholder

    private var chartPlaceholder: some View {
        VStack(spacing: AppSpacing.md) {
            Image(systemName: "chart.line.uptrend.xyaxis")
                .font(.system(size: 40))
                .foregroundStyle(Color.theme.mediumBlue.opacity(0.4))

            Text("Log at least 2 weigh-ins to see your progress chart")
                .font(.subheadline)
                .foregroundColor(Color.theme.secondaryText)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, AppSpacing.xl)
        .cardStyle()
    }

    // MARK: - Entries List

    private var entriesList: some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            Text("All Entries")
                .font(.headline)
                .foregroundColor(Color.theme.primaryText)

            // Show newest first
            ForEach(viewModel.logs.reversed()) { log in
                HStack {
                    Image(systemName: "scalemass.fill")
                        .foregroundStyle(Color.theme.mediumBlue)
                        .font(.caption)

                    Text(String(format: "%.1f kg", log.weightKg))
                        .font(.subheadline.bold())
                        .foregroundColor(Color.theme.primaryText)

                    Spacer()

                    Text(log.loggedAt, style: .date)
                        .font(.caption)
                        .foregroundColor(Color.theme.secondaryText)

                    Button {
                        Task { await viewModel.deleteLog(log) }
                    } label: {
                        Image(systemName: "trash")
                            .font(.caption)
                            .foregroundStyle(.red.opacity(0.7))
                    }
                    .buttonStyle(.plain)
                }
                .padding(.vertical, AppSpacing.xs)

                if log.id != viewModel.logs.first?.id {
                    Divider()
                }
            }
        }
        .cardStyle()
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
                VStack(alignment: .leading, spacing: AppSpacing.sm) {
                    Text("Body Weight (kg)")
                        .font(.subheadline.bold())
                        .foregroundColor(Color.theme.secondaryText)

                    TextField("e.g. 75.5", text: $weightText)
                        .keyboardType(.decimalPad)
                        .textFieldStyle(ThemedTextFieldStyle())
                        .focused($isFocused)
                }

                Button("Log Weight") {
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
            .navigationTitle("Log Weight")
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
