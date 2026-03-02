import SwiftUI

struct MacSettingsView: View {
    @EnvironmentObject var themeManager: ThemeManager
    @EnvironmentObject var authViewModel: AuthViewModel
    @StateObject private var calorieVM = CalorieViewModel()
    @State private var calorieGoal = ""

    var body: some View {
        TabView {
            // Appearance
            Form {
                Section("Appearance") {
                    Picker("Theme", selection: Binding(
                        get: { themeManager.colorScheme },
                        set: { themeManager.set($0) }
                    )) {
                        Text("System").tag(ColorScheme?.none)
                        Text("Light").tag(ColorScheme?.some(.light))
                        Text("Dark").tag(ColorScheme?.some(.dark))
                    }
                    .pickerStyle(.radioGroup)
                }
            }
            .formStyle(.grouped)
            .tabItem { Label("General", systemImage: "gearshape") }

            // Goals
            Form {
                Section("Daily Goals") {
                    HStack {
                        Text("Calorie Goal")
                        Spacer()
                        TextField("Calories", text: $calorieGoal)
                            .frame(width: 80)
                            .textFieldStyle(.roundedBorder)
                        Button("Save") {
                            if let goal = Int(calorieGoal) {
                                Task { await calorieVM.updateDailyGoal(goal) }
                            }
                        }
                    }
                }
            }
            .formStyle(.grouped)
            .tabItem { Label("Goals", systemImage: "target") }
            .onAppear {
                Task {
                    await calorieVM.loadUserGoal()
                    calorieGoal = String(calorieVM.dailyGoal)
                }
            }

            // Account
            Form {
                Section("Account") {
                    if authViewModel.isAuthenticated {
                        Text("Signed in")
                            .foregroundColor(.secondary)
                        Button("Sign Out", role: .destructive) {
                            Task { await authViewModel.signOut() }
                        }
                    }
                }
            }
            .formStyle(.grouped)
            .tabItem { Label("Account", systemImage: "person.crop.circle") }
        }
        .frame(width: 450, height: 250)
    }
}
