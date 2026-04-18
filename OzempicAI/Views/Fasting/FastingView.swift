import SwiftUI

struct FastingView: View {
    @EnvironmentObject var viewModel: FastingViewModel

    private let presets = [12, 14, 16, 18, 20, 24]
    @State private var showStartTimePicker = false

    private struct Phase: Identifiable {
        let id = UUID()
        let hour: Double
        let label: String
        let icon: String
    }

    private let phases: [Phase] = [
        Phase(hour: 0,  label: "Fed",      icon: "fork.knife"),
        Phase(hour: 4,  label: "Absorb",   icon: "hourglass"),
        Phase(hour: 8,  label: "Early",    icon: "moon.fill"),
        Phase(hour: 12, label: "Fat burn", icon: "flame.fill"),
        Phase(hour: 16, label: "Deep",     icon: "moon.stars.fill"),
        Phase(hour: 20, label: "Extended", icon: "sparkles")
    ]

    private var subtitle: String {
        if viewModel.isComplete { return "Complete" }
        if viewModel.isActive   { return "In progress" }
        return "Ready to start"
    }

    var body: some View {
        ScrollView {
            VStack(spacing: AppSpacing.md) {
                ScreenHeader(title: "Fasting", subtitle: subtitle)
                heroRingCard
                if viewModel.isActive || viewModel.isComplete {
                    statsRow
                }
                if viewModel.isActive, let endTime = viewModel.endTime {
                    endTimeCard(endTime)
                }
                if viewModel.isActive {
                    phaseTimelineCard
                }
                if !viewModel.isActive && !viewModel.isComplete {
                    durationPicker
                    startTimeSection
                    protocolHintCard
                }
                actionButton
                Spacer(minLength: 40)
            }
            .padding(.bottom, 100)
        }
        .screenBackground()
    }

    // MARK: - Hero ring card

    private var heroRingCard: some View {
        VStack(spacing: AppSpacing.sm) {
            ZStack {
                ProgressRing(
                    progress: viewModel.progress,
                    size: 260,
                    lineWidth: 22,
                    gradient: viewModel.isComplete
                        ? [Color.theme.amber, Color.theme.terracotta]
                        : [Color.theme.saffron, Color.theme.terracotta]
                )
                VStack(spacing: 6) {
                    Image(systemName: centerIcon)
                        .font(.system(size: 28))
                        .foregroundColor(
                            viewModel.isComplete ? Color.theme.terracotta : Color.theme.saffron
                        )
                    if viewModel.isComplete {
                        Text("Done")
                            .font(AppFont.display(44, weight: .regular))
                            .foregroundColor(Color.theme.espresso)
                            .kerning(-1)
                        Text("\(viewModel.selectedHours)h fast complete")
                            .font(AppFont.display(13, weight: .regular, italic: true))
                            .foregroundColor(Color.theme.coffee)
                    } else if viewModel.isActive {
                        Text(viewModel.elapsedString)
                            .font(AppFont.display(34, weight: .regular))
                            .foregroundColor(Color.theme.espresso)
                            .monospacedDigit()
                            .kerning(-0.8)
                        Text("of \(viewModel.selectedHours)h")
                            .font(AppFont.ui(12))
                            .foregroundColor(Color.theme.coffee)
                    } else {
                        Text("\(viewModel.selectedHours)h")
                            .font(AppFont.display(56, weight: .regular))
                            .foregroundColor(Color.theme.espresso)
                            .kerning(-1.2)
                        Text("tap start to begin")
                            .font(AppFont.display(13, weight: .regular, italic: true))
                            .foregroundColor(Color.theme.coffee)
                    }
                }
                .padding(AppSpacing.lg)
            }

            if viewModel.isActive {
                HStack(spacing: 6) {
                    Circle()
                        .fill(Color.theme.saffron)
                        .frame(width: 8, height: 8)
                    Text(viewModel.fastingPhase)
                        .font(AppFont.ui(12, weight: .semibold))
                        .foregroundColor(Color.theme.terracottaDeep)
                        .tracking(0.5)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 6)
                .background(Color.theme.saffron.opacity(0.15))
                .clipShape(Capsule())
            }
        }
        .padding(.vertical, AppSpacing.lg)
        .frame(maxWidth: .infinity)
        .background(Color.theme.paper)
        .cornerRadius(AppRadius.large)
        .shadow(color: Color.theme.shadow, radius: 10, x: 0, y: 2)
        .padding(.horizontal, AppSpacing.md + 4)
    }

    private var centerIcon: String {
        if viewModel.isComplete { return "checkmark.circle.fill" }
        if viewModel.isActive   { return "moon.stars.fill" }
        return "moon.fill"
    }

    // MARK: - Stats row

    private var statsRow: some View {
        HStack(spacing: 12) {
            statChip(label: "Elapsed", value: viewModel.elapsedString, accent: Color.theme.saffron)
            statChip(label: "Remaining", value: viewModel.remainingString, accent: Color.theme.terracotta)
        }
        .padding(.horizontal, AppSpacing.md + 4)
    }

    private func statChip(label: String, value: String, accent: Color) -> some View {
        VStack(spacing: 6) {
            CapsLabel(text: label, color: accent)
            Text(value)
                .font(AppFont.display(20, weight: .medium))
                .foregroundColor(Color.theme.espresso)
                .monospacedDigit()
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 14)
        .background(Color.theme.paper)
        .cornerRadius(AppRadius.large)
        .shadow(color: Color.theme.shadow, radius: 6, x: 0, y: 2)
    }

    // MARK: - End time card

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

    // MARK: - Phase timeline

    private var phaseTimelineCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .firstTextBaseline) {
                Text("Phase timeline")
                    .font(AppFont.display(18, weight: .medium))
                    .foregroundColor(Color.theme.espresso)
                Spacer()
                CapsLabel(text: "\(Int(viewModel.timeElapsed / 3600))h in")
            }

            VStack(spacing: 10) {
                ForEach(Array(phases.enumerated()), id: \.element.id) { idx, phase in
                    if Double(viewModel.selectedHours) >= phase.hour {
                        phaseRow(phase: phase,
                                 isLast: idx == phases.count - 1 || Double(viewModel.selectedHours) < (phases[safe: idx + 1]?.hour ?? .infinity))
                    }
                }
            }
        }
        .padding(AppSpacing.md)
        .background(Color.theme.paper)
        .cornerRadius(AppRadius.large)
        .shadow(color: Color.theme.shadow, radius: 6, x: 0, y: 2)
        .padding(.horizontal, AppSpacing.md + 4)
    }

    private func phaseRow(phase: Phase, isLast: Bool) -> some View {
        let elapsedHours = viewModel.timeElapsed / 3600
        let reached = elapsedHours >= phase.hour
        let active = reached && elapsedHours < phase.hour + 4
        let accent: Color = active ? Color.theme.saffron
            : reached ? Color.theme.terracotta
            : Color.theme.dust.opacity(0.5)

        return HStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(reached ? accent.opacity(0.18) : Color.theme.creamDim)
                Image(systemName: reached ? phase.icon : "circle")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(accent)
            }
            .frame(width: 30, height: 30)
            .overlay(
                Circle()
                    .stroke(active ? Color.theme.saffron : .clear, lineWidth: 2)
            )

            VStack(alignment: .leading, spacing: 1) {
                Text(phase.label)
                    .font(AppFont.ui(13, weight: reached ? .semibold : .regular))
                    .foregroundColor(reached ? Color.theme.espresso : Color.theme.dust)
                Text("starts at \(Int(phase.hour))h")
                    .font(AppFont.ui(11))
                    .foregroundColor(Color.theme.dust)
            }
            Spacer()
            if active {
                Text("NOW")
                    .font(AppFont.ui(10, weight: .bold))
                    .foregroundColor(.white)
                    .tracking(1.0)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(Color.theme.saffron)
                    .clipShape(Capsule())
            } else if reached {
                Image(systemName: "checkmark")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(Color.theme.sageDeep)
            }
        }
    }

    // MARK: - Duration picker

    private var durationPicker: some View {
        VStack(alignment: .leading, spacing: 12) {
            CapsLabel(text: "Fast duration")
                .padding(.horizontal, 4)
            LazyVGrid(
                columns: [GridItem(.flexible(), spacing: 8),
                          GridItem(.flexible(), spacing: 8),
                          GridItem(.flexible(), spacing: 8)],
                spacing: 8
            ) {
                ForEach(presets, id: \.self) { hours in
                    Button { viewModel.selectedHours = hours } label: {
                        VStack(spacing: 2) {
                            Text("\(hours)h")
                                .font(AppFont.display(18, weight: .medium))
                            Text(protocolName(for: hours))
                                .font(AppFont.ui(10, weight: .medium))
                                .opacity(0.75)
                        }
                        .foregroundColor(
                            viewModel.selectedHours == hours ? .white : Color.theme.coffee
                        )
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
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
                }
            }
        }
        .padding(AppSpacing.md)
        .background(Color.theme.paper)
        .cornerRadius(AppRadius.large)
        .shadow(color: Color.theme.shadow, radius: 8, x: 0, y: 2)
        .padding(.horizontal, AppSpacing.md + 4)
    }

    private func protocolName(for hours: Int) -> String {
        switch hours {
        case 12: return "beginner"
        case 14: return "14/10"
        case 16: return "16/8"
        case 18: return "18/6"
        case 20: return "20/4"
        case 24: return "OMAD"
        default: return ""
        }
    }

    // MARK: - Start time

    private var startTimeSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            CapsLabel(text: "Start time")
                .padding(.horizontal, 4)

            Button {
                showStartTimePicker.toggle()
            } label: {
                HStack(spacing: 10) {
                    Image(systemName: "clock.fill")
                        .foregroundColor(Color.theme.terracotta)
                    Text(viewModel.customStartTime, style: .date)
                    Text(viewModel.customStartTime, style: .time)
                    Spacer()
                    Image(systemName: showStartTimePicker ? "chevron.up" : "pencil")
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
                        set: { viewModel.customStartTime = $0 }
                    ),
                    in: ...Date(),
                    displayedComponents: [.date, .hourAndMinute]
                )
                .datePickerStyle(.graphical)
                .labelsHidden()
                .accentColor(Color.theme.terracotta)
                .environment(\.colorScheme, .light)
                .padding(AppSpacing.md)
                .background(Color.theme.paper)
                .cornerRadius(AppRadius.large)
                .shadow(color: Color.theme.shadow, radius: 6, x: 0, y: 2)
            }
        }
        .padding(.horizontal, AppSpacing.md + 4)
    }

    // MARK: - Protocol hint

    private var protocolHintCard: some View {
        HStack(alignment: .top, spacing: 12) {
            ZStack {
                Circle().fill(Color.theme.sage.opacity(0.2))
                Image(systemName: "sparkles")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(Color.theme.sageDeep)
            }
            .frame(width: 36, height: 36)
            VStack(alignment: .leading, spacing: 4) {
                CapsLabel(text: "Protocol", color: Color.theme.sageDeep)
                Text(hintText)
                    .font(AppFont.display(14, weight: .regular, italic: true))
                    .foregroundColor(Color.theme.espresso)
                    .lineSpacing(2)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer()
        }
        .padding(14)
        .background(Color.theme.sage.opacity(0.12))
        .overlay(
            RoundedRectangle(cornerRadius: AppRadius.large)
                .stroke(Color.theme.sage.opacity(0.25), lineWidth: 1)
        )
        .cornerRadius(AppRadius.large)
        .padding(.horizontal, AppSpacing.md + 4)
    }

    private var hintText: String {
        switch viewModel.selectedHours {
        case 12: return "A gentle start — 12 hours works well if you're new to fasting."
        case 14: return "14/10 — an easy step up that still lets you eat with family."
        case 16: return "16/8 — the most popular window. Skip breakfast or dinner."
        case 18: return "18/6 — deeper fat burn kicks in. Stay hydrated."
        case 20: return "20/4 — a narrow window. Eat enough to fuel the next fast."
        case 24: return "OMAD — one meal a day. Make it nutrient-dense."
        default: return "Stay hydrated and listen to your body."
        }
    }

    // MARK: - Action

    private var actionButton: some View {
        Group {
            if viewModel.isComplete {
                Button("Start new fast") { viewModel.resetAfterComplete() }
                    .buttonStyle(PrimaryButtonStyle())
            } else if viewModel.isActive {
                Button("End fast early") { viewModel.stopFast() }
                    .buttonStyle(SecondaryButtonStyle())
            } else {
                Button("Start \(viewModel.selectedHours)-hour fast") { viewModel.startFast() }
                    .buttonStyle(PrimaryButtonStyle())
            }
        }
        .padding(.horizontal, AppSpacing.md + 4)
    }
}

private extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
