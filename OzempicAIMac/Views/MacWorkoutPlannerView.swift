import SwiftUI

struct MacWorkoutPlannerView: View {
    @StateObject private var viewModel = WorkoutPlanViewModel()
    @State private var weekStart = WeekNavigator.mondayOfWeek(containing: .now)
    @State private var showAddPopover = false
    @State private var addingForDate: Date = .now
    @State private var editingPlan: WorkoutPlan?
    @State private var editingLabelDate: Date?
    @State private var editingLabelText: String = ""
    @FocusState private var labelFieldFocused: Bool

    private var daysOfWeek: [Date] {
        (0..<7).compactMap { Calendar.current.date(byAdding: .day, value: $0, to: weekStart) }
    }

    private static let dayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    private func plans(for date: Date) -> [WorkoutPlan] {
        let dateString = Self.dayFormatter.string(from: date)
        return viewModel.weeklyPlans.filter {
            $0.plannedDate == dateString
        }
    }

    private var defaultAddDate: Date {
        let calendar = Calendar.current
        let currentWeekStart = WeekNavigator.mondayOfWeek(containing: .now)
        return calendar.isDate(weekStart, inSameDayAs: currentWeekStart) ? .now : weekStart
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                HStack(alignment: .bottom) {
                    MacPageHeader(title: "Workouts", subtitle: "This week", actionTitle: nil)
                    Spacer()
                    WeekNavigator(weekStart: $weekStart)
                    Spacer()
                    Button {
                        addingForDate = defaultAddDate
                        showAddPopover = true
                    } label: {
                        Label("Add", systemImage: "plus")
                            .font(.inter(13, weight: .semibold))
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(Color.theme.terracotta)
                }

                HStack(spacing: 8) {
                    ForEach(daysOfWeek, id: \.self) { day in
                        dayColumn(for: day)
                    }
                }
                .frame(minHeight: 560)
            }
            .padding(32)
        }
        .background(Color.theme.cream)
        .onChange(of: weekStart) { _ in
            Task {
                await viewModel.loadWeeklyPlans(for: weekStart)
                await viewModel.loadWeeklyDayLabels(for: weekStart)
            }
        }
        .task {
            await viewModel.loadWeeklyPlans(for: weekStart)
            await viewModel.loadWeeklyDayLabels(for: weekStart)
            await viewModel.loadPastExercises()
            await viewModel.loadPastWorkoutPlans()
        }
        .sheet(item: $editingPlan) { plan in
            EditWorkoutSheet(viewModel: viewModel, plan: plan, weekStart: weekStart)
        }
        .sheet(isPresented: $showAddPopover) {
            AddWorkoutSheet(viewModel: viewModel, date: addingForDate, weekStart: weekStart)
        }
    }

    @ViewBuilder
    private func dayColumn(for date: Date) -> some View {
        let dayPlans = plans(for: date)
        let isToday = Calendar.current.isDateInToday(date)

        VStack(spacing: 8) {
            // Day header
            VStack(spacing: 2) {
                Text(date.formatted(.dateTime.weekday(.abbreviated)))
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundColor(isToday ? Color.theme.terracotta : Color.theme.coffee)
                Text(date.formatted(.dateTime.day()))
                    .font(.title3)
                    .fontWeight(isToday ? .bold : .regular)
                    .foregroundColor(isToday ? Color.theme.terracotta : Color.theme.espresso)
            }
            .padding(.vertical, 8)

            Divider()

            // Day label
            dayLabelView(for: date)

            // Workout cards
            ScrollView {
                VStack(spacing: 6) {
                    ForEach(dayPlans) { plan in
                        WorkoutCard(plan: plan)
                            .onTapGesture {
                                editingPlan = plan
                            }
                            .contextMenu {
                                Button("Delete", role: .destructive) {
                                    Task { await viewModel.deleteWorkoutPlan(plan)
                                        await viewModel.loadWeeklyPlans(for: weekStart)
                                    }
                                }
                            }
                    }
                }
                .padding(.horizontal, 4)
            }

            Spacer()

            // Add button per day
            Button {
                addingForDate = date
                showAddPopover = true
            } label: {
                Image(systemName: "plus.circle")
                    .foregroundColor(Color.theme.terracotta)
            }
            .buttonStyle(.plain)
            .padding(.bottom, 8)
        }
        .frame(maxWidth: .infinity)
        .background(isToday ? Color.theme.terracotta.opacity(0.05) : Color.clear)
        .cornerRadius(AppRadius.small)
    }
    @ViewBuilder
    private func dayLabelView(for date: Date) -> some View {
        let dateString = Self.dayFormatter.string(from: date)
        let savedLabel = viewModel.weeklyDayLabels[dateString]
        let isEditing = editingLabelDate == date

        if isEditing {
            TextField("Rest Day", text: $editingLabelText)
                .font(.caption)
                .textFieldStyle(.roundedBorder)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 4)
                .focused($labelFieldFocused)
                .onSubmit {
                    commitLabelEdit(for: date)
                }
                .onExitCommand {
                    editingLabelDate = nil
                }
                .onAppear {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                        labelFieldFocused = true
                    }
                }
        } else {
            Text(savedLabel ?? "Rest Day")
                .font(.caption)
                .foregroundColor(savedLabel != nil ? Color.theme.terracotta : Color.theme.dust)
                .frame(maxWidth: .infinity)
                .contentShape(Rectangle())
                .onTapGesture {
                    editingLabelText = savedLabel ?? ""
                    editingLabelDate = date
                }
        }
    }

    private func commitLabelEdit(for date: Date) {
        let trimmed = editingLabelText.trimmingCharacters(in: .whitespacesAndNewlines)
        labelFieldFocused = false
        editingLabelDate = nil
        Task {
            await viewModel.saveDayLabel(date: date, label: trimmed)
        }
    }
}

// MARK: - Add Workout Sheet

private struct AddWorkoutSheet: View {
    @ObservedObject var viewModel: WorkoutPlanViewModel
    let date: Date
    let weekStart: Date
    @Environment(\.dismiss) private var dismiss

    @State private var isFromHistory = false
    @State private var searchText = ""
    @State private var exerciseName = ""
    @State private var category: ExerciseLog.ExerciseCategory = .strength
    @State private var sets = ""
    @State private var reps = ""
    @State private var duration = ""
    @State private var calories = ""
    @State private var weight = ""
    @State private var weightUnit: ExerciseLog.WeightUnit = .lb
    @State private var bodyPart: ExerciseLog.BodyPart = .fullBody
    @State private var notes = ""
    @State private var suggestions: [String] = []

    private var pastNames: [String] {
        Array(Set(viewModel.allPastExercises.map(\.exerciseName))).sorted()
    }

    private var uniquePastExercises: [WorkoutPlanViewModel.HistoryExercise] {
        var seen = Set<String>()
        return viewModel.allPastExercises.filter { item in
            let key = item.exerciseName.lowercased()
            guard !seen.contains(key) else { return false }
            seen.insert(key)
            return true
        }
    }

    private var filteredPastExercises: [WorkoutPlanViewModel.HistoryExercise] {
        if searchText.isEmpty { return uniquePastExercises }
        return uniquePastExercises.filter {
            $0.exerciseName.localizedCaseInsensitiveContains(searchText)
        }
    }

    private func selectPastExercise(_ item: WorkoutPlanViewModel.HistoryExercise) {
        exerciseName = item.exerciseName
        category = item.category
        duration = item.durationMinutes.map(String.init) ?? ""
        calories = item.caloriesBurned.map(String.init) ?? ""
        sets = item.sets.map(String.init) ?? ""
        reps = item.repsPerSet.map(String.init) ?? ""
        if let bp = item.bodyPart { bodyPart = bp }
        weight = item.weight.map(weightText) ?? ""
        if let wu = item.weightUnit { weightUnit = wu }
        suggestions = []
    }

    private func categoryIcon(for category: ExerciseLog.ExerciseCategory) -> String {
        switch category {
        case .cardio: return "figure.run"
        case .strength: return "figure.strengthtraining.traditional"
        case .flexibility: return "figure.mind.and.body"
        case .sports: return "sportscourt.fill"
        case .other: return "ellipsis.circle.fill"
        }
    }

    private func categoryColor(for category: ExerciseLog.ExerciseCategory) -> Color {
        switch category {
        case .cardio: return Color.theme.terracotta
        case .strength: return Color.theme.amber
        case .flexibility, .sports: return Color.theme.mediumBlue
        case .other: return Color.theme.lightBlue
        }
    }

    private func weightText(_ value: Double) -> String {
        value.rounded() == value ? String(Int(value)) : String(value)
    }

    var body: some View {
        VStack(spacing: 16) {
            Text("Add Workout — \(date.formatted(.dateTime.weekday(.wide).month().day()))")
                .font(.headline)

            Form {
                Picker("Source", selection: $isFromHistory) {
                    Text("New Workout").tag(false)
                    Text("From History").tag(true)
                }
                .pickerStyle(.segmented)
                .onChange(of: isFromHistory) { _ in
                    suggestions = []
                    searchText = ""
                }

                if isFromHistory {
                    VStack(alignment: .leading, spacing: 8) {
                        TextField("Search workout history", text: $searchText)

                        if filteredPastExercises.isEmpty {
                            HStack(spacing: 8) {
                                Image(systemName: "figure.run.circle")
                                    .foregroundColor(Color.theme.dust)
                                Text("No past workouts found")
                                    .font(.caption)
                                    .foregroundColor(Color.theme.coffee)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.vertical, 8)
                        } else {
                            VStack(spacing: 4) {
                                ForEach(filteredPastExercises.prefix(8)) { item in
                                    Button {
                                        selectPastExercise(item)
                                    } label: {
                                        HStack(spacing: 8) {
                                            Image(systemName: categoryIcon(for: item.category))
                                                .foregroundColor(categoryColor(for: item.category))
                                                .frame(width: 18)

                                            VStack(alignment: .leading, spacing: 2) {
                                                Text(item.exerciseName)
                                                    .font(.caption)
                                                    .fontWeight(.semibold)
                                                    .foregroundColor(Color.theme.espresso)
                                                    .lineLimit(1)

                                                Text(historyDetail(for: item))
                                                    .font(.caption2)
                                                    .foregroundColor(Color.theme.coffee)
                                                    .lineLimit(1)
                                            }

                                            Spacer()

                                            if exerciseName == item.exerciseName {
                                                Image(systemName: "checkmark.circle.fill")
                                                    .foregroundColor(Color.theme.terracotta)
                                            }
                                        }
                                        .padding(6)
                                        .background(
                                            exerciseName == item.exerciseName
                                                ? Color.theme.terracotta.opacity(0.1)
                                                : Color.clear
                                        )
                                        .cornerRadius(AppRadius.small)
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                    }
                }

                TextField("Exercise Name", text: $exerciseName)
                    .onChange(of: exerciseName) { newValue in
                        guard !isFromHistory else {
                            suggestions = []
                            return
                        }

                        if newValue.count >= 2 {
                            suggestions = pastNames.filter {
                                $0.localizedCaseInsensitiveContains(newValue)
                            }.prefix(5).map { $0 }
                        } else {
                            suggestions = []
                        }
                    }

                if !isFromHistory && !suggestions.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        ForEach(suggestions, id: \.self) { name in
                            Button(name) {
                                if let past = viewModel.allPastExercises.first(where: { $0.exerciseName == name }) {
                                    selectPastExercise(past)
                                } else {
                                    exerciseName = name
                                    suggestions = []
                                }
                            }
                            .buttonStyle(.plain)
                            .foregroundColor(Color.theme.terracotta)
                        }
                    }
                }

                Picker("Category", selection: $category) {
                    ForEach(ExerciseLog.ExerciseCategory.allCases, id: \.self) { cat in
                        Text(cat.rawValue.capitalized).tag(cat)
                    }
                }

                Picker("Body Part", selection: $bodyPart) {
                    ForEach(ExerciseLog.BodyPart.allCases, id: \.self) { part in
                        Text(part.rawValue.replacingOccurrences(of: "_", with: " ").capitalized).tag(part)
                    }
                }

                HStack {
                    TextField("Sets", text: $sets)
                        .frame(width: 60)
                    Text("x")
                    TextField("Reps", text: $reps)
                        .frame(width: 60)
                }

                HStack {
                    TextField("Duration (min)", text: $duration)
                    TextField("Calories", text: $calories)
                }

                HStack {
                    TextField("Weight", text: $weight)
                        .frame(width: 80)
                    Picker("", selection: $weightUnit) {
                        Text("lb").tag(ExerciseLog.WeightUnit.lb)
                        Text("kg").tag(ExerciseLog.WeightUnit.kg)
                    }
                    .frame(width: 60)
                }

                TextField("Notes", text: $notes)
            }
            .formStyle(.grouped)

            HStack {
                Button("Cancel") { dismiss() }
                    .keyboardShortcut(.cancelAction)
                Spacer()
                Button("Add Workout") {
                    Task {
                        await viewModel.addWorkoutPlan(
                            exerciseName: exerciseName,
                            category: category,
                            plannedDate: date,
                            durationMinutes: Int(duration),
                            caloriesBurned: Int(calories),
                            sets: Int(sets),
                            repsPerSet: Int(reps),
                            bodyPart: bodyPart,
                            weight: Double(weight),
                            weightUnit: weight.isEmpty ? nil : weightUnit,
                            notes: notes.isEmpty ? nil : notes
                        )
                        await viewModel.loadWeeklyPlans(for: weekStart)
                        dismiss()
                    }
                }
                .keyboardShortcut(.defaultAction)
                .disabled(exerciseName.isEmpty)
            }
            .padding()
        }
        .frame(width: 520, height: 620)
        .padding()
        .task {
            await viewModel.loadPastExercises()
            await viewModel.loadPastWorkoutPlans()
        }
    }

    private func historyDetail(for item: WorkoutPlanViewModel.HistoryExercise) -> String {
        var details = [item.category.rawValue.capitalized]
        if let duration = item.durationMinutes { details.append("\(duration) min") }
        if let calories = item.caloriesBurned { details.append("\(calories) cal") }
        if let sets = item.sets, let reps = item.repsPerSet { details.append("\(sets)x\(reps)") }
        if let weight = item.weight {
            let unit = item.weightUnit?.rawValue ?? ExerciseLog.WeightUnit.lb.rawValue
            details.append("\(weightText(weight)) \(unit)")
        }
        return details.joined(separator: " - ")
    }
}

// MARK: - Edit Workout Sheet

private struct EditWorkoutSheet: View {
    @ObservedObject var viewModel: WorkoutPlanViewModel
    let plan: WorkoutPlan
    let weekStart: Date
    @Environment(\.dismiss) private var dismiss

    @State private var exerciseName = ""
    @State private var category: ExerciseLog.ExerciseCategory = .strength
    @State private var sets = ""
    @State private var reps = ""
    @State private var duration = ""
    @State private var weight = ""
    @State private var weightUnit: ExerciseLog.WeightUnit = .lb
    @State private var bodyPart: ExerciseLog.BodyPart = .fullBody
    @State private var notes = ""

    var body: some View {
        VStack(spacing: 16) {
            Text("Edit Workout")
                .font(.headline)

            Form {
                TextField("Exercise Name", text: $exerciseName)

                Picker("Category", selection: $category) {
                    ForEach(ExerciseLog.ExerciseCategory.allCases, id: \.self) { cat in
                        Text(cat.rawValue.capitalized).tag(cat)
                    }
                }

                Picker("Body Part", selection: $bodyPart) {
                    ForEach(ExerciseLog.BodyPart.allCases, id: \.self) { part in
                        Text(part.rawValue.replacingOccurrences(of: "_", with: " ").capitalized).tag(part)
                    }
                }

                HStack {
                    TextField("Sets", text: $sets)
                        .frame(width: 60)
                    Text("x")
                    TextField("Reps", text: $reps)
                        .frame(width: 60)
                }

                TextField("Duration (min)", text: $duration)

                HStack {
                    TextField("Weight", text: $weight)
                        .frame(width: 80)
                    Picker("", selection: $weightUnit) {
                        Text("lb").tag(ExerciseLog.WeightUnit.lb)
                        Text("kg").tag(ExerciseLog.WeightUnit.kg)
                    }
                    .frame(width: 60)
                }

                TextField("Notes", text: $notes)
            }
            .formStyle(.grouped)

            HStack {
                Button("Delete", role: .destructive) {
                    Task {
                        await viewModel.deleteWorkoutPlan(plan)
                        await viewModel.loadWeeklyPlans(for: weekStart)
                        dismiss()
                    }
                }
                .foregroundColor(.red)

                Spacer()

                Button("Cancel") { dismiss() }
                    .keyboardShortcut(.cancelAction)

                Button("Save") {
                    Task {
                        await viewModel.updateWorkoutPlan(
                            id: plan.id,
                            exerciseName: exerciseName,
                            category: category,
                            plannedDate: plan.plannedDateValue ?? .now,
                            durationMinutes: Int(duration),
                            sets: Int(sets),
                            repsPerSet: Int(reps),
                            bodyPart: bodyPart,
                            weight: Double(weight),
                            weightUnit: weight.isEmpty ? nil : weightUnit,
                            notes: notes.isEmpty ? nil : notes
                        )
                        await viewModel.loadWeeklyPlans(for: weekStart)
                        dismiss()
                    }
                }
                .keyboardShortcut(.defaultAction)
                .disabled(exerciseName.isEmpty)
            }
            .padding()
        }
        .frame(width: 420, height: 520)
        .padding()
        .onAppear {
            exerciseName = plan.exerciseName
            category = plan.category
            sets = plan.sets.map(String.init) ?? ""
            reps = plan.repsPerSet.map(String.init) ?? ""
            duration = plan.durationMinutes.map(String.init) ?? ""
            weight = plan.weight.map { String(Int($0)) } ?? ""
            weightUnit = plan.weightUnit ?? .lb
            bodyPart = plan.bodyPart ?? .fullBody
            notes = plan.notes ?? ""
        }
    }
}
