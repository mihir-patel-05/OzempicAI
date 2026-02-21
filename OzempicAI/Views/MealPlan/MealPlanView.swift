import SwiftUI

struct MealPlanView: View {
    @StateObject private var viewModel = MealPlanViewModel()
    @State private var showAddMeal = false

    private func mealIcon(for type: MealPlan.MealType) -> String {
        switch type {
        case .breakfast: return "sunrise.fill"
        case .lunch: return "sun.max.fill"
        case .dinner: return "moon.fill"
        case .snack: return "leaf.fill"
        }
    }

    private var plansByDate: [(Date, [MealPlan])] {
        let grouped = Dictionary(grouping: viewModel.weeklyPlans) { plan in
            Calendar.current.startOfDay(for: plan.plannedDate)
        }
        return grouped.sorted { $0.key < $1.key }
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEE, MMM d"
        return formatter.string(from: date)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: AppSpacing.lg) {
                    if viewModel.weeklyPlans.isEmpty {
                        // Empty state
                        VStack(spacing: AppSpacing.md) {
                            Image(systemName: "calendar.badge.plus")
                                .font(.system(size: 50))
                                .foregroundStyle(Color.theme.mediumBlue)

                            Text("Plan Your Meals")
                                .font(.title3.bold())
                                .foregroundColor(Color.theme.primaryText)

                            Text("Tap + to add your first meal plan")
                                .font(.subheadline)
                                .foregroundColor(Color.theme.secondaryText)
                        }
                        .padding(.top, 80)
                    } else {
                        ForEach(plansByDate, id: \.0) { date, plans in
                            VStack(alignment: .leading, spacing: AppSpacing.sm) {
                                // Date header pill
                                Text(formatDate(date))
                                    .font(.caption.bold())
                                    .foregroundColor(.white)
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 6)
                                    .background(Color.theme.darkNavy)
                                    .clipShape(Capsule())

                                // Meal cards for this date
                                ForEach(plans) { plan in
                                    HStack(spacing: AppSpacing.md) {
                                        // Icon circle
                                        Image(systemName: mealIcon(for: plan.mealType))
                                            .font(.body)
                                            .foregroundStyle(Color.theme.amber)
                                            .frame(width: 36, height: 36)
                                            .background(Color.theme.amber.opacity(0.12))
                                            .clipShape(Circle())

                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(plan.name)
                                                .font(.subheadline.bold())
                                                .foregroundColor(Color.theme.primaryText)

                                            Text(plan.mealType.rawValue.capitalized)
                                                .font(.caption)
                                                .foregroundColor(Color.theme.secondaryText)
                                        }

                                        Spacer()

                                        // Calorie badge
                                        Text("\(plan.calories) cal")
                                            .font(.caption.bold())
                                            .foregroundColor(Color.theme.darkNavy)
                                            .padding(.horizontal, 10)
                                            .padding(.vertical, 4)
                                            .background(Color.theme.amber.opacity(0.2))
                                            .clipShape(Capsule())
                                    }
                                    .cardStyle()
                                }
                            }
                        }
                    }
                }
                .padding(.horizontal)
                .padding(.vertical, AppSpacing.lg)
            }
            .screenBackground()
            .navigationTitle("Meal Plan")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button { showAddMeal = true } label: {
                        Image(systemName: "plus.circle.fill")
                            .foregroundStyle(Color.theme.orange)
                            .font(.title3)
                    }
                }
            }
            .sheet(isPresented: $showAddMeal) {
                AddMealView(viewModel: viewModel)
            }
            .task { await viewModel.loadWeeklyPlans() }
        }
    }
}
