import SwiftUI

struct MacLoginView: View {
    @EnvironmentObject var authViewModel: AuthViewModel

    @State private var email = ""
    @State private var password = ""
    @State private var isSignUp = false

    var body: some View {
        ZStack {
            Color.theme.cream.ignoresSafeArea()

            VStack(spacing: 32) {
                VStack(spacing: 12) {
                    LinearGradient(
                        colors: [Color.theme.terracotta, Color.theme.amber],
                        startPoint: .topLeading, endPoint: .bottomTrailing
                    )
                    .frame(width: 56, height: 56)
                    .clipShape(RoundedRectangle(cornerRadius: 14))
                    .overlay(Text("O").font(.fraunces(28, weight: .semibold)).foregroundColor(.white))

                    Text("OzempicAI")
                        .font(.fraunces(32, weight: .semibold))
                        .foregroundColor(Color.theme.espresso)
                    Text(isSignUp ? "Create your account" : "Welcome back")
                        .font(.inter(13, weight: .medium))
                        .foregroundColor(Color.theme.coffee)
                }

                VStack(spacing: 16) {
                    TextField("Email", text: $email)
                        .textFieldStyle(.roundedBorder)
                        .frame(width: 300)

                    SecureField("Password", text: $password)
                        .textFieldStyle(.roundedBorder)
                        .frame(width: 300)

                    if let error = authViewModel.errorMessage {
                        Text(error)
                            .font(.inter(11))
                            .foregroundColor(Color.theme.ember)
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
                        Text(isSignUp ? "Sign up" : "Sign in")
                            .font(.inter(14, weight: .semibold))
                            .foregroundColor(.white)
                            .frame(width: 300, height: 44)
                            .background(Color.theme.terracotta)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                            .shadow(color: Color.theme.terracotta.opacity(0.25), radius: 8, y: 3)
                    }
                    .buttonStyle(.plain)
                    .disabled(email.isEmpty || password.isEmpty)

                    Button {
                        isSignUp.toggle()
                        authViewModel.errorMessage = nil
                    } label: {
                        Text(isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up")
                            .font(.inter(12, weight: .medium))
                            .foregroundColor(Color.theme.terracotta)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(48)
        }
        .frame(minWidth: 500, minHeight: 400)
    }
}
