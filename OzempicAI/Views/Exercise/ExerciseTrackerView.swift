import SwiftUI

struct ExerciseTrackerView: View {
    @StateObject private var viewModel = ExerciseViewModel()
    @State private var showLogExercise = false

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

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: AppSpacing.lg) {
                    // Hero: progress ring
                    ZStack {
                        CircularProgressView(
                            progress: min(Double(viewModel.totalCaloriesBurnedToday) / 500.0, 1.0),
                            size: 180,
                            lineWidth: 18,
                            progressColor: Color.theme.orange
                        )

                        VStack(spacing: AppSpacing.xs) {
                            Image(systemName: "flame.fill")
                                .font(.title2)
                                .foregroundStyle(Color.theme.orange)

                            Text("\(viewModel.totalCaloriesBurnedToday)")
                                .font(.system(size: 36, weight: .bold, design: .rounded))
                                .foregroundColor(Color.theme.primaryText)

                            Text("cal burned")
                                .font(.subheadline)
                                .foregroundColor(Color.theme.secondaryText)
                        }
                    }
                    .padding(.top, AppSpacing.lg)

                    // History
                    if viewModel.logs.isEmpty {
                        VStack(spacing: AppSpacing.sm) {
                            Image(systemName: "figure.run.circle")
                                .font(.system(size: 44))
                                .foregroundStyle(Color.theme.lightBlue)
                            Text("No exercises logged yet")
                                .font(.subheadline)
                                .foregroundColor(Color.theme.secondaryText)
                        }
                        .padding(.top, AppSpacing.xl)
                    } else {
                        VStack(spacing: AppSpacing.sm) {
                            HStack {
                                Text("History")
                                    .font(.headline)
                                    .foregroundColor(Color.theme.primaryText)
                                Spacer()
                            }

                            ForEach(viewModel.logs) { log in
                                HStack(spacing: AppSpacing.md) {
                                    // Category icon
                                    Image(systemName: categoryIcon(for: log.category))
                                        .font(.title3)
                                        .foregroundStyle(categoryColor(for: log.category))
                                        .frame(width: 36, height: 36)
                                        .background(categoryColor(for: log.category).opacity(0.12))
                                        .clipShape(Circle())

                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(log.exerciseName)
                                            .font(.subheadline.bold())
                                            .foregroundColor(Color.theme.primaryText)

                                        HStack(spacing: 4) {
                                            Text(log.category.rawValue.capitalized)
                                            Text("·")
                                            Text("\(log.durationMinutes) min")
                                            Text("·")
                                            Text("\(log.caloriesBurned) cal")
                                        }
                                        .font(.caption)
                                        .foregroundColor(Color.theme.secondaryText)

                                        if log.category == .strength,
                                           let sets = log.sets,
                                           let reps = log.repsPerSet {
                                            HStack(spacing: 4) {
                                                Text("\(sets) sets × \(reps) reps")
                                                if let weight = log.weight {
                                                    Text("·")
                                                    Text("\(weight, specifier: "%g") \(log.weightUnit?.rawValue ?? "lb")")
                                                }
                                            }
                                            .font(.caption)
                                            .foregroundColor(Color.theme.mediumBlue)
                                        }
                                    }

                                    Spacer()
                                }
                                .cardStyle()
                            }
                        }
                    }
                }
                .padding(.horizontal)
                .padding(.bottom, AppSpacing.lg)
            }
            .screenBackground()
            .navigationTitle("Exercise")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button { showLogExercise = true } label: {
                        Image(systemName: "plus.circle.fill")
                            .foregroundStyle(Color.theme.orange)
                            .font(.title3)
                    }
                }
            }
            .sheet(isPresented: $showLogExercise) {
                LogExerciseView(viewModel: viewModel)
            }
            .task { await viewModel.loadLogs() }
        }
    }
}
