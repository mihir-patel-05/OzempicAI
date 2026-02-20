import Foundation

@MainActor
class GroceryViewModel: ObservableObject {
    @Published var items: [GroceryItem] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let client = SupabaseService.shared.client

    var itemsByCategory: [GroceryItem.GroceryCategory: [GroceryItem]] {
        Dictionary(grouping: items, by: \.category)
    }

    func loadItems() async {
        isLoading = true
        errorMessage = nil
        do {
            let userId = try await SupabaseService.shared.currentUserId

            items = try await client
                .from("grocery_items")
                .select()
                .eq("user_id", value: userId.uuidString)
                .order("created_at", ascending: false)
                .execute()
                .value
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    func addItem(name: String, category: GroceryItem.GroceryCategory, mealPlanId: UUID? = nil) async {
        do {
            let userId = try await SupabaseService.shared.currentUserId

            struct NewGroceryItem: Encodable {
                let user_id: UUID
                let name: String
                let category: String
                let meal_plan_id: UUID?
            }

            let entry = NewGroceryItem(
                user_id: userId,
                name: name,
                category: category.rawValue,
                meal_plan_id: mealPlanId
            )

            try await client.from("grocery_items").insert(entry).execute()
            await loadItems()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func togglePurchased(_ item: GroceryItem) async {
        do {
            struct PurchasedUpdate: Encodable {
                let is_purchased: Bool
            }

            try await client
                .from("grocery_items")
                .update(PurchasedUpdate(is_purchased: !item.isPurchased))
                .eq("id", value: item.id.uuidString)
                .execute()
            await loadItems()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func clearPurchased() async {
        do {
            let userId = try await SupabaseService.shared.currentUserId

            try await client
                .from("grocery_items")
                .delete()
                .eq("user_id", value: userId.uuidString)
                .eq("is_purchased", value: true)
                .execute()
            await loadItems()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
