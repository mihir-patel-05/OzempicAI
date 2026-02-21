import Foundation

@MainActor
class AuthViewModel: ObservableObject {
    @Published var isAuthenticated = false
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var needsEmailConfirmation = false

    private let authService = AuthService()

    func signIn(email: String, password: String) async {
        isLoading = true
        errorMessage = nil
        do {
            try await authService.signIn(email: email, password: password)
            // Ensure user profile exists — don't block login if this fails
            try? await authService.ensureUserProfile()
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
                isAuthenticated = true
            }
        }
        isLoading = false
    }

    func signOut() async {
        try? await authService.signOut()
        isAuthenticated = false
        needsEmailConfirmation = false
    }

    func dismissConfirmation() {
        needsEmailConfirmation = false
    }
}
