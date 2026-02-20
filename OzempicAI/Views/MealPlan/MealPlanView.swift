import SwiftUI

struct MealPlanView: View {
    @StateObject private var viewModel = MealPlanViewModel()
    @State private var showAddMeal = false

    var body: some View {
        NavigationStack {
            List {
                ForEach(viewModel.weeklyPlans) { plan in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(plan.name).font(.headline)
                        HStack {
                            Text(plan.mealType.rawValue.capitalized)
                            Text("·")
                            Text("\(plan.calories) cal")
                        }
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    }
                }
            }
            .navigationTitle("Meal Plan")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button { showAddMeal = true } label: { Image(systemName: "plus") }
                }
            }
            .sheet(isPresented: $showAddMeal) {
                AddMealView(viewModel: viewModel)
            }
            .task { await viewModel.loadWeeklyPlans() }
        }
    }
}
