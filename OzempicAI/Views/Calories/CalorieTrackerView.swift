import SwiftUI

struct CalorieTrackerView: View {
    @StateObject private var viewModel = CalorieViewModel()
    @State private var showLogMeal = false
    @State private var showGoalSheet = false
    @State private var goalText = ""

    private func mealIcon(for type: CalorieLog.MealType) -> String {
        switch type {
        case .breakfast: return "sunrise.fill"
        case .lunch: return "sun.max.fill"
        case .dinner: return "moon.fill"
        case .snack: return "leaf.fill"
        }
    }

    private func mealCalories(for type: CalorieLog.MealType) -> Int {
        (viewModel.logsByMeal[type] ?? []).reduce(0) { $0 + $1.calories }
    }

    private var dateLabel: String {
        if Calendar.current.isDateInToday(viewModel.selectedDate) {
            return "Today"
        } else if Calendar.current.isDateInYesterday(viewModel.selectedDate) {
            return "Yesterday"
        } else {
            let formatter = DateFormatter()
            formatter.dateFormat = "MMM d, yyyy"
            return formatter.string(from: viewModel.selectedDate)
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: AppSpacing.lg) {
                    // Error display
                    if let error = viewModel.errorMessage {
                        HStack(spacing: AppSpacing.sm) {
                            Image(systemName: "exclamationmark.triangle.fill")
                            Text(error)
                        }
                        .font(.caption.bold())
                        .foregroundColor(Color.theme.darkNavy)
                        .padding(AppSpacing.sm)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.theme.amber.opacity(0.2))
                        .cornerRadius(AppRadius.small)
                    }

                    // Date navigation
                    HStack {
                        Button { viewModel.goToPreviousDay() } label: {
                            Image(systemName: "chevron.left")
                                .font(.title3.bold())
                                .foregroundStyle(Color.theme.mediumBlue)
                        }

                        Spacer()

                        VStack(spacing: 2) {
                            Text(dateLabel)
                                .font(.headline)
                                .foregroundColor(Color.theme.primaryText)

                            if !viewModel.isToday {
                                Button("Go to Today") {
                                    viewModel.goToToday()
                                }
                                .font(.caption)
                                .foregroundStyle(Color.theme.mediumBlue)
                            }
                        }

                        Spacer()

                        Button { viewModel.goToNextDay() } label: {
                            Image(systemName: "chevron.right")
                                .font(.title3.bold())
                                .foregroundStyle(viewModel.isToday
                                    ? Color.theme.lightBlue.opacity(0.4)
                                    : Color.theme.mediumBlue)
                        }
                        .disabled(viewModel.isToday)
                    }
                    .padding(.horizontal, AppSpacing.sm)

                    // Hero: circular progress
                    ZStack {
                        CircularProgressView(
                            progress: viewModel.dailyGoal > 0
                                ? Double(viewModel.totalCalories) / Double(viewModel.dailyGoal)
                                : 0,
                            size: 180,
                            lineWidth: 18,
                            progressColor: Color.theme.amber
                        )

                        VStack(spacing: AppSpacing.xs) {
                            Image(systemName: "flame.fill")
                                .font(.title2)
                                .foregroundStyle(Color.theme.orange)

                            Text("\(viewModel.totalCalories)")
                                .font(.system(size: 36, weight: .bold, design: .rounded))
                                .foregroundColor(Color.theme.primaryText)

                            // Tappable goal
                            Button {
                                goalText = "\(viewModel.dailyGoal)"
                                showGoalSheet = true
                            } label: {
                                HStack(spacing: 4) {
                                    Text("/ \(viewModel.dailyGoal) cal")
                                        .font(.subheadline)
                                    Image(systemName: "pencil.circle.fill")
                                        .font(.caption)
                                }
                                .foregroundColor(Color.theme.secondaryText)
                            }
                        }
                    }

                    // Remaining label
                    let remaining = max(viewModel.dailyGoal - viewModel.totalCalories, 0)
                    Text("\(remaining) cal remaining")
                        .font(.subheadline.bold())
                        .foregroundColor(Color.theme.mediumBlue)

                    // Meal type cards
                    ForEach(CalorieLog.MealType.allCases, id: \.self) { mealType in
                        let logs = viewModel.logsByMeal[mealType] ?? []

                        VStack(alignment: .leading, spacing: AppSpacing.sm) {
                            // Header
                            HStack(spacing: AppSpacing.sm) {
                                Image(systemName: mealIcon(for: mealType))
                                    .font(.title3)
                                    .foregroundStyle(Color.theme.amber)
                                    .frame(width: 32)

                                Text(mealType.rawValue.capitalized)
                                    .font(.headline)
                                    .foregroundColor(Color.theme.primaryText)

                                Spacer()

                                Text("\(mealCalories(for: mealType)) cal")
                                    .font(.subheadline.bold())
                                    .foregroundColor(Color.theme.secondaryText)
                            }

                            // Food items
                            if !logs.isEmpty {
                                Divider()
                                    .background(Color.theme.lightBlue)

                                ForEach(logs) { log in
                                    HStack {
                                        Text(log.foodName)
                                            .font(.subheadline)
                                            .foregroundColor(Color.theme.primaryText)
                                        Spacer()
                                        Text("\(log.calories) cal")
                                            .font(.caption)
                                            .foregroundColor(Color.theme.secondaryText)
                                    }
                                    .padding(.vertical, 2)
                                }
                            }
                        }
                        .cardStyle()
                    }
                }
                .padding(.horizontal)
                .padding(.bottom, AppSpacing.lg)
            }
            .screenBackground()
            .navigationTitle("Calories")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button { showLogMeal = true } label: {
                        Image(systemName: "plus.circle.fill")
                            .foregroundStyle(Color.theme.orange)
                            .font(.title3)
                    }
                }
            }
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
    }
}
