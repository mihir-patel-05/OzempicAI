import SwiftUI

// MARK: - Color Palette

extension Color {
    static let theme = ColorTheme()
}

struct ColorTheme {
    let lightBlue   = Color(hex: "8ECAE6")
    let mediumBlue  = Color(hex: "219EBC")
    let darkNavy    = Color(hex: "023047")
    let amber       = Color(hex: "FFB703")
    let orange      = Color(hex: "FB8500")

    // Semantic aliases
    var background: Color      { lightBlue.opacity(0.15) }
    var cardBackground: Color  { Color(.systemBackground) }
    var primaryText: Color     { Color(.label) }
    var secondaryText: Color   { Color(.secondaryLabel) }
    var accent: Color          { mediumBlue }
    var ctaButton: Color       { orange }
    var calorieRing: Color     { amber }
    var waterFill: Color       { mediumBlue }
    var exerciseRing: Color    { orange }
    var heartPulse: Color      { orange }
}

// MARK: - Hex Initializer

extension Color {
    init(hex: String) {
        let scanner = Scanner(string: hex)
        var rgb: UInt64 = 0
        scanner.scanHexInt64(&rgb)
        self.init(
            red: Double((rgb >> 16) & 0xFF) / 255,
            green: Double((rgb >> 8) & 0xFF) / 255,
            blue: Double(rgb & 0xFF) / 255
        )
    }
}

// MARK: - Spacing

enum AppSpacing {
    static let xs: CGFloat = 4
    static let sm: CGFloat = 8
    static let md: CGFloat = 16
    static let lg: CGFloat = 24
    static let xl: CGFloat = 32
}

// MARK: - Corner Radius

enum AppRadius {
    static let small: CGFloat = 8
    static let medium: CGFloat = 12
    static let large: CGFloat = 20
}
