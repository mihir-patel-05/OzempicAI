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
                    colors: [Color.theme.darkNavy, Color.theme.mediumBlue],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .ignoresSafeArea()

                VStack(spacing: AppSpacing.lg) {
                    Spacer()

                    // Branding
                    VStack(spacing: 12) {
                        Image(systemName: "heart.text.square.fill")
                            .font(.system(size: 60))
                            .foregroundStyle(Color.theme.amber)

                        Text("OzempicAI")
                            .font(.system(size: 38, weight: .bold, design: .rounded))
                            .foregroundColor(.white)

                        Text("Your Health Companion")
                            .font(.subheadline)
                            .foregroundColor(Color.theme.lightBlue)
                    }

                    // Fields card
                    VStack(spacing: 12) {
                        TextField("Email", text: $email)
                            .textContentType(.emailAddress)
                            .keyboardType(.emailAddress)
                            .autocapitalization(.none)
                            .textFieldStyle(AuthTextFieldStyle())

                        SecureField("Password", text: $password)
                            .textContentType(.password)
                            .textFieldStyle(AuthTextFieldStyle())
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

                    // Sign In button
                    Button {
                        Task { await authViewModel.signIn(email: email, password: password) }
                    } label: {
                        if authViewModel.isLoading {
                            ProgressView()
                                .tint(.white)
                        } else {
                            Text("Sign In")
                        }
                    }
                    .buttonStyle(PrimaryButtonStyle())
                    .disabled(authViewModel.isLoading)

                    // Sign Up link
                    Button {
                        showSignUp = true
                    } label: {
                        HStack(spacing: 4) {
                            Text("Don't have an account?")
                                .foregroundColor(Color.theme.lightBlue)
                            Text("Sign Up")
                                .foregroundColor(Color.theme.amber)
                                .bold()
                        }
                        .font(.footnote)
                    }

                    Spacer()
                }
                .padding()
            }
            .navigationDestination(isPresented: $showSignUp) {
                SignUpView()
            }
        }
    }
}
