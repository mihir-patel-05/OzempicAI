import SwiftUI

struct HeartRateView: View {
    @StateObject private var viewModel = HeartRateViewModel()
    @State private var showManualEntry = false
    @State private var manualBpm = ""
    @State private var isAnimating = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: AppSpacing.lg) {
                    // Hero: pulsing heart
                    ZStack {
                        // ECG decorative line
                        HeartbeatLineShape()
                            .stroke(Color.theme.orange.opacity(0.3), lineWidth: 2)
                            .frame(height: 60)
                            .padding(.horizontal, AppSpacing.lg)

                        VStack(spacing: AppSpacing.sm) {
                            Image(systemName: "heart.fill")
                                .font(.system(size: 70))
                                .foregroundStyle(Color.theme.orange)
                                .scaleEffect(isAnimating ? 1.12 : 1.0)
                                .animation(
                                    .easeInOut(duration: 0.6).repeatForever(autoreverses: true),
                                    value: isAnimating
                                )

                            if let bpm = viewModel.restingHeartRate {
                                Text("\(Int(bpm))")
                                    .font(.system(size: 48, weight: .bold, design: .rounded))
                                    .foregroundColor(Color.theme.primaryText)

                                Text("BPM")
                                    .font(.title3)
                                    .foregroundColor(Color.theme.secondaryText)
                            } else {
                                Text("--")
                                    .font(.system(size: 48, weight: .bold, design: .rounded))
                                    .foregroundColor(Color.theme.secondaryText)

                                Text("Tap refresh to sync")
                                    .font(.subheadline)
                                    .foregroundColor(Color.theme.secondaryText)
                            }
                        }
                    }
                    .padding(.top, AppSpacing.xl)

                    // Action buttons
                    HStack(spacing: AppSpacing.md) {
                        Button {
                            showManualEntry = true
                        } label: {
                            Label("Manual Entry", systemImage: "hand.raised.fill")
                                .font(.subheadline.bold())
                        }
                        .buttonStyle(SecondaryButtonStyle())

                        Button {
                            Task { await viewModel.fetchFromHealthKit() }
                        } label: {
                            Label("Sync HealthKit", systemImage: "arrow.clockwise")
                                .font(.subheadline.bold())
                        }
                        .buttonStyle(PrimaryButtonStyle())
                    }
                    .padding(.horizontal)

                    // History
                    if !viewModel.logs.isEmpty {
                        VStack(spacing: AppSpacing.sm) {
                            HStack {
                                Text("History")
                                    .font(.headline)
                                    .foregroundColor(Color.theme.primaryText)
                                Spacer()
                            }

                            ForEach(viewModel.logs) { log in
                                HStack(spacing: AppSpacing.md) {
                                    Image(systemName: log.source == .healthkit
                                          ? "applewatch.radiowaves.left.and.right"
                                          : "hand.raised.fill")
                                        .font(.body)
                                        .foregroundStyle(log.source == .healthkit
                                                         ? Color.theme.mediumBlue
                                                         : Color.theme.amber)
                                        .frame(width: 36, height: 36)
                                        .background(
                                            (log.source == .healthkit
                                             ? Color.theme.mediumBlue
                                             : Color.theme.amber).opacity(0.12)
                                        )
                                        .clipShape(Circle())

                                    VStack(alignment: .leading, spacing: 2) {
                                        Text("\(log.bpm) BPM")
                                            .font(.subheadline.bold())
                                            .foregroundColor(Color.theme.primaryText)

                                        Text(log.source.rawValue.capitalized)
                                            .font(.caption)
                                            .foregroundColor(Color.theme.secondaryText)
                                    }

                                    Spacer()
                                }
                                .cardStyle()
                            }
                        }
                    }
                }
                .padding(.horizontal)
                .padding(.bottom, AppSpacing.lg)
            }
            .screenBackground()
            .navigationTitle("Heart Rate")
            .alert("Manual Entry", isPresented: $showManualEntry) {
                TextField("BPM", text: $manualBpm).keyboardType(.numberPad)
                Button("Save") {
                    guard let bpm = Int(manualBpm) else { return }
                    Task { await viewModel.logManualReading(bpm: bpm) }
                    manualBpm = ""
                }
                Button("Cancel", role: .cancel) { manualBpm = "" }
            }
            .task {
                isAnimating = true
                await viewModel.requestHealthKitAccess()
                await viewModel.loadLogs()
                await viewModel.fetchFromHealthKit()
            }
        }
    }
}

// MARK: - ECG Heartbeat Line

struct HeartbeatLineShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let midY = rect.midY
        let w = rect.width

        path.move(to: CGPoint(x: 0, y: midY))
        // Flat lead-in
        path.addLine(to: CGPoint(x: w * 0.3, y: midY))
        // Small P wave
        path.addLine(to: CGPoint(x: w * 0.35, y: midY - rect.height * 0.15))
        path.addLine(to: CGPoint(x: w * 0.38, y: midY))
        // QRS complex
        path.addLine(to: CGPoint(x: w * 0.42, y: midY + rect.height * 0.1))
        path.addLine(to: CGPoint(x: w * 0.46, y: midY - rect.height * 0.45))
        path.addLine(to: CGPoint(x: w * 0.50, y: midY + rect.height * 0.25))
        path.addLine(to: CGPoint(x: w * 0.54, y: midY))
        // T wave
        path.addLine(to: CGPoint(x: w * 0.60, y: midY - rect.height * 0.12))
        path.addLine(to: CGPoint(x: w * 0.65, y: midY))
        // Flat trail
        path.addLine(to: CGPoint(x: w, y: midY))

        return path
    }
}
