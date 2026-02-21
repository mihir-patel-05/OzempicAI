import SwiftUI

struct LogMealView: View {
    @ObservedObject var viewModel: CalorieViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var foodName = ""
    @State private var caloriesText = ""
    @State private var mealType = CalorieLog.MealType.breakfast

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: AppSpacing.md) {
                    // Food name
                    VStack(alignment: .leading, spacing: AppSpacing.xs) {
                        Text("Food Name")
                            .font(.caption.bold())
                            .foregroundColor(Color.theme.secondaryText)
                        TextField("e.g. Grilled Chicken", text: $foodName)
                            .textFieldStyle(ThemedTextFieldStyle())
                    }

                    // Calories
                    VStack(alignment: .leading, spacing: AppSpacing.xs) {
                        Text("Calories")
                            .font(.caption.bold())
                            .foregroundColor(Color.theme.secondaryText)
                        TextField("e.g. 350", text: $caloriesText)
                            .keyboardType(.numberPad)
                            .textFieldStyle(ThemedTextFieldStyle())
                    }

                    // Meal type
                    VStack(alignment: .leading, spacing: AppSpacing.xs) {
                        Text("Meal Type")
                            .font(.caption.bold())
                            .foregroundColor(Color.theme.secondaryText)
                        Picker("Meal", selection: $mealType) {
                            ForEach(CalorieLog.MealType.allCases, id: \.self) {
                                Text($0.rawValue.capitalized)
                            }
                        }
                        .pickerStyle(.segmented)
                    }

                    Spacer().frame(height: AppSpacing.md)

                    // Add button
                    Button {
                        guard let calories = Int(caloriesText), !foodName.isEmpty else { return }
                        Task {
                            await viewModel.logFood(name: foodName, calories: calories, mealType: mealType)
                            dismiss()
                        }
                    } label: {
                        Text("Add Meal")
                    }
                    .buttonStyle(PrimaryButtonStyle())
                    .disabled(foodName.isEmpty || caloriesText.isEmpty)
                    .opacity(foodName.isEmpty || caloriesText.isEmpty ? 0.5 : 1)
                }
                .padding(AppSpacing.lg)
            }
            .screenBackground()
            .navigationTitle("Log Meal")
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
