import SwiftUI

struct HeartRateView: View {
    @EnvironmentObject var viewModel: HeartRateViewModel
    @State private var showManualEntry = false
    @State private var manualBpm = ""
    @State private var isAnimating = false

    private var bpmLabel: String {
        if let bpm = viewModel.restingHeartRate { return "\(Int(bpm))" }
        return "--"
    }

    private var statusLine: String {
        if viewModel.restingHeartRate != nil { return "Resting · from Apple Watch" }
        return "Sync to pull your latest reading"
    }

    var body: some View {
        ScrollView {
            VStack(spacing: AppSpacing.md) {
                ScreenHeader(title: "Heart", subtitle: "Vitals") {
                    showManualEntry = true
                }

                if let error = viewModel.errorMessage {
                    errorBanner(error)
                        .padding(.horizontal, AppSpacing.md + 4)
                }

                heroCard
                actionRow
                if !viewModel.logs.isEmpty { history }
                Spacer(minLength: 40)
            }
            .padding(.bottom, 100)
        }
        .screenBackground()
        .alert("Log a reading", isPresented: $showManualEntry) {
            TextField("BPM", text: $manualBpm).keyboardType(.numberPad)
            Button("Save") {
                guard let bpm = Int(manualBpm), bpm > 0 else { return }
                Task { await viewModel.logManualReading(bpm: bpm) }
                manualBpm = ""
            }
            Button("Cancel", role: .cancel) { manualBpm = "" }
        } message: {
            Text("Enter your current heart rate in BPM")
        }
        .task {
            isAnimating = true
            await viewModel.requestHealthKitAccess()
            await viewModel.loadLogs()
            await viewModel.fetchFromHealthKit()
        }
    }

    // MARK: - Hero

    private var heroCard: some View {
        VStack(spacing: AppSpacing.md) {
            ZStack {
                HeartbeatLineShape()
                    .stroke(Color.theme.ember.opacity(0.28), lineWidth: 2)
                    .frame(height: 70)
                    .padding(.horizontal, AppSpacing.lg)

                VStack(spacing: 6) {
                    Image(systemName: "heart.fill")
                        .font(.system(size: 40))
                        .foregroundColor(Color.theme.ember)
                        .scaleEffect(isAnimating ? 1.12 : 1.0)
                        .animation(
                            .easeInOut(duration: 0.7).repeatForever(autoreverses: true),
                            value: isAnimating
                        )

                    Text(bpmLabel)
                        .font(AppFont.display(56, weight: .regular))
                        .foregroundColor(Color.theme.espresso)
                        .kerning(-1)
                        .monospacedDigit()

                    Text("BPM")
                        .font(AppFont.ui(13, weight: .semibold))
                        .foregroundColor(Color.theme.coffee)
                        .tracking(2)
                }
            }
            .padding(.top, AppSpacing.sm)

            Text(statusLine)
                .font(AppFont.display(14, weight: .regular, italic: true))
                .foregroundColor(Color.theme.terracottaDeep)
                .multilineTextAlignment(.center)
        }
        .padding(.vertical, AppSpacing.lg)
        .frame(maxWidth: .infinity)
        .background(Color.theme.paper)
        .cornerRadius(AppRadius.large)
        .shadow(color: Color.theme.shadow, radius: 10, x: 0, y: 2)
        .padding(.horizontal, AppSpacing.md + 4)
    }

    // MARK: - Actions

    private var actionRow: some View {
        HStack(spacing: 10) {
            Button {
                showManualEntry = true
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "hand.raised.fill")
                    Text("Manual")
                }
                .font(AppFont.ui(14, weight: .semibold))
                .foregroundColor(Color.theme.terracotta)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(Color.theme.terracotta.opacity(0.12))
                .cornerRadius(AppRadius.medium)
            }
            .buttonStyle(.plain)

            Button {
                Task { await viewModel.fetchFromHealthKit() }
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "applewatch.radiowaves.left.and.right")
                    Text("Sync")
                }
                .font(AppFont.ui(14, weight: .semibold))
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(
                    LinearGradient(
                        colors: [Color.theme.ember, Color.theme.terracotta],
                        startPoint: .topLeading, endPoint: .bottomTrailing
                    )
                )
                .cornerRadius(AppRadius.medium)
                .shadow(color: Color.theme.ember.opacity(0.25), radius: 8, x: 0, y: 3)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, AppSpacing.md + 4)
    }

    // MARK: - History

    private var history: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                Text("History")
                    .font(AppFont.display(20, weight: .medium))
                    .foregroundColor(Color.theme.espresso)
                Spacer()
                CapsLabel(text: "\(viewModel.logs.count) entries")
            }
            .padding(.horizontal, 4)

            VStack(spacing: 0) {
                ForEach(Array(viewModel.logs.enumerated()), id: \.element.id) { idx, log in
                    historyRow(log)
                    if idx < viewModel.logs.count - 1 {
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

    private func historyRow(_ log: HeartRateLog) -> some View {
        let isHK = log.source == .healthkit
        let accent = isHK ? Color.theme.terracotta : Color.theme.saffron
        return HStack(spacing: 12) {
            ZStack {
                Circle().fill(accent.opacity(0.15))
                Image(systemName: isHK ? "applewatch" : "hand.raised.fill")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(accent)
            }
            .frame(width: 32, height: 32)

            VStack(alignment: .leading, spacing: 2) {
                Text("\(log.bpm) BPM")
                    .font(AppFont.ui(14, weight: .semibold))
                    .foregroundColor(Color.theme.espresso)
                Text(log.source.rawValue.capitalized)
                    .font(AppFont.ui(11))
                    .foregroundColor(Color.theme.dust)
            }

            Spacer()

            Text(log.recordedAt, style: .date)
                .font(AppFont.ui(12))
                .foregroundColor(Color.theme.dust)
        }
        .padding(.horizontal, AppSpacing.md)
        .padding(.vertical, 12)
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

// MARK: - ECG Heartbeat Line

struct HeartbeatLineShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let midY = rect.midY
        let w = rect.width

        path.move(to: CGPoint(x: 0, y: midY))
        path.addLine(to: CGPoint(x: w * 0.3, y: midY))
        path.addLine(to: CGPoint(x: w * 0.35, y: midY - rect.height * 0.15))
        path.addLine(to: CGPoint(x: w * 0.38, y: midY))
        path.addLine(to: CGPoint(x: w * 0.42, y: midY + rect.height * 0.1))
        path.addLine(to: CGPoint(x: w * 0.46, y: midY - rect.height * 0.45))
        path.addLine(to: CGPoint(x: w * 0.50, y: midY + rect.height * 0.25))
        path.addLine(to: CGPoint(x: w * 0.54, y: midY))
        path.addLine(to: CGPoint(x: w * 0.60, y: midY - rect.height * 0.12))
        path.addLine(to: CGPoint(x: w * 0.65, y: midY))
        path.addLine(to: CGPoint(x: w, y: midY))

        return path
    }
}
