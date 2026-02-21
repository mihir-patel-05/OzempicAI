import SwiftUI

struct LogMealView: View {
    @ObservedObject var viewModel: CalorieViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var foodName = ""
    @State private var caloriesText = ""
    @State private var mealType = CalorieLog.MealType.breakfast
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
                        isSaving = true
                        Task {
                            await viewModel.logFood(name: foodName, calories: calories, mealType: mealType)
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
                    .disabled(foodName.isEmpty || caloriesText.isEmpty || isSaving)
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
