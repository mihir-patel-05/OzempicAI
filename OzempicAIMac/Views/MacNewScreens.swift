// MacNewScreens.swift — New macOS screens added by the redesign
// Add to: OzempicAI/OzempicAIMac/Views/MacNewScreens.swift
// These screens did not exist in the original macOS target.

import SwiftUI

// MARK: - Water
struct MacWaterView: View {
    @StateObject private var vm = WaterViewModel()

    private var todayDateString: String {
        let f = DateFormatter(); f.dateFormat = "EEEE, MMMM d"
        return f.string(from: Date())
    }

    private var totalLiters: Double { Double(vm.totalMlToday) / 1000.0 }
    private var goalLiters: Double { Double(vm.dailyGoalMl) / 1000.0 }
    private var percent: Int { Int((vm.progressFraction * 100).rounded()) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                MacPageHeader(title: "Water", subtitle: todayDateString, actionTitle: nil)
                HStack(alignment: .top, spacing: 20) {
                    MacCard {
                        VStack(spacing: 16) {
                            WaterVessel(progress: vm.progressFraction)
                                .frame(width: 200, height: 260)
                            HStack(alignment: .lastTextBaseline, spacing: 4) {
                                Text(String(format: "%.1f", totalLiters)).font(.fraunces(48))
                                Text("L").font(.inter(24, weight: .medium))
                                    .foregroundColor(Color.theme.coffee)
                            }
                            .foregroundColor(Color.theme.espresso)
                            Text("of \(String(format: "%.1f", goalLiters))L daily goal · \(percent)%")
                                .font(.inter(12, weight: .medium))
                                .foregroundColor(Color.theme.coffee)
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .frame(width: 340)

                    VStack(alignment: .leading, spacing: 12) {
                        MacSectionTitle(text: "Quick add")
                        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 4), spacing: 10) {
                            quickAddTile("¼ cup", 60)
                            quickAddTile("Glass", 250)
                            quickAddTile("Bottle", 500)
                            quickAddTile("Liter", 1000)
                        }
                        MacSectionTitle(text: "Today's entries").padding(.top, 12)
                        MacCard(padding: 0) {
                            if vm.todaysLogs.isEmpty {
                                Text("No entries yet today")
                                    .font(.inter(13))
                                    .foregroundColor(Color.theme.dust)
                                    .frame(maxWidth: .infinity, alignment: .center)
                                    .padding(.vertical, 28)
                            } else {
                                VStack(spacing: 0) {
                                    ForEach(Array(vm.todaysLogs.enumerated()), id: \.element.id) { idx, log in
                                        entryRow(formatTime(log.loggedAt), log.amountMl,
                                                 entryLabel(for: log.amountMl),
                                                 divider: idx < vm.todaysLogs.count - 1)
                                    }
                                }
                            }
                        }
                    }
                }
            }
            .padding(32)
        }
        .background(Color.theme.cream)
        .task { await vm.loadTodaysLogs() }
    }

    private func formatTime(_ date: Date) -> String {
        let f = DateFormatter(); f.dateFormat = "h:mm a"
        return f.string(from: date)
    }

    private func entryLabel(for ml: Int) -> String {
        switch ml {
        case ..<100:  return "Small pour"
        case 100..<300: return "Glass"
        case 300..<600: return "Water bottle"
        default: return "Large bottle"
        }
    }

    private func quickAddTile(_ label: String, _ ml: Int) -> some View {
        Button { Task { await vm.logWater(amountMl: ml) } } label: {
            VStack(spacing: 2) {
                Text("+\(ml)").font(.fraunces(22, weight: .medium))
                    .foregroundColor(Color.theme.espresso)
                Text(label).font(.inter(11, weight: .medium))
                    .foregroundColor(Color.theme.dust)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(Color.theme.paper)
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.theme.divider, lineWidth: 1))
            .clipShape(RoundedRectangle(cornerRadius: 14))
        }.buttonStyle(.plain)
    }

    private func entryRow(_ time: String, _ ml: Int, _ name: String, divider: Bool) -> some View {
        VStack(spacing: 0) {
            HStack(spacing: 14) {
                ZStack {
                    RoundedRectangle(cornerRadius: 9).fill(Color.theme.amber.opacity(0.18))
                        .frame(width: 28, height: 28)
                    Image(systemName: "drop.fill").font(.system(size: 11, weight: .semibold))
                        .foregroundColor(Color.theme.saffron)
                }
                Text(name).font(.inter(14, weight: .medium))
                    .foregroundColor(Color.theme.espresso)
                Spacer()
                Text(time).font(.inter(12, weight: .medium)).foregroundColor(Color.theme.dust)
                Text("\(ml) ml").font(.fraunces(16, weight: .medium))
                    .foregroundColor(Color.theme.espresso).frame(width: 70, alignment: .trailing)
            }
            .padding(.horizontal, 18).padding(.vertical, 12)
            if divider { Divider().background(Color.theme.divider) }
        }
    }
}

private struct WaterVessel: View {
    let progress: Double
    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width, h = geo.size.height
            ZStack {
                VesselShape()
                    .fill(Color.theme.ringTrack)
                VesselShape()
                    .fill(LinearGradient(colors: [Color.theme.saffron, Color.theme.amber],
                                         startPoint: .top, endPoint: .bottom))
                    .mask(
                        Rectangle()
                            .offset(y: (1 - progress) * h)
                    )
            }
            .frame(width: w, height: h)
        }
    }
}

private struct VesselShape: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        let w = rect.width, h = rect.height
        p.move(to: CGPoint(x: w*0.20, y: h*0.08))
        p.addLine(to: CGPoint(x: w*0.80, y: h*0.08))
        p.addLine(to: CGPoint(x: w*0.74, y: h*0.92))
        p.addQuadCurve(to: CGPoint(x: w*0.69, y: h*0.96),
                       control: CGPoint(x: w*0.74, y: h*0.96))
        p.addLine(to: CGPoint(x: w*0.31, y: h*0.96))
        p.addQuadCurve(to: CGPoint(x: w*0.26, y: h*0.92),
                       control: CGPoint(x: w*0.26, y: h*0.96))
        p.closeSubpath()
        return p
    }
}

// MARK: - Heart Rate
struct MacHeartRateView: View {
    @StateObject private var vm = HeartRateViewModel()

    private var todayDateString: String {
        let f = DateFormatter(); f.dateFormat = "EEEE, MMMM d"
        return f.string(from: Date())
    }

    private var todaysBpmValues: [Int] {
        let cal = Calendar.current
        return vm.logs.filter { cal.isDateInToday($0.recordedAt) }.map { $0.bpm }
    }

    private var latestBpm: Int? { vm.logs.first?.bpm }
    private var minBpm: Int? { todaysBpmValues.min() }
    private var maxBpm: Int? { todaysBpmValues.max() }
    private var avgBpm: Int? {
        let v = todaysBpmValues
        return v.isEmpty ? nil : v.reduce(0, +) / v.count
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                MacPageHeader(title: "Heart Rate", subtitle: todayDateString, actionTitle: nil)
                HStack(alignment: .top, spacing: 20) {
                    MacCard {
                        VStack(spacing: 16) {
                            Image(systemName: "heart.fill")
                                .font(.system(size: 56))
                                .foregroundColor(Color.theme.ember)
                            Text(latestBpm.map(String.init) ?? "—").font(.fraunces(72))
                                .foregroundColor(Color.theme.espresso)
                            Text("BPM · Resting").font(.inter(14, weight: .medium))
                                .foregroundColor(Color.theme.coffee)
                            Text("Normal range")
                                .font(.inter(11, weight: .semibold))
                                .foregroundColor(Color.theme.sageDeep)
                                .padding(.horizontal, 10).padding(.vertical, 4)
                                .background(Color.theme.sage.opacity(0.18))
                                .clipShape(Capsule())
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .frame(width: 320)

                    VStack(alignment: .leading, spacing: 12) {
                        MacSectionTitle(text: "Today")
                        MacCard {
                            HeartRateSparkline(bpmPoints: todaysBpmValues.map(Double.init))
                                .frame(height: 140)
                        }
                        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 3), spacing: 10) {
                            MacStatCard(label: "Min", value: minBpm.map(String.init) ?? "—", sub: "bpm",
                                        color: Color.theme.sage, iconName: "arrow.down")
                            MacStatCard(label: "Max", value: maxBpm.map(String.init) ?? "—", sub: "bpm today",
                                        color: Color.theme.ember, iconName: "arrow.up")
                            MacStatCard(label: "Avg", value: avgBpm.map(String.init) ?? "—", sub: "bpm today",
                                        color: Color.theme.terracotta, iconName: "waveform.path.ecg")
                        }
                    }
                }
            }
            .padding(32)
        }
        .background(Color.theme.cream)
        .task { await vm.loadLogs() }
    }
}

private struct HeartRateSparkline: View {
    var bpmPoints: [Double] = []
    private var points: [Double] {
        bpmPoints.isEmpty ? [90, 85, 78, 75, 55, 50, 40, 28, 30, 50, 70, 75, 80, 78, 82, 80] : bpmPoints
    }
    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width, h = geo.size.height
            let step = w / CGFloat(points.count - 1)
            let mx = points.max() ?? 1
            Path { p in
                for (i, v) in points.enumerated() {
                    let pt = CGPoint(x: CGFloat(i) * step, y: CGFloat(v / mx) * h)
                    if i == 0 { p.move(to: pt) } else { p.addLine(to: pt) }
                }
            }
            .stroke(Color.theme.ember, style: StrokeStyle(lineWidth: 2.5, lineJoin: .round))
        }
    }
}

// MARK: - Fasting
struct MacFastingView: View {
    @StateObject private var vm = FastingViewModel()

    private var subtitle: String {
        if vm.isActive { return "\(vm.selectedHours):\(24 - vm.selectedHours) schedule · active" }
        if vm.isComplete { return "complete" }
        return "ready to start"
    }

    private var hoursMinutes: String {
        let total = Int(max(vm.timeElapsed, 0))
        return String(format: "%02d:%02d", total / 3600, (total % 3600) / 60)
    }

    private var elapsedHours: Double { vm.timeElapsed / 3600.0 }

    private var phaseLabel: String {
        switch elapsedHours {
        case ..<4:    return "BLOOD SUGAR"
        case 4..<12:  return "GLYCOGEN"
        case 12..<18: return "FAT BURNING"
        default:      return "KETOSIS"
        }
    }

    private func phaseState(start: Double, end: Double) -> PhaseState {
        if elapsedHours >= end { return .done }
        if elapsedHours >= start { return .active }
        return .upcoming
    }

    private func formatClock(_ date: Date?) -> String {
        guard let date else { return "—" }
        let f = DateFormatter(); f.dateFormat = "h:mm a"
        return f.string(from: date)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                MacPageHeader(title: "Fasting", subtitle: subtitle, actionTitle: nil)
                HStack(alignment: .top, spacing: 20) {
                    MacCard {
                        VStack(spacing: 24) {
                            ZStack {
                                MacRing(size: 240, stroke: 16, progress: vm.progress,
                                        gradient: [Color.theme.plum, Color.theme.terracotta])
                                VStack(spacing: 6) {
                                    Text(phaseLabel)
                                        .font(.inter(10, weight: .bold)).tracking(1.5)
                                        .foregroundColor(Color.theme.plum)
                                    Text(hoursMinutes).font(.fraunces(56))
                                        .foregroundColor(Color.theme.espresso)
                                    Text("of \(vm.selectedHours)h fast").font(.inter(12, weight: .medium))
                                        .foregroundColor(Color.theme.dust)
                                }
                            }
                            Button { vm.stopFast() } label: {
                                Text(vm.isActive ? "End fast early" : "Start fast")
                                    .font(.inter(14, weight: .semibold))
                                    .foregroundColor(.white)
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 12)
                                    .background(Color.theme.terracotta)
                                    .clipShape(RoundedRectangle(cornerRadius: 14))
                            }
                            .buttonStyle(.plain)
                            .disabled(!vm.isActive)
                            .opacity(vm.isActive ? 1 : 0.5)
                        }
                    }
                    .frame(width: 340)

                    VStack(alignment: .leading, spacing: 16) {
                        MacCard {
                            VStack(alignment: .leading, spacing: 14) {
                                Text("SCHEDULE").font(.inter(11, weight: .bold)).tracking(1.0)
                                    .foregroundColor(Color.theme.coffee)
                                HStack(alignment: .center) {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text("Started").font(.fraunces(14)).italic()
                                            .foregroundColor(Color.theme.dust)
                                        Text(formatClock(vm.isActive ? vm.customStartTime : nil))
                                            .font(.fraunces(24, weight: .medium))
                                            .foregroundColor(Color.theme.espresso)
                                    }
                                    Spacer()
                                    VStack(alignment: .trailing, spacing: 2) {
                                        Text("Ends").font(.fraunces(14)).italic()
                                            .foregroundColor(Color.theme.dust)
                                        Text(formatClock(vm.endTime))
                                            .font(.fraunces(24, weight: .medium))
                                            .foregroundColor(Color.theme.espresso)
                                    }
                                }
                            }
                        }
                        phaseRow("Phase 1", "Blood sugar rises", "0–4h · insulin peaks",
                                 state: phaseState(start: 0, end: 4))
                        phaseRow("Phase 2", "Glycogen depletion", "4–12h · glucose stable",
                                 state: phaseState(start: 4, end: 12))
                        phaseRow("Phase 3", "Fat burning begins", "12–18h · fat metabolism",
                                 state: phaseState(start: 12, end: 18))
                        phaseRow("Phase 4", "Ketosis", "18h+ · deep fat metabolism",
                                 state: phaseState(start: 18, end: .infinity))
                    }
                }
            }
            .padding(32)
        }
        .background(Color.theme.cream)
    }

    enum PhaseState { case done, active, upcoming }

    private func phaseRow(_ phase: String, _ title: String, _ desc: String, state: PhaseState) -> some View {
        HStack(spacing: 14) {
            ZStack {
                Circle().fill(state == .done ? Color.theme.sage
                              : state == .active ? Color.theme.plum
                              : Color.theme.creamDim)
                    .frame(width: 28, height: 28)
                if state == .done {
                    Image(systemName: "checkmark").font(.system(size: 12, weight: .bold))
                        .foregroundColor(.white)
                } else if state == .active {
                    Image(systemName: "moon.fill").font(.system(size: 11))
                        .foregroundColor(.white)
                }
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(phase.uppercased()).font(.inter(10, weight: .bold)).tracking(1.0)
                    .foregroundColor(state == .active ? Color.theme.plum : Color.theme.dust)
                Text(title).font(.fraunces(16, weight: .medium))
                    .foregroundColor(state == .upcoming ? Color.theme.dust : Color.theme.espresso)
                Text(desc).font(.inter(12)).foregroundColor(Color.theme.coffee)
            }
            Spacer()
        }
        .padding(.horizontal, 16).padding(.vertical, 12)
        .background(state == .active ? Color.theme.plum.opacity(0.1) : .clear)
        .overlay(RoundedRectangle(cornerRadius: 14)
            .stroke(state == .active ? Color.theme.plum.opacity(0.25) : .clear, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }
}
