import Foundation
import Supabase

class AuthService {
    private let client = SupabaseService.shared.client

    func signIn(email: String, password: String) async throws {
        try await client.auth.signIn(email: email, password: password)
    }

    func signUp(email: String, password: String) async throws {
        let response = try await client.auth.signUp(email: email, password: password)
        try await createUserProfile(id: response.user.id, email: email)
    }

    func signOut() async throws {
        try await client.auth.signOut()
    }

    func currentSession() async -> Session? {
        try? await client.auth.session
    }

    private func createUserProfile(id: UUID, email: String) async throws {
        struct NewUser: Encodable {
            let id: UUID
            let email: String
        }
        try await client.from("users").insert(NewUser(id: id, email: email)).execute()
    }
}
