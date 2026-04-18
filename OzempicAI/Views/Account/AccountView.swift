import SwiftUI

struct AccountView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var name: String = ""
    @State private var ageText: String = ""
    @State private var heightText: String = ""
    @State private var weightText: String = ""
    @State private var calorieGoalText: String = ""
    @State private var waterGoalText: String = ""
    @State private var isSaving = false
    @State private var savedFlash = false

    private var initial: String { authViewModel.avatarInitial }

    private var email: String { authViewModel.currentUser?.email ?? "—" }

    var body: some View {
        ScrollView {
            VStack(spacing: AppSpacing.md) {
                headerCard
                if let error = authViewModel.errorMessage {
                    errorBanner(error)
                }
                profileCard
                goalsCard
                signOutCard
                Spacer(minLength: 40)
            }
            .padding(.bottom, 40)
        }
        .screenBackground()
        .navigationTitle("Account")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            if authViewModel.currentUser == nil {
                await authViewModel.loadProfile()
            }
            hydrateFields()
        }
        .onChange(of: authViewModel.currentUser?.id) { _ in hydrateFields() }
    }

    private func hydrateFields() {
        guard let u = authViewModel.currentUser else { return }
        name = u.name
        ageText = u.age.map(String.init) ?? ""
        heightText = u.heightCm.map { String(format: "%g", $0) } ?? ""
        weightText = u.weightKg.map { String(format: "%g", $0) } ?? ""
        calorieGoalText = String(u.dailyCalorieGoal)
        waterGoalText = String(u.dailyWaterGoalMl)
    }

    // MARK: - Header

    private var headerCard: some View {
        VStack(spacing: 12) {
            ZStack {
                LinearGradient(colors: [Color.theme.terracotta, Color.theme.amber],
                               startPoint: .topLeading, endPoint: .bottomTrailing)
                    .clipShape(Circle())
                Text(initial)
                    .font(AppFont.display(36, weight: .medium))
                    .foregroundColor(.white)
            }
            .frame(width: 86, height: 86)
            .shadow(color: Color.theme.terracotta.opacity(0.3), radius: 14, x: 0, y: 6)

            Text(name.isEmpty ? "Add your name" : name)
                .font(AppFont.display(22, weight: .medium))
                .foregroundColor(Color.theme.espresso)

            Text(email)
                .font(AppFont.ui(13))
                .foregroundColor(Color.theme.coffee)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, AppSpacing.lg)
        .padding(.horizontal, AppSpacing.md)
        .background(Color.theme.paper)
        .cornerRadius(AppRadius.large)
        .shadow(color: Color.theme.shadow, radius: 8, x: 0, y: 2)
        .padding(.horizontal, AppSpacing.md + 4)
        .padding(.top, AppSpacing.sm)
    }

    // MARK: - Profile

    private var profileCard: some View {
        cardShell(icon: "person.text.rectangle.fill", accent: Color.theme.terracotta, title: "Profile") {
            VStack(alignment: .leading, spacing: AppSpacing.sm) {
                fieldLabel("Name")
                TextField("Your name", text: $name)
                    .textFieldStyle(ThemedTextFieldStyle())

                HStack(spacing: AppSpacing.sm) {
                    VStack(alignment: .leading, spacing: AppSpacing.xs) {
                        fieldLabel("Age")
                        TextField("—", text: $ageText)
                            .keyboardType(.numberPad)
                            .textFieldStyle(ThemedTextFieldStyle())
                    }
                    VStack(alignment: .leading, spacing: AppSpacing.xs) {
                        fieldLabel("Height (cm)")
                        TextField("—", text: $heightText)
                            .keyboardType(.decimalPad)
                            .textFieldStyle(ThemedTextFieldStyle())
                    }
                    VStack(alignment: .leading, spacing: AppSpacing.xs) {
                        fieldLabel("Weight (kg)")
                        TextField("—", text: $weightText)
                            .keyboardType(.decimalPad)
                            .textFieldStyle(ThemedTextFieldStyle())
                    }
                }
            }
        }
    }

    // MARK: - Goals

    private var goalsCard: some View {
        cardShell(icon: "target", accent: Color.theme.sageDeep, title: "Daily goals") {
            VStack(alignment: .leading, spacing: AppSpacing.sm) {
                fieldLabel("Calorie goal")
                TextField("2000", text: $calorieGoalText)
                    .keyboardType(.numberPad)
                    .textFieldStyle(ThemedTextFieldStyle())

                fieldLabel("Water goal (ml)")
                TextField("2500", text: $waterGoalText)
                    .keyboardType(.numberPad)
                    .textFieldStyle(ThemedTextFieldStyle())

                Button {
                    Task { await save() }
                } label: {
                    HStack(spacing: 8) {
                        if isSaving {
                            ProgressView().tint(.white)
                        } else if savedFlash {
                            Image(systemName: "checkmark")
                            Text("Saved")
                        } else {
                            Text("Save changes")
                        }
                    }
                    .font(AppFont.ui(14, weight: .semibold))
                }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(isSaving)
                .padding(.top, AppSpacing.xs)
            }
        }
    }

    // MARK: - Sign out

    private var signOutCard: some View {
        cardShell(icon: "rectangle.portrait.and.arrow.right", accent: Color.theme.ember, title: "Session") {
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
    }

    // MARK: - Helpers

    private func errorBanner(_ message: String) -> some View {
        HStack(spacing: AppSpacing.sm) {
            Image(systemName: "exclamationmark.triangle.fill")
            Text(message)
        }
        .font(AppFont.ui(12, weight: .semibold))
        .foregroundColor(Color.theme.ember)
        .padding(AppSpacing.sm)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.theme.ember.opacity(0.12))
        .cornerRadius(AppRadius.medium)
        .padding(.horizontal, AppSpacing.md + 4)
    }

    private func fieldLabel(_ text: String) -> some View {
        Text(text.uppercased())
            .font(.system(size: 11, weight: .semibold))
            .tracking(0.6)
            .foregroundColor(Color.theme.dust)
    }

    private func cardShell<Content: View>(
        icon: String,
        accent: Color,
        title: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            HStack(spacing: 10) {
                ZStack {
                    Circle().fill(accent.opacity(0.15))
                    Image(systemName: icon)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(accent)
                }
                .frame(width: 32, height: 32)
                Text(title)
                    .font(AppFont.display(18, weight: .medium))
                    .foregroundColor(Color.theme.espresso)
            }
            content()
        }
        .padding(AppSpacing.md)
        .background(Color.theme.paper)
        .cornerRadius(AppRadius.large)
        .shadow(color: Color.theme.shadow, radius: 6, x: 0, y: 2)
        .padding(.horizontal, AppSpacing.md + 4)
    }

    private func save() async {
        isSaving = true
        savedFlash = false
        let age = Int(ageText.trimmingCharacters(in: .whitespaces))
        let height = Double(heightText.trimmingCharacters(in: .whitespaces))
        let weight = Double(weightText.trimmingCharacters(in: .whitespaces))
        let calorieGoal = Int(calorieGoalText.trimmingCharacters(in: .whitespaces)) ?? 2000
        let waterGoal = Int(waterGoalText.trimmingCharacters(in: .whitespaces)) ?? 2500

        let ok = await authViewModel.updateProfile(
            name: name.trimmingCharacters(in: .whitespacesAndNewlines),
            age: age,
            heightCm: height,
            weightKg: weight,
            dailyCalorieGoal: calorieGoal,
            dailyWaterGoalMl: waterGoal
        )
        isSaving = false
        if ok {
            savedFlash = true
            try? await Task.sleep(nanoseconds: 1_500_000_000)
            savedFlash = false
        }
    }
}
