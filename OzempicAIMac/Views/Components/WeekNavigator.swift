import SwiftUI

struct WeekNavigator: View {
    @Binding var weekStart: Date

    private var weekEnd: Date {
        Calendar.current.date(byAdding: .day, value: 6, to: weekStart) ?? weekStart
    }

    private var weekLabel: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d"
        let start = formatter.string(from: weekStart)
        let end = formatter.string(from: weekEnd)
        return "Week of \(start) – \(end)"
    }

    var body: some View {
        HStack(spacing: 16) {
            Button {
                weekStart = Calendar.current.date(byAdding: .weekOfYear, value: -1, to: weekStart) ?? weekStart
            } label: {
                Image(systemName: "chevron.left")
            }
            .buttonStyle(.plain)
            .keyboardShortcut(.leftArrow, modifiers: .command)

            Text(weekLabel)
                .font(.headline)
                .frame(minWidth: 200)

            Button {
                weekStart = Calendar.current.date(byAdding: .weekOfYear, value: 1, to: weekStart) ?? weekStart
            } label: {
                Image(systemName: "chevron.right")
            }
            .buttonStyle(.plain)
            .keyboardShortcut(.rightArrow, modifiers: .command)
        }
    }

    static func mondayOfWeek(containing date: Date) -> Date {
        let calendar = Calendar.current
        let weekday = calendar.component(.weekday, from: date)
        // weekday: 1=Sun, 2=Mon, ..., 7=Sat
        let daysToSubtract = (weekday + 5) % 7 // Mon=0, Tue=1, ..., Sun=6
        return calendar.startOfDay(for: calendar.date(byAdding: .day, value: -daysToSubtract, to: date)!)
    }
}
