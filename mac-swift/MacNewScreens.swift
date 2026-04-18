// MacNewScreens.swift — New macOS screens added by the redesign
// Add to: OzempicAI/OzempicAIMac/Views/MacNewScreens.swift
// These screens did not exist in the original macOS target.

import SwiftUI

// MARK: - Water
struct MacWaterView: View {
    @StateObject private var vm = WaterViewModel()
    @State private var goal: Double = 2500

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                MacPageHeader(title: "Water", subtitle: "Friday, April 17")
                HStack(alignment: .top, spacing: 20) {
                    MacCard {
                        VStack(spacing: 16) {
                            WaterVessel(progress: 1440 / goal)
                                .frame(width: 200, height: 260)
                            HStack(alignment: .lastTextBaseline, spacing: 4) {
                                Text("1.4").font(.fraunces(48))
                                Text("L").font(.inter(24, weight: .medium))
                                    .foregroundColor(Color.theme.coffee)
                            }
                            .foregroundColor(Color.theme.espresso)
                            Text("of \(Int(goal/1000))L daily goal · 58%")
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
                            VStack(spacing: 0) {
                                entryRow("7:10 AM", 250, "Glass", divider: true)
                                entryRow("9:30 AM", 500, "Water bottle", divider: true)
                                entryRow("12:45 PM", 250, "Glass with lunch", divider: true)
                                entryRow("3:20 PM", 440, "Water bottle", divider: false)
                            }
                        }
                    }
                }
            }
            .padding(32)
        }
        .background(Color.theme.cream)
    }

    private func quickAddTile(_ label: String, _ ml: Int) -> some View {
        Button {} label: {
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

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                MacPageHeader(title: "Heart Rate", subtitle: "Friday, April 17")
                HStack(alignment: .top, spacing: 20) {
                    MacCard {
                        VStack(spacing: 16) {
                            Image(systemName: "heart.fill")
                                .font(.system(size: 56))
                                .foregroundColor(Color.theme.ember)
                            Text("62").font(.fraunces(72))
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
                            HeartRateSparkline()
                                .frame(height: 140)
                        }
                        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 3), spacing: 10) {
                            MacStatCard(label: "Min", value: "48", sub: "bpm",
                                        color: Color.theme.sage, iconName: "arrow.down")
                            MacStatCard(label: "Max", value: "142", sub: "bpm during run",
                                        color: Color.theme.ember, iconName: "arrow.up")
                            MacStatCard(label: "Avg", value: "74", sub: "bpm today",
                                        color: Color.theme.terracotta, iconName: "waveform.path.ecg")
                        }
                    }
                }
            }
            .padding(32)
        }
        .background(Color.theme.cream)
    }
}

private struct HeartRateSparkline: View {
    let points: [Double] = [90, 85, 78, 75, 55, 50, 40, 28, 30, 50, 70, 75, 80, 78, 82, 80]
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

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                MacPageHeader(title: "Fasting", subtitle: "16:8 schedule · active", actionTitle: nil)
                HStack(alignment: .top, spacing: 20) {
                    MacCard {
                        VStack(spacing: 24) {
                            ZStack {
                                MacRing(size: 240, stroke: 16, progress: 12.5/16,
                                        gradient: [Color.theme.plum, Color.theme.terracotta])
                                VStack(spacing: 6) {
                                    Text("FAT BURNING")
                                        .font(.inter(10, weight: .bold)).tracking(1.5)
                                        .foregroundColor(Color.theme.plum)
                                    Text("12:34").font(.fraunces(56))
                                        .foregroundColor(Color.theme.espresso)
                                    Text("of 16h fast").font(.inter(12, weight: .medium))
                                        .foregroundColor(Color.theme.dust)
                                }
                            }
                            Button {} label: {
                                Text("End fast early")
                                    .font(.inter(14, weight: .semibold))
                                    .foregroundColor(.white)
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 12)
                                    .background(Color.theme.terracotta)
                                    .clipShape(RoundedRectangle(cornerRadius: 14))
                            }.buttonStyle(.plain)
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
                                        Text("8:00 PM").font(.fraunces(24, weight: .medium))
                                            .foregroundColor(Color.theme.espresso)
                                    }
                                    Spacer()
                                    VStack(alignment: .trailing, spacing: 2) {
                                        Text("Ends").font(.fraunces(14)).italic()
                                            .foregroundColor(Color.theme.dust)
                                        Text("12:00 PM").font(.fraunces(24, weight: .medium))
                                            .foregroundColor(Color.theme.espresso)
                                    }
                                }
                            }
                        }
                        phaseRow("Phase 1", "Blood sugar rises", "0–4h · insulin peaks", state: .done)
                        phaseRow("Phase 2", "Glycogen depletion", "4–12h · glucose stable", state: .done)
                        phaseRow("Phase 3", "Fat burning begins", "12–18h · active now", state: .active)
                        phaseRow("Phase 4", "Ketosis", "18h+ · deep fat metabolism", state: .upcoming)
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
