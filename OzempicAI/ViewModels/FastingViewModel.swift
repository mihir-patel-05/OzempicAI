import Foundation
import UserNotifications

@MainActor
final class FastingViewModel: ObservableObject {

    // MARK: - Published

    @Published var selectedHours: Int = 16
    @Published var isActive: Bool = false
    @Published var isComplete: Bool = false
    @Published var progress: Double = 0
    @Published var timeElapsed: TimeInterval = 0

    // MARK: - Private

    private var startTime: Date?
    private var timer: Timer?

    private let startTimeKey = "fasting_start_time"
    private let durationKey  = "fasting_duration_hours"

    // MARK: - Computed

    var targetDuration: TimeInterval { Double(selectedHours) * 3600 }
    var timeRemaining: TimeInterval  { max(targetDuration - timeElapsed, 0) }

    var elapsedString: String   { formatInterval(timeElapsed) }
    var remainingString: String { formatInterval(timeRemaining) }

    var fastingPhase: String {
        let hours = timeElapsed / 3600
        switch hours {
        case ..<4:    return "Fed State"
        case 4..<8:   return "Post-Absorptive"
        case 8..<12:  return "Early Fasting"
        case 12..<16: return "Fat Burning Begins"
        case 16..<20: return "Deep Fat Burning"
        default:      return "Extended Fast"
        }
    }

    var fastingPhaseIcon: String {
        let hours = timeElapsed / 3600
        switch hours {
        case ..<8:   return "fork.knife"
        case 8..<14: return "moon.fill"
        default:     return "moon.stars.fill"
        }
    }

    // MARK: - Init

    init() {
        restoreSession()
    }

    // MARK: - Actions

    func startFast() {
        let now = Date()
        startTime = now
        isActive = true
        isComplete = false
        timeElapsed = 0
        progress = 0

        UserDefaults.standard.set(now, forKey: startTimeKey)
        UserDefaults.standard.set(selectedHours, forKey: durationKey)

        scheduleNotification()
        startTimer()
    }

    func stopFast() {
        timer?.invalidate()
        timer = nil
        isActive = false
        isComplete = false
        startTime = nil
        timeElapsed = 0
        progress = 0

        UserDefaults.standard.removeObject(forKey: startTimeKey)
        UserDefaults.standard.removeObject(forKey: durationKey)
        cancelNotification()
    }

    func resetAfterComplete() {
        isComplete = false
        isActive = false
        startTime = nil
        timeElapsed = 0
        progress = 0
        UserDefaults.standard.removeObject(forKey: startTimeKey)
        UserDefaults.standard.removeObject(forKey: durationKey)
    }

    // MARK: - Timer

    private func startTimer() {
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                self?.tick()
            }
        }
    }

    private func tick() {
        guard let start = startTime else { return }
        timeElapsed = Date().timeIntervalSince(start)
        progress = min(timeElapsed / targetDuration, 1.0)

        if timeElapsed >= targetDuration && !isComplete {
            isComplete = true
            isActive = false
            timer?.invalidate()
            timer = nil
        }
    }

    // MARK: - Persistence

    private func restoreSession() {
        guard let savedStart = UserDefaults.standard.object(forKey: startTimeKey) as? Date else { return }
        let savedHours = UserDefaults.standard.integer(forKey: durationKey)
        guard savedHours > 0 else { return }

        selectedHours = savedHours
        startTime = savedStart
        timeElapsed = Date().timeIntervalSince(savedStart)
        progress = min(timeElapsed / (Double(savedHours) * 3600), 1.0)

        if timeElapsed >= Double(savedHours) * 3600 {
            isComplete = true
            isActive = false
        } else {
            isActive = true
            startTimer()
        }
    }

    // MARK: - Notifications

    private func scheduleNotification() {
        let center = UNUserNotificationCenter.current()
        let hours = selectedHours
        let duration = targetDuration

        center.requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
            guard granted else { return }

            let content = UNMutableNotificationContent()
            content.title = "Fast Complete!"
            content.body = "Great job! You've completed your \(hours)-hour fast. Time to break your fast!"
            content.sound = .default

            let trigger = UNTimeIntervalNotificationTrigger(timeInterval: duration, repeats: false)
            let request = UNNotificationRequest(
                identifier: "fasting_complete",
                content: content,
                trigger: trigger
            )
            center.add(request)
        }
    }

    private func cancelNotification() {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: ["fasting_complete"])
    }

    // MARK: - Helpers

    private func formatInterval(_ interval: TimeInterval) -> String {
        let total = Int(max(interval, 0))
        let h = total / 3600
        let m = (total % 3600) / 60
        let s = total % 60
        return String(format: "%02d:%02d:%02d", h, m, s)
    }
}
