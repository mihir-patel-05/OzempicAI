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
                colors: [Color.theme.cream, Color.theme.paper],
                startPoint: .top, endPoint: .bottom
            )
            .ignoresSafeArea()

            ScrollView {
                VStack(spacing: AppSpacing.lg) {
                    Spacer(minLength: 40)

                    VStack(spacing: 12) {
                        ZStack {
                            Circle()
                                .fill(
                                    LinearGradient(
                                        colors: [Color.theme.saffron, Color.theme.terracotta],
                                        startPoint: .topLeading, endPoint: .bottomTrailing
                                    )
                                )
                                .frame(width: 72, height: 72)
                                .shadow(color: Color.theme.terracotta.opacity(0.3), radius: 14, x: 0, y: 5)
                            Image(systemName: "person.badge.plus")
                                .font(.system(size: 30, weight: .semibold))
                                .foregroundColor(.white)
                        }

                        Text("Create account")
                            .font(AppFont.display(32, weight: .regular))
                            .foregroundColor(Color.theme.espresso)
                            .kerning(-0.8)

                        Text("Start tracking in seconds")
                            .font(AppFont.display(14, weight: .regular, italic: true))
                            .foregroundColor(Color.theme.coffee)
                    }

                    VStack(spacing: 14) {
                        VStack(alignment: .leading, spacing: 6) {
                            CapsLabel(text: "Email")
                            TextField("you@example.com", text: $email)
                                .textContentType(.emailAddress)
                                .keyboardType(.emailAddress)
                                .autocapitalization(.none)
                                .textFieldStyle(ThemedTextFieldStyle())
                        }

                        VStack(alignment: .leading, spacing: 6) {
                            CapsLabel(text: "Password")
                            SecureField("••••••••", text: $password)
                                .textContentType(.newPassword)
                                .textFieldStyle(ThemedTextFieldStyle())
                        }

                        VStack(alignment: .leading, spacing: 6) {
                            CapsLabel(text: "Confirm password")
                            SecureField("••••••••", text: $confirmPassword)
                                .textContentType(.newPassword)
                                .textFieldStyle(ThemedTextFieldStyle())
                        }

                        if !confirmPassword.isEmpty && !passwordsMatch {
                            HStack(spacing: 8) {
                                Image(systemName: "exclamationmark.triangle.fill")
                                    .foregroundColor(Color.theme.ember)
                                Text("Passwords do not match")
                                    .font(AppFont.ui(12, weight: .medium))
                                    .foregroundColor(Color.theme.espresso)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(10)
                            .background(Color.theme.ember.opacity(0.12))
                            .cornerRadius(AppRadius.small)
                        }
                    }
                    .padding(AppSpacing.md)
                    .background(Color.theme.paper)
                    .cornerRadius(AppRadius.large)
                    .shadow(color: Color.theme.shadow, radius: 10, x: 0, y: 4)

                    if let error = authViewModel.errorMessage {
                        HStack(spacing: 10) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .foregroundColor(Color.theme.ember)
                            Text(error)
                                .font(AppFont.ui(13, weight: .medium))
                                .foregroundColor(Color.theme.espresso)
                        }
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.theme.ember.opacity(0.12))
                        .cornerRadius(AppRadius.small)
                    }

                    Button {
                        Task { await authViewModel.signUp(email: email, password: password) }
                    } label: {
                        if authViewModel.isLoading {
                            ProgressView().tint(.white)
                        } else {
                            Text("Create account")
                        }
                    }
                    .buttonStyle(PrimaryButtonStyle())
                    .disabled(authViewModel.isLoading || !passwordsMatch || email.isEmpty)

                    Spacer(minLength: 40)
                }
                .padding(.horizontal, AppSpacing.lg)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
    }
}
