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
        case .gaining: return Color.theme.ember
        case .losing:  return Color.theme.sageDeep
        case .stable:  return Color.theme.coffee
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                HStack(alignment: .bottom) {
                    MacPageHeader(title: "Weight", subtitle: "Trend", actionTitle: nil)
                    Spacer()
                    if let latest = viewModel.latestWeight {
                        HStack(spacing: 8) {
                            Text(String(format: "%.1f kg", latest.weightKg))
                                .font(.fraunces(20, weight: .medium))
                                .foregroundColor(Color.theme.espresso)
                            Image(systemName: trendIcon).foregroundColor(trendColor)
                            if viewModel.trendDelta != 0 {
                                Text(String(format: "%+.1f kg", viewModel.trendDelta))
                                    .font(.inter(11, weight: .semibold))
                                    .foregroundColor(trendColor)
                            }
                        }
                    }
                    Picker("Range", selection: $timeRange) {
                        ForEach(TimeRange.allCases, id: \.self) { range in
                            Text(range.rawValue).tag(range)
                        }
                    }
                    .pickerStyle(.segmented)
                    .frame(width: 240)
                }

                if filteredLogs.count >= 2 {
                    MacCard {
                        Chart(filteredLogs) { log in
                            LineMark(
                                x: .value("Date", log.loggedAt),
                                y: .value("Weight", log.weightKg)
                            )
                            .foregroundStyle(Color.theme.terracotta)
                            .interpolationMethod(.catmullRom)

                            PointMark(
                                x: .value("Date", log.loggedAt),
                                y: .value("Weight", log.weightKg)
                            )
                            .foregroundStyle(Color.theme.terracotta)
                            .symbolSize(30)
                        }
                        .chartYScale(domain: .automatic(includesZero: false))
                        .frame(height: 250)
                    }
                } else {
                    MacCard {
                        Text("Log at least 2 weights to see the chart")
                            .font(.inter(13))
                            .foregroundColor(Color.theme.dust)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 28)
                    }
                }

                HStack(alignment: .top, spacing: 16) {
                    MacCard {
                        VStack(alignment: .leading, spacing: 8) {
                            MacSectionTitle(text: "History")
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
                                            .foregroundColor(Color.theme.ember.opacity(0.75))
                                    }
                                    .buttonStyle(.plain)
                                }
                                .width(40)
                            }
                            .frame(minHeight: 200)
                        }
                    }
                    .frame(maxWidth: .infinity)

                    MacCard {
                        VStack(alignment: .leading, spacing: 12) {
                            MacSectionTitle(text: "Log weight")
                            TextField("Weight (kg)", text: $newWeight)
                                .textFieldStyle(.roundedBorder)
                                .onSubmit { logWeight() }
                            Button("Log weight") { logWeight() }
                                .buttonStyle(.borderedProminent)
                                .tint(Color.theme.terracotta)
                                .disabled(newWeight.isEmpty)
                        }
                    }
                    .frame(width: 240)
                }
            }
            .padding(32)
        }
        .background(Color.theme.cream)
        .task { await viewModel.loadLogs() }
    }

    private func logWeight() {
        guard let kg = Double(newWeight) else { return }
        newWeight = ""
        Task { await viewModel.logWeight(kg) }
    }
}
