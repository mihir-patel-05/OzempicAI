import SwiftUI

struct WorkoutPlanView: View {
    @StateObject private var viewModel = WorkoutPlanViewModel()
    @State private var showAddWorkout = false
    @State private var editingPlan: WorkoutPlan?

    private func categoryIcon(for category: ExerciseLog.ExerciseCategory) -> String {
        switch category {
        case .cardio:      return "figure.run"
        case .strength:    return "figure.strengthtraining.traditional"
        case .flexibility: return "figure.mind.and.body"
        case .sports:      return "sportscourt.fill"
        case .other:       return "ellipsis.circle.fill"
        }
    }

    private func categoryColor(for category: ExerciseLog.ExerciseCategory) -> Color {
        switch category {
        case .cardio:      return Color.theme.ember
        case .strength:    return Color.theme.terracotta
        case .flexibility: return Color.theme.sage
        case .sports:      return Color.theme.saffron
        case .other:       return Color.theme.plum
        }
    }

    private func mealIcon(for type: MealPlan.MealType) -> String {
        switch type {
        case .breakfast: return "sunrise.fill"
        case .lunch:     return "sun.max.fill"
        case .dinner:    return "moon.fill"
        case .snack:     return "leaf.fill"
        }
    }

    private func mealAccent(for type: MealPlan.MealType) -> Color {
        switch type {
        case .breakfast: return Color.theme.amber
        case .lunch:     return Color.theme.terracotta
        case .dinner:    return Color.theme.plum
        case .snack:     return Color.theme.sage
        }
    }

    private func formatSelectedDate(_ date: Date) -> String {
        if Calendar.current.isDateInToday(date) { return "Today" }
        if Calendar.current.isDateInTomorrow(date) { return "Tomorrow" }
        let f = DateFormatter()
        f.dateFormat = "EEEE, MMM d"
        return f.string(from: date)
    }

    var body: some View {
        ScrollView {
            VStack(spacing: AppSpacing.md) {
                ScreenHeader(title: "Workouts", subtitle: formatSelectedDate(viewModel.selectedDate)) {
                    showAddWorkout = true
                }

                calendarCard
                selectedDateHeader

                if viewModel.plansForSelectedDate.isEmpty {
                    emptyWorkoutsState
                } else {
                    VStack(spacing: 10) {
                        ForEach(viewModel.plansForSelectedDate) { plan in
                            workoutCard(plan)
                        }
                    }
                    .padding(.horizontal, AppSpacing.md + 4)
                }

                if !viewModel.mealsForSelectedDate.isEmpty {
                    mealsSection
                }

                Spacer(minLength: 40)
            }
            .padding(.bottom, 100)
        }
        .screenBackground()
        .sheet(isPresented: $showAddWorkout) {
            AddWorkoutPlanView(viewModel: viewModel)
        }
        .sheet(item: $editingPlan) { plan in
            EditWorkoutPlanView(viewModel: viewModel, plan: plan)
        }
        .task {
            await viewModel.loadMonthlyPlans()
            await viewModel.loadPlansForDate(viewModel.selectedDate)
            await viewModel.loadMealsForDate(viewModel.selectedDate)
            await viewModel.loadDayLabel(for: viewModel.selectedDate)
        }
    }

    // MARK: - Calendar

    private var calendarCard: some View {
        DatePicker(
            "Select date",
            selection: $viewModel.selectedDate,
            displayedComponents: .date
        )
        .datePickerStyle(.graphical)
        .labelsHidden()
        .accentColor(Color.theme.terracotta)
        .padding(AppSpacing.md)
        .background(Color.theme.paper)
        .cornerRadius(AppRadius.large)
        .shadow(color: Color.theme.shadow, radius: 8, x: 0, y: 2)
        .padding(.horizontal, AppSpacing.md + 4)
        .onChange(of: viewModel.selectedDate) { newDate in
            viewModel.selectDate(newDate)
        }
    }

    private var selectedDateHeader: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(formatSelectedDate(viewModel.selectedDate))
                .font(AppFont.display(20, weight: .medium))
                .foregroundColor(Color.theme.espresso)
            if let dayLabel = viewModel.selectedDayLabel {
                Text(dayLabel)
                    .font(AppFont.ui(11, weight: .semibold))
                    .foregroundColor(Color.theme.terracotta)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(Color.theme.terracotta.opacity(0.12))
                    .clipShape(Capsule())
            }
            Spacer()
            if !viewModel.plansForSelectedDate.isEmpty {
                CapsLabel(text: "\(viewModel.plansForSelectedDate.count) workout\(viewModel.plansForSelectedDate.count == 1 ? "" : "s")")
            }
        }
        .padding(.horizontal, AppSpacing.md + 4)
    }

    private var emptyWorkoutsState: some View {
        VStack(spacing: 10) {
            Image(systemName: "dumbbell.fill")
                .font(.system(size: 36))
                .foregroundColor(Color.theme.dust)
            Text("No workouts planned")
                .font(AppFont.display(16, weight: .medium))
                .foregroundColor(Color.theme.espresso)
            Text("Tap + to plan one.")
                .font(AppFont.ui(12))
                .foregroundColor(Color.theme.coffee)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, AppSpacing.xl)
        .background(Color.theme.paper)
        .cornerRadius(AppRadius.large)
        .shadow(color: Color.theme.shadow, radius: 6, x: 0, y: 2)
        .padding(.horizontal, AppSpacing.md + 4)
    }

    private func workoutCard(_ plan: WorkoutPlan) -> some View {
        let accent = categoryColor(for: plan.category)
        return HStack(spacing: 12) {
            Button {
                Task { await viewModel.toggleWorkoutCompletion(plan) }
            } label: {
                Image(systemName: plan.isCompleted ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 20))
                    .foregroundColor(plan.isCompleted ? Color.theme.sageDeep : Color.theme.dust.opacity(0.5))
            }
            .buttonStyle(.plain)

            ZStack {
                Circle().fill(accent.opacity(0.15))
                Image(systemName: categoryIcon(for: plan.category))
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(accent)
            }
            .frame(width: 36, height: 36)

            VStack(alignment: .leading, spacing: 2) {
                Text(plan.exerciseName)
                    .font(AppFont.ui(14, weight: .semibold))
                    .strikethrough(plan.isCompleted)
                    .foregroundColor(plan.isCompleted ? Color.theme.dust : Color.theme.espresso)

                HStack(spacing: 4) {
                    Text(plan.category.rawValue.capitalized)
                    if let d = plan.durationMinutes { Text("·"); Text("\(d) min") }
                    if let c = plan.caloriesBurned { Text("·"); Text("\(c) cal") }
                }
                .font(AppFont.ui(11))
                .foregroundColor(Color.theme.dust)

                if plan.category == .strength, let sets = plan.sets, let reps = plan.repsPerSet {
                    HStack(spacing: 4) {
                        Text("\(sets) × \(reps) reps")
                        if let w = plan.weight {
                            Text("·")
                            Text("\(w, specifier: "%g") \(plan.weightUnit?.rawValue ?? "lb")")
                        }
                    }
                    .font(AppFont.ui(11, weight: .medium))
                    .foregroundColor(Color.theme.terracottaDeep)
                }

                if let notes = plan.notes, !notes.isEmpty {
                    Text(notes)
                        .font(AppFont.display(11, weight: .regular, italic: true))
                        .foregroundColor(Color.theme.coffee)
                }
            }

            Spacer()

            HStack(spacing: 8) {
                Button { editingPlan = plan } label: {
                    Image(systemName: "pencil")
                        .font(.system(size: 12))
                        .foregroundColor(Color.theme.coffee)
                }
                .buttonStyle(.plain)
                Button {
                    Task { await viewModel.deleteWorkoutPlan(plan) }
                } label: {
                    Image(systemName: "trash")
                        .font(.system(size: 12))
                        .foregroundColor(Color.theme.ember.opacity(0.8))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(AppSpacing.md)
        .background(Color.theme.paper)
        .cornerRadius(AppRadius.large)
        .shadow(color: Color.theme.shadow, radius: 6, x: 0, y: 2)
        .opacity(plan.isCompleted ? 0.75 : 1.0)
        .onTapGesture { editingPlan = plan }
    }

    // MARK: - Meals section

    private var mealsSection: some View {
        let total = viewModel.mealsForSelectedDate.reduce(0) { $0 + $1.calories }
        return VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                HStack(spacing: 8) {
                    Image(systemName: "fork.knife")
                        .foregroundColor(Color.theme.amber)
                    Text("Meals")
                        .font(AppFont.display(20, weight: .medium))
                        .foregroundColor(Color.theme.espresso)
                }
                Spacer()
                Text("\(total) cal")
                    .font(AppFont.ui(12, weight: .semibold))
                    .foregroundColor(Color.theme.amber)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(Color.theme.amber.opacity(0.15))
                    .clipShape(Capsule())
            }
            .padding(.horizontal, 4)

            VStack(spacing: 10) {
                ForEach(viewModel.mealsForSelectedDate) { meal in
                    let accent = mealAccent(for: meal.mealType)
                    HStack(spacing: 12) {
                        ZStack {
                            Circle().fill(accent.opacity(0.15))
                            Image(systemName: mealIcon(for: meal.mealType))
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundColor(accent)
                        }
                        .frame(width: 36, height: 36)

                        VStack(alignment: .leading, spacing: 2) {
                            Text(meal.name)
                                .font(AppFont.ui(14, weight: .semibold))
                                .foregroundColor(Color.theme.espresso)
                            Text(meal.mealType.rawValue.capitalized)
                                .font(AppFont.ui(11))
                                .foregroundColor(Color.theme.dust)
                        }

                        Spacer()

                        Text("\(meal.calories) cal")
                            .font(AppFont.ui(12, weight: .semibold))
                            .foregroundColor(accent)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 4)
                            .background(accent.opacity(0.15))
                            .clipShape(Capsule())

                        Button {
                            Task { await viewModel.deleteMeal(meal) }
                        } label: {
                            Image(systemName: "trash")
                                .font(.system(size: 11))
                                .foregroundColor(Color.theme.ember.opacity(0.8))
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(AppSpacing.md)
                    .background(Color.theme.paper)
                    .cornerRadius(AppRadius.large)
                    .shadow(color: Color.theme.shadow, radius: 6, x: 0, y: 2)
                }
            }
        }
        .padding(.horizontal, AppSpacing.md + 4)
    }
}
