import SwiftUI

struct MealCell: View {
    let meal: MealPlan?
    let dayDate: Date
    let mealType: MealPlan.MealType
    let onAdd: () -> Void
    let onEdit: (MealPlan) -> Void

    var body: some View {
        Group {
            if let meal = meal {
                VStack(alignment: .leading, spacing: 2) {
                    Text(meal.name)
                        .font(.caption)
                        .fontWeight(.medium)
                        .lineLimit(1)
                    Text("\(meal.calories) cal")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
                .padding(6)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.theme.terracotta.opacity(0.12))
                .cornerRadius(4)
                .onTapGesture { onEdit(meal) }
            } else {
                Button(action: onAdd) {
                    Image(systemName: "plus")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
                .buttonStyle(.plain)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .frame(height: 40)
    }
}
