import Foundation

@MainActor
class GroceryViewModel: ObservableObject {
    @Published var items: [GroceryItem] = []
    @Published var isLoading = false

    var itemsByCategory: [GroceryItem.GroceryCategory: [GroceryItem]] {
        Dictionary(grouping: items, by: \.category)
    }

    func loadItems() async {
        // TODO: fetch from Supabase
    }

    func addItem(name: String, category: GroceryItem.GroceryCategory, mealPlanId: UUID? = nil) async {
        // TODO: insert into Supabase
    }

    func togglePurchased(_ item: GroceryItem) async {
        // TODO: update in Supabase
    }

    func clearPurchased() async {
        // TODO: delete purchased items from Supabase
    }
}
