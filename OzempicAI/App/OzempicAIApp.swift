import SwiftUI

@main
struct OzempicAIApp: App {
    @StateObject private var authViewModel = AuthViewModel()
    @StateObject private var themeManager = ThemeManager()

    // Shared domain view models. Single source of truth so Home + trackers
    // see the same state without reloading per screen.
    @StateObject private var calorieVM  = CalorieViewModel()
    @StateObject private var waterVM    = WaterViewModel()
    @StateObject private var exerciseVM = ExerciseViewModel()
    @StateObject private var fastingVM  = FastingViewModel()
    @StateObject private var weightVM   = WeightViewModel()
    @StateObject private var heartVM    = HeartRateViewModel()

    init() {
        let navAppearance = UINavigationBarAppearance()
        navAppearance.configureWithTransparentBackground()
        navAppearance.backgroundColor = UIColor(Color(hex: "F5EFE6"))
        navAppearance.largeTitleTextAttributes = [
            .foregroundColor: UIColor(Color(hex: "2A1E16"))
        ]
        navAppearance.titleTextAttributes = [
            .foregroundColor: UIColor(Color(hex: "2A1E16"))
        ]
        UINavigationBar.appearance().standardAppearance = navAppearance
        UINavigationBar.appearance().scrollEdgeAppearance = navAppearance

        let segmentedControl = UISegmentedControl.appearance()
        segmentedControl.backgroundColor = UIColor(Color.theme.creamDim)
        segmentedControl.selectedSegmentTintColor = UIColor(Color.theme.terracottaDeep)
        segmentedControl.setTitleTextAttributes(
            [
                .foregroundColor: UIColor(Color.theme.espresso),
                .font: UIFont.systemFont(ofSize: 14, weight: .semibold)
            ],
            for: .normal
        )
        segmentedControl.setTitleTextAttributes(
            [
                .foregroundColor: UIColor.white,
                .font: UIFont.systemFont(ofSize: 14, weight: .semibold)
            ],
            for: .selected
        )
    }

    var body: some Scene {
        WindowGroup {
            Group {
                if authViewModel.isLoading {
                    splash
                } else if authViewModel.isAuthenticated {
                    DashboardView()
                        .environmentObject(authViewModel)
                        .environmentObject(themeManager)
                        .environmentObject(calorieVM)
                        .environmentObject(waterVM)
                        .environmentObject(exerciseVM)
                        .environmentObject(fastingVM)
                        .environmentObject(weightVM)
                        .environmentObject(heartVM)
                        .task { await bootstrap() }
                } else if authViewModel.needsEmailConfirmation {
                    EmailConfirmationView()
                        .environmentObject(authViewModel)
                } else {
                    LoginView()
                        .environmentObject(authViewModel)
                }
            }
            .preferredColorScheme(themeManager.colorScheme)
            .tint(Color.theme.terracotta)
            .task {
                await authViewModel.checkSession()
            }
        }
    }

    private var splash: some View {
        ZStack {
            LinearGradient(
                colors: [Color.theme.cream, Color.theme.creamDim],
                startPoint: .top, endPoint: .bottom
            )
            .ignoresSafeArea()

            VStack(spacing: AppSpacing.md) {
                ZStack {
                    LinearGradient(
                        colors: [Color.theme.terracotta, Color.theme.amber],
                        startPoint: .topLeading, endPoint: .bottomTrailing
                    )
                    .clipShape(Circle())
                    .frame(width: 88, height: 88)
                    .shadow(color: Color.theme.terracotta.opacity(0.35), radius: 18, x: 0, y: 10)

                    Image(systemName: "heart.text.square.fill")
                        .font(.system(size: 40, weight: .medium))
                        .foregroundStyle(.white)
                }

                Text("OzempicAI")
                    .font(AppFont.display(32, weight: .regular))
                    .foregroundColor(Color.theme.espresso)

                Text("a warmer way to track")
                    .font(AppFont.display(14, weight: .regular, italic: true))
                    .foregroundColor(Color.theme.coffee)
                    .padding(.bottom, AppSpacing.md)

                ProgressView()
                    .tint(Color.theme.terracotta)
            }
        }
    }

    private func bootstrap() async {
        // Warm shared view models once after sign-in so Home has data on first appear.
        async let a: () = calorieVM.loadUserGoal()
        async let b: () = calorieVM.loadLogs()
        async let c: () = waterVM.loadTodaysLogs()
        async let d: () = weightVM.loadLogs()
        async let e: () = exerciseVM.loadLogs()
        _ = await (a, b, c, d, e)
    }
}
