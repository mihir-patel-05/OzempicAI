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
            ScrollView {
                VStack(spacing: AppSpacing.md) {
                    // Meal name
                    VStack(alignment: .leading, spacing: AppSpacing.xs) {
                        Text("Meal Name")
                            .font(.caption.bold())
                            .foregroundColor(Color.theme.secondaryText)
                        TextField("e.g. Grilled Salmon Bowl", text: $mealName)
                            .textFieldStyle(ThemedTextFieldStyle())
                    }

                    // Date picker
                    VStack(alignment: .leading, spacing: AppSpacing.xs) {
                        Text("Planned Date")
                            .font(.caption.bold())
                            .foregroundColor(Color.theme.secondaryText)
                        DatePicker("Date", selection: $plannedDate, displayedComponents: .date)
                            .datePickerStyle(.compact)
                            .tint(Color.theme.mediumBlue)
                            .labelsHidden()
                    }

                    // Meal type
                    VStack(alignment: .leading, spacing: AppSpacing.xs) {
                        Text("Meal Type")
                            .font(.caption.bold())
                            .foregroundColor(Color.theme.secondaryText)
                        Picker("Meal type", selection: $mealType) {
                            ForEach(MealPlan.MealType.allCases, id: \.self) {
                                Text($0.rawValue.capitalized)
                            }
                        }
                        .pickerStyle(.segmented)
                    }

                    // Calories
                    VStack(alignment: .leading, spacing: AppSpacing.xs) {
                        Text("Calories")
                            .font(.caption.bold())
                            .foregroundColor(Color.theme.secondaryText)
                        TextField("e.g. 500", text: $caloriesText)
                            .keyboardType(.numberPad)
                            .textFieldStyle(ThemedTextFieldStyle())
                    }

                    Spacer().frame(height: AppSpacing.md)

                    // Add button
                    Button {
                        guard let calories = Int(caloriesText), !mealName.isEmpty else { return }
                        Task {
                            await viewModel.addMeal(name: mealName, date: plannedDate, mealType: mealType, calories: calories)
                            dismiss()
                        }
                    } label: {
                        Text("Add Meal")
                    }
                    .buttonStyle(PrimaryButtonStyle())
                    .disabled(mealName.isEmpty || caloriesText.isEmpty)
                    .opacity(mealName.isEmpty || caloriesText.isEmpty ? 0.5 : 1)
                }
                .padding(AppSpacing.lg)
            }
            .screenBackground()
            .navigationTitle("Add Meal")
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
