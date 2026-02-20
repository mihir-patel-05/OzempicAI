import SwiftUI

struct LogExerciseView: View {
    @ObservedObject var viewModel: ExerciseViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var exerciseName = ""
    @State private var category = ExerciseLog.ExerciseCategory.cardio
    @State private var durationText = ""
    @State private var caloriesText = ""

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
                        Task {
                            await viewModel.logExercise(
                                name: exerciseName,
                                category: category,
                                duration: duration,
                                caloriesBurned: calories
                            )
                            dismiss()
                        }
                    }
                    .disabled(exerciseName.isEmpty || durationText.isEmpty || caloriesText.isEmpty)
                }
            }
        }
    }
}
