import Foundation
import Supabase

class AuthService {
    private let client = SupabaseService.shared.client

    func signIn(email: String, password: String) async throws {
        try await client.auth.signIn(email: email, password: password)
    }

    func signUp(email: String, password: String) async throws {
        // Only create the auth user — profile is created on first sign-in
        // after the user confirms their email
        _ = try await client.auth.signUp(email: email, password: password)
    }

    func signOut() async throws {
        try await client.auth.signOut()
    }

    func currentSession() async -> Session? {
        try? await client.auth.session
    }

    /// Creates a user profile row if one doesn't already exist.
    /// Called on first successful sign-in after email confirmation.
    func ensureUserProfile() async throws {
        let session = try await client.auth.session
        let userId = session.user.id
        let email = session.user.email ?? ""

        // Check if profile already exists
        let existing: [UserRow] = try await client
            .from("users")
            .select("id")
            .eq("id", value: userId.uuidString)
            .execute()
            .value

        if existing.isEmpty {
            struct NewUser: Encodable {
                let id: UUID
                let email: String
            }
            try await client.from("users").insert(NewUser(id: userId, email: email)).execute()
        }
    }
}

/// Minimal struct just for the existence check query
private struct UserRow: Decodable {
    let id: UUID
}
