import SwiftUI

struct AddMealView: View {
    @ObservedObject var viewModel: MealPlanViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var mealName = ""
    @State private var plannedDate = Date()
    @State private var mealType = MealPlan.MealType.lunch
    @State private var caloriesText = ""

    var body: some View {
        NavigationStack {
            Form {
                TextField("Meal name", text: $mealName)
                DatePicker("Date", selection: $plannedDate, displayedComponents: .date)
                Picker("Meal type", selection: $mealType) {
                    ForEach(MealPlan.MealType.allCases, id: \.self) {
                        Text($0.rawValue.capitalized)
                    }
                }
                TextField("Calories", text: $caloriesText)
                    .keyboardType(.numberPad)
            }
            .navigationTitle("Add Meal")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        guard let calories = Int(caloriesText), !mealName.isEmpty else { return }
                        Task {
                            await viewModel.addMeal(name: mealName, date: plannedDate, mealType: mealType, calories: calories)
                            dismiss()
                        }
                    }
                    .disabled(mealName.isEmpty || caloriesText.isEmpty)
                }
            }
        }
    }
}
