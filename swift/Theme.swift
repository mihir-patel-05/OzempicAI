//  Theme.swift
//  OzempicAI — warm redesign palette
//  Drop this into OzempicAI/Utilities/ (replaces existing Theme.swift)

import SwiftUI

// MARK: - Color Palette

extension Color {
    static let theme = ColorTheme()
}

struct ColorTheme {
    // Backgrounds
    let cream       = Color(hex: "F5EFE6")   // main app bg
    let creamDim    = Color(hex: "ECE5D8")   // subtle surfaces / segmented track
    let paper       = Color(hex: "FBF7F0")   // cards / elevated

    // Text
    let espresso    = Color(hex: "2A1E16")   // primary text
    let coffee      = Color(hex: "6B5A4E")   // secondary
    let dust        = Color(hex: "A89A8B")   // tertiary / muted

    // Brand warms
    let terracotta      = Color(hex: "C76F4A")   // primary accent
    let terracottaDeep  = Color(hex: "A8522F")
    let amber           = Color(hex: "E8A66B")
    let saffron         = Color(hex: "D89A4F")
    let ember           = Color(hex: "B8441F")

    // Supporting
    let sage        = Color(hex: "8AA07D")
    let sageDeep    = Color(hex: "5E7854")
    let plum        = Color(hex: "6B3E4A")

    // Semantic aliases
    var background: Color       { cream }
    var cardBackground: Color   { paper }
    var primaryText: Color      { espresso }
    var secondaryText: Color    { coffee }
    var tertiaryText: Color     { dust }
    var accent: Color           { terracotta }
    var ctaButton: Color        { terracotta }
    var calorieRing: Color      { terracotta }
    var waterFill: Color        { saffron }
    var exerciseRing: Color     { ember }
    var heartPulse: Color       { ember }
    var ringTrack: Color        { Color(red: 0.16, green: 0.12, blue: 0.09).opacity(0.07) }
    var divider: Color          { Color(red: 0.16, green: 0.12, blue: 0.09).opacity(0.08) }
    var shadow: Color           { Color(red: 0.31, green: 0.20, blue: 0.12).opacity(0.10) }
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
    static let xxs: CGFloat = 2
    static let xs: CGFloat  = 4
    static let sm: CGFloat  = 8
    static let md: CGFloat  = 16
    static let lg: CGFloat  = 24
    static let xl: CGFloat  = 32
}

// MARK: - Corner Radius

enum AppRadius {
    static let small: CGFloat  = 12
    static let medium: CGFloat = 18
    static let large: CGFloat  = 24
    static let hero: CGFloat   = 32
}

// MARK: - Typography
// Fraunces for display (download from Google Fonts, add to Info.plist UIAppFonts),
// or falls back to a rounded serif via the `.serif` design.

enum AppFont {
    static func display(_ size: CGFloat, weight: Font.Weight = .regular, italic: Bool = false) -> Font {
        // Prefer custom "Fraunces" if bundled; otherwise NY (Apple's serif).
        let base = Font.custom("Fraunces", size: size, relativeTo: .title)
        return italic ? base.italic().weight(weight) : base.weight(weight)
    }

    static func ui(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        Font.system(size: size, weight: weight, design: .default)
    }

    static func caps(_ size: CGFloat = 11) -> Font {
        .system(size: size, weight: .semibold, design: .default)
    }
}
