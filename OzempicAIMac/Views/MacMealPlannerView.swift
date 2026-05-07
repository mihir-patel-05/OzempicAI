import SwiftUI

struct MacMealPlannerView: View {
    @StateObject private var viewModel = MealPlanViewModel()
    @StateObject private var calorieVM = CalorieViewModel()
    @State private var weekStart = WeekNavigator.mondayOfWeek(containing: .now)
    @State private var showAddSheet = false
    @State private var addMealType: MealPlan.MealType = .breakfast
    @State private var addDate: Date = .now
    @State private var editingMeal: MealPlan?

    private let mealTypes: [MealPlan.MealType] = [.breakfast, .lunch, .dinner, .snack]

    private var daysOfWeek: [Date] {
        (0..<7).compactMap { Calendar.current.date(byAdding: .day, value: $0, to: weekStart) }
    }

    private static let dayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    private func dateString(for date: Date) -> String {
        Self.dayFormatter.string(from: date)
    }

    private func mealPlan(_ plan: MealPlan, matches date: Date, type: MealPlan.MealType) -> Bool {
        plan.plannedDate == dateString(for: date) && plan.mealType == type
    }

    private func meals(in plans: [MealPlan], for date: Date, type: MealPlan.MealType) -> [MealPlan] {
        plans.filter { mealPlan($0, matches: date, type: type) }
    }

    private func meals(for date: Date, type: MealPlan.MealType) -> [MealPlan] {
        meals(in: viewModel.weeklyPlans, for: date, type: type)
    }

    private func dailyTotal(for date: Date) -> Int {
        viewModel.weeklyPlans
            .filter { $0.plannedDate == dateString(for: date) }
            .reduce(0) { $0 + $1.calories }
    }

    private func totalColor(for total: Int) -> Color {
        let goal = calorieVM.dailyGoal
        if total == 0 { return .secondary }
        if total <= goal { return .green }
        if total <= Int(Double(goal) * 1.1) { return Color.theme.amber }
        return .red
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                HStack(alignment: .bottom) {
                    MacPageHeader(title: "Meal plan", subtitle: "This week", actionTitle: nil)
                    Spacer()
                    WeekNavigator(weekStart: $weekStart)
                    Spacer()
                    Button("Copy week") { Task { await copyWeekToNext() } }
                    Button {
                        addDate = weekStart
                        addMealType = .breakfast
                        showAddSheet = true
                    } label: {
                        Label("Add", systemImage: "plus")
                            .font(.inter(13, weight: .semibold))
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(Color.theme.terracotta)
                }

                HStack(spacing: 8) {
                    ForEach(daysOfWeek, id: \.self) { day in
                        dayColumn(for: day)
                    }
                }
                .frame(minHeight: 560)
            }
            .padding(32)
        }
        .background(Color.theme.cream)
        .onChange(of: weekStart) { _ in
            Task { await viewModel.loadWeeklyPlans(for: weekStart) }
        }
        .task {
            await viewModel.loadWeeklyPlans(for: weekStart)
            await calorieVM.loadUserGoal()
        }
        .sheet(isPresented: $showAddSheet) {
            AddMealSheet(viewModel: viewModel, date: addDate, mealType: addMealType, weekStart: weekStart)
        }
        .sheet(item: $editingMeal) { meal in
            EditMealSheet(viewModel: viewModel, meal: meal, weekStart: weekStart)
        }
    }

    @ViewBuilder
    private func dayColumn(for date: Date) -> some View {
        let isToday = Calendar.current.isDateInToday(date)
        let total = dailyTotal(for: date)

        VStack(spacing: 8) {
            VStack(spacing: 2) {
                Text(date.formatted(.dateTime.weekday(.abbreviated)))
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundColor(isToday ? Color.theme.terracotta : Color.theme.coffee)
                Text(date.formatted(.dateTime.day()))
                    .font(.title3)
                    .fontWeight(isToday ? .bold : .regular)
                    .foregroundColor(isToday ? Color.theme.terracotta : Color.theme.espresso)
            }
            .padding(.vertical, 8)

            Divider()

            HStack(spacing: 4) {
                Text("TOTAL")
                    .font(.system(size: 9, weight: .bold))
                    .tracking(0.8)
                    .foregroundColor(Color.theme.coffee)
                Spacer()
                Text(total > 0 ? "\(total) cal" : "—")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundColor(totalColor(for: total))
            }
            .padding(.horizontal, 6)

            ScrollView {
                VStack(alignment: .leading, spacing: 10) {
                    ForEach(mealTypes, id: \.self) { type in
                        mealTypeSection(date: date, type: type)
                    }
                }
                .padding(.horizontal, 4)
            }

            Spacer()

            Button {
                addDate = date
                addMealType = .breakfast
                showAddSheet = true
            } label: {
                Image(systemName: "plus.circle")
                    .foregroundColor(Color.theme.terracotta)
            }
            .buttonStyle(.plain)
            .padding(.bottom, 8)
        }
        .frame(maxWidth: .infinity)
        .background(isToday ? Color.theme.terracotta.opacity(0.05) : Color.clear)
        .cornerRadius(AppRadius.small)
    }

    @ViewBuilder
    private func mealTypeSection(date: Date, type: MealPlan.MealType) -> some View {
        let plans = meals(for: date, type: type)

        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 4) {
                Text(type.rawValue.uppercased())
                    .font(.system(size: 9, weight: .bold))
                    .tracking(0.8)
                    .foregroundColor(Color.theme.coffee)
                Spacer()
                Button {
                    addDate = date
                    addMealType = type
                    showAddSheet = true
                } label: {
                    Image(systemName: "plus")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundColor(Color.theme.terracotta)
                }
                .buttonStyle(.plain)
            }

            if plans.isEmpty {
                Text("—")
                    .font(.caption2)
                    .foregroundColor(Color.theme.dust)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 4)
            } else {
                VStack(spacing: 4) {
                    ForEach(plans) { plan in
                        Button {
                            editingMeal = plan
                        } label: {
                            HStack(alignment: .top, spacing: 6) {
                                Text(plan.name)
                                    .font(.caption)
                                    .fontWeight(.semibold)
                                    .foregroundColor(Color.theme.espresso)
                                    .lineLimit(2)
                                    .multilineTextAlignment(.leading)

                                Spacer(minLength: 4)

                                Text("\(plan.calories)")
                                    .font(.caption2)
                                    .foregroundColor(Color.theme.coffee)
                                    .lineLimit(1)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(8)
                            .background(Color.theme.terracotta.opacity(0.1))
                            .overlay(
                                RoundedRectangle(cornerRadius: AppRadius.small)
                                    .strokeBorder(Color.theme.terracotta.opacity(0.3), lineWidth: 1)
                            )
                            .cornerRadius(AppRadius.small)
                        }
                        .buttonStyle(.plain)
                        .contextMenu {
                            Button("Delete", role: .destructive) {
                                Task {
                                    await viewModel.deleteMeal(plan)
                                    await viewModel.loadWeeklyPlans(for: weekStart)
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    private func copyWeekToNext() async {
        let calendar = Calendar.current
        let nextWeekStart = calendar.date(byAdding: .weekOfYear, value: 1, to: weekStart)!
        let sourcePlans = viewModel.weeklyPlans

        for day in daysOfWeek {
            let dayOffset = calendar.dateComponents([.day], from: weekStart, to: day).day ?? 0
            let targetDate = calendar.date(byAdding: .day, value: dayOffset, to: nextWeekStart)!

            for mealType in mealTypes {
                let plans = meals(in: sourcePlans, for: day, type: mealType)
                guard !plans.isEmpty else { continue }

                await viewModel.deleteMeal(on: targetDate, mealType: mealType)
                for plan in plans {
                    await viewModel.addMeal(name: plan.name, date: targetDate, mealType: mealType, calories: plan.calories)
                }
            }
        }

        await viewModel.loadWeeklyPlans(for: weekStart)
    }
}

// MARK: - Add Meal Sheet

private struct AddMealSheet: View {
    @ObservedObject var viewModel: MealPlanViewModel
    let date: Date
    let mealType: MealPlan.MealType
    let weekStart: Date
    @Environment(\.dismiss) private var dismiss

    @State private var name = ""
    @State private var calories = ""

    var body: some View {
        VStack(spacing: 16) {
            Text("Add \(mealType.rawValue.capitalized) — \(date.formatted(.dateTime.weekday(.wide).month().day()))")
                .font(.headline)
                .foregroundColor(Color.theme.espresso)

            Form {
                TextField("Food Name", text: $name)
                TextField("Calories", text: $calories)
            }
            .formStyle(.grouped)

            HStack {
                Button("Cancel") { dismiss() }
                    .keyboardShortcut(.cancelAction)
                Spacer()
                Button("Add") {
                    Task {
                        await viewModel.addMeal(
                            name: name,
                            date: date,
                            mealType: mealType,
                            calories: Int(calories) ?? 0
                        )
                        await viewModel.loadWeeklyPlans(for: weekStart)
                        dismiss()
                    }
                }
                .keyboardShortcut(.defaultAction)
                .disabled(name.isEmpty || calories.isEmpty)
            }
            .padding()
        }
        .frame(width: 350, height: 250)
        .padding()
    }
}

// MARK: - Edit Meal Sheet

private struct EditMealSheet: View {
    @ObservedObject var viewModel: MealPlanViewModel
    let meal: MealPlan
    let weekStart: Date
    @Environment(\.dismiss) private var dismiss

    @State private var name = ""
    @State private var calories = ""

    var body: some View {
        VStack(spacing: 16) {
            Text("Edit Meal")
                .font(.headline)

            Form {
                TextField("Food Name", text: $name)
                TextField("Calories", text: $calories)
            }
            .formStyle(.grouped)

            HStack {
                Button("Delete", role: .destructive) {
                    Task {
                        await viewModel.deleteMeal(meal)
                        await viewModel.loadWeeklyPlans(for: weekStart)
                        dismiss()
                    }
                }
                .foregroundColor(.red)

                Spacer()

                Button("Cancel") { dismiss() }
                    .keyboardShortcut(.cancelAction)

                Button("Save") {
                    Task {
                        await viewModel.deleteMeal(meal)
                        await viewModel.addMeal(
                            name: name,
                            date: meal.plannedDateValue ?? .now,
                            mealType: meal.mealType,
                            calories: Int(calories) ?? 0
                        )
                        await viewModel.loadWeeklyPlans(for: weekStart)
                        dismiss()
                    }
                }
                .keyboardShortcut(.defaultAction)
                .disabled(name.isEmpty)
            }
            .padding()
        }
        .frame(width: 350, height: 250)
        .padding()
        .onAppear {
            name = meal.name
            calories = String(meal.calories)
        }
    }
}
