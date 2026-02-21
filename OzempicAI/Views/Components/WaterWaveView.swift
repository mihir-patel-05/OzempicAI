import SwiftUI

struct WaterWaveView: View {
    let progress: Double
    @State private var phase: CGFloat = 0

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: AppRadius.large)
                .fill(Color.theme.lightBlue.opacity(0.15))

            WaveShape(progress: progress, phase: phase)
                .fill(
                    LinearGradient(
                        colors: [Color.theme.mediumBlue, Color.theme.lightBlue],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .clipShape(RoundedRectangle(cornerRadius: AppRadius.large))

            RoundedRectangle(cornerRadius: AppRadius.large)
                .stroke(Color.theme.mediumBlue.opacity(0.3), lineWidth: 2)
        }
        .onAppear {
            withAnimation(.linear(duration: 2).repeatForever(autoreverses: false)) {
                phase = .pi * 2
            }
        }
    }
}

struct WaveShape: Shape {
    var progress: Double
    var phase: CGFloat

    var animatableData: AnimatablePair<Double, CGFloat> {
        get { AnimatablePair(progress, phase) }
        set {
            progress = newValue.first
            phase = newValue.second
        }
    }

    func path(in rect: CGRect) -> Path {
        var path = Path()
        let waterHeight = rect.height * (1 - CGFloat(min(max(progress, 0), 1)))
        let amplitude: CGFloat = 6

        path.move(to: CGPoint(x: 0, y: waterHeight))

        for x in stride(from: CGFloat(0), through: rect.width, by: 1) {
            let relX = x / rect.width
            let y = waterHeight + amplitude * sin((relX * 2 * .pi) + phase)
            path.addLine(to: CGPoint(x: x, y: y))
        }

        path.addLine(to: CGPoint(x: rect.width, y: rect.height))
        path.addLine(to: CGPoint(x: 0, y: rect.height))
        path.closeSubpath()

        return path
    }
}
