import SwiftUI

struct WorkoutPlanView: View {
    @StateObject private var viewModel = WorkoutPlanViewModel()
    @State private var showAddWorkout = false

    private func categoryIcon(for category: ExerciseLog.ExerciseCategory) -> String {
        switch category {
        case .cardio: return "figure.run"
        case .strength: return "figure.strengthtraining.traditional"
        case .flexibility: return "figure.mind.and.body"
        case .sports: return "sportscourt.fill"
        case .other: return "ellipsis.circle.fill"
        }
    }

    private func categoryColor(for category: ExerciseLog.ExerciseCategory) -> Color {
        switch category {
        case .cardio: return Color.theme.orange
        case .strength: return Color.theme.amber
        case .flexibility: return Color.theme.mediumBlue
        case .sports: return Color.theme.mediumBlue
        case .other: return Color.theme.lightBlue
        }
    }

    private func formatSelectedDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEEE, MMM d"
        return formatter.string(from: date)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: AppSpacing.lg) {
                    // Calendar
                    DatePicker(
                        "Select Date",
                        selection: $viewModel.selectedDate,
                        displayedComponents: .date
                    )
                    .datePickerStyle(.graphical)
                    .tint(Color.theme.mediumBlue)
                    .padding(AppSpacing.sm)
                    .background(Color.theme.cardBackground)
                    .cornerRadius(AppRadius.medium)
                    .onChange(of: viewModel.selectedDate) { newDate in
                        viewModel.selectDate(newDate)
                    }

                    // Selected date header
                    HStack {
                        Text(formatSelectedDate(viewModel.selectedDate))
                            .font(.headline)
                            .foregroundColor(Color.theme.primaryText)
                        Spacer()

                        // Workout count badge
                        if !viewModel.plansForSelectedDate.isEmpty {
                            Text("\(viewModel.plansForSelectedDate.count) workout\(viewModel.plansForSelectedDate.count == 1 ? "" : "s")")
                                .font(.caption.bold())
                                .foregroundColor(.white)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 4)
                                .background(Color.theme.mediumBlue)
                                .clipShape(Capsule())
                        }
                    }

                    // Workout cards for selected date
                    if viewModel.plansForSelectedDate.isEmpty {
                        VStack(spacing: AppSpacing.md) {
                            Image(systemName: "dumbbell.fill")
                                .font(.system(size: 50))
                                .foregroundStyle(Color.theme.mediumBlue)

                            Text("No Workouts Planned")
                                .font(.title3.bold())
                                .foregroundColor(Color.theme.primaryText)

                            Text("Tap + to plan a workout for this day")
                                .font(.subheadline)
                                .foregroundColor(Color.theme.secondaryText)
                        }
                        .padding(.top, AppSpacing.xl)
                    } else {
                        ForEach(viewModel.plansForSelectedDate) { plan in
                            HStack(spacing: AppSpacing.md) {
                                // Category icon
                                Image(systemName: categoryIcon(for: plan.category))
                                    .font(.title3)
                                    .foregroundStyle(categoryColor(for: plan.category))
                                    .frame(width: 36, height: 36)
                                    .background(categoryColor(for: plan.category).opacity(0.12))
                                    .clipShape(Circle())

                                VStack(alignment: .leading, spacing: 2) {
                                    Text(plan.exerciseName)
                                        .font(.subheadline.bold())
                                        .foregroundColor(Color.theme.primaryText)

                                    HStack(spacing: 4) {
                                        Text(plan.category.rawValue.capitalized)
                                        Text("·")
                                        Text("\(plan.durationMinutes) min")
                                        Text("·")
                                        Text("\(plan.caloriesBurned) cal")
                                    }
                                    .font(.caption)
                                    .foregroundColor(Color.theme.secondaryText)

                                    if plan.category == .strength,
                                       let sets = plan.sets,
                                       let reps = plan.repsPerSet {
                                        HStack(spacing: 4) {
                                            Text("\(sets) sets × \(reps) reps")
                                            if let weight = plan.weight {
                                                Text("·")
                                                Text("\(weight, specifier: "%g") \(plan.weightUnit?.rawValue ?? "lb")")
                                            }
                                        }
                                        .font(.caption)
                                        .foregroundColor(Color.theme.mediumBlue)
                                    }

                                    if let notes = plan.notes, !notes.isEmpty {
                                        Text(notes)
                                            .font(.caption)
                                            .foregroundColor(Color.theme.secondaryText)
                                            .italic()
                                    }
                                }

                                Spacer()

                                Button {
                                    Task { await viewModel.deleteWorkoutPlan(plan) }
                                } label: {
                                    Image(systemName: "trash")
                                        .font(.caption)
                                        .foregroundStyle(.red.opacity(0.7))
                                }
                                .buttonStyle(.plain)
                            }
                            .cardStyle()
                        }
                    }
                }
                .padding(.horizontal)
                .padding(.bottom, AppSpacing.lg)
            }
            .screenBackground()
            .navigationTitle("Workout Plan")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button { showAddWorkout = true } label: {
                        Image(systemName: "plus.circle.fill")
                            .foregroundStyle(Color.theme.orange)
                            .font(.title3)
                    }
                }
            }
            .sheet(isPresented: $showAddWorkout) {
                AddWorkoutPlanView(viewModel: viewModel)
            }
            .task {
                await viewModel.loadMonthlyPlans()
                await viewModel.loadPlansForDate(viewModel.selectedDate)
            }
        }
    }
}
