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

    func fetchUserProfile() async throws -> User {
        let userId = try await client.auth.session.user.id
        let rows: [User] = try await client
            .from("users")
            .select()
            .eq("id", value: userId.uuidString)
            .limit(1)
            .execute()
            .value
        guard let user = rows.first else {
            throw NSError(domain: "AuthService", code: 404,
                          userInfo: [NSLocalizedDescriptionKey: "User profile not found"])
        }
        return user
    }

    func updateUserProfile(
        name: String,
        age: Int?,
        heightCm: Double?,
        weightKg: Double?,
        dailyCalorieGoal: Int,
        dailyWaterGoalMl: Int
    ) async throws -> User {
        let userId = try await client.auth.session.user.id

        struct ProfileUpdate: Encodable {
            let name: String
            let age: Int?
            let height_cm: Double?
            let weight_kg: Double?
            let daily_calorie_goal: Int
            let daily_water_goal_ml: Int
        }

        try await client
            .from("users")
            .update(ProfileUpdate(
                name: name,
                age: age,
                height_cm: heightCm,
                weight_kg: weightKg,
                daily_calorie_goal: dailyCalorieGoal,
                daily_water_goal_ml: dailyWaterGoalMl
            ))
            .eq("id", value: userId.uuidString)
            .execute()

        return try await fetchUserProfile()
    }
}

/// Minimal struct just for the existence check query
private struct UserRow: Decodable {
    let id: UUID
}
