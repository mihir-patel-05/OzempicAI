import SwiftUI

struct MacGroceryListView: View {
    @StateObject private var viewModel = GroceryViewModel()
    @State private var newItemName = ""
    @State private var newItemCategory: GroceryItem.GroceryCategory = .produce
    @State private var selectedItem: GroceryItem?

    private let columns: [[GroceryItem.GroceryCategory]] = [
        [.produce, .grains],
        [.protein, .beverages],
        [.dairy, .snacks]
    ]

    private func categoryIcon(_ category: GroceryItem.GroceryCategory) -> String {
        switch category {
        case .produce:   return "leaf.fill"
        case .dairy:     return "cup.and.saucer.fill"
        case .protein:   return "fork.knife"
        case .grains:    return "birthday.cake.fill"
        case .beverages: return "waterbottle.fill"
        case .snacks:    return "popcorn.fill"
        case .other:     return "bag.fill"
        }
    }

    private func sortedItems(for category: GroceryItem.GroceryCategory) -> [GroceryItem] {
        let items = viewModel.itemsByCategory[category] ?? []
        return items.sorted { !$0.isPurchased && $1.isPurchased }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                MacPageHeader(title: "Grocery", subtitle: "Shopping list", actionTitle: nil)

                MacCard {
                    HStack(spacing: 8) {
                        TextField("Add item…", text: $newItemName)
                            .textFieldStyle(.roundedBorder)
                            .onSubmit { addItem() }
                        Picker("", selection: $newItemCategory) {
                            ForEach(GroceryItem.GroceryCategory.allCases, id: \.self) { cat in
                                Text(cat.rawValue.capitalized).tag(cat)
                            }
                        }
                        .frame(width: 140)
                        Button { addItem() } label: {
                            Label("Add", systemImage: "plus")
                                .font(.inter(13, weight: .semibold))
                        }
                        .disabled(newItemName.isEmpty)
                        .keyboardShortcut("n", modifiers: .command)
                        Button("Clear purchased") {
                            Task { await viewModel.clearPurchased() }
                        }
                        .keyboardShortcut(.delete, modifiers: .command)
                    }
                }

                HStack(alignment: .top, spacing: 16) {
                    ForEach(columns, id: \.first) { columnCategories in
                        VStack(alignment: .leading, spacing: 16) {
                            ForEach(columnCategories, id: \.self) { category in
                                categorySection(category)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .top)
                    }
                }
            }
            .padding(32)
        }
        .background(Color.theme.cream)
        .task { await viewModel.loadItems() }
    }

    @ViewBuilder
    private func categorySection(_ category: GroceryItem.GroceryCategory) -> some View {
        MacCard {
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 8) {
                    Image(systemName: categoryIcon(category))
                        .foregroundColor(Color.theme.terracotta)
                    Text(category.rawValue.uppercased())
                        .font(.inter(11, weight: .bold))
                        .tracking(1.0)
                        .foregroundColor(Color.theme.coffee)
                }

                let items = sortedItems(for: category)
                if items.isEmpty {
                    Text("No items")
                        .font(.inter(12))
                        .foregroundColor(Color.theme.dust)
                        .italic()
                } else {
                    ForEach(items) { item in
                        HStack(spacing: 8) {
                            Button {
                                Task { await viewModel.togglePurchased(item) }
                            } label: {
                                Image(systemName: item.isPurchased ? "checkmark.circle.fill" : "circle")
                                    .foregroundColor(item.isPurchased ? Color.theme.sage : Color.theme.dust)
                            }
                            .buttonStyle(.plain)

                            Text(item.name)
                                .font(.inter(13))
                                .strikethrough(item.isPurchased)
                                .foregroundColor(item.isPurchased ? Color.theme.dust : Color.theme.espresso)

                            if item.mealPlanId != nil {
                                Image(systemName: "fork.knife.circle.fill")
                                    .font(.system(size: 11))
                                    .foregroundColor(Color.theme.terracotta.opacity(0.5))
                            }
                            Spacer()
                        }
                    }
                }
            }
        }
    }

    private func addItem() {
        guard !newItemName.isEmpty else { return }
        let name = newItemName
        let category = newItemCategory
        newItemName = ""
        Task { await viewModel.addItem(name: name, category: category) }
    }
}
