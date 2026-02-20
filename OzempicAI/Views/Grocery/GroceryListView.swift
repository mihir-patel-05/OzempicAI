import SwiftUI

struct GroceryListView: View {
    @StateObject private var viewModel = GroceryViewModel()
    @State private var showAddItem = false
    @State private var newItemName = ""
    @State private var newItemCategory = GroceryItem.GroceryCategory.other

    var body: some View {
        NavigationStack {
            List {
                ForEach(GroceryItem.GroceryCategory.allCases, id: \.self) { category in
                    let items = viewModel.itemsByCategory[category] ?? []
                    if !items.isEmpty {
                        Section(category.rawValue.capitalized) {
                            ForEach(items) { item in
                                HStack {
                                    Image(systemName: item.isPurchased ? "checkmark.circle.fill" : "circle")
                                        .foregroundStyle(item.isPurchased ? .green : .secondary)
                                    Text(item.name)
                                        .strikethrough(item.isPurchased)
                                        .foregroundStyle(item.isPurchased ? .secondary : .primary)
                                    Spacer()
                                }
                                .onTapGesture {
                                    Task { await viewModel.togglePurchased(item) }
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle("Grocery List")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button { showAddItem = true } label: { Image(systemName: "plus") }
                }
                ToolbarItem(placement: .secondaryAction) {
                    Button("Clear Purchased") {
                        Task { await viewModel.clearPurchased() }
                    }
                }
            }
            .alert("Add Item", isPresented: $showAddItem) {
                TextField("Item name", text: $newItemName)
                Button("Add") {
                    guard !newItemName.isEmpty else { return }
                    Task {
                        await viewModel.addItem(name: newItemName, category: newItemCategory)
                        newItemName = ""
                    }
                }
                Button("Cancel", role: .cancel) {}
            }
            .task { await viewModel.loadItems() }
        }
    }
}
