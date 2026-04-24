import SwiftUI

struct MealPlanView: View {
    @StateObject private var viewModel = MealPlanViewModel()
    @State private var showAddMeal = false
    @State private var mealPendingDeletion: MealPlan?

    private func mealIcon(for type: MealPlan.MealType) -> String {
        switch type {
        case .breakfast: return "sunrise.fill"
        case .lunch:     return "sun.max.fill"
        case .dinner:    return "moon.fill"
        case .snack:     return "leaf.fill"
        }
    }

    private func mealAccent(for type: MealPlan.MealType) -> Color {
        switch type {
        case .breakfast: return Color.theme.amber
        case .lunch:     return Color.theme.terracotta
        case .dinner:    return Color.theme.plum
        case .snack:     return Color.theme.sage
        }
    }

    private var plansByDate: [(Date, [MealPlan])] {
        let grouped = Dictionary(grouping: viewModel.weeklyPlans) { plan in
            plan.plannedDateValue.map { Calendar.current.startOfDay(for: $0) } ?? .distantPast
        }
        return grouped.sorted { $0.key < $1.key }
    }

    private func formatDate(_ date: Date) -> String {
        if Calendar.current.isDateInToday(date) { return "Today" }
        if Calendar.current.isDateInTomorrow(date) { return "Tomorrow" }
        let f = DateFormatter()
        f.dateFormat = "EEEE, MMM d"
        return f.string(from: date)
    }

    var body: some View {
        ScrollView {
            VStack(spacing: AppSpacing.md) {
                ScreenHeader(title: "Meals", subtitle: "This week") {
                    showAddMeal = true
                }

                if viewModel.weeklyPlans.isEmpty {
                    emptyState
                } else {
                    ForEach(plansByDate, id: \.0) { date, plans in
                        daySection(date: date, plans: plans)
                    }
                }
                Spacer(minLength: 40)
            }
            .padding(.bottom, 100)
        }
        .screenBackground()
        .sheet(isPresented: $showAddMeal) { AddMealView(viewModel: viewModel) }
        .alert("Remove meal?", isPresented: deleteAlertBinding) {
            Button("Cancel", role: .cancel) {
                mealPendingDeletion = nil
            }
            Button("Remove", role: .destructive) {
                guard let plan = mealPendingDeletion else { return }
                mealPendingDeletion = nil
                Task { await viewModel.deleteMeal(plan) }
            }
        } message: {
            Text("This will remove the meal from your plan.")
        }
        .alert("Couldn't remove meal", isPresented: errorAlertBinding) {
            Button("OK", role: .cancel) {
                viewModel.errorMessage = nil
            }
        } message: {
            Text(viewModel.errorMessage ?? "Something went wrong.")
        }
        .task { await viewModel.loadWeeklyPlans() }
    }

    private var deleteAlertBinding: Binding<Bool> {
        Binding(
            get: { mealPendingDeletion != nil },
            set: { isPresented in
                if !isPresented { mealPendingDeletion = nil }
            }
        )
    }

    private var errorAlertBinding: Binding<Bool> {
        Binding(
            get: { viewModel.errorMessage != nil },
            set: { isPresented in
                if !isPresented { viewModel.errorMessage = nil }
            }
        )
    }

    private var emptyState: some View {
        VStack(spacing: 10) {
            Image(systemName: "calendar.badge.plus")
                .font(.system(size: 44))
                .foregroundColor(Color.theme.dust)
            Text("No meals planned yet")
                .font(AppFont.display(18, weight: .medium))
                .foregroundColor(Color.theme.espresso)
            Text("Tap + to schedule one.")
                .font(AppFont.ui(13))
                .foregroundColor(Color.theme.coffee)
        }
        .padding(.vertical, 40)
        .frame(maxWidth: .infinity)
        .background(Color.theme.paper)
        .cornerRadius(AppRadius.large)
        .shadow(color: Color.theme.shadow, radius: 8, x: 0, y: 2)
        .padding(.horizontal, AppSpacing.md + 4)
    }

    private func daySection(date: Date, plans: [MealPlan]) -> some View {
        let total = plans.reduce(0) { $0 + $1.calories }
        return VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                Text(formatDate(date))
                    .font(AppFont.display(20, weight: .medium))
                    .foregroundColor(Color.theme.espresso)
                Spacer()
                CapsLabel(text: "\(total) cal")
            }
            .padding(.horizontal, 4)

            VStack(spacing: 10) {
                ForEach(plans) { plan in
                    mealCard(plan)
                }
            }
        }
        .padding(.horizontal, AppSpacing.md + 4)
    }

    private func mealCard(_ plan: MealPlan) -> some View {
        let accent = mealAccent(for: plan.mealType)
        return HStack(spacing: 12) {
            ZStack {
                Circle().fill(accent.opacity(0.15))
                Image(systemName: mealIcon(for: plan.mealType))
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(accent)
            }
            .frame(width: 38, height: 38)

            VStack(alignment: .leading, spacing: 2) {
                Text(plan.name)
                    .font(AppFont.ui(14, weight: .semibold))
                    .foregroundColor(Color.theme.espresso)
                Text(plan.mealType.rawValue.capitalized)
                    .font(AppFont.ui(11))
                    .foregroundColor(Color.theme.dust)
            }

            Spacer()

            Text("\(plan.calories) cal")
                .font(AppFont.ui(12, weight: .semibold))
                .foregroundColor(accent)
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .background(accent.opacity(0.15))
                .clipShape(Capsule())

            Button {
                mealPendingDeletion = plan
            } label: {
                Image(systemName: "trash")
                    .font(.system(size: 12))
                    .foregroundColor(Color.theme.ember.opacity(0.8))
                    .frame(width: 44, height: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Delete meal plan")
            .accessibilityHint("Deletes this meal plan")
        }
        .padding(AppSpacing.md)
        .background(Color.theme.paper)
        .cornerRadius(AppRadius.large)
        .shadow(color: Color.theme.shadow, radius: 6, x: 0, y: 2)
    }
}
