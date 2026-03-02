import SwiftUI

struct AddWorkoutPlanView: View {
    @ObservedObject var viewModel: WorkoutPlanViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var isFromHistory = false
    @State private var searchText = ""
    @State private var exerciseName = ""
    @State private var category = ExerciseLog.ExerciseCategory.cardio
    @State private var durationText = ""
    @State private var caloriesText = ""
    @State private var plannedDate = Date()
    @State private var setsText = ""
    @State private var repsText = ""
    @State private var bodyPart = ExerciseLog.BodyPart.chest
    @State private var weightText = ""
    @State private var weightUnit = ExerciseLog.WeightUnit.lb
    @State private var notes = ""
    @State private var isSaving = false

    var isStrength: Bool { category == .strength }

    var isFormValid: Bool {
        guard !exerciseName.isEmpty && !durationText.isEmpty && !caloriesText.isEmpty else { return false }
        if isStrength { return !setsText.isEmpty && !repsText.isEmpty }
        return true
    }

    private var uniquePastExercises: [ExerciseLog] {
        var seen = Set<String>()
        return viewModel.pastExercises.filter { log in
            let key = log.exerciseName.lowercased()
            guard !seen.contains(key) else { return false }
            seen.insert(key)
            return true
        }
    }

    private var filteredPastExercises: [ExerciseLog] {
        if searchText.isEmpty { return uniquePastExercises }
        return uniquePastExercises.filter {
            $0.exerciseName.localizedCaseInsensitiveContains(searchText)
        }
    }

    private func selectPastExercise(_ log: ExerciseLog) {
        exerciseName = log.exerciseName
        category = log.category
        durationText = "\(log.durationMinutes)"
        caloriesText = "\(log.caloriesBurned)"
        if let s = log.sets { setsText = "\(s)" }
        if let r = log.repsPerSet { repsText = "\(r)" }
        if let bp = log.bodyPart { bodyPart = bp }
        if let w = log.weight { weightText = "\(w)" }
        if let wu = log.weightUnit { weightUnit = wu }
    }

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
                VStack(spacing: AppSpacing.md) {
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

                    // Source toggle
                    VStack(alignment: .leading, spacing: AppSpacing.xs) {
                        Text("Workout Source")
                            .font(.caption.bold())
                            .foregroundColor(Color.theme.secondaryText)
                        Picker("Source", selection: $isFromHistory) {
                            Text("New Workout").tag(false)
                            Text("From History").tag(true)
                        }
                        .pickerStyle(.segmented)
                    }

                    // From History picker
                    if isFromHistory {
                        VStack(alignment: .leading, spacing: AppSpacing.sm) {
                            TextField("Search exercises...", text: $searchText)
                                .textFieldStyle(ThemedTextFieldStyle())

                            if filteredPastExercises.isEmpty {
                                VStack(spacing: AppSpacing.sm) {
                                    Image(systemName: "figure.run.circle")
                                        .font(.system(size: 30))
                                        .foregroundStyle(Color.theme.lightBlue)
                                    Text("No past exercises found")
                                        .font(.caption)
                                        .foregroundColor(Color.theme.secondaryText)
                                }
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, AppSpacing.md)
                            } else {
                                VStack(spacing: AppSpacing.xs) {
                                    ForEach(filteredPastExercises) { log in
                                        Button {
                                            selectPastExercise(log)
                                        } label: {
                                            HStack(spacing: AppSpacing.sm) {
                                                Image(systemName: categoryIcon(for: log.category))
                                                    .font(.caption)
                                                    .foregroundStyle(categoryColor(for: log.category))
                                                    .frame(width: 28, height: 28)
                                                    .background(categoryColor(for: log.category).opacity(0.12))
                                                    .clipShape(Circle())

                                                VStack(alignment: .leading, spacing: 1) {
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
                                                    .font(.caption2)
                                                    .foregroundColor(Color.theme.secondaryText)
                                                }

                                                Spacer()

                                                if exerciseName == log.exerciseName {
                                                    Image(systemName: "checkmark.circle.fill")
                                                        .foregroundStyle(Color.theme.mediumBlue)
                                                }
                                            }
                                            .padding(AppSpacing.sm)
                                            .background(
                                                exerciseName == log.exerciseName
                                                    ? Color.theme.mediumBlue.opacity(0.1)
                                                    : Color.theme.cardBackground
                                            )
                                            .cornerRadius(AppRadius.small)
                                        }
                                        .buttonStyle(.plain)
                                    }
                                }
                            }
                        }
                        .padding(AppSpacing.md)
                        .background(Color.theme.lightBlue.opacity(0.1))
                        .cornerRadius(AppRadius.medium)
                    }

                    // Exercise name (editable in both modes)
                    VStack(alignment: .leading, spacing: AppSpacing.xs) {
                        Text("Exercise Name")
                            .font(.caption.bold())
                            .foregroundColor(Color.theme.secondaryText)
                        TextField("e.g. Bench Press", text: $exerciseName)
                            .textFieldStyle(ThemedTextFieldStyle())
                    }

                    // Category
                    VStack(alignment: .leading, spacing: AppSpacing.xs) {
                        Text("Category")
                            .font(.caption.bold())
                            .foregroundColor(Color.theme.secondaryText)
                        Picker("Category", selection: $category) {
                            ForEach(ExerciseLog.ExerciseCategory.allCases, id: \.self) {
                                Text($0.rawValue.capitalized)
                            }
                        }
                        .pickerStyle(.segmented)
                    }

                    // Duration & Calories
                    HStack(spacing: AppSpacing.md) {
                        VStack(alignment: .leading, spacing: AppSpacing.xs) {
                            Text("Duration (min)")
                                .font(.caption.bold())
                                .foregroundColor(Color.theme.secondaryText)
                            TextField("30", text: $durationText)
                                .keyboardType(.numberPad)
                                .textFieldStyle(ThemedTextFieldStyle())
                        }

                        VStack(alignment: .leading, spacing: AppSpacing.xs) {
                            Text("Calories")
                                .font(.caption.bold())
                                .foregroundColor(Color.theme.secondaryText)
                            TextField("200", text: $caloriesText)
                                .keyboardType(.numberPad)
                                .textFieldStyle(ThemedTextFieldStyle())
                        }
                    }

                    // Strength details
                    if isStrength {
                        VStack(spacing: AppSpacing.md) {
                            HStack(spacing: AppSpacing.md) {
                                VStack(alignment: .leading, spacing: AppSpacing.xs) {
                                    Text("Sets")
                                        .font(.caption.bold())
                                        .foregroundColor(Color.theme.secondaryText)
                                    TextField("3", text: $setsText)
                                        .keyboardType(.numberPad)
                                        .textFieldStyle(ThemedTextFieldStyle())
                                }

                                VStack(alignment: .leading, spacing: AppSpacing.xs) {
                                    Text("Reps per Set")
                                        .font(.caption.bold())
                                        .foregroundColor(Color.theme.secondaryText)
                                    TextField("12", text: $repsText)
                                        .keyboardType(.numberPad)
                                        .textFieldStyle(ThemedTextFieldStyle())
                                }
                            }

                            HStack(spacing: AppSpacing.md) {
                                VStack(alignment: .leading, spacing: AppSpacing.xs) {
                                    Text("Weight")
                                        .font(.caption.bold())
                                        .foregroundColor(Color.theme.secondaryText)
                                    TextField("135", text: $weightText)
                                        .keyboardType(.decimalPad)
                                        .textFieldStyle(ThemedTextFieldStyle())
                                }

                                VStack(alignment: .leading, spacing: AppSpacing.xs) {
                                    Text("Unit")
                                        .font(.caption.bold())
                                        .foregroundColor(Color.theme.secondaryText)
                                    Picker("Unit", selection: $weightUnit) {
                                        ForEach(ExerciseLog.WeightUnit.allCases, id: \.self) {
                                            Text($0.rawValue)
                                        }
                                    }
                                    .pickerStyle(.segmented)
                                    .frame(height: 44)
                                }
                                .frame(width: 100)
                            }

                            VStack(alignment: .leading, spacing: AppSpacing.xs) {
                                Text("Body Part")
                                    .font(.caption.bold())
                                    .foregroundColor(Color.theme.secondaryText)
                                Picker("Body part", selection: $bodyPart) {
                                    ForEach(ExerciseLog.BodyPart.allCases, id: \.self) {
                                        Text($0.displayName)
                                    }
                                }
                                .pickerStyle(.segmented)
                            }
                        }
                        .padding(AppSpacing.md)
                        .background(Color.theme.lightBlue.opacity(0.1))
                        .cornerRadius(AppRadius.medium)
                    }

                    // Planned date
                    VStack(alignment: .leading, spacing: AppSpacing.xs) {
                        Text("Planned Date")
                            .font(.caption.bold())
                            .foregroundColor(Color.theme.secondaryText)
                        DatePicker("Date", selection: $plannedDate, displayedComponents: .date)
                            .datePickerStyle(.compact)
                            .labelsHidden()
                    }

                    // Notes
                    VStack(alignment: .leading, spacing: AppSpacing.xs) {
                        Text("Notes (optional)")
                            .font(.caption.bold())
                            .foregroundColor(Color.theme.secondaryText)
                        TextField("e.g. Warm up first", text: $notes)
                            .textFieldStyle(ThemedTextFieldStyle())
                    }

                    Spacer().frame(height: AppSpacing.md)

                    // Add button
                    Button {
                        guard let duration = Int(durationText),
                              let calories = Int(caloriesText),
                              !exerciseName.isEmpty else { return }
                        let sets = Int(setsText)
                        let reps = Int(repsText)
                        let weight = Double(weightText)
                        isSaving = true
                        Task {
                            await viewModel.addWorkoutPlan(
                                exerciseName: exerciseName,
                                category: category,
                                plannedDate: plannedDate,
                                durationMinutes: duration,
                                caloriesBurned: calories,
                                sets: isStrength ? sets : nil,
                                repsPerSet: isStrength ? reps : nil,
                                bodyPart: isStrength ? bodyPart : nil,
                                weight: isStrength ? weight : nil,
                                weightUnit: (isStrength && weight != nil) ? weightUnit : nil,
                                notes: notes.isEmpty ? nil : notes
                            )
                            isSaving = false
                            if viewModel.errorMessage == nil {
                                dismiss()
                            }
                        }
                    } label: {
                        if isSaving {
                            ProgressView()
                                .tint(.white)
                        } else {
                            Text("Add Workout")
                        }
                    }
                    .buttonStyle(PrimaryButtonStyle())
                    .disabled(!isFormValid || isSaving)
                    .opacity(isFormValid ? 1 : 0.5)
                }
                .padding(AppSpacing.lg)
            }
            .screenBackground()
            .navigationTitle("Plan Workout")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(Color.theme.mediumBlue)
                }
            }
            .onAppear {
                plannedDate = viewModel.selectedDate
            }
            .task {
                await viewModel.loadPastExercises()
            }
        }
    }
}
