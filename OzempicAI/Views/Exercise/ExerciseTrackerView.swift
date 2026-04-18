import SwiftUI

struct ExerciseTrackerView: View {
    @EnvironmentObject var viewModel: ExerciseViewModel
    @State private var showLogExercise = false
    @State private var exerciseToEdit: ExerciseLog?

    private let burnTarget: Double = 500

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

    private var progress: Double {
        min(Double(viewModel.totalCaloriesBurnedToday) / burnTarget, 1.0)
    }

    var body: some View {
        ScrollView {
            VStack(spacing: AppSpacing.md) {
                ScreenHeader(title: "Exercise", subtitle: "Movement") {
                    showLogExercise = true
                }

                if let error = viewModel.errorMessage {
                    errorBanner(error)
                        .padding(.horizontal, AppSpacing.md + 4)
                }

                heroCard
                importCard
                if viewModel.logs.isEmpty {
                    emptyState
                } else {
                    history
                }
                Spacer(minLength: 40)
            }
            .padding(.bottom, 100)
        }
        .screenBackground()
        .sheet(isPresented: $showLogExercise) {
            LogExerciseView(viewModel: viewModel)
        }
        .sheet(item: $exerciseToEdit) { log in
            LogExerciseView(viewModel: viewModel, existingLog: log)
        }
        .task {
            if viewModel.logs.isEmpty {
                await viewModel.requestHealthKitAccess()
                await viewModel.loadLogs()
            }
        }
    }

    // MARK: - Hero

    private var heroCard: some View {
        VStack(spacing: AppSpacing.md) {
            ZStack {
                ProgressRing(
                    progress: progress,
                    size: 220,
                    lineWidth: 16,
                    gradient: [Color.theme.terracotta, Color.theme.ember]
                )
                VStack(spacing: 4) {
                    Image(systemName: "flame.fill")
                        .font(.system(size: 22))
                        .foregroundColor(Color.theme.ember)
                    Text("\(viewModel.totalCaloriesBurnedToday)")
                        .font(AppFont.display(52, weight: .regular))
                        .foregroundColor(Color.theme.espresso)
                        .kerning(-1)
                    Text("cal burned")
                        .font(AppFont.ui(13))
                        .foregroundColor(Color.theme.coffee)
                }
            }
            Text("target \(Int(burnTarget)) cal today")
                .font(AppFont.display(14, weight: .regular, italic: true))
                .foregroundColor(Color.theme.terracottaDeep)
        }
        .padding(.vertical, AppSpacing.lg)
        .frame(maxWidth: .infinity)
        .background(Color.theme.paper)
        .cornerRadius(AppRadius.large)
        .shadow(color: Color.theme.shadow, radius: 10, x: 0, y: 2)
        .padding(.horizontal, AppSpacing.md + 4)
    }

    private var importCard: some View {
        Button {
            Task { await viewModel.syncFromHealthKit() }
        } label: {
            HStack(spacing: 12) {
                ZStack {
                    Circle().fill(Color.theme.terracotta.opacity(0.12))
                    if viewModel.isSyncing {
                        ProgressView().tint(Color.theme.terracotta).scaleEffect(0.7)
                    } else {
                        Image(systemName: "applewatch.radiowaves.left.and.right")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundColor(Color.theme.terracotta)
                    }
                }
                .frame(width: 36, height: 36)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Import from Apple Watch")
                        .font(AppFont.ui(14, weight: .semibold))
                        .foregroundColor(Color.theme.espresso)
                    Text("Sync workouts from HealthKit")
                        .font(AppFont.ui(12))
                        .foregroundColor(Color.theme.dust)
                }
                Spacer()
                Image(systemName: "arrow.down.circle.fill")
                    .font(.system(size: 18))
                    .foregroundColor(Color.theme.terracotta)
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.theme.paper)
            .cornerRadius(AppRadius.large)
            .shadow(color: Color.theme.shadow, radius: 8, x: 0, y: 2)
        }
        .buttonStyle(.plain)
        .disabled(viewModel.isSyncing)
        .padding(.horizontal, AppSpacing.md + 4)
    }

    private var emptyState: some View {
        VStack(spacing: 10) {
            Image(systemName: "figure.run.circle")
                .font(.system(size: 44))
                .foregroundColor(Color.theme.dust)
            Text("No exercises logged yet")
                .font(AppFont.display(18, weight: .medium))
                .foregroundColor(Color.theme.espresso)
            Text("Tap the + button to add one.")
                .font(AppFont.ui(13))
                .foregroundColor(Color.theme.coffee)
        }
        .padding(.vertical, 40)
        .frame(maxWidth: .infinity)
        .background(Color.theme.paper)
        .cornerRadius(AppRadius.large)
        .shadow(color: Color.theme.shadow, radius: 8, x: 0, y: 2)
        .padding(.horizontal, AppSpacing.md + 4)
    }

    private var history: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("History")
                .font(AppFont.display(20, weight: .medium))
                .foregroundColor(Color.theme.espresso)
                .padding(.horizontal, 4)

            VStack(spacing: 10) {
                ForEach(viewModel.logs) { log in
                    historyRow(log)
                }
            }
        }
        .padding(.horizontal, AppSpacing.md + 4)
    }

    private func historyRow(_ log: ExerciseLog) -> some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(categoryColor(for: log.category).opacity(0.15))
                Image(systemName: categoryIcon(for: log.category))
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(categoryColor(for: log.category))
            }
            .frame(width: 38, height: 38)

            VStack(alignment: .leading, spacing: 2) {
                Text(log.exerciseName)
                    .font(AppFont.ui(14, weight: .semibold))
                    .foregroundColor(Color.theme.espresso)
                HStack(spacing: 4) {
                    if log.source == .healthkit {
                        Image(systemName: "applewatch").font(.caption2)
                            .foregroundColor(Color.theme.terracotta)
                    }
                    Text(log.category.rawValue.capitalized)
                    Text("·")
                    Text("\(log.durationMinutes) min")
                    Text("·")
                    Text("\(log.caloriesBurned) cal")
                }
                .font(AppFont.ui(11))
                .foregroundColor(Color.theme.dust)

                if log.category == .strength,
                   let sets = log.sets, let reps = log.repsPerSet {
                    HStack(spacing: 4) {
                        Text("\(sets) × \(reps) reps")
                        if let weight = log.weight {
                            Text("·")
                            Text("\(weight, specifier: "%g") \(log.weightUnit?.rawValue ?? "lb")")
                        }
                    }
                    .font(AppFont.ui(11, weight: .medium))
                    .foregroundColor(Color.theme.terracottaDeep)
                }
            }

            Spacer()

            if log.source != .healthkit {
                HStack(spacing: 8) {
                    Button { exerciseToEdit = log } label: {
                        Image(systemName: "pencil")
                            .font(.system(size: 12))
                            .foregroundColor(Color.theme.coffee)
                    }
                    .buttonStyle(.plain)
                    Button {
                        Task { await viewModel.deleteLog(log) }
                    } label: {
                        Image(systemName: "trash")
                            .font(.system(size: 12))
                            .foregroundColor(Color.theme.ember.opacity(0.8))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(AppSpacing.md)
        .background(Color.theme.paper)
        .cornerRadius(AppRadius.large)
        .shadow(color: Color.theme.shadow, radius: 6, x: 0, y: 2)
    }

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
