import Foundation

@MainActor
class AuthViewModel: ObservableObject {
    @Published var isAuthenticated = false
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var needsEmailConfirmation = false
    @Published var currentUser: User?

    private let authService = AuthService()

    var avatarInitial: String {
        if let name = currentUser?.name.trimmingCharacters(in: .whitespacesAndNewlines),
           let first = name.first, !name.isEmpty {
            return String(first).uppercased()
        }
        if let email = currentUser?.email.trimmingCharacters(in: .whitespacesAndNewlines),
           let first = email.first {
            return String(first).uppercased()
        }
        return "?"
    }

    func signIn(email: String, password: String) async {
        isLoading = true
        errorMessage = nil
        do {
            try await authService.signIn(email: email, password: password)
            // Ensure user profile exists — don't block login if this fails
            try? await authService.ensureUserProfile()
            await loadProfile()
            isAuthenticated = true
            needsEmailConfirmation = false
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    func signUp(email: String, password: String) async {
        isLoading = true
        errorMessage = nil
        do {
            try await authService.signUp(email: email, password: password)
            // Don't set isAuthenticated — user must confirm email first
            needsEmailConfirmation = true
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    func checkSession() async {
        isLoading = true
        if let session = await authService.currentSession() {
            if session.user.emailConfirmedAt != nil {
                // Ensure user profile exists on session restore too
                try? await authService.ensureUserProfile()
                await loadProfile()
                isAuthenticated = true
            }
        }
        isLoading = false
    }

    func signOut() async {
        try? await authService.signOut()
        isAuthenticated = false
        needsEmailConfirmation = false
        currentUser = nil
    }

    func loadProfile() async {
        do {
            currentUser = try await authService.fetchUserProfile()
        } catch {
            // Non-blocking — avatar falls back to email initial
        }
    }

    func updateProfile(
        name: String,
        age: Int?,
        heightCm: Double?,
        weightKg: Double?,
        dailyCalorieGoal: Int,
        dailyWaterGoalMl: Int
    ) async -> Bool {
        errorMessage = nil
        do {
            currentUser = try await authService.updateUserProfile(
                name: name,
                age: age,
                heightCm: heightCm,
                weightKg: weightKg,
                dailyCalorieGoal: dailyCalorieGoal,
                dailyWaterGoalMl: dailyWaterGoalMl
            )
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    func dismissConfirmation() {
        needsEmailConfirmation = false
    }
}
