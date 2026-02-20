import SwiftUI

struct LogMealView: View {
    @ObservedObject var viewModel: CalorieViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var foodName = ""
    @State private var caloriesText = ""
    @State private var mealType = CalorieLog.MealType.breakfast

    var body: some View {
        NavigationStack {
            Form {
                TextField("Food name", text: $foodName)
                TextField("Calories", text: $caloriesText)
                    .keyboardType(.numberPad)
                Picker("Meal", selection: $mealType) {
                    ForEach(CalorieLog.MealType.allCases, id: \.self) {
                        Text($0.rawValue.capitalized)
                    }
                }
            }
            .navigationTitle("Log Meal")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        guard let calories = Int(caloriesText), !foodName.isEmpty else { return }
                        Task {
                            await viewModel.logFood(name: foodName, calories: calories, mealType: mealType)
                            dismiss()
                        }
                    }
                    .disabled(foodName.isEmpty || caloriesText.isEmpty)
                }
            }
        }
    }
}
