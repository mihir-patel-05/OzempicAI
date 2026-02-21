import SwiftUI

struct EmailConfirmationView: View {
    @EnvironmentObject var authViewModel: AuthViewModel

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color.theme.darkNavy, Color.theme.mediumBlue],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            VStack(spacing: AppSpacing.lg) {
                Spacer()

                Image(systemName: "envelope.badge.fill")
                    .font(.system(size: 60))
                    .foregroundStyle(Color.theme.amber)

                Text("Check Your Email")
                    .font(.system(size: 28, weight: .bold, design: .rounded))
                    .foregroundColor(.white)

                Text("We sent a confirmation link to your email address. Tap the link to verify your account, then come back and sign in.")
                    .font(.subheadline)
                    .foregroundColor(Color.theme.lightBlue)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, AppSpacing.lg)

                Spacer()

                Button {
                    authViewModel.dismissConfirmation()
                } label: {
                    Text("Back to Sign In")
                }
                .buttonStyle(PrimaryButtonStyle())
                .padding(.horizontal)

                Spacer()
            }
            .padding()
        }
    }
}
