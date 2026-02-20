import Foundation
import Supabase

class AuthService {
    private let client = SupabaseService.shared.client

    func signIn(email: String, password: String) async throws {
        try await client.auth.signIn(email: email, password: password)
    }

    func signUp(email: String, password: String) async throws {
        try await client.auth.signUp(email: email, password: password)
    }

    func signOut() async throws {
        try await client.auth.signOut()
    }

    func currentSession() async -> Session? {
        try? await client.auth.session
    }
}
