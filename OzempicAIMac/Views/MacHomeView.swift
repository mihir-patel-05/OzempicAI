// MacHomeView.swift — New Home / Dashboard screen
// Add to: OzempicAI/OzempicAIMac/Views/MacHomeView.swift

import SwiftUI

struct MacHomeView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @StateObject private var calorieVM = CalorieViewModel()
    @StateObject private var waterVM = WaterViewModel()
    @StateObject private var weightVM = WeightViewModel()
    @StateObject private var fastingVM = FastingViewModel()
    @StateObject private var exerciseVM = ExerciseViewModel()

    private var remainingCalories: Int { max(calorieVM.dailyGoal - calorieVM.totalCalories, 0) }
    private var calorieProgress: Double {
        guard calorieVM.dailyGoal > 0 else { return 0 }
        return min(Double(calorieVM.totalCalories) / Double(calorieVM.dailyGoal), 1.0)
    }
    private var calorieProgressPct: Int { Int((calorieProgress * 100).rounded()) }

    private var waterValue: String {
        String(format: "%.1fL", Double(waterVM.totalMlToday) / 1000.0)
    }
    private var waterGoalSub: String {
        String(format: "of %.1fL", Double(waterVM.dailyGoalMl) / 1000.0)
    }

    private var weightValue: String {
        guard let w = weightVM.latestWeight?.weightKg else { return "—" }
        return String(format: "%.1f", w)
    }
    private var weightSub: String {
        let delta = weightVM.trendDelta
        guard weightVM.logs.count >= 2 else { return "kg" }
        let sign = delta > 0 ? "+" : (delta < 0 ? "−" : "")
        return String(format: "kg · %@%.1f last entry", sign, abs(delta))
    }

    private var fastingValue: String {
        let total = Int(max(fastingVM.timeElapsed, 0))
        return String(format: "%02d:%02d", total / 3600, (total % 3600) / 60)
    }
    private var fastingSub: String {
        "of \(fastingVM.selectedHours)h · \(fastingVM.isActive ? "active" : "idle")"
    }

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
                            Text(authViewModel.currentUser?.name.components(separatedBy: " ").first ?? "friend")
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
                    MacStatCard(label: "Water", value: waterValue, sub: waterGoalSub,
                                color: Color.theme.sage, iconName: "drop.fill",
                                progress: waterVM.progressFraction)
                    MacStatCard(label: "Activity", value: "\(exerciseVM.totalCaloriesBurnedToday)", sub: "cal burned today",
                                color: Color.theme.amber, iconName: "flame.fill")
                    MacStatCard(label: "Weight", value: weightValue, sub: weightSub,
                                color: Color.theme.plum, iconName: "scalemass.fill")
                    MacStatCard(label: "Fasting", value: fastingValue, sub: fastingSub,
                                color: Color.theme.saffron, iconName: "moon.fill",
                                progress: fastingVM.progress)
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
        .task {
            async let c: () = calorieVM.loadLogs()
            async let w: () = waterVM.loadTodaysLogs()
            async let wt: () = weightVM.loadLogs()
            async let e: () = exerciseVM.loadLogs()
            _ = await (c, w, wt, e)
        }
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
                            Text("\(remainingCalories)").font(.fraunces(80, weight: .regular))
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
                        MacRing(size: 96, stroke: 9, progress: calorieProgress,
                                gradient: [.white, .white],
                                trackColor: .white.opacity(0.2))
                        Text("\(calorieProgressPct)%").font(.inter(16, weight: .bold)).foregroundColor(.white)
                    }
                }
                Divider().background(.white.opacity(0.22)).padding(.vertical, 20)
                HStack {
                    heroStat("Eaten", "\(calorieVM.totalCalories) cal")
                    heroStat("Burned", "\(exerciseVM.totalCaloriesBurnedToday) cal")
                    heroStat("Goal", "\(calorieVM.dailyGoal) cal")
                    heroStat("Net", "\(calorieVM.totalCalories - exerciseVM.totalCaloriesBurnedToday) cal")
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
                    let mealTypes: [CalorieLog.MealType] = [.breakfast, .lunch, .snack, .dinner]
                    ForEach(Array(mealTypes.enumerated()), id: \.element) { index, mealType in
                        let logs = calorieVM.logsByMeal[mealType] ?? []
                        plateRow(
                            mealTitle(for: mealType),
                            logs.isEmpty ? "Not logged" : "\(logs.count) item\(logs.count == 1 ? "" : "s")",
                            foodSummary(for: logs),
                            logs.reduce(0) { $0 + $1.calories },
                            done: !logs.isEmpty,
                            divider: index < mealTypes.count - 1
                        )
                    }
                }
            }
        }
    }

    private func mealTitle(for type: CalorieLog.MealType) -> String {
        switch type {
        case .breakfast: return "Breakfast"
        case .lunch: return "Lunch"
        case .dinner: return "Dinner"
        case .snack: return "Snack"
        }
    }

    private func foodSummary(for logs: [CalorieLog]) -> String {
        guard !logs.isEmpty else { return "Add food to complete your day" }
        return logs.prefix(2).map(\.foodName).joined(separator: ", ")
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
                    let logs = todaysExerciseLogs
                    if logs.isEmpty {
                        Text("No exercise logged today")
                            .font(.inter(13))
                            .foregroundColor(Color.theme.dust)
                            .frame(maxWidth: .infinity, alignment: .center)
                            .padding(.vertical, 28)
                    } else {
                        ForEach(Array(logs.prefix(4).enumerated()), id: \.element.id) { index, log in
                            activityRow(
                                log.exerciseName,
                                "\(log.category.rawValue.capitalized) · \(log.durationMinutes) min",
                                log.caloriesBurned,
                                icon: activityIcon(for: log.category)
                            )
                            if index < min(logs.count, 4) - 1 {
                                Divider().background(Color.theme.divider)
                            }
                        }
                    }
                }
            }
        }
    }

    private var todaysExerciseLogs: [ExerciseLog] {
        exerciseVM.logs.filter { Calendar.current.isDateInToday($0.loggedAt) }
    }

    private func activityIcon(for category: ExerciseLog.ExerciseCategory) -> String {
        switch category {
        case .cardio: return "figure.run"
        case .strength: return "dumbbell.fill"
        case .flexibility: return "figure.flexibility"
        case .sports: return "sportscourt.fill"
        case .other: return "flame.fill"
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
