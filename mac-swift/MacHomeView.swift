// MacHomeView.swift — New Home / Dashboard screen
// Add to: OzempicAI/OzempicAIMac/Views/MacHomeView.swift

import SwiftUI

struct MacHomeView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @StateObject private var calorieVM = CalorieViewModel()
    @StateObject private var waterVM = WaterViewModel()
    @StateObject private var weightVM = WeightViewModel()

    private var greeting: String {
        let h = Calendar.current.component(.hour, from: Date())
        switch h {
        case 0..<12: return "Good morning"
        case 12..<17: return "Good afternoon"
        default: return "Good evening"
        }
    }

    private var dateString: String {
        let f = DateFormatter()
        f.dateFormat = "EEEE, MMMM d"
        return f.string(from: Date())
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Header
                HStack(alignment: .bottom) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(dateString.uppercased())
                            .font(.inter(12, weight: .semibold)).tracking(1.0)
                            .foregroundColor(Color.theme.coffee)
                        HStack(spacing: 0) {
                            Text("\(greeting), ")
                                .font(.fraunces(40, weight: .regular))
                            Text(authViewModel.user?.name.components(separatedBy: " ").first ?? "friend")
                                .font(.fraunces(40, weight: .regular)).italic()
                        }
                        .foregroundColor(Color.theme.espresso)
                    }
                    Spacer()
                    Button {} label: {
                        HStack(spacing: 6) {
                            Image(systemName: "plus").font(.system(size: 12, weight: .bold))
                            Text("Quick log").font(.inter(13, weight: .semibold))
                        }
                        .foregroundColor(.white)
                        .padding(.horizontal, 18).padding(.vertical, 10)
                        .background(Color.theme.terracotta)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                    }.buttonStyle(.plain)
                }

                // Hero + insight
                HStack(alignment: .top, spacing: 20) {
                    heroCard.frame(maxWidth: .infinity)
                    insightCard.frame(width: 320)
                }

                // Stat grid
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 16), count: 4), spacing: 16) {
                    MacStatCard(label: "Water", value: "1.4L", sub: "of 2.5L", color: Color.theme.sage, iconName: "drop.fill", progress: 0.58)
                    MacStatCard(label: "Steps", value: "6,842", sub: "of 10,000", color: Color.theme.amber, iconName: "figure.walk", progress: 0.68)
                    MacStatCard(label: "Weight", value: "74.2", sub: "kg · −0.4 this week", color: Color.theme.plum, iconName: "scalemass.fill", progress: 0.68)
                    MacStatCard(label: "Fasting", value: "12:34", sub: "of 16h · active", color: Color.theme.saffron, iconName: "moon.fill", progress: 0.78)
                }

                // Today rows
                HStack(alignment: .top, spacing: 20) {
                    plateCard.frame(maxWidth: .infinity)
                    activityCard.frame(width: 340)
                }
            }
            .padding(32)
        }
        .background(Color.theme.cream)
    }

    private var heroCard: some View {
        ZStack(alignment: .topLeading) {
            LinearGradient(
                colors: [Color.theme.terracotta, Color.theme.terracottaDeep],
                startPoint: .topLeading, endPoint: .bottomTrailing
            )
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("TODAY'S ENERGY")
                            .font(.inter(11, weight: .semibold)).tracking(1.5)
                            .foregroundColor(.white.opacity(0.75))
                        HStack(alignment: .lastTextBaseline, spacing: 10) {
                            Text("1,060").font(.fraunces(80, weight: .regular))
                            Text("cal remaining").font(.inter(16, weight: .regular))
                                .foregroundColor(.white.opacity(0.75))
                        }
                        Text("on track — keep it steady")
                            .font(.fraunces(16)).italic()
                            .foregroundColor(.white.opacity(0.85))
                    }
                    .foregroundColor(.white)
                    Spacer()
                    ZStack {
                        MacRing(size: 96, stroke: 9, progress: 0.676,
                                gradient: [.white, .white],
                                trackColor: .white.opacity(0.2))
                        Text("68%").font(.inter(16, weight: .bold)).foregroundColor(.white)
                    }
                }
                Divider().background(.white.opacity(0.22)).padding(.vertical, 20)
                HStack {
                    heroStat("Eaten", "1,420 cal")
                    heroStat("Burned", "380 cal")
                    heroStat("Goal", "2,100 cal")
                    heroStat("Net", "1,040 cal")
                }
            }
            .padding(28)
        }
        .clipShape(RoundedRectangle(cornerRadius: 24))
        .shadow(color: Color.theme.shadow, radius: 20, y: 6)
    }

    private func heroStat(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label.uppercased()).font(.inter(10, weight: .semibold)).tracking(1.0)
                .foregroundColor(.white.opacity(0.7))
            Text(value).font(.fraunces(22, weight: .medium))
        }
        .foregroundColor(.white)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var insightCard: some View {
        MacCard {
            VStack(alignment: .leading, spacing: 10) {
                Text("WEEKLY INSIGHT")
                    .font(.inter(10, weight: .bold)).tracking(1.2)
                    .foregroundColor(Color.theme.coffee)
                (Text("You've hit your water goal ")
                    + Text("4 days in a row").italic().foregroundColor(Color.theme.sageDeep)
                    + Text("."))
                    .font(.fraunces(22, weight: .medium))
                    .foregroundColor(Color.theme.espresso)
                Text("Your longest streak this quarter. One more day matches your February record.")
                    .font(.inter(13))
                    .foregroundColor(Color.theme.coffee)
                HStack(spacing: 4) {
                    ForEach(0..<7) { i in
                        RoundedRectangle(cornerRadius: 6)
                            .fill(i < 4 ? Color.theme.sage : Color.theme.creamDim)
                            .frame(height: 32)
                    }
                }
                .padding(.top, 6)
            }
        }
    }

    private var plateCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            MacSectionTitle(text: "Today's plate")
            MacCard(padding: 0) {
                VStack(spacing: 0) {
                    plateRow("Breakfast", "7:42 AM", "Oatmeal, berries, almonds", 380, done: true, divider: true)
                    plateRow("Lunch", "12:30 PM", "Grilled chicken salad", 520, done: true, divider: true)
                    plateRow("Snack", "3:15 PM", "Greek yogurt + honey", 220, done: true, divider: true)
                    plateRow("Dinner", "Planned", "Salmon, quinoa, greens", 580, done: false, divider: false)
                }
            }
        }
    }

    private func plateRow(_ meal: String, _ time: String, _ food: String, _ cal: Int, done: Bool, divider: Bool) -> some View {
        VStack(spacing: 0) {
            HStack(spacing: 14) {
                ZStack {
                    RoundedRectangle(cornerRadius: 11)
                        .fill(done ? Color.theme.terracotta.opacity(0.12) : Color.theme.creamDim)
                        .frame(width: 36, height: 36)
                    Image(systemName: done ? "checkmark" : "plus")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundColor(done ? Color.theme.terracotta : Color.theme.coffee)
                }
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 10) {
                        Text(meal).font(.inter(14, weight: .semibold))
                            .foregroundColor(Color.theme.espresso)
                        Text(time).font(.inter(11, weight: .medium))
                            .foregroundColor(Color.theme.dust)
                    }
                    Text(food).font(.inter(13)).foregroundColor(Color.theme.coffee)
                }
                Spacer()
                HStack(spacing: 2) {
                    Text("\(cal)").font(.fraunces(18, weight: .medium))
                    Text("cal").font(.inter(10, weight: .medium))
                        .foregroundColor(Color.theme.dust)
                }
                .foregroundColor(Color.theme.espresso)
            }
            .padding(.horizontal, 20).padding(.vertical, 14)
            .opacity(done ? 1 : 0.55)
            if divider { Divider().background(Color.theme.divider) }
        }
    }

    private var activityCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            MacSectionTitle(text: "Today's activity")
            MacCard(padding: 0) {
                VStack(spacing: 0) {
                    activityRow("Morning run", "3.2 mi · 28 min", 240, icon: "figure.run")
                    Divider().background(Color.theme.divider)
                    activityRow("Upper body", "Strength · 14 min", 140, icon: "dumbbell.fill")
                }
            }
        }
    }

    private func activityRow(_ name: String, _ sub: String, _ cal: Int, icon: String) -> some View {
        HStack(spacing: 14) {
            ZStack {
                LinearGradient(
                    colors: [Color.theme.ember, Color.theme.amber],
                    startPoint: .topLeading, endPoint: .bottomTrailing
                )
                .clipShape(RoundedRectangle(cornerRadius: 11))
                .frame(width: 36, height: 36)
                Image(systemName: icon).font(.system(size: 14, weight: .semibold))
                    .foregroundColor(.white)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(name).font(.inter(14, weight: .semibold))
                    .foregroundColor(Color.theme.espresso)
                Text(sub).font(.inter(12)).foregroundColor(Color.theme.coffee)
            }
            Spacer()
            Text("\(cal) cal").font(.fraunces(16, weight: .medium))
                .foregroundColor(Color.theme.ember)
        }
        .padding(.horizontal, 20).padding(.vertical, 14)
    }
}
