import SwiftUI

struct WorkoutCard: View {
    let plan: WorkoutPlan

    private var categoryColor: Color {
        switch plan.category {
        case .cardio:      return Color.theme.mediumBlue
        case .strength:    return Color.theme.orange
        case .flexibility: return .green
        case .sports:      return Color.theme.amber
        case .other:       return .gray
        }
    }

    private var categoryIcon: String {
        switch plan.category {
        case .cardio:      return "figure.run"
        case .strength:    return "dumbbell.fill"
        case .flexibility: return "figure.mind.and.body"
        case .sports:      return "sportscourt.fill"
        case .other:       return "figure.mixed.cardio"
        }
    }

    private var detailText: String {
        if let sets = plan.sets, let reps = plan.repsPerSet {
            var text = "\(sets)x\(reps)"
            if let w = plan.weight, let unit = plan.weightUnit {
                text += " · \(Int(w))\(unit.rawValue)"
            }
            return text
        } else if let duration = plan.durationMinutes {
            return "\(duration) min"
        }
        return ""
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 4) {
                Image(systemName: categoryIcon)
                    .font(.caption2)
                    .foregroundColor(categoryColor)
                Text(plan.exerciseName)
                    .font(.caption)
                    .fontWeight(.semibold)
                    .lineLimit(1)
            }

            if !detailText.isEmpty {
                Text(detailText)
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        }
        .padding(8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(categoryColor.opacity(0.1))
        .cornerRadius(AppRadius.small)
        .overlay(
            RoundedRectangle(cornerRadius: AppRadius.small)
                .strokeBorder(categoryColor.opacity(0.3), lineWidth: 1)
        )
    }
}
