import SwiftUI

struct GroceryListView: View {
    @StateObject private var viewModel = GroceryViewModel()
    @State private var showAddItem = false

    private func categoryIcon(for category: GroceryItem.GroceryCategory) -> String {
        switch category {
        case .produce: return "leaf.fill"
        case .dairy: return "cup.and.saucer.fill"
        case .protein: return "fork.knife"
        case .grains: return "takeoutbag.and.cup.and.straw.fill"
        case .beverages: return "drop.fill"
        case .snacks: return "star.fill"
        case .other: return "basket.fill"
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: AppSpacing.md) {
                    ForEach(GroceryItem.GroceryCategory.allCases, id: \.self) { category in
                        let items = viewModel.itemsByCategory[category] ?? []
                        if !items.isEmpty {
                            VStack(alignment: .leading, spacing: AppSpacing.sm) {
                                // Category header
                                HStack(spacing: AppSpacing.sm) {
                                    Image(systemName: categoryIcon(for: category))
                                        .font(.body)
                                        .foregroundStyle(Color.theme.amber)
                                    Text(category.rawValue.capitalized)
                                        .font(.headline)
                                        .foregroundColor(Color.theme.primaryText)
                                }
                                .padding(.horizontal, AppSpacing.xs)

                                // Items
                                VStack(spacing: 0) {
                                    ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                                        HStack(spacing: AppSpacing.md) {
                                            Image(systemName: item.isPurchased
                                                  ? "checkmark.circle.fill"
                                                  : "circle")
                                                .font(.title3)
                                                .foregroundStyle(item.isPurchased
                                                                 ? Color.theme.mediumBlue
                                                                 : Color.theme.lightBlue)

                                            Text(item.name)
                                                .font(.subheadline)
                                                .strikethrough(item.isPurchased)
                                                .foregroundColor(item.isPurchased
                                                                 ? Color.theme.secondaryText
                                                                 : Color.theme.primaryText)

                                            Spacer()
                                        }
                                        .padding(.vertical, AppSpacing.sm)
                                        .contentShape(Rectangle())
                                        .onTapGesture {
                                            Task { await viewModel.togglePurchased(item) }
                                        }

                                        if index < items.count - 1 {
                                            Divider()
                                                .background(Color.theme.lightBlue.opacity(0.3))
                                        }
                                    }
                                }
                                .cardStyle()
                            }
                        }
                    }

                    // Clear Purchased button
                    if viewModel.itemsByCategory.values.flatMap({ $0 }).contains(where: { $0.isPurchased }) {
                        Button {
                            Task { await viewModel.clearPurchased() }
                        } label: {
                            Label("Clear Purchased Items", systemImage: "trash")
                        }
                        .buttonStyle(SecondaryButtonStyle())
                        .padding(.horizontal)
                        .padding(.top, AppSpacing.sm)
                    }
                }
                .padding(.horizontal)
                .padding(.vertical, AppSpacing.lg)
            }
            .screenBackground()
            .navigationTitle("Grocery List")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button { showAddItem = true } label: {
                        Image(systemName: "plus.circle.fill")
                            .foregroundStyle(Color.theme.orange)
                            .font(.title3)
                    }
                }
            }
            .sheet(isPresented: $showAddItem) {
                AddGroceryItemSheet(viewModel: viewModel)
            }
            .task { await viewModel.loadItems() }
        }
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
            ScrollView {
                VStack(spacing: AppSpacing.md) {
                    // Error display
                    if let error = viewModel.errorMessage {
                        HStack(spacing: AppSpacing.sm) {
                            Image(systemName: "exclamationmark.triangle.fill")
                            Text(error)
                        }
                        .font(.caption.bold())
                        .foregroundColor(Color.theme.darkNavy)
                        .padding(AppSpacing.sm)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.theme.amber.opacity(0.2))
                        .cornerRadius(AppRadius.small)
                    }

                    VStack(alignment: .leading, spacing: AppSpacing.xs) {
                        Text("Item Name")
                            .font(.caption.bold())
                            .foregroundColor(Color.theme.secondaryText)
                        TextField("e.g. Chicken Breast", text: $itemName)
                            .textFieldStyle(ThemedTextFieldStyle())
                    }

                    VStack(alignment: .leading, spacing: AppSpacing.xs) {
                        Text("Category")
                            .font(.caption.bold())
                            .foregroundColor(Color.theme.secondaryText)
                        Picker("Category", selection: $category) {
                            ForEach(GroceryItem.GroceryCategory.allCases, id: \.self) {
                                Text($0.rawValue.capitalized)
                            }
                        }
                        .pickerStyle(.wheel)
                        .frame(height: 120)
                    }

                    Spacer().frame(height: AppSpacing.md)

                    Button {
                        guard !itemName.isEmpty else { return }
                        isSaving = true
                        Task {
                            await viewModel.addItem(name: itemName, category: category)
                            isSaving = false
                            if viewModel.errorMessage == nil {
                                dismiss()
                            }
                        }
                    } label: {
                        if isSaving {
                            ProgressView()
                                .tint(.white)
                        } else {
                            Text("Add Item")
                        }
                    }
                    .buttonStyle(PrimaryButtonStyle())
                    .disabled(itemName.isEmpty || isSaving)
                    .opacity(itemName.isEmpty ? 0.5 : 1)
                }
                .padding(AppSpacing.lg)
            }
            .screenBackground()
            .navigationTitle("Add Item")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(Color.theme.mediumBlue)
                }
            }
        }
    }
}
