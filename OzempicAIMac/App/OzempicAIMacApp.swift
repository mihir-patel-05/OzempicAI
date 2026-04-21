import SwiftUI

@main
struct OzempicAIMacApp: App {
    @StateObject private var authViewModel = AuthViewModel()
    @StateObject private var themeManager = ThemeManager()
    @State private var sidebarSelection: MacSidebarItem? = .home

    var body: some Scene {
        WindowGroup {
            Group {
                if authViewModel.isLoading {
                    ZStack {
                        Color.theme.cream.ignoresSafeArea()
                        VStack(spacing: 16) {
                            Image(systemName: "heart.text.square.fill")
                                .font(.system(size: 60))
                                .foregroundStyle(Color.theme.terracotta)
                            Text("OzempicAI")
                                .font(.fraunces(34, weight: .semibold))
                                .foregroundColor(Color.theme.espresso)
                            ProgressView()
                                .tint(Color.theme.terracotta)
                        }
                    }
                } else if authViewModel.isAuthenticated {
                    MacMainView(selection: $sidebarSelection)
                        .environmentObject(authViewModel)
                        .environmentObject(themeManager)
                } else {
                    MacLoginView()
                        .environmentObject(authViewModel)
                }
            }
            .preferredColorScheme(themeManager.colorScheme)
            .tint(Color.theme.terracotta)
            .task {
                await authViewModel.checkSession()
            }
        }
        .windowResizability(.contentMinSize)
        .defaultSize(width: 1200, height: 800)
        .commands {
            NavigationCommands(selection: $sidebarSelection)
        }

        Settings {
            MacSettingsView()
                .environmentObject(themeManager)
                .environmentObject(authViewModel)
        }
    }
}
