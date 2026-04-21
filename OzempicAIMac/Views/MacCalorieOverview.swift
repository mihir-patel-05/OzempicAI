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

    private static let dayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    private func dailyTotal(for date: Date) -> Int {
        let dateString = Self.dayFormatter.string(from: date)
        return viewModel.weekLogs
            .filter { Self.dayFormatter.string(from: $0.loggedAt) == dateString }
            .reduce(0) { $0 + $1.calories }
    }

    private var displayDay: Date {
        selectedDay ?? Date()
    }

    private var displayDayLogs: [CalorieLog] {
        let dateString = Self.dayFormatter.string(from: displayDay)
        return viewModel.weekLogs.filter {
            Self.dayFormatter.string(from: $0.loggedAt) == dateString
        }
    }

    private var displayDayLogsByMeal: [CalorieLog.MealType: [CalorieLog]] {
        Dictionary(grouping: displayDayLogs, by: \.mealType)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                HStack(alignment: .bottom) {
                    MacPageHeader(title: "Nutrition", subtitle: "Calories this week", actionTitle: nil)
                    Spacer()
                    Text("Goal: \(viewModel.dailyGoal)/day")
                        .font(.inter(12, weight: .semibold))
                        .foregroundColor(Color.theme.coffee)
                    WeekNavigator(weekStart: $weekStart)
                }

                MacCard {
                    Chart {
                        ForEach(daysOfWeek, id: \.self) { day in
                            BarMark(
                                x: .value("Day", day.formatted(.dateTime.weekday(.abbreviated))),
                                y: .value("Calories", dailyTotal(for: day))
                            )
                            .foregroundStyle(
                                dailyTotal(for: day) > viewModel.dailyGoal
                                    ? Color.theme.ember
                                    : Color.theme.terracotta
                            )
                        }
                        RuleMark(y: .value("Goal", viewModel.dailyGoal))
                            .foregroundStyle(Color.theme.saffron)
                            .lineStyle(StrokeStyle(dash: [5, 5]))
                            .annotation(position: .trailing) {
                                Text("Goal")
                                    .font(.inter(10, weight: .semibold))
                                    .foregroundColor(Color.theme.saffron)
                            }
                    }
                    .frame(height: 220)
                    .chartYAxis { AxisMarks(position: .leading) }
                }

                HStack(alignment: .top, spacing: 16) {
                    MacCard {
                        VStack(alignment: .leading, spacing: 12) {
                            Text(displayDay.formatted(.dateTime.weekday(.wide).month().day()))
                                .font(.fraunces(18, weight: .medium))
                                .foregroundColor(Color.theme.espresso)

                            let mealTypes: [CalorieLog.MealType] = [.breakfast, .lunch, .dinner, .snack]
                            ForEach(mealTypes, id: \.self) { type in
                                let meals = displayDayLogsByMeal[type] ?? []
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(mealTypeLabel(type).uppercased())
                                        .font(.inter(10, weight: .bold))
                                        .tracking(1.0)
                                        .foregroundColor(Color.theme.coffee)
                                    if meals.isEmpty {
                                        Text("(nothing logged)")
                                            .font(.inter(12))
                                            .foregroundColor(Color.theme.dust)
                                            .italic()
                                    } else {
                                        ForEach(meals) { log in
                                            HStack {
                                                Text(log.foodName)
                                                    .font(.inter(13))
                                                    .foregroundColor(Color.theme.espresso)
                                                Spacer()
                                                Text("\(log.calories) cal")
                                                    .font(.inter(11, weight: .medium))
                                                    .foregroundColor(Color.theme.dust)
                                                Button {
                                                    Task {
                                                        await viewModel.deleteLog(log)
                                                        await viewModel.loadWeekLogs(for: weekStart)
                                                    }
                                                } label: {
                                                    Image(systemName: "xmark.circle.fill")
                                                        .foregroundColor(Color.theme.dust)
                                                }
                                                .buttonStyle(.plain)
                                                .help("Remove")
                                            }
                                            .contextMenu {
                                                Button("Delete", role: .destructive) {
                                                    Task {
                                                        await viewModel.deleteLog(log)
                                                        await viewModel.loadWeekLogs(for: weekStart)
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            Divider().background(Color.theme.divider)
                            HStack {
                                Text("Total").font(.inter(13, weight: .semibold))
                                    .foregroundColor(Color.theme.espresso)
                                Spacer()
                                Text("\(displayDayLogs.reduce(0) { $0 + $1.calories }) / \(viewModel.dailyGoal)")
                                    .font(.fraunces(16, weight: .medium))
                                    .foregroundColor(Color.theme.espresso)
                            }
                        }
                    }
                    .frame(maxWidth: .infinity)

                    MacCard {
                        VStack(alignment: .leading, spacing: 12) {
                            MacSectionTitle(text: "Quick add")
                            TextField("Food", text: $foodName).textFieldStyle(.roundedBorder)
                            TextField("Calories", text: $calories).textFieldStyle(.roundedBorder)
                            Picker("Meal", selection: $mealType) {
                                ForEach([CalorieLog.MealType.breakfast, .lunch, .dinner, .snack], id: \.self) { type in
                                    Text(type.rawValue.capitalized).tag(type)
                                }
                            }
                            .pickerStyle(.segmented)
                            Button("Log food") {
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
                            .tint(Color.theme.terracotta)
                            .disabled(foodName.isEmpty || calories.isEmpty)
                        }
                    }
                    .frame(maxWidth: 320)
                }
            }
            .padding(32)
        }
        .background(Color.theme.cream)
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
