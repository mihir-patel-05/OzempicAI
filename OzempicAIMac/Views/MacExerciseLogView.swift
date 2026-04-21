import SwiftUI

struct MacExerciseLogView: View {
    @StateObject private var viewModel = ExerciseViewModel()
    @State private var sortOrder = [KeyPathComparator(\ExerciseLog.loggedAt, order: .reverse)]
    @State private var selectedLogIds = Set<ExerciseLog.ID>()
    @State private var showAddPanel = false
    @State private var filterCategory: ExerciseLog.ExerciseCategory?

    private var filteredLogs: [ExerciseLog] {
        var logs = viewModel.logs
        if let cat = filterCategory {
            logs = logs.filter { $0.category == cat }
        }
        return logs.sorted(using: sortOrder)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            HStack(alignment: .bottom) {
                MacPageHeader(title: "Exercise", subtitle: "Log", actionTitle: nil)
                Spacer()
                Text("Today's burn · \(viewModel.totalCaloriesBurnedToday) cal")
                    .font(.inter(12, weight: .semibold))
                    .foregroundColor(Color.theme.coffee)
                Picker("Category", selection: $filterCategory) {
                    Text("All").tag(ExerciseLog.ExerciseCategory?.none)
                    ForEach(ExerciseLog.ExerciseCategory.allCases, id: \.self) { cat in
                        Text(cat.rawValue.capitalized).tag(ExerciseLog.ExerciseCategory?.some(cat))
                    }
                }
                .frame(width: 140)
                Button { showAddPanel.toggle() } label: {
                    Label("Log exercise", systemImage: "plus")
                        .font(.inter(13, weight: .semibold))
                }
                .buttonStyle(.borderedProminent)
                .tint(Color.theme.terracotta)
            }
            .padding(.horizontal, 32).padding(.top, 32)

            HStack(spacing: 16) {
                MacCard(padding: 0) {
                    Table(filteredLogs, selection: $selectedLogIds, sortOrder: $sortOrder) {
                    TableColumn("Date") { log in
                        Text(log.loggedAt.formatted(.dateTime.month(.abbreviated).day()))
                    }
                    .width(min: 60, ideal: 80)

                    TableColumn("Exercise", value: \.exerciseName)
                        .width(min: 100, ideal: 150)

                    TableColumn("Category") { log in
                        HStack(spacing: 4) {
                            Circle()
                                .fill(categoryColor(log.category))
                                .frame(width: 8, height: 8)
                            Text(log.category.rawValue.capitalized)
                        }
                    }
                    .width(min: 80, ideal: 100)

                    TableColumn("Duration") { log in
                        Text("\(log.durationMinutes) min")
                    }
                    .width(min: 60, ideal: 80)

                    TableColumn("Calories") { log in
                        Text("\(log.caloriesBurned) cal")
                    }
                    .width(min: 60, ideal: 80)

                    TableColumn("Details") { log in
                        Text(detailText(for: log))
                            .foregroundColor(.secondary)
                    }
                    .width(min: 80, ideal: 120)
                }
                .contextMenu(forSelectionType: ExerciseLog.ID.self) { ids in
                    Button("Delete", role: .destructive) {
                        Task {
                            for id in ids {
                                if let log = viewModel.logs.first(where: { $0.id == id }) {
                                    await viewModel.deleteLog(log)
                                }
                            }
                        }
                    }
                } primaryAction: { _ in }
                }

                if showAddPanel {
                    MacCard {
                        AddExercisePanel(viewModel: viewModel, onDismiss: { showAddPanel = false })
                    }
                    .frame(width: 360)
                }
            }
            .padding(.horizontal, 32).padding(.bottom, 32)
        }
        .background(Color.theme.cream)
        .task { await viewModel.loadLogs() }
    }

    private func categoryColor(_ category: ExerciseLog.ExerciseCategory) -> Color {
        switch category {
        case .cardio:      return Color.theme.terracotta
        case .strength:    return Color.theme.ember
        case .flexibility: return Color.theme.sage
        case .sports:      return Color.theme.amber
        case .other:       return Color.theme.dust
        }
    }

    private func detailText(for log: ExerciseLog) -> String {
        var parts: [String] = []
        if let sets = log.sets, let reps = log.repsPerSet {
            parts.append("\(sets)x\(reps)")
        }
        if let w = log.weight, let unit = log.weightUnit {
            parts.append("\(Int(w))\(unit.rawValue)")
        }
        return parts.joined(separator: " · ")
    }
}

// MARK: - Add Exercise Panel

private struct AddExercisePanel: View {
    @ObservedObject var viewModel: ExerciseViewModel
    let onDismiss: () -> Void

    @State private var name = ""
    @State private var category: ExerciseLog.ExerciseCategory = .strength
    @State private var duration = ""
    @State private var calories = ""
    @State private var sets = ""
    @State private var reps = ""
    @State private var bodyPart: ExerciseLog.BodyPart = .fullBody
    @State private var weight = ""
    @State private var weightUnit: ExerciseLog.WeightUnit = .lb

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            HStack {
                Text("Log Exercise")
                    .font(.headline)
                Spacer()
                Button { onDismiss() } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundColor(.secondary)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, AppSpacing.md)
            .padding(.top, AppSpacing.md)
            .padding(.bottom, AppSpacing.sm)

            Divider()

            ScrollView {
                VStack(alignment: .leading, spacing: AppSpacing.lg) {
                    // Basic Info
                    VStack(alignment: .leading, spacing: AppSpacing.sm) {
                        sectionHeader("EXERCISE")

                        TextField("Exercise Name", text: $name)
                            .textFieldStyle(.roundedBorder)

                        Picker("Category", selection: $category) {
                            ForEach(ExerciseLog.ExerciseCategory.allCases, id: \.self) { cat in
                                Text(cat.rawValue.capitalized).tag(cat)
                            }
                        }
                    }

                    // Activity
                    VStack(alignment: .leading, spacing: AppSpacing.sm) {
                        sectionHeader("ACTIVITY")

                        HStack(spacing: AppSpacing.sm) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Duration").font(.caption).foregroundColor(.secondary)
                                TextField("min", text: $duration)
                                    .textFieldStyle(.roundedBorder)
                            }
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Calories").font(.caption).foregroundColor(.secondary)
                                TextField("cal", text: $calories)
                                    .textFieldStyle(.roundedBorder)
                            }
                        }
                    }

                    // Strength Details (conditional)
                    if category == .strength {
                        VStack(alignment: .leading, spacing: AppSpacing.sm) {
                            sectionHeader("STRENGTH DETAILS")

                            Picker("Body Part", selection: $bodyPart) {
                                ForEach(ExerciseLog.BodyPart.allCases, id: \.self) { part in
                                    Text(part.displayName).tag(part)
                                }
                            }

                            HStack(spacing: AppSpacing.sm) {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("Sets").font(.caption).foregroundColor(.secondary)
                                    TextField("#", text: $sets)
                                        .textFieldStyle(.roundedBorder)
                                }
                                Text("\u{00D7}")
                                    .foregroundColor(.secondary)
                                    .padding(.top, 16)
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("Reps").font(.caption).foregroundColor(.secondary)
                                    TextField("#", text: $reps)
                                        .textFieldStyle(.roundedBorder)
                                }
                            }

                            HStack(spacing: AppSpacing.sm) {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("Weight").font(.caption).foregroundColor(.secondary)
                                    TextField("0", text: $weight)
                                        .textFieldStyle(.roundedBorder)
                                }
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("Unit").font(.caption).foregroundColor(.secondary)
                                    Picker("", selection: $weightUnit) {
                                        Text("lb").tag(ExerciseLog.WeightUnit.lb)
                                        Text("kg").tag(ExerciseLog.WeightUnit.kg)
                                    }
                                    .labelsHidden()
                                }
                                .frame(width: 70)
                            }
                        }
                    }
                }
                .padding(AppSpacing.md)
            }

            Divider()

            // Action
            Button {
                Task {
                    await viewModel.logExercise(
                        name: name,
                        category: category,
                        duration: Int(duration) ?? 0,
                        caloriesBurned: Int(calories) ?? 0,
                        sets: Int(sets),
                        repsPerSet: Int(reps),
                        bodyPart: category == .strength ? bodyPart : nil,
                        weight: Double(weight),
                        weightUnit: weight.isEmpty ? nil : weightUnit
                    )
                    name = ""
                    duration = ""
                    calories = ""
                    sets = ""
                    reps = ""
                    weight = ""
                }
            } label: {
                Text("Log Exercise")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(Color.theme.terracotta)
            .disabled(name.isEmpty || duration.isEmpty || calories.isEmpty)
            .padding(AppSpacing.md)
        }
    }

    private func sectionHeader(_ title: String) -> some View {
        Text(title)
            .font(.caption.bold())
            .foregroundColor(Color.theme.secondaryText)
            .tracking(0.5)
    }
}
