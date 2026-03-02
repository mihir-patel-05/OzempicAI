import SwiftUI
import Charts

struct MacCalorieOverview: View {
    @StateObject private var viewModel = CalorieViewModel()
    @State private var weekStart = WeekNavigator.mondayOfWeek(containing: .now)
    @State private var selectedDay: Date?

    // Quick add state
    @State private var foodName = ""
    @State private var calories = ""
    @State private var mealType: CalorieLog.MealType = .lunch

    private var daysOfWeek: [Date] {
        (0..<7).compactMap { Calendar.current.date(byAdding: .day, value: $0, to: weekStart) }
    }

    private func dailyTotal(for date: Date) -> Int {
        let calendar = Calendar.current
        return viewModel.weekLogs
            .filter { calendar.isDate($0.loggedAt, inSameDayAs: date) }
            .reduce(0) { $0 + $1.calories }
    }

    private var displayDay: Date {
        selectedDay ?? Date()
    }

    private var displayDayLogs: [CalorieLog] {
        let calendar = Calendar.current
        return viewModel.weekLogs.filter {
            calendar.isDate($0.loggedAt, inSameDayAs: displayDay)
        }
    }

    private var displayDayLogsByMeal: [CalorieLog.MealType: [CalorieLog]] {
        Dictionary(grouping: displayDayLogs, by: \.mealType)
    }

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("Calories This Week")
                    .font(.title2)
                    .fontWeight(.bold)

                Spacer()

                Text("Goal: \(viewModel.dailyGoal)/day")
                    .font(.subheadline)
                    .foregroundColor(.secondary)

                WeekNavigator(weekStart: $weekStart)
            }
            .padding()

            Divider()

            ScrollView {
                VStack(spacing: 20) {
                    // Bar chart
                    Chart {
                        ForEach(daysOfWeek, id: \.self) { day in
                            BarMark(
                                x: .value("Day", day.formatted(.dateTime.weekday(.abbreviated))),
                                y: .value("Calories", dailyTotal(for: day))
                            )
                            .foregroundStyle(
                                dailyTotal(for: day) > viewModel.dailyGoal
                                    ? Color.theme.orange
                                    : Color.theme.mediumBlue
                            )
                        }

                        RuleMark(y: .value("Goal", viewModel.dailyGoal))
                            .foregroundStyle(Color.theme.amber)
                            .lineStyle(StrokeStyle(dash: [5, 5]))
                            .annotation(position: .trailing) {
                                Text("Goal")
                                    .font(.caption2)
                                    .foregroundColor(Color.theme.amber)
                            }
                    }
                    .frame(height: 220)
                    .chartYAxis {
                        AxisMarks(position: .leading)
                    }
                    .padding()
                    .cardStyle()

                    // Bottom section: Today's log + Quick add
                    HStack(alignment: .top, spacing: 16) {
                        // Day breakdown
                        VStack(alignment: .leading, spacing: 12) {
                            Text(displayDay.formatted(.dateTime.weekday(.wide).month().day()))
                                .font(.headline)

                            let mealTypes: [CalorieLog.MealType] = [.breakfast, .lunch, .dinner, .snack]
                            ForEach(mealTypes, id: \.self) { type in
                                let meals = displayDayLogsByMeal[type] ?? []
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(mealTypeLabel(type))
                                        .font(.caption)
                                        .fontWeight(.semibold)
                                        .foregroundColor(.secondary)

                                    if meals.isEmpty {
                                        Text("(nothing logged)")
                                            .font(.caption)
                                            .foregroundColor(.secondary)
                                            .italic()
                                    } else {
                                        ForEach(meals) { log in
                                            HStack {
                                                Text(log.foodName)
                                                    .font(.body)
                                                Spacer()
                                                Text("\(log.calories) cal")
                                                    .font(.caption)
                                                    .foregroundColor(.secondary)
                                            }
                                        }
                                    }
                                }
                            }

                            Divider()

                            HStack {
                                Text("Total")
                                    .fontWeight(.semibold)
                                Spacer()
                                Text("\(displayDayLogs.reduce(0) { $0 + $1.calories }) / \(viewModel.dailyGoal)")
                                    .fontWeight(.semibold)
                            }
                        }
                        .padding()
                        .cardStyle()
                        .frame(maxWidth: .infinity)

                        // Quick add form
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Quick Add")
                                .font(.headline)

                            TextField("Food", text: $foodName)
                                .textFieldStyle(.roundedBorder)

                            TextField("Calories", text: $calories)
                                .textFieldStyle(.roundedBorder)

                            Picker("Meal", selection: $mealType) {
                                ForEach([CalorieLog.MealType.breakfast, .lunch, .dinner, .snack], id: \.self) { type in
                                    Text(type.rawValue.capitalized).tag(type)
                                }
                            }
                            .pickerStyle(.segmented)

                            Button("Log Food") {
                                Task {
                                    await viewModel.logFood(
                                        name: foodName,
                                        calories: Int(calories) ?? 0,
                                        mealType: mealType,
                                        date: displayDay
                                    )
                                    foodName = ""
                                    calories = ""
                                    await viewModel.loadWeekLogs(for: weekStart)
                                }
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(Color.theme.ctaButton)
                            .disabled(foodName.isEmpty || calories.isEmpty)
                        }
                        .padding()
                        .cardStyle()
                        .frame(maxWidth: 300)
                    }
                    .padding(.horizontal)
                }
                .padding(.bottom)
            }
        }
        .screenBackground()
        .onChange(of: weekStart) { _ in
            Task { await viewModel.loadWeekLogs(for: weekStart) }
        }
        .task {
            await viewModel.loadWeekLogs(for: weekStart)
            await viewModel.loadUserGoal()
        }
    }

    private func mealTypeLabel(_ type: CalorieLog.MealType) -> String {
        switch type {
        case .breakfast: return "Breakfast"
        case .lunch:     return "Lunch"
        case .dinner:    return "Dinner"
        case .snack:     return "Snack"
        }
    }
}
