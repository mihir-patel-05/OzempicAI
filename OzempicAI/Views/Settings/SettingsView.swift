import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var themeManager: ThemeManager
    @EnvironmentObject var authViewModel: AuthViewModel

    private var themeSelection: Binding<Int> {
        Binding(
            get: {
                switch themeManager.colorScheme {
                case .light:  return 1
                case .dark:   return 2
                default:      return 0
                }
            },
            set: { index in
                switch index {
                case 1:  themeManager.set(.light)
                case 2:  themeManager.set(.dark)
                default: themeManager.set(nil)
                }
            }
        )
    }

    var body: some View {
        ScrollView {
            VStack(spacing: AppSpacing.md) {
                ScreenHeader(title: "Settings", subtitle: "Preferences")

                appearanceCard
                accountCard
                aboutCard
                Spacer(minLength: 40)
            }
            .padding(.bottom, 100)
        }
        .screenBackground()
    }

    // MARK: - Appearance

    private var appearanceCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                ZStack {
                    Circle().fill(Color.theme.amber.opacity(0.15))
                    Image(systemName: "paintpalette.fill")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(Color.theme.amber)
                }
                .frame(width: 32, height: 32)
                Text("Appearance")
                    .font(AppFont.display(18, weight: .medium))
                    .foregroundColor(Color.theme.espresso)
            }

            Picker("App theme", selection: themeSelection) {
                Text("System").tag(0)
                Text("Light").tag(1)
                Text("Dark").tag(2)
            }
            .pickerStyle(.segmented)
        }
        .padding(AppSpacing.md)
        .background(Color.theme.paper)
        .cornerRadius(AppRadius.large)
        .shadow(color: Color.theme.shadow, radius: 6, x: 0, y: 2)
        .padding(.horizontal, AppSpacing.md + 4)
    }

    // MARK: - Account

    private var accountCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                ZStack {
                    Circle().fill(Color.theme.terracotta.opacity(0.15))
                    Image(systemName: "person.crop.circle.fill")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(Color.theme.terracotta)
                }
                .frame(width: 32, height: 32)
                Text("Account")
                    .font(AppFont.display(18, weight: .medium))
                    .foregroundColor(Color.theme.espresso)
            }

            Button {
                Task { await authViewModel.signOut() }
            } label: {
                HStack(spacing: 10) {
                    Image(systemName: "rectangle.portrait.and.arrow.right")
                        .font(.system(size: 14, weight: .semibold))
                    Text("Sign out")
                        .font(AppFont.ui(14, weight: .semibold))
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(Color.theme.dust)
                }
                .foregroundColor(Color.theme.ember)
                .padding(AppSpacing.md)
                .background(Color.theme.ember.opacity(0.10))
                .cornerRadius(AppRadius.medium)
            }
            .buttonStyle(.plain)
        }
        .padding(AppSpacing.md)
        .background(Color.theme.paper)
        .cornerRadius(AppRadius.large)
        .shadow(color: Color.theme.shadow, radius: 6, x: 0, y: 2)
        .padding(.horizontal, AppSpacing.md + 4)
    }

    // MARK: - About

    private var aboutCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                ZStack {
                    Circle().fill(Color.theme.sage.opacity(0.15))
                    Image(systemName: "heart.text.square.fill")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(Color.theme.sageDeep)
                }
                .frame(width: 32, height: 32)
                Text("About")
                    .font(AppFont.display(18, weight: .medium))
                    .foregroundColor(Color.theme.espresso)
            }

            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text("OzempicAI")
                        .font(AppFont.ui(14, weight: .semibold))
                        .foregroundColor(Color.theme.espresso)
                    Spacer()
                    Text("Phase 1")
                        .font(AppFont.ui(11, weight: .semibold))
                        .foregroundColor(Color.theme.coffee)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Color.theme.creamDim)
                        .clipShape(Capsule())
                }
                Text("Personal health & fitness tracker")
                    .font(AppFont.display(12, weight: .regular, italic: true))
                    .foregroundColor(Color.theme.coffee)
            }
        }
        .padding(AppSpacing.md)
        .background(Color.theme.paper)
        .cornerRadius(AppRadius.large)
        .shadow(color: Color.theme.shadow, radius: 6, x: 0, y: 2)
        .padding(.horizontal, AppSpacing.md + 4)
    }
}
