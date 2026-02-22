import SwiftUI

struct FastingView: View {
    @StateObject private var viewModel = FastingViewModel()

    private let presets = [12, 14, 16, 18, 20, 24]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: AppSpacing.lg) {
                    durationPicker
                    fastingRing
                    if viewModel.isActive || viewModel.isComplete {
                        statsRow
                    }
                    if viewModel.isActive {
                        phaseCard
                    }
                    actionButton
                }
                .padding(.horizontal)
                .padding(.bottom, AppSpacing.lg)
            }
            .screenBackground()
            .navigationTitle("Fasting")
        }
    }

    // MARK: - Duration Picker

    private var durationPicker: some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            Text("Fast Duration")
                .font(.subheadline.bold())
                .foregroundColor(Color.theme.secondaryText)

            HStack(spacing: AppSpacing.sm) {
                ForEach(presets, id: \.self) { hours in
                    Button {
                        viewModel.selectedHours = hours
                    } label: {
                        Text("\(hours)h")
                            .font(.subheadline.bold())
                            .foregroundColor(
                                viewModel.selectedHours == hours ? .white : Color.theme.mediumBlue
                            )
                            .padding(.vertical, AppSpacing.sm)
                            .frame(maxWidth: .infinity)
                            .background(
                                viewModel.selectedHours == hours
                                    ? Color.theme.mediumBlue
                                    : Color.theme.mediumBlue.opacity(0.12)
                            )
                            .cornerRadius(AppRadius.small)
                    }
                    .disabled(viewModel.isActive)
                }
            }
        }
        .cardStyle()
    }

    // MARK: - Fasting Ring

    private var fastingRing: some View {
        ZStack {
            // Track
            Circle()
                .stroke(Color.theme.darkNavy.opacity(0.08), lineWidth: 22)

            // Progress arc
            Circle()
                .trim(from: 0, to: viewModel.progress)
                .stroke(
                    LinearGradient(
                        colors: viewModel.isComplete
                            ? [Color.theme.amber, Color.theme.orange]
                            : [Color.theme.mediumBlue, Color.theme.lightBlue],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    style: StrokeStyle(lineWidth: 22, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))
                .animation(.linear(duration: 1.0), value: viewModel.progress)

            // Center content
            VStack(spacing: AppSpacing.xs) {
                Image(systemName: centerIcon)
                    .font(.title)
                    .foregroundStyle(
                        viewModel.isComplete ? Color.theme.amber : Color.theme.mediumBlue
                    )

                if viewModel.isComplete {
                    Text("Done!")
                        .font(.system(size: 34, weight: .bold, design: .rounded))
                        .foregroundColor(Color.theme.primaryText)
                    Text("\(viewModel.selectedHours)h fast complete")
                        .font(.caption)
                        .foregroundColor(Color.theme.secondaryText)
                        .multilineTextAlignment(.center)
                } else if viewModel.isActive {
                    Text(viewModel.elapsedString)
                        .font(.system(size: 32, weight: .bold, design: .rounded))
                        .foregroundColor(Color.theme.primaryText)
                        .monospacedDigit()
                    Text("/ \(viewModel.selectedHours)h")
                        .font(.subheadline)
                        .foregroundColor(Color.theme.secondaryText)
                } else {
                    Text("\(viewModel.selectedHours)h")
                        .font(.system(size: 42, weight: .bold, design: .rounded))
                        .foregroundColor(Color.theme.primaryText)
                    Text("ready to start")
                        .font(.caption)
                        .foregroundColor(Color.theme.secondaryText)
                }
            }
            .padding(AppSpacing.lg)
        }
        .frame(width: 260, height: 260)
        .padding(.vertical, AppSpacing.md)
    }

    private var centerIcon: String {
        if viewModel.isComplete { return "checkmark.circle.fill" }
        if viewModel.isActive   { return "moon.stars.fill" }
        return "moon.fill"
    }

    // MARK: - Stats Row

    private var statsRow: some View {
        HStack(spacing: 0) {
            statItem(label: "Elapsed", value: viewModel.elapsedString)
            Divider().frame(height: 44)
            statItem(label: "Remaining", value: viewModel.remainingString)
        }
        .cardStyle()
    }

    private func statItem(label: String, value: String) -> some View {
        VStack(spacing: AppSpacing.xs) {
            Text(label)
                .font(.caption.bold())
                .foregroundColor(Color.theme.secondaryText)
            Text(value)
                .font(.system(.body, design: .monospaced).bold())
                .foregroundColor(Color.theme.primaryText)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Phase Card

    private var phaseCard: some View {
        HStack(spacing: AppSpacing.md) {
            Image(systemName: viewModel.fastingPhaseIcon)
                .font(.title2)
                .foregroundStyle(Color.theme.mediumBlue)
                .frame(width: 40)

            VStack(alignment: .leading, spacing: AppSpacing.xs) {
                Text("Current Phase")
                    .font(.caption.bold())
                    .foregroundColor(Color.theme.secondaryText)
                Text(viewModel.fastingPhase)
                    .font(.headline)
                    .foregroundColor(Color.theme.primaryText)
            }
            Spacer()
        }
        .cardStyle()
    }

    // MARK: - Action Button

    private var actionButton: some View {
        Group {
            if viewModel.isComplete {
                Button("Start New Fast") {
                    viewModel.resetAfterComplete()
                }
                .buttonStyle(PrimaryButtonStyle())
            } else if viewModel.isActive {
                Button("Stop Fast") {
                    viewModel.stopFast()
                }
                .buttonStyle(SecondaryButtonStyle())
            } else {
                Button("Start \(viewModel.selectedHours)-Hour Fast") {
                    viewModel.startFast()
                }
                .buttonStyle(PrimaryButtonStyle())
            }
        }
    }
}
