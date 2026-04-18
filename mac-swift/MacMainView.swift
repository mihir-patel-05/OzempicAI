// MacMainView.swift — Redesigned with warm palette + sidebar navigation
// Replace: OzempicAI/OzempicAIMac/Views/MacMainView.swift

import SwiftUI

enum MacSidebarItem: String, CaseIterable, Identifiable {
    case home        = "Home"
    case nutrition   = "Nutrition"
    case water       = "Water"
    case exercise    = "Exercise"
    case workouts    = "Workouts"
    case heartRate   = "Heart Rate"
    case mealPlan    = "Meal Plan"
    case grocery     = "Grocery"
    case fasting     = "Fasting"
    case weight      = "Weight"
    case settings    = "Settings"

    var id: String { rawValue }

    var icon: String {
        switch self {
        case .home:      return "house.fill"
        case .nutrition: return "flame.fill"
        case .water:     return "drop.fill"
        case .exercise:  return "figure.run"
        case .workouts:  return "dumbbell.fill"
        case .heartRate: return "heart.fill"
        case .mealPlan:  return "calendar"
        case .grocery:   return "cart.fill"
        case .fasting:   return "moon.fill"
        case .weight:    return "scalemass.fill"
        case .settings:  return "gearshape.fill"
        }
    }

    var section: Section {
        switch self {
        case .home: return .overview
        case .nutrition, .water, .exercise, .workouts, .heartRate: return .track
        case .mealPlan, .grocery: return .plan
        case .fasting, .weight: return .body
        case .settings: return .account
        }
    }

    enum Section: String, CaseIterable {
        case overview = "OVERVIEW"
        case track    = "TRACK"
        case plan     = "PLAN"
        case body     = "BODY"
        case account  = "ACCOUNT"
    }
}

struct MacMainView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @Binding var selection: MacSidebarItem?

    var body: some View {
        NavigationSplitView {
            MacSidebarView(selection: $selection)
                .frame(minWidth: 220)
        } detail: {
            detailView
                .frame(minWidth: 880, minHeight: 700)
                .background(Color.theme.cream)
        }
        .frame(minWidth: 1100, minHeight: 760)
    }

    @ViewBuilder
    private var detailView: some View {
        switch selection {
        case .home:       MacHomeView()
        case .nutrition:  MacCalorieOverview()
        case .water:      MacWaterView()
        case .exercise:   MacExerciseLogView()
        case .workouts:   MacWorkoutPlannerView()
        case .heartRate:  MacHeartRateView()
        case .mealPlan:   MacMealPlannerView()
        case .grocery:    MacGroceryListView()
        case .fasting:    MacFastingView()
        case .weight:     MacWeightView()
        case .settings:   MacSettingsView()
        case nil:
            Text("Select an item")
                .font(.fraunces(20))
                .foregroundColor(Color.theme.coffee)
        }
    }
}

struct MacSidebarView: View {
    @Binding var selection: MacSidebarItem?
    @EnvironmentObject var authViewModel: AuthViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Brand
            HStack(spacing: 10) {
                LinearGradient(
                    colors: [Color.theme.terracotta, Color.theme.amber],
                    startPoint: .topLeading, endPoint: .bottomTrailing
                )
                .frame(width: 32, height: 32)
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .overlay(Text("O").font(.fraunces(16, weight: .semibold)).foregroundColor(.white))

                VStack(alignment: .leading, spacing: 1) {
                    Text("OzempicAI").font(.fraunces(15, weight: .semibold))
                        .foregroundColor(Color.theme.espresso)
                    Text("Fitness · Mac").font(.inter(10, weight: .medium))
                        .foregroundColor(Color.theme.coffee)
                }
                Spacer()
            }
            .padding(.horizontal, 18).padding(.top, 12).padding(.bottom, 18)

            // Sections
            ScrollView {
                VStack(alignment: .leading, spacing: 2) {
                    ForEach(MacSidebarItem.Section.allCases, id: \.self) { section in
                        Text(section.rawValue)
                            .font(.inter(10, weight: .bold))
                            .tracking(1.2)
                            .foregroundColor(Color.theme.dust)
                            .padding(.horizontal, 20).padding(.top, 14).padding(.bottom, 6)

                        ForEach(MacSidebarItem.allCases.filter { $0.section == section }) { item in
                            SidebarRow(item: item, selected: selection == item) {
                                selection = item
                            }
                        }
                    }
                }
            }

            Divider().background(Color.theme.divider)
            // Profile
            HStack(spacing: 10) {
                LinearGradient(
                    colors: [Color.theme.terracotta, Color.theme.amber],
                    startPoint: .topLeading, endPoint: .bottomTrailing
                )
                .frame(width: 30, height: 30)
                .clipShape(Circle())
                .overlay(
                    Text(String(authViewModel.user?.name.first ?? "A"))
                        .font(.fraunces(13, weight: .semibold))
                        .foregroundColor(.white)
                )
                VStack(alignment: .leading, spacing: 1) {
                    Text(authViewModel.user?.name ?? "You")
                        .font(.inter(12, weight: .semibold))
                        .foregroundColor(Color.theme.espresso)
                    Text("Pro · synced")
                        .font(.inter(10, weight: .medium))
                        .foregroundColor(Color.theme.coffee)
                }
                Spacer()
            }
            .padding(14)
        }
        .background(Color.theme.cream)
    }
}

private struct SidebarRow: View {
    let item: MacSidebarItem
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                Image(systemName: item.icon)
                    .font(.system(size: 13, weight: selected ? .semibold : .medium))
                    .foregroundColor(selected ? Color.theme.terracotta : Color.theme.coffee)
                    .frame(width: 18)
                Text(item.rawValue)
                    .font(.inter(13, weight: selected ? .semibold : .medium))
                    .foregroundColor(selected ? Color.theme.terracotta : Color.theme.espresso)
                Spacer()
            }
            .padding(.horizontal, 12).padding(.vertical, 7)
            .background(selected ? Color.theme.terracotta.opacity(0.12) : .clear)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .padding(.horizontal, 8)
        }
        .buttonStyle(.plain)
    }
}

struct NavigationCommands: Commands {
    @Binding var selection: MacSidebarItem?
    var body: some Commands {
        CommandMenu("Navigate") {
            Button("Home")       { selection = .home       }.keyboardShortcut("1", modifiers: .command)
            Button("Nutrition")  { selection = .nutrition  }.keyboardShortcut("2", modifiers: .command)
            Button("Water")      { selection = .water      }.keyboardShortcut("3", modifiers: .command)
            Button("Exercise")   { selection = .exercise   }.keyboardShortcut("4", modifiers: .command)
            Button("Workouts")   { selection = .workouts   }.keyboardShortcut("5", modifiers: .command)
            Button("Heart Rate") { selection = .heartRate  }.keyboardShortcut("6", modifiers: .command)
            Button("Meal Plan")  { selection = .mealPlan   }.keyboardShortcut("7", modifiers: .command)
            Button("Grocery")    { selection = .grocery    }.keyboardShortcut("8", modifiers: .command)
            Button("Fasting")    { selection = .fasting    }.keyboardShortcut("9", modifiers: .command)
            Button("Weight")     { selection = .weight     }.keyboardShortcut("0", modifiers: .command)
        }
    }
}
