import SwiftUI

struct MacLoginView: View {
    @EnvironmentObject var authViewModel: AuthViewModel

    @State private var email = ""
    @State private var password = ""
    @State private var isSignUp = false

    var body: some View {
        ZStack {
            Color.theme.darkNavy.ignoresSafeArea()

            VStack(spacing: 32) {
                // Header
                VStack(spacing: 12) {
                    Image(systemName: "heart.text.square.fill")
                        .font(.system(size: 56))
                        .foregroundStyle(Color.theme.amber)
                    Text("OzempicAI")
                        .font(.system(size: 32, weight: .bold, design: .rounded))
                        .foregroundColor(.white)
                    Text(isSignUp ? "Create your account" : "Welcome back")
                        .font(.subheadline)
                        .foregroundColor(.white.opacity(0.7))
                }

                // Form
                VStack(spacing: 16) {
                    TextField("Email", text: $email)
                        .textFieldStyle(.roundedBorder)
                        .frame(width: 300)

                    SecureField("Password", text: $password)
                        .textFieldStyle(.roundedBorder)
                        .frame(width: 300)

                    if let error = authViewModel.errorMessage {
                        Text(error)
                            .font(.caption)
                            .foregroundColor(Color.theme.orange)
                            .frame(width: 300, alignment: .leading)
                    }

                    Button {
                        Task {
                            if isSignUp {
                                await authViewModel.signUp(email: email, password: password)
                            } else {
                                await authViewModel.signIn(email: email, password: password)
                            }
                        }
                    } label: {
                        Text(isSignUp ? "Sign Up" : "Sign In")
                            .font(.headline)
                            .foregroundColor(.white)
                            .frame(width: 300, height: 44)
                            .background(Color.theme.ctaButton)
                            .cornerRadius(AppRadius.medium)
                    }
                    .buttonStyle(.plain)
                    .disabled(email.isEmpty || password.isEmpty)

                    Button {
                        isSignUp.toggle()
                        authViewModel.errorMessage = nil
                    } label: {
                        Text(isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up")
                            .font(.subheadline)
                            .foregroundColor(Color.theme.lightBlue)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(48)
        }
        .frame(minWidth: 500, minHeight: 400)
    }
}
