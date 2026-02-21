import SwiftUI

// MARK: - Card Modifier

struct CardModifier: ViewModifier {
    var padding: CGFloat = AppSpacing.md

    func body(content: Content) -> some View {
        content
            .padding(padding)
            .background(Color.theme.cardBackground)
            .cornerRadius(AppRadius.medium)
            .shadow(color: Color.theme.darkNavy.opacity(0.08), radius: 8, x: 0, y: 4)
    }
}

extension View {
    func cardStyle(padding: CGFloat = AppSpacing.md) -> some View {
        modifier(CardModifier(padding: padding))
    }

    func screenBackground() -> some View {
        modifier(ScreenBackgroundModifier())
    }
}

// MARK: - Screen Background

struct ScreenBackgroundModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .background(Color.theme.background.ignoresSafeArea())
    }
}

// MARK: - Primary Button Style

struct PrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(Color.theme.ctaButton)
            .cornerRadius(AppRadius.medium)
            .scaleEffect(configuration.isPressed ? 0.97 : 1.0)
            .opacity(configuration.isPressed ? 0.9 : 1.0)
    }
}

// MARK: - Secondary Button Style

struct SecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .foregroundColor(Color.theme.mediumBlue)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(Color.theme.mediumBlue.opacity(0.12))
            .cornerRadius(AppRadius.medium)
            .scaleEffect(configuration.isPressed ? 0.97 : 1.0)
    }
}

// MARK: - Themed Text Field Style

struct ThemedTextFieldStyle: TextFieldStyle {
    func _body(configuration: TextField<Self._Label>) -> some View {
        configuration
            .padding(12)
            .background(Color.theme.lightBlue.opacity(0.2))
            .cornerRadius(AppRadius.small)
            .overlay(
                RoundedRectangle(cornerRadius: AppRadius.small)
                    .stroke(Color.theme.mediumBlue.opacity(0.3), lineWidth: 1)
            )
    }
}

// MARK: - Auth Text Field Style (for dark backgrounds)

struct AuthTextFieldStyle: TextFieldStyle {
    func _body(configuration: TextField<Self._Label>) -> some View {
        configuration
            .padding(12)
            .background(Color.white.opacity(0.15))
            .cornerRadius(AppRadius.small)
            .overlay(
                RoundedRectangle(cornerRadius: AppRadius.small)
                    .stroke(Color.white.opacity(0.25), lineWidth: 1)
            )
            .foregroundColor(.white)
    }
}
