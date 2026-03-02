import SwiftUI

enum MacSidebarItem: String, CaseIterable, Identifiable {
    case workouts = "Weekly Workouts"
    case mealPlan = "Meal Plan"
    case grocery = "Grocery List"
    case calories = "Calories"
    case exerciseLog = "Exercise Log"
    case weight = "Weight"

    var id: String { rawValue }

    var icon: String {
        switch self {
        case .workouts:    return "dumbbell.fill"
        case .mealPlan:    return "calendar"
        case .grocery:     return "cart.fill"
        case .calories:    return "flame.fill"
        case .exerciseLog: return "figure.run"
        case .weight:      return "scalemass.fill"
        }
    }

    var section: SidebarSection {
        switch self {
        case .workouts, .mealPlan, .grocery: return .plan
        case .calories, .exerciseLog, .weight: return .track
        }
    }

    enum SidebarSection: String, CaseIterable {
        case plan = "PLAN"
        case track = "TRACK"
    }
}

struct MacMainView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @Binding var selection: MacSidebarItem?

    var body: some View {
        NavigationSplitView {
            List(selection: $selection) {
                ForEach(MacSidebarItem.SidebarSection.allCases, id: \.self) { section in
                    Section(section.rawValue) {
                        ForEach(MacSidebarItem.allCases.filter { $0.section == section }) { item in
                            Label(item.rawValue, systemImage: item.icon)
                                .tag(item)
                        }
                    }
                }
            }
            .listStyle(.sidebar)
            .navigationTitle("OzempicAI")
            .frame(minWidth: 200)
        } detail: {
            Group {
                switch selection {
                case .workouts:
                    MacWorkoutPlannerView()
                case .mealPlan:
                    MacMealPlannerView()
                case .grocery:
                    MacGroceryListView()
                case .calories:
                    MacCalorieOverview()
                case .exerciseLog:
                    MacExerciseLogView()
                case .weight:
                    MacWeightView()
                case nil:
                    Text("Select an item from the sidebar")
                        .font(.title2)
                        .foregroundColor(.secondary)
                }
            }
            .frame(minWidth: 800, minHeight: 700)
        }
        .frame(minWidth: 1000, minHeight: 700)
    }
}

// MARK: - Navigation Commands

struct NavigationCommands: Commands {
    @Binding var selection: MacSidebarItem?

    var body: some Commands {
        CommandMenu("Navigate") {
            Button("Weekly Workouts") { selection = .workouts }
                .keyboardShortcut("1", modifiers: .command)
            Button("Meal Plan") { selection = .mealPlan }
                .keyboardShortcut("2", modifiers: .command)
            Button("Grocery List") { selection = .grocery }
                .keyboardShortcut("3", modifiers: .command)
            Button("Calories") { selection = .calories }
                .keyboardShortcut("4", modifiers: .command)
            Button("Exercise Log") { selection = .exerciseLog }
                .keyboardShortcut("5", modifiers: .command)
            Button("Weight") { selection = .weight }
                .keyboardShortcut("6", modifiers: .command)
        }
    }
}
