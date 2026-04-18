import SwiftUI

struct FastingView: View {
    @EnvironmentObject var viewModel: FastingViewModel

    private let presets = [12, 14, 16, 18, 20, 24]
    @State private var showStartTimePicker = false

    private var subtitle: String {
        if viewModel.isComplete { return "Complete" }
        if viewModel.isActive   { return "In progress" }
        return "Ready to start"
    }

    var body: some View {
        ScrollView {
            VStack(spacing: AppSpacing.md) {
                ScreenHeader(title: "Fasting", subtitle: subtitle)
                durationPicker
                startTimeSection
                fastingRing
                if viewModel.isActive || viewModel.isComplete {
                    statsRow
                }
                if viewModel.isActive, let endTime = viewModel.endTime {
                    endTimeCard(endTime)
                }
                if viewModel.isActive {
                    phaseCard
                }
                actionButton
                Spacer(minLength: 40)
            }
            .padding(.bottom, 100)
        }
        .screenBackground()
    }

    // MARK: - Duration picker

    private var durationPicker: some View {
        VStack(alignment: .leading, spacing: 12) {
            CapsLabel(text: "Fast duration")
                .padding(.horizontal, 4)
            HStack(spacing: 8) {
                ForEach(presets, id: \.self) { hours in
                    Button {
                        viewModel.selectedHours = hours
                    } label: {
                        Text("\(hours)h")
                            .font(AppFont.display(15, weight: .medium))
                            .foregroundColor(
                                viewModel.selectedHours == hours
                                    ? .white
                                    : Color.theme.coffee
                            )
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                            .background(
                                viewModel.selectedHours == hours
                                    ? AnyShapeStyle(
                                        LinearGradient(
                                            colors: [Color.theme.saffron, Color.theme.terracotta],
                                            startPoint: .topLeading, endPoint: .bottomTrailing
                                        )
                                    )
                                    : AnyShapeStyle(Color.theme.creamDim)
                            )
                            .cornerRadius(AppRadius.small)
                    }
                    .buttonStyle(.plain)
                    .disabled(viewModel.isActive)
                }
            }
        }
        .padding(AppSpacing.md)
        .background(Color.theme.paper)
        .cornerRadius(AppRadius.large)
        .shadow(color: Color.theme.shadow, radius: 8, x: 0, y: 2)
        .padding(.horizontal, AppSpacing.md + 4)
    }

    // MARK: - Start time

    private var startTimeSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            CapsLabel(text: "Start time")
                .padding(.horizontal, 4)

            if viewModel.isComplete {
                HStack(spacing: 10) {
                    Image(systemName: "clock.fill")
                        .foregroundColor(Color.theme.terracotta)
                    Text(viewModel.customStartTime, style: .date)
                    Text(viewModel.customStartTime, style: .time)
                    Spacer()
                }
                .font(AppFont.ui(14, weight: .medium))
                .foregroundColor(Color.theme.espresso)
                .padding(AppSpacing.md)
                .background(Color.theme.paper)
                .cornerRadius(AppRadius.large)
                .shadow(color: Color.theme.shadow, radius: 6, x: 0, y: 2)
            } else {
                Button {
                    showStartTimePicker.toggle()
                } label: {
                    HStack(spacing: 10) {
                        Image(systemName: "clock.fill")
                            .foregroundColor(Color.theme.terracotta)
                        Text(viewModel.customStartTime, style: .date)
                        Text(viewModel.customStartTime, style: .time)
                        Spacer()
                        Image(systemName: "pencil")
                            .foregroundColor(Color.theme.coffee)
                    }
                    .font(AppFont.ui(14, weight: .medium))
                    .foregroundColor(Color.theme.espresso)
                    .padding(AppSpacing.md)
                    .background(Color.theme.paper)
                    .cornerRadius(AppRadius.large)
                    .shadow(color: Color.theme.shadow, radius: 6, x: 0, y: 2)
                }
                .buttonStyle(.plain)

                if showStartTimePicker {
                    DatePicker(
                        "Started at",
                        selection: Binding(
                            get: { viewModel.customStartTime },
                            set: { newDate in
                                viewModel.customStartTime = newDate
                                if viewModel.isActive {
                                    viewModel.updateStartTime(newDate)
                                }
                            }
                        ),
                        in: ...Date(),
                        displayedComponents: [.date, .hourAndMinute]
                    )
                    .datePickerStyle(.graphical)
                    .labelsHidden()
                    .accentColor(Color.theme.terracotta)
                    .padding(AppSpacing.md)
                    .background(Color.theme.paper)
                    .cornerRadius(AppRadius.large)
                    .shadow(color: Color.theme.shadow, radius: 6, x: 0, y: 2)
                }
            }
        }
        .padding(.horizontal, AppSpacing.md + 4)
    }

    // MARK: - Ring

    private var fastingRing: some View {
        ZStack {
            ProgressRing(
                progress: viewModel.progress,
                size: 260,
                lineWidth: 20,
                gradient: viewModel.isComplete
                    ? [Color.theme.amber, Color.theme.terracotta]
                    : [Color.theme.saffron, Color.theme.terracotta]
            )
            VStack(spacing: 6) {
                Image(systemName: centerIcon)
                    .font(.system(size: 26))
                    .foregroundColor(
                        viewModel.isComplete ? Color.theme.terracotta : Color.theme.saffron
                    )
                if viewModel.isComplete {
                    Text("Done!")
                        .font(AppFont.display(34, weight: .regular))
                        .foregroundColor(Color.theme.espresso)
                    Text("\(viewModel.selectedHours)h fast complete")
                        .font(AppFont.ui(12))
                        .foregroundColor(Color.theme.coffee)
                } else if viewModel.isActive {
                    Text(viewModel.elapsedString)
                        .font(AppFont.display(32, weight: .regular))
                        .foregroundColor(Color.theme.espresso)
                        .monospacedDigit()
                        .kerning(-0.8)
                    Text("of \(viewModel.selectedHours)h")
                        .font(AppFont.ui(12))
                        .foregroundColor(Color.theme.coffee)
                } else {
                    Text("\(viewModel.selectedHours)h")
                        .font(AppFont.display(48, weight: .regular))
                        .foregroundColor(Color.theme.espresso)
                    Text("ready to start")
                        .font(AppFont.display(13, weight: .regular, italic: true))
                        .foregroundColor(Color.theme.coffee)
                }
            }
            .padding(AppSpacing.lg)
        }
        .padding(.vertical, AppSpacing.sm)
    }

    private var centerIcon: String {
        if viewModel.isComplete { return "checkmark.circle.fill" }
        if viewModel.isActive   { return "moon.stars.fill" }
        return "moon.fill"
    }

    // MARK: - Stats row

    private var statsRow: some View {
        HStack(spacing: 12) {
            statChip(label: "Elapsed", value: viewModel.elapsedString)
            statChip(label: "Remaining", value: viewModel.remainingString)
        }
        .padding(.horizontal, AppSpacing.md + 4)
    }

    private func statChip(label: String, value: String) -> some View {
        VStack(spacing: 4) {
            CapsLabel(text: label)
            Text(value)
                .font(AppFont.display(18, weight: .medium))
                .foregroundColor(Color.theme.espresso)
                .monospacedDigit()
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(Color.theme.paper)
        .cornerRadius(AppRadius.large)
        .shadow(color: Color.theme.shadow, radius: 6, x: 0, y: 2)
    }

    // MARK: - End time / phase

    private func endTimeCard(_ endTime: Date) -> some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(Color.theme.terracotta.opacity(0.15))
                Image(systemName: "bell.fill")
                    .font(.system(size: 14))
                    .foregroundColor(Color.theme.terracotta)
            }
            .frame(width: 36, height: 36)
            VStack(alignment: .leading, spacing: 2) {
                CapsLabel(text: "Fast ends at")
                HStack(spacing: 6) {
                    Text(endTime, style: .date)
                    Text(endTime, style: .time)
                }
                .font(AppFont.ui(14, weight: .semibold))
                .foregroundColor(Color.theme.espresso)
            }
            Spacer()
        }
        .padding(14)
        .background(Color.theme.paper)
        .cornerRadius(AppRadius.large)
        .shadow(color: Color.theme.shadow, radius: 6, x: 0, y: 2)
        .padding(.horizontal, AppSpacing.md + 4)
    }

    private var phaseCard: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(Color.theme.saffron.opacity(0.15))
                Image(systemName: viewModel.fastingPhaseIcon)
                    .font(.system(size: 14))
                    .foregroundColor(Color.theme.saffron)
            }
            .frame(width: 36, height: 36)
            VStack(alignment: .leading, spacing: 2) {
                CapsLabel(text: "Current phase")
                Text(viewModel.fastingPhase)
                    .font(AppFont.ui(14, weight: .semibold))
                    .foregroundColor(Color.theme.espresso)
            }
            Spacer()
        }
        .padding(14)
        .background(Color.theme.paper)
        .cornerRadius(AppRadius.large)
        .shadow(color: Color.theme.shadow, radius: 6, x: 0, y: 2)
        .padding(.horizontal, AppSpacing.md + 4)
    }

    // MARK: - Action

    private var actionButton: some View {
        Group {
            if viewModel.isComplete {
                Button("Start new fast") { viewModel.resetAfterComplete() }
                    .buttonStyle(PrimaryButtonStyle())
            } else if viewModel.isActive {
                Button("Stop fast") { viewModel.stopFast() }
                    .buttonStyle(SecondaryButtonStyle())
            } else {
                Button("Start \(viewModel.selectedHours)-hour fast") { viewModel.startFast() }
                    .buttonStyle(PrimaryButtonStyle())
            }
        }
        .padding(.horizontal, AppSpacing.md + 4)
    }
}
