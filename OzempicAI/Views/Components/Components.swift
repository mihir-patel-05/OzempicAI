import SwiftUI

// Reusable UI bits for the iOS redesign (Home screen, stat cards, etc.).
// iOS-only — file lives under the iOS target's Views/ path.

// MARK: - Progress Ring (gradient capable)

struct ProgressRing: View {
    var progress: Double
    var size: CGFloat = 180
    var lineWidth: CGFloat = 14
    var gradient: [Color] = [Color.theme.terracotta, Color.theme.amber]
    var trackColor: Color = Color.theme.ringTrack

    var body: some View {
        ZStack {
            Circle()
                .stroke(trackColor, lineWidth: lineWidth)

            Circle()
                .trim(from: 0, to: min(CGFloat(progress), 1))
                .stroke(
                    LinearGradient(colors: gradient, startPoint: .topLeading, endPoint: .bottomTrailing),
                    style: StrokeStyle(lineWidth: lineWidth, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))
                .animation(.easeOut(duration: 0.8), value: progress)
        }
        .frame(width: size, height: size)
    }
}

// MARK: - Stat Card (2x2 grid on Home)

struct StatCard: View {
    let label: String
    let value: String
    let sub: String
    let progress: Double
    let color: Color
    let systemImage: String
    var pulse: Bool = false
    var trendDown: Bool = false

    @State private var animating = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                ZStack {
                    RoundedRectangle(cornerRadius: 9)
                        .fill(color.opacity(0.12))
                    Image(systemName: systemImage)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(color)
                }
                .frame(width: 28, height: 28)

                Spacer()

                if pulse {
                    Circle()
                        .fill(color)
                        .frame(width: 8, height: 8)
                        .scaleEffect(animating ? 1.4 : 1.0)
                        .opacity(animating ? 0.4 : 1.0)
                        .animation(.easeOut(duration: 1.2).repeatForever(autoreverses: false), value: animating)
                        .onAppear { animating = true }
                }

                if trendDown {
                    Image(systemName: "arrow.down")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(Color.theme.sage)
                }
            }

            Spacer(minLength: 12)

            CapsLabel(text: label)
            Text(value)
                .font(AppFont.display(28, weight: .medium))
                .foregroundColor(Color.theme.espresso)
                .kerning(-0.5)
                .padding(.top, 2)
            Text(sub)
                .font(.system(size: 11, weight: .medium))
                .foregroundColor(Color.theme.dust)
                .padding(.top, 3)

            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.theme.ringTrack)
                    Capsule().fill(color)
                        .frame(width: geo.size.width * CGFloat(min(progress, 1)))
                }
            }
            .frame(height: 4)
            .padding(.top, 10)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.theme.paper)
        .cornerRadius(22)
        .shadow(color: Color.theme.shadow, radius: 10, x: 0, y: 2)
    }
}

// MARK: - Screen Header (Large title + CTA)

struct ScreenHeader: View {
    let title: String
    let subtitle: String
    var onAdd: (() -> Void)? = nil

    var body: some View {
        HStack(alignment: .bottom) {
            VStack(alignment: .leading, spacing: 4) {
                CapsLabel(text: subtitle)
                Text(title)
                    .font(AppFont.display(34, weight: .regular))
                    .foregroundColor(Color.theme.espresso)
                    .kerning(-0.6)
            }
            Spacer()
            if let onAdd {
                Button(action: onAdd) {
                    Image(systemName: "plus")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundColor(.white)
                        .frame(width: 40, height: 40)
                        .background(Color.theme.terracotta)
                        .clipShape(Circle())
                        .shadow(color: Color.theme.terracotta.opacity(0.4), radius: 10, x: 0, y: 4)
                }
            }
        }
        .padding(.horizontal, AppSpacing.lg)
        .padding(.top, AppSpacing.md)
        .padding(.bottom, AppSpacing.md)
    }
}

// MARK: - Macro Bar

struct MacroBar: View {
    let label: String
    let grams: Int
    let goal: Int
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            CapsLabel(text: label)
            HStack(alignment: .lastTextBaseline, spacing: 3) {
                Text("\(grams)")
                    .font(AppFont.display(22, weight: .medium))
                    .foregroundColor(Color.theme.espresso)
                Text("/\(goal)g")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundColor(Color.theme.dust)
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.theme.ringTrack)
                    Capsule().fill(color)
                        .frame(width: geo.size.width * CGFloat(min(Double(grams)/Double(goal), 1)))
                }
            }
            .frame(height: 4)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.theme.paper)
        .cornerRadius(AppRadius.medium)
        .shadow(color: Color.theme.shadow, radius: 8, x: 0, y: 2)
    }
}
