import SwiftUI
import Charts

struct MacWeightView: View {
    @StateObject private var viewModel = WeightViewModel()
    @State private var newWeight = ""
    @State private var timeRange: TimeRange = .thirtyDays

    enum TimeRange: String, CaseIterable {
        case thirtyDays = "30 Days"
        case ninetyDays = "90 Days"
        case oneYear = "1 Year"

        var days: Int {
            switch self {
            case .thirtyDays: return 30
            case .ninetyDays: return 90
            case .oneYear:    return 365
            }
        }
    }

    private var filteredLogs: [WeightLog] {
        let cutoff = Calendar.current.date(byAdding: .day, value: -timeRange.days, to: .now)!
        return viewModel.logs.filter { $0.loggedAt >= cutoff }
    }

    private var trendIcon: String {
        switch viewModel.trend {
        case .gaining: return "arrow.up.right"
        case .losing:  return "arrow.down.right"
        case .stable:  return "arrow.right"
        }
    }

    private var trendColor: Color {
        switch viewModel.trend {
        case .gaining: return Color.theme.orange
        case .losing:  return .green
        case .stable:  return Color.theme.mediumBlue
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("Weight Tracker")
                    .font(.title2)
                    .fontWeight(.bold)

                if let latest = viewModel.latestWeight {
                    Text(String(format: "%.1f kg", latest.weightKg))
                        .font(.title3)
                        .foregroundColor(.secondary)

                    Image(systemName: trendIcon)
                        .foregroundColor(trendColor)

                    if viewModel.trendDelta != 0 {
                        Text(String(format: "%+.1f kg", viewModel.trendDelta))
                            .font(.caption)
                            .foregroundColor(trendColor)
                    }
                }

                Spacer()

                Picker("Range", selection: $timeRange) {
                    ForEach(TimeRange.allCases, id: \.self) { range in
                        Text(range.rawValue).tag(range)
                    }
                }
                .pickerStyle(.segmented)
                .frame(width: 240)
            }
            .padding()

            Divider()

            ScrollView {
                VStack(spacing: 20) {
                    // Chart
                    if filteredLogs.count >= 2 {
                        Chart(filteredLogs) { log in
                            LineMark(
                                x: .value("Date", log.loggedAt),
                                y: .value("Weight", log.weightKg)
                            )
                            .foregroundStyle(Color.theme.mediumBlue)
                            .interpolationMethod(.catmullRom)

                            PointMark(
                                x: .value("Date", log.loggedAt),
                                y: .value("Weight", log.weightKg)
                            )
                            .foregroundStyle(Color.theme.mediumBlue)
                            .symbolSize(30)
                        }
                        .chartYScale(domain: .automatic(includesZero: false))
                        .frame(height: 250)
                        .padding()
                        .cardStyle()
                    } else {
                        Text("Log at least 2 weights to see the chart")
                            .foregroundColor(.secondary)
                            .padding(.vertical, 40)
                    }

                    // Bottom: Table + Quick add
                    HStack(alignment: .top, spacing: 16) {
                        // Table
                        VStack(alignment: .leading, spacing: 8) {
                            Text("History")
                                .font(.headline)

                            Table(filteredLogs) {
                                TableColumn("Date") { log in
                                    Text(log.loggedAt.formatted(.dateTime.month(.abbreviated).day().year()))
                                }
                                TableColumn("Weight (kg)") { log in
                                    Text(String(format: "%.1f", log.weightKg))
                                }
                                TableColumn("") { log in
                                    Button(role: .destructive) {
                                        Task { await viewModel.deleteLog(log) }
                                    } label: {
                                        Image(systemName: "trash")
                                            .foregroundColor(.red.opacity(0.7))
                                    }
                                    .buttonStyle(.plain)
                                }
                                .width(40)
                            }
                            .frame(minHeight: 200)
                        }
                        .frame(maxWidth: .infinity)

                        // Quick add
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Log Weight")
                                .font(.headline)

                            TextField("Weight (kg)", text: $newWeight)
                                .textFieldStyle(.roundedBorder)
                                .onSubmit { logWeight() }

                            Button("Log Weight") {
                                logWeight()
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(Color.theme.ctaButton)
                            .disabled(newWeight.isEmpty)
                        }
                        .padding()
                        .cardStyle()
                        .frame(width: 220)
                    }
                    .padding(.horizontal)
                }
                .padding(.bottom)
            }
        }
        .screenBackground()
        .task {
            await viewModel.loadLogs()
        }
    }

    private func logWeight() {
        guard let kg = Double(newWeight) else { return }
        newWeight = ""
        Task { await viewModel.logWeight(kg) }
    }
}
