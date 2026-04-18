//  HomeView.swift
//  New Home/Dashboard — drop into OzempicAI/Views/Dashboard/

import SwiftUI

struct HomeView: View {
    // Replace with your real view models
    let eaten = 1420, goal = 2100, burned = 380
    var remaining: Int { goal - eaten + burned }
    var calsPct: Double { Double(eaten) / Double(goal) }

    var body: some View {
        ScrollView {
            VStack(spacing: AppSpacing.md) {

                // Greeting
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 4) {
                        CapsLabel(text: "Friday, April 17")
                        Text("Good morning,")
                            .font(AppFont.display(28, weight: .regular))
                            .foregroundColor(Color.theme.espresso)
                        Text("Alex")
                            .font(AppFont.display(28, weight: .regular, italic: true))
                            .foregroundColor(Color.theme.espresso)
                    }
                    Spacer()
                    ZStack {
                        LinearGradient(colors: [Color.theme.terracotta, Color.theme.amber],
                                       startPoint: .topLeading, endPoint: .bottomTrailing)
                            .clipShape(Circle())
                        Text("A").font(AppFont.display(17, weight: .medium)).foregroundColor(.white)
                    }
                    .frame(width: 42, height: 42)
                }
                .padding(.horizontal, AppSpacing.lg)
                .padding(.top, AppSpacing.sm)

                // Hero calorie card
                VStack(alignment: .leading, spacing: 0) {
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 8) {
                            CapsLabel(text: "Today's energy", color: Color.white.opacity(0.75))
                            HStack(alignment: .firstTextBaseline, spacing: 8) {
                                Text("\(remaining.formatted())")
                                    .font(AppFont.display(64, weight: .regular))
                                    .kerning(-1.5)
                                    .foregroundColor(.white)
                                Text("cal left")
                                    .font(AppFont.ui(14))
                                    .foregroundColor(.white.opacity(0.75))
                            }
                            Text("on track for your goal")
                                .font(AppFont.display(14, weight: .regular, italic: true))
                                .foregroundColor(.white.opacity(0.8))
                        }
                        Spacer()
                        ZStack {
                            ProgressRing(progress: calsPct, size: 72, lineWidth: 7,
                                         gradient: [.white, .white],
                                         trackColor: .white.opacity(0.2))
                            Text("\(Int(calsPct * 100))%")
                                .font(AppFont.ui(13, weight: .semibold))
                                .foregroundColor(.white)
                        }
                    }

                    Divider().background(Color.white.opacity(0.2)).padding(.vertical, 18)

                    HStack {
                        heroSubStat(label: "Eaten", value: "\(eaten.formatted())", align: .leading)
                        Spacer()
                        heroSubStat(label: "Burned", value: "\(burned)", align: .center)
                        Spacer()
                        heroSubStat(label: "Goal", value: "\(goal.formatted())", align: .trailing)
                    }
                }
                .padding(24)
                .background(
                    LinearGradient(colors: [Color.theme.terracotta, Color.theme.terracottaDeep],
                                   startPoint: .topLeading, endPoint: .bottomTrailing)
                )
                .cornerRadius(AppRadius.hero)
                .shadow(color: Color.theme.shadow, radius: 24, x: 0, y: 8)
                .padding(.horizontal, AppSpacing.md + 4)

                // Stat grid
                LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible())],
                          spacing: 12) {
                    StatCard(label: "Water", value: "1.4L", sub: "of 2.5L",
                             progress: 1440.0/2500.0, color: Color.theme.sage, systemImage: "drop.fill")
                    StatCard(label: "Steps", value: "6,842", sub: "of 10,000",
                             progress: 6842.0/10000.0, color: Color.theme.amber, systemImage: "figure.run")
                    StatCard(label: "Weight", value: "74.2", sub: "kg · −0.4 this week",
                             progress: 0.68, color: Color.theme.plum, systemImage: "scalemass.fill", trendDown: true)
                    StatCard(label: "Fasting", value: "12:34", sub: "of 16h · active",
                             progress: 12.5/16, color: Color.theme.saffron, systemImage: "moon.stars.fill", pulse: true)
                }
                .padding(.horizontal, AppSpacing.md + 4)

                // Today's plate
                VStack(alignment: .leading, spacing: 12) {
                    HStack(alignment: .firstTextBaseline) {
                        Text("Today's plate")
                            .font(AppFont.display(22, weight: .medium))
                            .foregroundColor(Color.theme.espresso)
                        Spacer()
                        Text("See all")
                            .font(AppFont.ui(13, weight: .semibold))
                            .foregroundColor(Color.theme.terracotta)
                    }
                    .padding(.horizontal, 4)

                    VStack(spacing: 0) {
                        mealRow("Breakfast", "7:42 AM", "Oatmeal, berries, almonds", 380, true)
                        Divider().background(Color.theme.divider).padding(.leading, 76)
                        mealRow("Lunch", "12:30 PM", "Grilled chicken salad", 520, true)
                        Divider().background(Color.theme.divider).padding(.leading, 76)
                        mealRow("Snack", "3:15 PM", "Greek yogurt + honey", 220, true)
                        Divider().background(Color.theme.divider).padding(.leading, 76)
                        mealRow("Dinner", "Planned", "Salmon, quinoa, greens", 580, false)
                    }
                    .background(Color.theme.paper)
                    .cornerRadius(AppRadius.large)
                    .shadow(color: Color.theme.shadow, radius: 10, x: 0, y: 2)
                }
                .padding(.horizontal, AppSpacing.md + 4)
                .padding(.top, AppSpacing.sm)

                // Insight
                insightCard
                    .padding(.horizontal, AppSpacing.md + 4)

                Spacer(minLength: 40)
            }
            .padding(.bottom, 100)
        }
        .screenBackground()
    }

    private func heroSubStat(label: String, value: String, align: Alignment) -> some View {
        VStack(alignment: align == .leading ? .leading : align == .trailing ? .trailing : .center, spacing: 4) {
            Text(label.uppercased())
                .font(.system(size: 11, weight: .semibold))
                .foregroundColor(.white.opacity(0.7))
                .tracking(0.8)
            HStack(spacing: 3) {
                Text(value)
                    .font(AppFont.display(20, weight: .medium))
                    .foregroundColor(.white)
                Text("cal")
                    .font(.system(size: 11, weight: .regular))
                    .foregroundColor(.white.opacity(0.6))
            }
        }
    }

    private func mealRow(_ meal: String, _ time: String, _ food: String, _ cal: Int, _ done: Bool) -> some View {
        HStack(spacing: 14) {
            ZStack {
                RoundedRectangle(cornerRadius: 12)
                    .fill(done ? Color.theme.terracotta.opacity(0.1) : Color.theme.creamDim)
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(
                        done ? Color.theme.terracotta.opacity(0.2) : Color.theme.divider, lineWidth: 1))
                Image(systemName: done ? "checkmark" : "plus")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundColor(done ? Color.theme.terracotta : Color.theme.coffee)
            }
            .frame(width: 38, height: 38)

            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 8) {
                    Text(meal).font(AppFont.ui(15, weight: .semibold)).foregroundColor(Color.theme.espresso)
                    Text(time).font(.system(size: 11, weight: .medium)).foregroundColor(Color.theme.dust)
                }
                Text(food).font(AppFont.ui(13)).foregroundColor(Color.theme.coffee)
            }
            Spacer()
            HStack(alignment: .lastTextBaseline, spacing: 2) {
                Text("\(cal)").font(AppFont.display(18, weight: .medium)).foregroundColor(Color.theme.espresso)
                Text("cal").font(.system(size: 10, weight: .medium)).foregroundColor(Color.theme.dust)
            }
        }
        .padding(.horizontal, 20).padding(.vertical, 14)
        .opacity(done ? 1 : 0.55)
    }

    private var insightCard: some View {
        HStack(alignment: .top, spacing: 14) {
            ZStack {
                Circle().fill(Color.theme.sage)
                Image(systemName: "chart.line.uptrend.xyaxis")
                    .font(.system(size: 16, weight: .bold)).foregroundColor(.white)
            }
            .frame(width: 36, height: 36)
            VStack(alignment: .leading, spacing: 4) {
                CapsLabel(text: "Weekly insight", color: Color.theme.sageDeep)
                Text("You've hit your water goal 4 days in a row — a new streak.")
                    .font(AppFont.display(17, weight: .medium))
                    .foregroundColor(Color.theme.espresso)
                    .lineSpacing(2)
            }
            Spacer()
        }
        .padding(20)
        .background(Color.theme.sage.opacity(0.15))
        .overlay(RoundedRectangle(cornerRadius: AppRadius.large).stroke(Color.theme.sage.opacity(0.3), lineWidth: 1))
        .cornerRadius(AppRadius.large)
    }
}
