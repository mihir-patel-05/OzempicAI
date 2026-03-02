import SwiftUI

@main
struct OzempicAIMacApp: App {
    @StateObject private var authViewModel = AuthViewModel()
    @StateObject private var themeManager = ThemeManager()
    @State private var sidebarSelection: MacSidebarItem? = .workouts

    var body: some Scene {
        WindowGroup {
            Group {
                if authViewModel.isLoading {
                    ZStack {
                        Color.theme.darkNavy.ignoresSafeArea()
                        VStack(spacing: 16) {
                            Image(systemName: "heart.text.square.fill")
                                .font(.system(size: 60))
                                .foregroundStyle(Color.theme.amber)
                            Text("OzempicAI")
                                .font(.system(size: 34, weight: .bold, design: .rounded))
                                .foregroundColor(.white)
                            ProgressView()
                                .tint(Color.theme.lightBlue)
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
            .tint(Color.theme.mediumBlue)
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
