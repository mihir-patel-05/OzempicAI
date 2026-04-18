import SwiftUI

struct GroceryListView: View {
    @StateObject private var viewModel = GroceryViewModel()
    @State private var showAddItem = false

    private func categoryIcon(for category: GroceryItem.GroceryCategory) -> String {
        switch category {
        case .produce:   return "leaf.fill"
        case .dairy:     return "cup.and.saucer.fill"
        case .protein:   return "fork.knife"
        case .grains:    return "takeoutbag.and.cup.and.straw.fill"
        case .beverages: return "drop.fill"
        case .snacks:    return "star.fill"
        case .other:     return "basket.fill"
        }
    }

    private func categoryAccent(for category: GroceryItem.GroceryCategory) -> Color {
        switch category {
        case .produce:   return Color.theme.sage
        case .dairy:     return Color.theme.amber
        case .protein:   return Color.theme.terracotta
        case .grains:    return Color.theme.saffron
        case .beverages: return Color.theme.sageDeep
        case .snacks:    return Color.theme.plum
        case .other:     return Color.theme.coffee
        }
    }

    private var hasPurchased: Bool {
        viewModel.itemsByCategory.values.flatMap { $0 }.contains { $0.isPurchased }
    }

    private var totalCount: Int {
        viewModel.itemsByCategory.values.reduce(0) { $0 + $1.count }
    }

    var body: some View {
        ScrollView {
            VStack(spacing: AppSpacing.md) {
                ScreenHeader(title: "Grocery", subtitle: "\(totalCount) items") {
                    showAddItem = true
                }

                if totalCount == 0 {
                    emptyState
                } else {
                    ForEach(GroceryItem.GroceryCategory.allCases, id: \.self) { category in
                        let items = viewModel.itemsByCategory[category] ?? []
                        if !items.isEmpty {
                            categorySection(category: category, items: items)
                        }
                    }

                    if hasPurchased {
                        Button {
                            Task { await viewModel.clearPurchased() }
                        } label: {
                            HStack(spacing: 8) {
                                Image(systemName: "trash")
                                Text("Clear purchased")
                            }
                            .font(AppFont.ui(14, weight: .semibold))
                            .foregroundColor(Color.theme.terracotta)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(Color.theme.terracotta.opacity(0.12))
                            .cornerRadius(AppRadius.medium)
                        }
                        .buttonStyle(.plain)
                        .padding(.horizontal, AppSpacing.md + 4)
                    }
                }
                Spacer(minLength: 40)
            }
            .padding(.bottom, 100)
        }
        .screenBackground()
        .sheet(isPresented: $showAddItem) { AddGroceryItemSheet(viewModel: viewModel) }
        .task { await viewModel.loadItems() }
    }

    private var emptyState: some View {
        VStack(spacing: 10) {
            Image(systemName: "basket.fill")
                .font(.system(size: 44))
                .foregroundColor(Color.theme.dust)
            Text("Your list is empty")
                .font(AppFont.display(18, weight: .medium))
                .foregroundColor(Color.theme.espresso)
            Text("Tap + to add your first item.")
                .font(AppFont.ui(13))
                .foregroundColor(Color.theme.coffee)
        }
        .padding(.vertical, 40)
        .frame(maxWidth: .infinity)
        .background(Color.theme.paper)
        .cornerRadius(AppRadius.large)
        .shadow(color: Color.theme.shadow, radius: 8, x: 0, y: 2)
        .padding(.horizontal, AppSpacing.md + 4)
    }

    private func categorySection(category: GroceryItem.GroceryCategory, items: [GroceryItem]) -> some View {
        let accent = categoryAccent(for: category)
        return VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                ZStack {
                    Circle().fill(accent.opacity(0.15))
                    Image(systemName: categoryIcon(for: category))
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(accent)
                }
                .frame(width: 28, height: 28)
                Text(category.rawValue.capitalized)
                    .font(AppFont.display(18, weight: .medium))
                    .foregroundColor(Color.theme.espresso)
                Spacer()
                Text("\(items.count)")
                    .font(AppFont.ui(12, weight: .semibold))
                    .foregroundColor(Color.theme.coffee)
            }
            .padding(.horizontal, 4)

            VStack(spacing: 0) {
                ForEach(Array(items.enumerated()), id: \.element.id) { idx, item in
                    HStack(spacing: 12) {
                        Image(systemName: item.isPurchased ? "checkmark.circle.fill" : "circle")
                            .font(.system(size: 18))
                            .foregroundColor(item.isPurchased ? accent : Color.theme.dust.opacity(0.5))
                        Text(item.name)
                            .font(AppFont.ui(14, weight: item.isPurchased ? .regular : .medium))
                            .strikethrough(item.isPurchased)
                            .foregroundColor(item.isPurchased ? Color.theme.dust : Color.theme.espresso)
                        Spacer()
                    }
                    .padding(.horizontal, AppSpacing.md)
                    .padding(.vertical, 12)
                    .contentShape(Rectangle())
                    .onTapGesture {
                        Task { await viewModel.togglePurchased(item) }
                    }
                    if idx < items.count - 1 {
                        Divider().background(Color.theme.divider).padding(.leading, AppSpacing.md + 28)
                    }
                }
            }
            .background(Color.theme.paper)
            .cornerRadius(AppRadius.large)
            .shadow(color: Color.theme.shadow, radius: 6, x: 0, y: 2)
        }
        .padding(.horizontal, AppSpacing.md + 4)
    }
}

// MARK: - Add Item Sheet

struct AddGroceryItemSheet: View {
    @ObservedObject var viewModel: GroceryViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var itemName = ""
    @State private var category = GroceryItem.GroceryCategory.produce
    @State private var isSaving = false

    var body: some View {
        NavigationStack {
            VStack(spacing: AppSpacing.lg) {
                VStack(alignment: .leading, spacing: 8) {
                    CapsLabel(text: "Item name")
                    TextField("e.g. Chicken breast", text: $itemName)
                        .textFieldStyle(ThemedTextFieldStyle())
                }

                VStack(alignment: .leading, spacing: 8) {
                    CapsLabel(text: "Category")
                    Picker("Category", selection: $category) {
                        ForEach(GroceryItem.GroceryCategory.allCases, id: \.self) {
                            Text($0.rawValue.capitalized)
                        }
                    }
                    .pickerStyle(.wheel)
                    .frame(height: 140)
                }

                Button {
                    guard !itemName.isEmpty else { return }
                    isSaving = true
                    Task {
                        await viewModel.addItem(name: itemName, category: category)
                        isSaving = false
                        if viewModel.errorMessage == nil { dismiss() }
                    }
                } label: {
                    if isSaving {
                        ProgressView().tint(.white)
                    } else {
                        Text("Add item")
                    }
                }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(itemName.isEmpty || isSaving)

                Spacer()
            }
            .padding()
            .screenBackground()
            .navigationTitle("Add item")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }
}
