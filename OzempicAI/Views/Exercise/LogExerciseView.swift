import SwiftUI

struct LogExerciseView: View {
    @ObservedObject var viewModel: ExerciseViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var exerciseName = ""
    @State private var category = ExerciseLog.ExerciseCategory.cardio
    @State private var durationText = ""
    @State private var caloriesText = ""
    @State private var setsText = ""
    @State private var repsText = ""
    @State private var bodyPart = ExerciseLog.BodyPart.chest
    @State private var isSaving = false

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

                    // Add button
                    Button {
                        guard let duration = Int(durationText),
                              let calories = Int(caloriesText),
                              !exerciseName.isEmpty else { return }
                        let sets = Int(setsText)
                        let reps = Int(repsText)
                        isSaving = true
                        Task {
                            await viewModel.logExercise(
                                name: exerciseName,
                                category: category,
                                duration: duration,
                                caloriesBurned: calories,
                                sets: isStrength ? sets : nil,
                                repsPerSet: isStrength ? reps : nil,
                                bodyPart: isStrength ? bodyPart : nil
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
                            Text("Add Exercise")
                        }
                    }
                    .buttonStyle(PrimaryButtonStyle())
                    .disabled(!isFormValid || isSaving)
                    .opacity(isFormValid ? 1 : 0.5)
                }
                .padding(AppSpacing.lg)
            }
            .screenBackground()
            .navigationTitle("Log Exercise")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(Color.theme.mediumBlue)
                }
            }
        }
    }
}
