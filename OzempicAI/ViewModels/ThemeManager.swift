import SwiftUI

@MainActor
final class ThemeManager: ObservableObject {

    @Published var colorScheme: ColorScheme?

    private let key = "app_color_scheme"

    init() {
        switch UserDefaults.standard.string(forKey: key) {
        case "light":  colorScheme = .light
        case "dark":   colorScheme = .dark
        default:       colorScheme = nil   // system
        }
    }

    func set(_ scheme: ColorScheme?) {
        colorScheme = scheme
        let value: String
        switch scheme {
        case .light:  value = "light"
        case .dark:   value = "dark"
        default:      value = "system"
        }
        UserDefaults.standard.set(value, forKey: key)
    }
}
