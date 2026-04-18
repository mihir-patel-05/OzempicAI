//  ViewModifiers.swift
//  Drop into OzempicAI/Utilities/

import SwiftUI

// MARK: - Card

struct CardModifier: ViewModifier {
    var padding: CGFloat = AppSpacing.lg
    func body(content: Content) -> some View {
        content
            .padding(padding)
            .background(Color.theme.paper)
            .cornerRadius(AppRadius.large)
            .shadow(color: Color.theme.shadow, radius: 10, x: 0, y: 2)
    }
}

extension View {
    func cardStyle(padding: CGFloat = AppSpacing.lg) -> some View {
        modifier(CardModifier(padding: padding))
    }

    func screenBackground() -> some View {
        self.frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color.theme.cream.ignoresSafeArea())
    }
}

// MARK: - Buttons

struct PrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(AppFont.ui(15, weight: .semibold))
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, AppSpacing.md)
            .background(Color.theme.terracotta)
            .cornerRadius(AppRadius.medium)
            .shadow(color: Color.theme.terracotta.opacity(0.35), radius: 12, x: 0, y: 4)
            .opacity(configuration.isPressed ? 0.85 : 1)
    }
}

struct SecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(AppFont.ui(15, weight: .semibold))
            .foregroundColor(Color.theme.terracotta)
            .frame(maxWidth: .infinity)
            .padding(.vertical, AppSpacing.md)
            .background(Color.theme.terracotta.opacity(0.12))
            .cornerRadius(AppRadius.medium)
            .opacity(configuration.isPressed ? 0.8 : 1)
    }
}

struct ThemedTextFieldStyle: TextFieldStyle {
    func _body(configuration: TextField<Self._Label>) -> some View {
        configuration
            .padding(.horizontal, AppSpacing.md)
            .padding(.vertical, AppSpacing.sm + 2)
            .background(Color.theme.creamDim.opacity(0.6))
            .cornerRadius(AppRadius.small)
            .overlay(
                RoundedRectangle(cornerRadius: AppRadius.small)
                    .stroke(Color.theme.divider, lineWidth: 1)
            )
    }
}

// MARK: - Section Header

struct CapsLabel: View {
    let text: String
    var color: Color = Color.theme.coffee
    var body: some View {
        Text(text.uppercased())
            .font(AppFont.caps())
            .foregroundColor(color)
            .tracking(1.0)
    }
}
