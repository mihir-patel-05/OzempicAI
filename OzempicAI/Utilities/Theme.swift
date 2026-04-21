import SwiftUI

// MARK: - Color Palette
//
// iOS uses the warm terracotta/cream/espresso redesign palette.
// macOS keeps the original blue palette so the Mac target is visually unchanged.
// Legacy iOS token names (lightBlue, mediumBlue, darkNavy, amber, orange) remain
// as aliases on iOS so existing call sites keep compiling until they are migrated
// to the semantic palette.

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
    let amber           = Color(hex: "E8A66B")   // warm amber (redesign value)
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

    // Backwards-compat aliases for the original blue palette token names.
    // These map to the closest warm equivalents so pre-redesign screens render
    // in the new palette without code changes. Migrate call sites to the
    // semantic names (accent, cardBackground, etc.) and then delete these.
    var lightBlue: Color    { creamDim }
    var mediumBlue: Color   { terracotta }
    var darkNavy: Color     { espresso }
    var orange: Color       { ember }
    // `amber` is already a stored property on iOS (warm amber), so legacy
    // call sites referring to Color.theme.amber resolve to the warm value —
    // no alias needed.
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
//
// Values are tuned for the iOS redesign. macOS views that referenced the
// pre-redesign radii (8 / 12 / 20) will render slightly rounder, which is a
// harmless visual tweak.

enum AppRadius {
    static let small: CGFloat  = 12
    static let medium: CGFloat = 18
    static let large: CGFloat  = 24
    static let hero: CGFloat   = 32
}

// MARK: - Typography
// Fraunces for display (download from Google Fonts, add to Info.plist UIAppFonts),
// falls back to NY (Apple's system serif) when the font is not bundled.

enum AppFont {
    static func display(_ size: CGFloat, weight: Font.Weight = .regular, italic: Bool = false) -> Font {
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

extension Font {
    static func fraunces(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        Font.custom("Fraunces", size: size, relativeTo: .title).weight(weight)
    }

    static func inter(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        Font.custom("Inter", size: size, relativeTo: .body).weight(weight)
    }
}
