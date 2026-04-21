import SwiftUI

struct MacSettingsView: View {
    @EnvironmentObject var themeManager: ThemeManager
    @EnvironmentObject var authViewModel: AuthViewModel
    @StateObject private var calorieVM = CalorieViewModel()
    @State private var calorieGoal = ""

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                MacPageHeader(title: "Settings", subtitle: "Preferences", actionTitle: nil)

                MacCard {
                    VStack(alignment: .leading, spacing: 12) {
                        MacSectionTitle(text: "Appearance")
                        Picker("Theme", selection: Binding(
                            get: { themeManager.colorScheme },
                            set: { themeManager.set($0) }
                        )) {
                            Text("System").tag(ColorScheme?.none)
                            Text("Light").tag(ColorScheme?.some(.light))
                            Text("Dark").tag(ColorScheme?.some(.dark))
                        }
                        .pickerStyle(.segmented)
                    }
                }

                MacCard {
                    VStack(alignment: .leading, spacing: 12) {
                        MacSectionTitle(text: "Daily goals")
                        HStack {
                            Text("Calorie goal")
                                .font(.inter(13, weight: .medium))
                                .foregroundColor(Color.theme.espresso)
                            Spacer()
                            TextField("Calories", text: $calorieGoal)
                                .frame(width: 100)
                                .textFieldStyle(.roundedBorder)
                            Button("Save") {
                                if let goal = Int(calorieGoal) {
                                    Task { await calorieVM.updateDailyGoal(goal) }
                                }
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(Color.theme.terracotta)
                        }
                    }
                }

                MacCard {
                    VStack(alignment: .leading, spacing: 12) {
                        MacSectionTitle(text: "Account")
                        if authViewModel.isAuthenticated {
                            HStack {
                                Text(authViewModel.user?.email ?? "Signed in")
                                    .font(.inter(13))
                                    .foregroundColor(Color.theme.coffee)
                                Spacer()
                                Button("Sign out", role: .destructive) {
                                    Task { await authViewModel.signOut() }
                                }
                            }
                        }
                    }
                }
            }
            .padding(32)
            .frame(maxWidth: 640)
        }
        .background(Color.theme.cream)
        .onAppear {
            Task {
                await calorieVM.loadUserGoal()
                calorieGoal = String(calorieVM.dailyGoal)
            }
        }
    }
}
