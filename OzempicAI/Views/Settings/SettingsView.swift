import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var themeManager: ThemeManager
    @EnvironmentObject var authViewModel: AuthViewModel

    // Local binding that maps ColorScheme? <-> Int for the segmented picker
    private var themeSelection: Binding<Int> {
        Binding(
            get: {
                switch themeManager.colorScheme {
                case .light:  return 1
                case .dark:   return 2
                default:      return 0
                }
            },
            set: { index in
                switch index {
                case 1:  themeManager.set(.light)
                case 2:  themeManager.set(.dark)
                default: themeManager.set(nil)
                }
            }
        )
    }

    var body: some View {
        NavigationStack {
            List {
                Section("Appearance") {
                    VStack(alignment: .leading, spacing: AppSpacing.sm) {
                        Text("App Theme")
                            .font(.subheadline.bold())
                            .foregroundColor(Color.theme.primaryText)

                        Picker("App Theme", selection: themeSelection) {
                            Text("System").tag(0)
                            Text("Light").tag(1)
                            Text("Dark").tag(2)
                        }
                        .pickerStyle(.segmented)
                    }
                    .padding(.vertical, AppSpacing.xs)
                }

                Section("Account") {
                    Button(role: .destructive) {
                        Task { await authViewModel.signOut() }
                    } label: {
                        HStack {
                            Image(systemName: "rectangle.portrait.and.arrow.right")
                            Text("Sign Out")
                        }
                    }
                }
            }
            .navigationTitle("Settings")
        }
    }
}
