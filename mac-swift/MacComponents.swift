// MacComponents.swift — Reusable macOS UI primitives matching the redesign
// Add to: OzempicAI/OzempicAIMac/Views/Components/MacComponents.swift

import SwiftUI

// MARK: - Page Header
struct MacPageHeader: View {
    let title: String
    let subtitle: String
    var actionTitle: String? = "Log"
    var actionIcon: String = "plus"
    var onAction: (() -> Void)? = nil

    var body: some View {
        HStack(alignment: .bottom) {
            VStack(alignment: .leading, spacing: 4) {
                Text(subtitle.uppercased())
                    .font(.inter(12, weight: .semibold))
                    .tracking(1.0)
                    .foregroundColor(Color.theme.coffee)
                Text(title)
                    .font(.fraunces(38, weight: .regular))
                    .foregroundColor(Color.theme.espresso)
            }
            Spacer()
            if let actionTitle = actionTitle {
                Button {
                    onAction?()
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: actionIcon).font(.system(size: 12, weight: .bold))
                        Text(actionTitle).font(.inter(13, weight: .semibold))
                    }
                    .foregroundColor(.white)
                    .padding(.horizontal, 18).padding(.vertical, 10)
                    .background(Color.theme.terracotta)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .shadow(color: Color.theme.terracotta.opacity(0.25), radius: 8, y: 3)
                }
                .buttonStyle(.plain)
            }
        }
    }
}

// MARK: - Card
struct MacCard<Content: View>: View {
    var padding: CGFloat = 20
    @ViewBuilder let content: Content

    var body: some View {
        content
            .padding(padding)
            .background(Color.theme.paper)
            .clipShape(RoundedRectangle(cornerRadius: 20))
            .shadow(color: Color.theme.shadow, radius: 10, y: 2)
    }
}

// MARK: - Progress Ring
struct MacRing: View {
    var size: CGFloat = 180
    var stroke: CGFloat = 14
    var progress: Double
    var gradient: [Color] = [Color.theme.terracotta, Color.theme.amber]
    var trackColor: Color = Color.theme.ringTrack

    var body: some View {
        ZStack {
            Circle()
                .stroke(trackColor, lineWidth: stroke)
            Circle()
                .trim(from: 0, to: min(progress, 1))
                .stroke(
                    AngularGradient(colors: gradient, center: .center),
                    style: StrokeStyle(lineWidth: stroke, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))
        }
        .frame(width: size, height: size)
    }
}

// MARK: - Stat Card (small metric tile)
struct MacStatCard: View {
    let label: String
    let value: String
    let sub: String
    let color: Color
    let iconName: String
    var progress: Double? = nil

    var body: some View {
        MacCard {
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    ZStack {
                        RoundedRectangle(cornerRadius: 10)
                            .fill(color.opacity(0.15))
                            .frame(width: 30, height: 30)
                        Image(systemName: iconName)
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(color)
                    }
                    Spacer()
                }
                Text(label.uppercased())
                    .font(.inter(10, weight: .bold))
                    .tracking(1.0)
                    .foregroundColor(Color.theme.coffee)
                    .padding(.top, 14)
                Text(value)
                    .font(.fraunces(32, weight: .medium))
                    .foregroundColor(Color.theme.espresso)
                    .padding(.top, 2)
                Text(sub)
                    .font(.inter(11, weight: .medium))
                    .foregroundColor(Color.theme.dust)
                    .padding(.top, 4)
                if let p = progress {
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 2)
                                .fill(Color.theme.ringTrack)
                            RoundedRectangle(cornerRadius: 2)
                                .fill(color)
                                .frame(width: geo.size.width * CGFloat(p))
                        }
                    }
                    .frame(height: 4)
                    .padding(.top, 12)
                }
            }
        }
    }
}

// MARK: - Section Title
struct MacSectionTitle: View {
    let text: String
    var body: some View {
        Text(text)
            .font(.fraunces(22, weight: .medium))
            .foregroundColor(Color.theme.espresso)
    }
}
