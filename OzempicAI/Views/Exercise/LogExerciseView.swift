import SwiftUI

struct LogExerciseView: View {
    @ObservedObject var viewModel: ExerciseViewModel
    @Environment(\.dismiss) private var dismiss

    var existingLog: ExerciseLog? = nil

    @State private var exerciseName = ""
    @State private var category = ExerciseLog.ExerciseCategory.cardio
    @State private var durationText = ""
    @State private var caloriesText = ""
    @State private var setsText = ""
    @State private var repsText = ""
    @State private var bodyPart = ExerciseLog.BodyPart.chest
    @State private var weightText = ""
    @State private var weightUnit = ExerciseLog.WeightUnit.lb
    @State private var isSaving = false

    var isEditing: Bool { existingLog != nil }
    var isStrength: Bool { category == .strength }

    var isFormValid: Bool {
        guard !exerciseName.isEmpty && !durationText.isEmpty && !caloriesText.isEmpty else { return false }
        if isStrength { return !setsText.isEmpty && !repsText.isEmpty }
        return true
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

                    // Exercise name
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

                            // Weight
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

                    Spacer().frame(height: AppSpacing.md)

                    // Add / Update button
                    Button {
                        guard let duration = Int(durationText),
                              let calories = Int(caloriesText),
                              !exerciseName.isEmpty else { return }
                        let sets = Int(setsText)
                        let reps = Int(repsText)
                        let weight = Double(weightText)
                        isSaving = true
                        Task {
                            if let log = existingLog {
                                await viewModel.updateLog(
                                    log,
                                    name: exerciseName,
                                    category: category,
                                    duration: duration,
                                    caloriesBurned: calories,
                                    sets: isStrength ? sets : nil,
                                    repsPerSet: isStrength ? reps : nil,
                                    bodyPart: isStrength ? bodyPart : nil,
                                    weight: isStrength ? weight : nil,
                                    weightUnit: (isStrength && weight != nil) ? weightUnit : nil
                                )
                            } else {
                                await viewModel.logExercise(
                                    name: exerciseName,
                                    category: category,
                                    duration: duration,
                                    caloriesBurned: calories,
                                    sets: isStrength ? sets : nil,
                                    repsPerSet: isStrength ? reps : nil,
                                    bodyPart: isStrength ? bodyPart : nil,
                                    weight: isStrength ? weight : nil,
                                    weightUnit: (isStrength && weight != nil) ? weightUnit : nil
                                )
                            }
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
                            Text(isEditing ? "Update Exercise" : "Add Exercise")
                        }
                    }
                    .buttonStyle(PrimaryButtonStyle())
                    .disabled(!isFormValid || isSaving)
                    .opacity(isFormValid ? 1 : 0.5)
                }
                .padding(AppSpacing.lg)
            }
            .screenBackground()
            .navigationTitle(isEditing ? "Edit Exercise" : "Log Exercise")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(Color.theme.mediumBlue)
                }
            }
            .onAppear {
                guard let log = existingLog else { return }
                exerciseName = log.exerciseName
                category = log.category
                durationText = "\(log.durationMinutes)"
                caloriesText = "\(log.caloriesBurned)"
                if let sets = log.sets { setsText = "\(sets)" }
                if let reps = log.repsPerSet { repsText = "\(reps)" }
                if let bp = log.bodyPart { bodyPart = bp }
                if let w = log.weight { weightText = "\(w)" }
                if let wu = log.weightUnit { weightUnit = wu }
            }
        }
    }
}
