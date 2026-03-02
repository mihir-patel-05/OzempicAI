import SwiftUI

@main
struct OzempicAIApp: App {
    @StateObject private var authViewModel = AuthViewModel()
    @StateObject private var themeManager = ThemeManager()

    init() {
        let bgColor = UIColor(Color.theme.background)

        let navAppearance = UINavigationBarAppearance()
        navAppearance.configureWithOpaqueBackground()
        navAppearance.backgroundColor = bgColor
        navAppearance.largeTitleTextAttributes = [.foregroundColor: UIColor.label]
        navAppearance.titleTextAttributes = [.foregroundColor: UIColor.label]
        UINavigationBar.appearance().standardAppearance = navAppearance
        UINavigationBar.appearance().scrollEdgeAppearance = navAppearance
    }

    var body: some Scene {
        WindowGroup {
            Group {
                if authViewModel.isLoading {
                    // Branded splash
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
                    DashboardView()
                        .environmentObject(authViewModel)
                        .environmentObject(themeManager)
                } else if authViewModel.needsEmailConfirmation {
                    EmailConfirmationView()
                        .environmentObject(authViewModel)
                } else {
                    LoginView()
                        .environmentObject(authViewModel)
                }
            }
            .preferredColorScheme(themeManager.colorScheme)
            .tint(Color.theme.mediumBlue)
            .task {
                await authViewModel.checkSession()
            }
        }
    }
}
