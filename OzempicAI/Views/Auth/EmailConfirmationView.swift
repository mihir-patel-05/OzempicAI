import SwiftUI

struct EmailConfirmationView: View {
    @EnvironmentObject var authViewModel: AuthViewModel

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color.theme.cream, Color.theme.paper],
                startPoint: .top, endPoint: .bottom
            )
            .ignoresSafeArea()

            VStack(spacing: AppSpacing.lg) {
                Spacer()

                ZStack {
                    Circle()
                        .fill(
                            LinearGradient(
                                colors: [Color.theme.amber, Color.theme.terracotta],
                                startPoint: .topLeading, endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: 92, height: 92)
                        .shadow(color: Color.theme.terracotta.opacity(0.3), radius: 16, x: 0, y: 6)
                    Image(systemName: "envelope.badge.fill")
                        .font(.system(size: 38, weight: .semibold))
                        .foregroundColor(.white)
                }

                VStack(spacing: 10) {
                    Text("Check your email")
                        .font(AppFont.display(30, weight: .regular))
                        .foregroundColor(Color.theme.espresso)
                        .kerning(-0.8)

                    Text("We sent a confirmation link to your inbox. Tap the link, then come back and sign in.")
                        .font(AppFont.ui(14))
                        .foregroundColor(Color.theme.coffee)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, AppSpacing.lg)
                }

                Spacer()

                Button {
                    authViewModel.dismissConfirmation()
                } label: {
                    Text("Back to sign in")
                }
                .buttonStyle(PrimaryButtonStyle())

                Spacer(minLength: 40)
            }
            .padding(.horizontal, AppSpacing.lg)
        }
    }
}
