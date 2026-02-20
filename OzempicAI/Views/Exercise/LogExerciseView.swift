import SwiftUI

struct LogExerciseView: View {
    @ObservedObject var viewModel: ExerciseViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var exerciseName = ""
    @State private var category = ExerciseLog.ExerciseCategory.cardio
    @State private var durationText = ""
    @State private var caloriesText = ""
    // Strength-only fields
    @State private var setsText = ""
    @State private var repsText = ""
    @State private var bodyPart = ExerciseLog.BodyPart.chest

    var isStrength: Bool { category == .strength }

    var isFormValid: Bool {
        guard !exerciseName.isEmpty && !durationText.isEmpty && !caloriesText.isEmpty else { return false }
        if isStrength { return !setsText.isEmpty && !repsText.isEmpty }
        return true
    }

    var body: some View {
        NavigationStack {
            Form {
                TextField("Exercise name", text: $exerciseName)
                Picker("Category", selection: $category) {
                    ForEach(ExerciseLog.ExerciseCategory.allCases, id: \.self) {
                        Text($0.rawValue.capitalized)
                    }
                }
                TextField("Duration (minutes)", text: $durationText)
                    .keyboardType(.numberPad)
                TextField("Calories burned", text: $caloriesText)
                    .keyboardType(.numberPad)

                if isStrength {
                    Section("Strength Details") {
                        TextField("Sets", text: $setsText)
                            .keyboardType(.numberPad)
                        TextField("Reps per set", text: $repsText)
                            .keyboardType(.numberPad)
                        Picker("Body part", selection: $bodyPart) {
                            ForEach(ExerciseLog.BodyPart.allCases, id: \.self) {
                                Text($0.displayName)
                            }
                        }
                    }
                }
            }
            .navigationTitle("Log Exercise")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        guard let duration = Int(durationText),
                              let calories = Int(caloriesText),
                              !exerciseName.isEmpty else { return }
                        let sets = Int(setsText)
                        let reps = Int(repsText)
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
                            dismiss()
                        }
                    }
                    .disabled(!isFormValid)
                }
            }
        }
    }
}
