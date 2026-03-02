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

    private func meal(for date: Date, type: MealPlan.MealType) -> MealPlan? {
        let dateString = Self.dayFormatter.string(from: date)
        return viewModel.weeklyPlans.first {
            Self.dayFormatter.string(from: $0.plannedDate) == dateString && $0.mealType == type
        }
    }

    private func dailyTotal(for date: Date) -> Int {
        let dateString = Self.dayFormatter.string(from: date)
        return viewModel.weeklyPlans
            .filter { Self.dayFormatter.string(from: $0.plannedDate) == dateString }
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
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("Meal Plan")
                    .font(.title2)
                    .fontWeight(.bold)

                Spacer()

                WeekNavigator(weekStart: $weekStart)

                Spacer()

                Button("Copy Week") {
                    Task { await copyWeekToNext() }
                }

                Button {
                    addDate = .now
                    addMealType = .breakfast
                    showAddSheet = true
                } label: {
                    Label("Add", systemImage: "plus")
                }
            }
            .padding()

            Divider()

            // Grid
            ScrollView {
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
            }
        }
        .screenBackground()
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

        for plan in viewModel.weeklyPlans {
            let dayOffset = calendar.dateComponents([.day], from: weekStart, to: plan.plannedDate).day ?? 0
            let newDate = calendar.date(byAdding: .day, value: dayOffset, to: nextWeekStart)!
            await viewModel.addMeal(name: plan.name, date: newDate, mealType: plan.mealType, calories: plan.calories)
        }
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
                            date: meal.plannedDate,
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
