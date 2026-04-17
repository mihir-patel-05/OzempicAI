import SwiftUI

// MARK: - Card
//
// iOS uses the warmer redesign card (paper surface, softer shadow, larger
// radius). macOS keeps the original card styling so the Mac target is
// visually unchanged.

#if os(iOS)

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

// MARK: - Auth Text Field Style (for dark backgrounds — used by Login/SignUp)

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

// MARK: - Section Header

struct CapsLabel: View {
    let text: String
    var color: Color = Color.theme.coffee
    var body: some View {
        Text(text.uppercased())
            .font(AppFont.caps())
            .tracking(1.0)
            .foregroundColor(color)
    }
}

#else

// MARK: - macOS (original styling, preserved unchanged)

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

struct ScreenBackgroundModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .background(Color.theme.background.ignoresSafeArea())
    }
}

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

#endif
