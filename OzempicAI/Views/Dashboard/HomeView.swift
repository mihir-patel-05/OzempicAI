import SwiftUI

struct HomeView: View {
    @EnvironmentObject var authVM: AuthViewModel
    @EnvironmentObject var calorieVM: CalorieViewModel
    @EnvironmentObject var waterVM: WaterViewModel
    @EnvironmentObject var exerciseVM: ExerciseViewModel
    @EnvironmentObject var fastingVM: FastingViewModel
    @EnvironmentObject var weightVM: WeightViewModel

    // MARK: - Derived values

    private var eaten: Int { calorieVM.totalCalories }
    private var goal: Int { max(calorieVM.dailyGoal, 1) }
    private var burned: Int { exerciseVM.totalCaloriesBurnedToday }
    private var remaining: Int { goal - eaten + burned }
    private var calsPct: Double { min(Double(eaten) / Double(goal), 1.0) }

    private var greeting: String {
        let h = Calendar.current.component(.hour, from: Date())
        switch h {
        case 5..<12:  return "Good morning,"
        case 12..<17: return "Good afternoon,"
        case 17..<22: return "Good evening,"
        default:      return "Hello,"
        }
    }

    private var todayLabel: String {
        let f = DateFormatter()
        f.dateFormat = "EEEE, MMM d"
        return f.string(from: Date())
    }

    private var avatarInitial: String {
        // Supabase auth's email may live in the session user rather than our own
        // User model; fall back to a neutral glyph if we can't derive a letter.
        "A"
    }

    private var waterLiters: String {
        String(format: "%.1fL", Double(waterVM.totalMlToday) / 1000.0)
    }

    private var waterGoalLiters: String {
        String(format: "%.1fL", Double(waterVM.dailyGoalMl) / 1000.0)
    }

    private var weightKg: String {
        if let latest = weightVM.latestWeight {
            return String(format: "%.1f", latest.weightKg)
        }
        return "—"
    }

    private var weightSub: String {
        guard weightVM.canShowChart else { return "kg · log to track" }
        let delta = weightVM.trendDelta
        let arrow = delta < 0 ? "−" : "+"
        return String(format: "kg · %@%.1f last entry", arrow, abs(delta))
    }

    private var fastingProgress: Double {
        if fastingVM.isActive || fastingVM.isComplete {
            return fastingVM.progress
        }
        return 0
    }

    private var fastingDisplay: String {
        if fastingVM.isActive {
            return timeString(fastingVM.timeElapsed)
        }
        if fastingVM.isComplete { return "Done" }
        return "—"
    }

    private var fastingSub: String {
        if fastingVM.isActive {
            return "of \(fastingVM.selectedHours)h · active"
        }
        if fastingVM.isComplete {
            return "\(fastingVM.selectedHours)h complete"
        }
        return "tap Movement to start"
    }

    private func timeString(_ interval: TimeInterval) -> String {
        let total = Int(max(interval, 0))
        let h = total / 3600
        let m = (total % 3600) / 60
        return String(format: "%d:%02d", h, m)
    }

    // MARK: - Body

    var body: some View {
        ScrollView {
            VStack(spacing: AppSpacing.md) {
                greetingRow
                heroCard
                statGrid
                mealsSection
                insightCard.padding(.horizontal, AppSpacing.md + 4)
                Spacer(minLength: 40)
            }
            .padding(.bottom, 100)
        }
        .screenBackground()
        .task { await refresh() }
        .refreshable { await refresh() }
    }

    private func refresh() async {
        async let a: () = calorieVM.loadLogs()
        async let b: () = waterVM.loadTodaysLogs()
        async let c: () = exerciseVM.loadLogs()
        async let d: () = weightVM.loadLogs()
        _ = await (a, b, c, d)
    }

    // MARK: - Sections

    private var greetingRow: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 4) {
                CapsLabel(text: todayLabel)
                Text(greeting)
                    .font(AppFont.display(28, weight: .regular))
                    .foregroundColor(Color.theme.espresso)
            }
            Spacer()
            ZStack {
                LinearGradient(colors: [Color.theme.terracotta, Color.theme.amber],
                               startPoint: .topLeading, endPoint: .bottomTrailing)
                    .clipShape(Circle())
                Text(avatarInitial).font(AppFont.display(17, weight: .medium)).foregroundColor(.white)
            }
            .frame(width: 42, height: 42)
        }
        .padding(.horizontal, AppSpacing.lg)
        .padding(.top, AppSpacing.sm)
    }

    private var heroCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 8) {
                    CapsLabel(text: "Today's energy", color: Color.white.opacity(0.75))
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text("\(max(remaining, 0).formatted())")
                            .font(AppFont.display(64, weight: .regular))
                            .kerning(-1.5)
                            .foregroundColor(.white)
                        Text(remaining >= 0 ? "cal left" : "over")
                            .font(AppFont.ui(14))
                            .foregroundColor(.white.opacity(0.75))
                    }
                    Text(heroSubline)
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
                heroSubStat(label: "Eaten", value: eaten.formatted(), align: .leading)
                Spacer()
                heroSubStat(label: "Burned", value: "\(burned)", align: .center)
                Spacer()
                heroSubStat(label: "Goal", value: goal.formatted(), align: .trailing)
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
    }

    private var heroSubline: String {
        if eaten == 0 { return "ready to start the day" }
        if calsPct < 0.5 { return "plenty left for today" }
        if calsPct < 0.9 { return "on track for your goal" }
        if calsPct <= 1.0 { return "almost at your goal" }
        return "over your daily goal"
    }

    private var statGrid: some View {
        LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible())],
                  spacing: 12) {
            StatCard(
                label: "Water",
                value: waterLiters,
                sub: "of \(waterGoalLiters)",
                progress: waterVM.progressFraction,
                color: Color.theme.sage,
                systemImage: "drop.fill"
            )
            StatCard(
                label: "Burned",
                value: "\(burned)",
                sub: "cal today",
                progress: min(Double(burned) / 500.0, 1.0),
                color: Color.theme.amber,
                systemImage: "flame.fill"
            )
            StatCard(
                label: "Weight",
                value: weightKg,
                sub: weightSub,
                progress: weightVM.canShowChart ? 0.68 : 0,
                color: Color.theme.plum,
                systemImage: "scalemass.fill",
                trendDown: weightVM.trend == .losing
            )
            StatCard(
                label: "Fasting",
                value: fastingDisplay,
                sub: fastingSub,
                progress: fastingProgress,
                color: Color.theme.saffron,
                systemImage: "moon.stars.fill",
                pulse: fastingVM.isActive
            )
        }
        .padding(.horizontal, AppSpacing.md + 4)
    }

    private var mealsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline) {
                Text("Today's plate")
                    .font(AppFont.display(22, weight: .medium))
                    .foregroundColor(Color.theme.espresso)
                Spacer()
            }
            .padding(.horizontal, 4)

            if calorieVM.logs.isEmpty {
                emptyMeals
            } else {
                mealsList
            }
        }
        .padding(.horizontal, AppSpacing.md + 4)
        .padding(.top, AppSpacing.sm)
    }

    private var emptyMeals: some View {
        VStack(spacing: 8) {
            Image(systemName: "fork.knife")
                .font(.system(size: 26))
                .foregroundColor(Color.theme.dust)
            Text("No meals logged yet")
                .font(AppFont.ui(14, weight: .medium))
                .foregroundColor(Color.theme.coffee)
            Text("Head to the Nutrition tab to log something.")
                .font(AppFont.ui(12))
                .foregroundColor(Color.theme.dust)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 32)
        .background(Color.theme.paper)
        .cornerRadius(AppRadius.large)
        .shadow(color: Color.theme.shadow, radius: 10, x: 0, y: 2)
    }

    private var mealsList: some View {
        VStack(spacing: 0) {
            ForEach(Array(CalorieLog.MealType.allCases.enumerated()), id: \.element) { idx, type in
                let logs = calorieVM.logsByMeal[type] ?? []
                if !logs.isEmpty {
                    mealRow(
                        title: type.rawValue.capitalized,
                        time: logs.first.map { timeShort($0.loggedAt) } ?? "",
                        detail: summaryLine(logs: logs),
                        calories: logs.reduce(0) { $0 + $1.calories }
                    )
                    if idx < CalorieLog.MealType.allCases.count - 1 {
                        Divider().background(Color.theme.divider).padding(.leading, 76)
                    }
                }
            }
        }
        .background(Color.theme.paper)
        .cornerRadius(AppRadius.large)
        .shadow(color: Color.theme.shadow, radius: 10, x: 0, y: 2)
    }

    private func summaryLine(logs: [CalorieLog]) -> String {
        if logs.count == 1 { return logs[0].foodName }
        let first = logs[0].foodName
        return "\(first) +\(logs.count - 1) more"
    }

    private func timeShort(_ date: Date) -> String {
        let f = DateFormatter()
        f.timeStyle = .short
        return f.string(from: date)
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

    private func mealRow(title: String, time: String, detail: String, calories: Int) -> some View {
        HStack(spacing: 14) {
            ZStack {
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.theme.terracotta.opacity(0.1))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(
                        Color.theme.terracotta.opacity(0.2), lineWidth: 1))
                Image(systemName: "checkmark")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundColor(Color.theme.terracotta)
            }
            .frame(width: 38, height: 38)

            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 8) {
                    Text(title).font(AppFont.ui(15, weight: .semibold)).foregroundColor(Color.theme.espresso)
                    if !time.isEmpty {
                        Text(time).font(.system(size: 11, weight: .medium)).foregroundColor(Color.theme.dust)
                    }
                }
                Text(detail).font(AppFont.ui(13)).foregroundColor(Color.theme.coffee)
                    .lineLimit(1)
            }
            Spacer()
            HStack(alignment: .lastTextBaseline, spacing: 2) {
                Text("\(calories)").font(AppFont.display(18, weight: .medium)).foregroundColor(Color.theme.espresso)
                Text("cal").font(.system(size: 10, weight: .medium)).foregroundColor(Color.theme.dust)
            }
        }
        .padding(.horizontal, 20).padding(.vertical, 14)
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
                Text(insightText)
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

    private var insightText: String {
        if waterVM.progressFraction >= 1.0 {
            return "You've hit your water goal today — nicely done."
        }
        if burned >= 300 {
            return "You've burned \(burned) cal today from movement. Strong pace."
        }
        if calorieVM.logs.count >= 3 {
            return "\(calorieVM.logs.count) meals logged so far — keeping consistent."
        }
        return "Small steps add up. Log a meal or a glass of water to get started."
    }
}
