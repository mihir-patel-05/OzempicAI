import Foundation
import Supabase

@MainActor
class SupabaseService {
    static let shared = SupabaseService()

    let client: SupabaseClient

    private init() {
        client = SupabaseClient(
            supabaseURL: URL(string: Constants.Supabase.projectURL)!,
            supabaseKey: Constants.Supabase.anonKey
        )
    }

    var currentUserId: UUID {
        get async throws {
            try await client.auth.session.user.id
        }
    }
}
