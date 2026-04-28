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

    private func meal(in plans: [MealPlan], for date: Date, type: MealPlan.MealType) -> MealPlan? {
        plans.first { mealPlan($0, matches: date, type: type) }
    }

    private func meal(for date: Date, type: MealPlan.MealType) -> MealPlan? {
        meal(in: viewModel.weeklyPlans, for: date, type: type)
    }

    private func dailyTotal(for date: Date) -> Int {
        mealTypes
            .compactMap { meal(for: date, type: $0) }
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
                        addDate = .now
                        addMealType = .breakfast
                        showAddSheet = true
                    } label: {
                        Label("Add", systemImage: "plus")
                            .font(.inter(13, weight: .semibold))
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(Color.theme.terracotta)
                }

                // Grid
                Grid(alignment: .topLeading, horizontalSpacing: 1, verticalSpacing: 1) {
                    // Header row
                    GridRow {
                        Text("")
                            .frame(width: 80)
                        ForEach(daysOfWeek, id: \.self) { day in
                            VStack(spacing: 2) {
                                Text(day.formatted(.dateTime.weekday(.abbreviated)))
                                    .font(.caption)
                                    .fontWeight(.semibold)
                                Text(day.formatted(.dateTime.month(.abbreviated).day()))
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 8)
                        }
                    }

                    Divider()

                    // Meal type rows
                    ForEach(mealTypes, id: \.self) { mealType in
                        GridRow {
                            Text(mealType.rawValue.capitalized)
                                .font(.caption)
                                .fontWeight(.semibold)
                                .frame(width: 80, alignment: .leading)
                                .padding(.leading, 8)

                            ForEach(daysOfWeek, id: \.self) { day in
                                MealCell(
                                    meal: meal(for: day, type: mealType),
                                    dayDate: day,
                                    mealType: mealType,
                                    onAdd: {
                                        addDate = day
                                        addMealType = mealType
                                        showAddSheet = true
                                    },
                                    onEdit: { editingMeal = $0 }
                                )
                                .frame(maxWidth: .infinity)
                            }
                        }

                        Divider()
                    }

                    // Totals row
                    GridRow {
                        Text("TOTAL")
                            .font(.caption)
                            .fontWeight(.bold)
                            .frame(width: 80, alignment: .leading)
                            .padding(.leading, 8)

                        ForEach(daysOfWeek, id: \.self) { day in
                            let total = dailyTotal(for: day)
                            Text(total > 0 ? "\(total)" : "—")
                                .font(.caption)
                                .fontWeight(.semibold)
                                .foregroundColor(totalColor(for: total))
                                .frame(maxWidth: .infinity)
                        }
                    }
                    .padding(.vertical, 8)
                }
                .padding()
                .background(Color.theme.paper)
                .clipShape(RoundedRectangle(cornerRadius: AppRadius.medium))
                .shadow(color: Color.theme.shadow, radius: 10, y: 2)
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

    private func copyWeekToNext() async {
        let calendar = Calendar.current
        let nextWeekStart = calendar.date(byAdding: .weekOfYear, value: 1, to: weekStart)!
        let sourcePlans = viewModel.weeklyPlans

        for day in daysOfWeek {
            let dayOffset = calendar.dateComponents([.day], from: weekStart, to: day).day ?? 0
            let targetDate = calendar.date(byAdding: .day, value: dayOffset, to: nextWeekStart)!

            for mealType in mealTypes {
                guard let plan = meal(in: sourcePlans, for: day, type: mealType) else { continue }

                await viewModel.deleteMeal(on: targetDate, mealType: mealType)
                await viewModel.addMeal(name: plan.name, date: targetDate, mealType: mealType, calories: plan.calories)
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
