import SwiftUI

struct LoginView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @State private var email = ""
    @State private var password = ""
    @State private var showSignUp = false

    var body: some View {
        NavigationStack {
            ZStack {
                LinearGradient(
                    colors: [Color.theme.cream, Color.theme.paper],
                    startPoint: .top, endPoint: .bottom
                )
                .ignoresSafeArea()

                ScrollView {
                    VStack(spacing: AppSpacing.lg) {
                        Spacer(minLength: 60)

                        brandMark

                        fieldsCard

                        if let error = authViewModel.errorMessage {
                            errorBanner(error)
                        }

                        Button {
                            Task { await authViewModel.signIn(email: email, password: password) }
                        } label: {
                            if authViewModel.isLoading {
                                ProgressView().tint(.white)
                            } else {
                                Text("Sign in")
                            }
                        }
                        .buttonStyle(PrimaryButtonStyle())
                        .disabled(authViewModel.isLoading)

                        Button { showSignUp = true } label: {
                            HStack(spacing: 4) {
                                Text("New here?")
                                    .foregroundColor(Color.theme.coffee)
                                Text("Create an account")
                                    .foregroundColor(Color.theme.terracotta)
                                    .fontWeight(.semibold)
                            }
                            .font(AppFont.ui(13))
                        }

                        Spacer(minLength: 40)
                    }
                    .padding(.horizontal, AppSpacing.lg)
                }
            }
            .navigationDestination(isPresented: $showSignUp) {
                SignUpView()
            }
        }
    }

    private var brandMark: some View {
        VStack(spacing: 14) {
            ZStack {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [Color.theme.terracotta, Color.theme.ember],
                            startPoint: .topLeading, endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 84, height: 84)
                    .shadow(color: Color.theme.terracotta.opacity(0.35), radius: 16, x: 0, y: 6)
                Image(systemName: "heart.text.square.fill")
                    .font(.system(size: 36, weight: .semibold))
                    .foregroundColor(.white)
            }

            Text("OzempicAI")
                .font(AppFont.display(40, weight: .regular))
                .foregroundColor(Color.theme.espresso)
                .kerning(-1)

            Text("Your daily health companion")
                .font(AppFont.display(15, weight: .regular, italic: true))
                .foregroundColor(Color.theme.coffee)
        }
    }

    private var fieldsCard: some View {
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
                    .textContentType(.password)
                    .textFieldStyle(ThemedTextFieldStyle())
            }
        }
        .padding(AppSpacing.md)
        .background(Color.theme.paper)
        .cornerRadius(AppRadius.large)
        .shadow(color: Color.theme.shadow, radius: 10, x: 0, y: 4)
    }

    private func errorBanner(_ text: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundColor(Color.theme.ember)
            Text(text)
                .font(AppFont.ui(13, weight: .medium))
                .foregroundColor(Color.theme.espresso)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.theme.ember.opacity(0.12))
        .cornerRadius(AppRadius.small)
    }
}
