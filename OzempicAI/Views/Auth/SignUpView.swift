import SwiftUI

struct SignUpView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var email = ""
    @State private var password = ""
    @State private var confirmPassword = ""

    var passwordsMatch: Bool { password == confirmPassword }

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

                // Header
                VStack(spacing: 8) {
                    Image(systemName: "person.badge.plus")
                        .font(.system(size: 50))
                        .foregroundStyle(Color.theme.amber)

                    Text("Create Account")
                        .font(.system(size: 32, weight: .bold, design: .rounded))
                        .foregroundColor(.white)
                }

                // Fields card
                VStack(spacing: 12) {
                    TextField("Email", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .autocapitalization(.none)
                        .textFieldStyle(AuthTextFieldStyle())

                    SecureField("Password", text: $password)
                        .textContentType(.newPassword)
                        .textFieldStyle(AuthTextFieldStyle())

                    SecureField("Confirm Password", text: $confirmPassword)
                        .textContentType(.newPassword)
                        .textFieldStyle(AuthTextFieldStyle())

                    if !confirmPassword.isEmpty && !passwordsMatch {
                        HStack(spacing: 4) {
                            Image(systemName: "exclamationmark.triangle.fill")
                            Text("Passwords do not match")
                        }
                        .font(.caption.bold())
                        .foregroundColor(Color.theme.darkNavy)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(Color.theme.amber.opacity(0.9))
                        .cornerRadius(AppRadius.small)
                    }
                }
                .padding(AppSpacing.lg)
                .background(.ultraThinMaterial)
                .cornerRadius(AppRadius.large)

                // Error
                if let error = authViewModel.errorMessage {
                    Text(error)
                        .font(.caption.bold())
                        .foregroundColor(Color.theme.darkNavy)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                        .background(Color.theme.amber.opacity(0.9))
                        .cornerRadius(AppRadius.small)
                }

                // Sign Up button
                Button {
                    Task { await authViewModel.signUp(email: email, password: password) }
                } label: {
                    if authViewModel.isLoading {
                        ProgressView()
                            .tint(.white)
                    } else {
                        Text("Sign Up")
                    }
                }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(authViewModel.isLoading || !passwordsMatch || email.isEmpty)

                Spacer()
            }
            .padding()
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbarColorScheme(.dark, for: .navigationBar)
    }
}
