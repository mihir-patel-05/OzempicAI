import SwiftUI

struct CalorieTrackerView: View {
    @EnvironmentObject var viewModel: CalorieViewModel
    @State private var showLogMeal = false
    @State private var showGoalSheet = false
    @State private var goalText = ""

    private func mealIcon(for type: CalorieLog.MealType) -> String {
        switch type {
        case .breakfast: return "sunrise.fill"
        case .lunch:     return "sun.max.fill"
        case .dinner:    return "moon.fill"
        case .snack:     return "leaf.fill"
        }
    }

    private func mealAccent(for type: CalorieLog.MealType) -> Color {
        switch type {
        case .breakfast: return Color.theme.amber
        case .lunch:     return Color.theme.terracotta
        case .dinner:    return Color.theme.plum
        case .snack:     return Color.theme.sage
        }
    }

    private func mealCalories(for type: CalorieLog.MealType) -> Int {
        (viewModel.logsByMeal[type] ?? []).reduce(0) { $0 + $1.calories }
    }

    private var dateLabel: String {
        if Calendar.current.isDateInToday(viewModel.selectedDate) { return "Today" }
        if Calendar.current.isDateInYesterday(viewModel.selectedDate) { return "Yesterday" }
        let f = DateFormatter()
        f.dateFormat = "MMM d, yyyy"
        return f.string(from: viewModel.selectedDate)
    }

    private var progress: Double {
        guard viewModel.dailyGoal > 0 else { return 0 }
        return min(Double(viewModel.totalCalories) / Double(viewModel.dailyGoal), 1.0)
    }

    private var remaining: Int { max(viewModel.dailyGoal - viewModel.totalCalories, 0) }

    var body: some View {
        ScrollView {
            VStack(spacing: AppSpacing.md) {
                ScreenHeader(title: "Calories", subtitle: dateLabel) {
                    showLogMeal = true
                }

                if let error = viewModel.errorMessage {
                    errorBanner(error)
                        .padding(.horizontal, AppSpacing.md + 4)
                }

                dateNav
                heroRing
                mealList
                Spacer(minLength: 40)
            }
            .padding(.bottom, 100)
        }
        .screenBackground()
        .sheet(isPresented: $showLogMeal) {
            LogMealView(viewModel: viewModel)
        }
        .alert("Set Daily Calorie Goal", isPresented: $showGoalSheet) {
            TextField("Calories", text: $goalText)
                .keyboardType(.numberPad)
            Button("Save") {
                if let goal = Int(goalText), goal > 0 {
                    Task { await viewModel.updateDailyGoal(goal) }
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Enter your daily calorie target")
        }
        .task {
            await viewModel.loadUserGoal()
            await viewModel.loadLogs()
        }
    }

    // MARK: - Date nav

    private var dateNav: some View {
        HStack {
            Button { viewModel.goToPreviousDay() } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(Color.theme.coffee)
                    .frame(width: 36, height: 36)
                    .background(Color.theme.paper)
                    .clipShape(Circle())
                    .shadow(color: Color.theme.shadow, radius: 4, x: 0, y: 1)
            }
            Spacer()
            VStack(spacing: 2) {
                Text(dateLabel)
                    .font(AppFont.display(18, weight: .medium))
                    .foregroundColor(Color.theme.espresso)
                if !viewModel.isToday {
                    Button("Jump to today") { viewModel.goToToday() }
                        .font(AppFont.ui(12, weight: .semibold))
                        .foregroundColor(Color.theme.terracotta)
                }
            }
            Spacer()
            Button { viewModel.goToNextDay() } label: {
                Image(systemName: "chevron.right")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(viewModel.isToday ? Color.theme.dust : Color.theme.coffee)
                    .frame(width: 36, height: 36)
                    .background(Color.theme.paper)
                    .clipShape(Circle())
                    .shadow(color: Color.theme.shadow, radius: 4, x: 0, y: 1)
            }
            .disabled(viewModel.isToday)
        }
        .padding(.horizontal, AppSpacing.md + 4)
    }

    // MARK: - Hero ring

    private var heroRing: some View {
        VStack(spacing: AppSpacing.md) {
            ZStack {
                ProgressRing(
                    progress: progress,
                    size: 220,
                    lineWidth: 16,
                    gradient: [Color.theme.terracotta, Color.theme.amber]
                )
                VStack(spacing: 4) {
                    CapsLabel(text: "Eaten")
                    Text("\(viewModel.totalCalories)")
                        .font(AppFont.display(52, weight: .regular))
                        .foregroundColor(Color.theme.espresso)
                        .kerning(-1)
                    Button {
                        goalText = "\(viewModel.dailyGoal)"
                        showGoalSheet = true
                    } label: {
                        HStack(spacing: 4) {
                            Text("of \(viewModel.dailyGoal) cal")
                                .font(AppFont.ui(13))
                            Image(systemName: "pencil")
                                .font(.system(size: 10, weight: .bold))
                        }
                        .foregroundColor(Color.theme.coffee)
                    }
                }
            }
            .padding(.top, AppSpacing.sm)

            Text(remaining > 0 ? "\(remaining) cal remaining" : "Goal hit — nice work")
                .font(AppFont.display(16, weight: .regular, italic: true))
                .foregroundColor(Color.theme.terracottaDeep)
        }
        .padding(.vertical, AppSpacing.lg)
        .frame(maxWidth: .infinity)
        .background(Color.theme.paper)
        .cornerRadius(AppRadius.large)
        .shadow(color: Color.theme.shadow, radius: 10, x: 0, y: 2)
        .padding(.horizontal, AppSpacing.md + 4)
    }

    // MARK: - Meal list

    private var mealList: some View {
        VStack(spacing: 12) {
            ForEach(CalorieLog.MealType.allCases, id: \.self) { type in
                mealCard(type)
            }
        }
        .padding(.horizontal, AppSpacing.md + 4)
    }

    private func mealCard(_ type: CalorieLog.MealType) -> some View {
        let logs = viewModel.logsByMeal[type] ?? []
        let accent = mealAccent(for: type)

        return VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                ZStack {
                    Circle().fill(accent.opacity(0.15))
                    Image(systemName: mealIcon(for: type))
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(accent)
                }
                .frame(width: 32, height: 32)

                Text(type.rawValue.capitalized)
                    .font(AppFont.display(18, weight: .medium))
                    .foregroundColor(Color.theme.espresso)

                Spacer()

                Text("\(mealCalories(for: type)) cal")
                    .font(AppFont.ui(13, weight: .semibold))
                    .foregroundColor(Color.theme.coffee)
            }

            if logs.isEmpty {
                Text("Nothing logged")
                    .font(AppFont.ui(13))
                    .foregroundColor(Color.theme.dust)
            } else {
                VStack(spacing: 8) {
                    ForEach(logs) { log in
                        HStack {
                            Text(log.foodName)
                                .font(AppFont.ui(14))
                                .foregroundColor(Color.theme.espresso)
                            Spacer()
                            Text("\(log.calories) cal")
                                .font(AppFont.ui(12))
                                .foregroundColor(Color.theme.dust)
                            Button {
                                Task { await viewModel.deleteLog(log) }
                            } label: {
                                Image(systemName: "trash")
                                    .font(.system(size: 11))
                                    .foregroundColor(Color.theme.ember.opacity(0.8))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
        }
        .padding(AppSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.theme.paper)
        .cornerRadius(AppRadius.large)
        .shadow(color: Color.theme.shadow, radius: 8, x: 0, y: 2)
    }

    // MARK: - Error

    private func errorBanner(_ text: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundColor(Color.theme.ember)
            Text(text)
                .font(AppFont.ui(13, weight: .medium))
                .foregroundColor(Color.theme.espresso)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.theme.ember.opacity(0.12))
        .cornerRadius(AppRadius.small)
    }
}
