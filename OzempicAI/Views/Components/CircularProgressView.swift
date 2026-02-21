import SwiftUI

struct CircularProgressView: View {
    let progress: Double
    let size: CGFloat
    let lineWidth: CGFloat
    let trackColor: Color
    let progressColor: Color

    init(
        progress: Double,
        size: CGFloat = 150,
        lineWidth: CGFloat = 14,
        trackColor: Color = Color.theme.lightBlue.opacity(0.3),
        progressColor: Color = Color.theme.amber
    ) {
        self.progress = min(max(progress, 0), 1)
        self.size = size
        self.lineWidth = lineWidth
        self.trackColor = trackColor
        self.progressColor = progressColor
    }

    var body: some View {
        ZStack {
            Circle()
                .stroke(trackColor, lineWidth: lineWidth)

            Circle()
                .trim(from: 0, to: progress)
                .stroke(
                    progressColor,
                    style: StrokeStyle(lineWidth: lineWidth, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))
                .animation(.easeInOut(duration: 0.6), value: progress)
        }
        .frame(width: size, height: size)
    }
}
