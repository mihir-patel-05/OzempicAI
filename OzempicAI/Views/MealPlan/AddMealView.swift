import SwiftUI

struct AddMealView: View {
    @ObservedObject var viewModel: MealPlanViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var mealName = ""
    @State private var plannedDate = Date()
    @State private var mealType = MealPlan.MealType.lunch
    @State private var caloriesText = ""
    @State private var isSaving = false

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
                        isSaving = true
                        Task {
                            await viewModel.addMeal(name: mealName, date: plannedDate, mealType: mealType, calories: calories)
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
                            Text("Add Meal")
                        }
                    }
                    .buttonStyle(PrimaryButtonStyle())
                    .disabled(mealName.isEmpty || caloriesText.isEmpty || isSaving)
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
