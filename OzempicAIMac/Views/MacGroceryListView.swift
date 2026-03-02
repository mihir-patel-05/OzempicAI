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
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("Grocery List")
                    .font(.title2)
                    .fontWeight(.bold)

                Spacer()

                // Quick add bar
                HStack(spacing: 8) {
                    TextField("Add item...", text: $newItemName)
                        .textFieldStyle(.roundedBorder)
                        .frame(width: 200)
                        .onSubmit { addItem() }

                    Picker("", selection: $newItemCategory) {
                        ForEach(GroceryItem.GroceryCategory.allCases, id: \.self) { cat in
                            Text(cat.rawValue.capitalized).tag(cat)
                        }
                    }
                    .frame(width: 120)

                    Button {
                        addItem()
                    } label: {
                        Label("Add Item", systemImage: "plus")
                    }
                    .disabled(newItemName.isEmpty)
                    .keyboardShortcut("n", modifiers: .command)
                }

                Button("Clear Purchased") {
                    Task { await viewModel.clearPurchased() }
                }
                .keyboardShortcut(.delete, modifiers: .command)
            }
            .padding()

            Divider()

            // 3-column layout
            HStack(alignment: .top, spacing: 16) {
                ForEach(columns, id: \.first) { columnCategories in
                    VStack(alignment: .leading, spacing: 16) {
                        ForEach(columnCategories, id: \.self) { category in
                            categorySection(category)
                        }
                        Spacer()
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .padding()
        }
        .screenBackground()
        .task {
            await viewModel.loadItems()
        }
    }

    @ViewBuilder
    private func categorySection(_ category: GroceryItem.GroceryCategory) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: categoryIcon(category))
                    .foregroundColor(Color.theme.mediumBlue)
                Text(category.rawValue.uppercased())
                    .font(.caption)
                    .fontWeight(.bold)
                    .foregroundColor(.secondary)
            }
            .padding(.bottom, 4)

            let items = sortedItems(for: category)
            if items.isEmpty {
                Text("No items")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .italic()
            } else {
                ForEach(items) { item in
                    HStack(spacing: 8) {
                        Button {
                            Task { await viewModel.togglePurchased(item) }
                        } label: {
                            Image(systemName: item.isPurchased ? "checkmark.circle.fill" : "circle")
                                .foregroundColor(item.isPurchased ? .green : .secondary)
                        }
                        .buttonStyle(.plain)

                        Text(item.name)
                            .font(.body)
                            .strikethrough(item.isPurchased)
                            .foregroundColor(item.isPurchased ? .secondary : .primary)

                        if item.mealPlanId != nil {
                            Image(systemName: "fork.knife.circle.fill")
                                .font(.caption2)
                                .foregroundColor(Color.theme.mediumBlue.opacity(0.5))
                        }

                        Spacer()
                    }
                    .padding(.vertical, 2)
                }
            }
        }
        .padding()
        .background(Color.theme.cardBackground)
        .cornerRadius(AppRadius.medium)
        .shadow(color: Color.theme.darkNavy.opacity(0.06), radius: 4, x: 0, y: 2)
    }

    private func addItem() {
        guard !newItemName.isEmpty else { return }
        let name = newItemName
        let category = newItemCategory
        newItemName = ""
        Task { await viewModel.addItem(name: name, category: category) }
    }
}
