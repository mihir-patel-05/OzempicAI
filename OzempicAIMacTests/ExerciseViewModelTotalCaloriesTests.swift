// ExerciseViewModelTotalCaloriesTests.swift
// Tests for ExerciseViewModel.totalCaloriesBurnedToday — the computed property
// introduced as the data source for the Activity stat card and the "Burned" hero
// stat in MacHomeView (PR phase2 change).
//
// Strategy: ExerciseViewModel.logs is an @Published internal property.
// We instantiate ExerciseViewModel and set logs directly (no Supabase call needed
// for the computed property itself), then assert totalCaloriesBurnedToday.

import XCTest
@testable import OzempicAI

@MainActor
final class ExerciseViewModelTotalCaloriesTests: XCTestCase {

    // MARK: - Helpers

    private func makeLog(
        caloriesBurned: Int,
        loggedAt: Date = Date(),
        category: ExerciseLog.ExerciseCategory = .cardio
    ) -> ExerciseLog {
        ExerciseLog(
            id: UUID(),
            userId: UUID(),
            exerciseName: "Test Exercise",
            category: category,
            durationMinutes: 30,
            caloriesBurned: caloriesBurned,
            loggedAt: loggedAt
        )
    }

    private var yesterday: Date {
        Calendar.current.date(byAdding: .day, value: -1, to: Date())!
    }

    private var twoDaysAgo: Date {
        Calendar.current.date(byAdding: .day, value: -2, to: Date())!
    }

    private var startOfToday: Date {
        Calendar.current.startOfDay(for: Date())
    }

    // MARK: - Tests

    func test_emptyLogs_returnsZero() {
        let vm = ExerciseViewModel()
        vm.logs = []
        XCTAssertEqual(vm.totalCaloriesBurnedToday, 0)
    }

    func test_singleTodayLog_returnsItsCalories() {
        let vm = ExerciseViewModel()
        vm.logs = [makeLog(caloriesBurned: 350)]
        XCTAssertEqual(vm.totalCaloriesBurnedToday, 350)
    }

    func test_multipleTodayLogs_returnsSum() {
        let vm = ExerciseViewModel()
        vm.logs = [
            makeLog(caloriesBurned: 200),
            makeLog(caloriesBurned: 150),
            makeLog(caloriesBurned: 100)
        ]
        XCTAssertEqual(vm.totalCaloriesBurnedToday, 450)
    }

    func test_onlyYesterdayLogs_returnsZero() {
        let vm = ExerciseViewModel()
        vm.logs = [
            makeLog(caloriesBurned: 400, loggedAt: yesterday),
            makeLog(caloriesBurned: 300, loggedAt: yesterday)
        ]
        XCTAssertEqual(vm.totalCaloriesBurnedToday, 0)
    }

    func test_mixedTodayAndPastLogs_countOnlyToday() {
        let vm = ExerciseViewModel()
        vm.logs = [
            makeLog(caloriesBurned: 250),           // today
            makeLog(caloriesBurned: 400, loggedAt: yesterday),
            makeLog(caloriesBurned: 300, loggedAt: twoDaysAgo),
            makeLog(caloriesBurned: 100)             // today
        ]
        XCTAssertEqual(vm.totalCaloriesBurnedToday, 350)
    }

    func test_logAtStartOfDay_isIncluded() {
        let vm = ExerciseViewModel()
        vm.logs = [makeLog(caloriesBurned: 500, loggedAt: startOfToday)]
        XCTAssertEqual(vm.totalCaloriesBurnedToday, 500)
    }

    func test_logAtEndOfDay_isIncluded() {
        // 23:59:59 of today should still count as today.
        let endOfToday = startOfToday.addingTimeInterval(86399)
        let vm = ExerciseViewModel()
        vm.logs = [makeLog(caloriesBurned: 80, loggedAt: endOfToday)]
        XCTAssertEqual(vm.totalCaloriesBurnedToday, 80)
    }

    func test_logExactlyMidnight_isIncluded() {
        // Midnight (00:00:00) belongs to today when it is today's start.
        let vm = ExerciseViewModel()
        vm.logs = [makeLog(caloriesBurned: 120, loggedAt: startOfToday)]
        XCTAssertEqual(vm.totalCaloriesBurnedToday, 120)
    }

    func test_zeroCaloriesLog_doesNotInflateTotal() {
        let vm = ExerciseViewModel()
        vm.logs = [
            makeLog(caloriesBurned: 0),
            makeLog(caloriesBurned: 200)
        ]
        XCTAssertEqual(vm.totalCaloriesBurnedToday, 200)
    }

    func test_allCategoriesAreIncluded() {
        // The filter only checks date, not category.
        let vm = ExerciseViewModel()
        vm.logs = ExerciseLog.ExerciseCategory.allCases.enumerated().map { index, cat in
            makeLog(caloriesBurned: 10, category: cat)
        }
        XCTAssertEqual(vm.totalCaloriesBurnedToday, 10 * ExerciseLog.ExerciseCategory.allCases.count)
    }

    func test_logsUpdated_computedPropertyReflectsNewValue() {
        // Verifies the computed property is not memoised and recomputes on each access.
        let vm = ExerciseViewModel()
        vm.logs = [makeLog(caloriesBurned: 100)]
        XCTAssertEqual(vm.totalCaloriesBurnedToday, 100)

        vm.logs.append(makeLog(caloriesBurned: 200))
        XCTAssertEqual(vm.totalCaloriesBurnedToday, 300)
    }

    func test_logRemovedFromArray_totalDecreases() {
        let vm = ExerciseViewModel()
        let log1 = makeLog(caloriesBurned: 100)
        let log2 = makeLog(caloriesBurned: 200)
        vm.logs = [log1, log2]
        XCTAssertEqual(vm.totalCaloriesBurnedToday, 300)

        vm.logs.removeAll { $0.id == log1.id }
        XCTAssertEqual(vm.totalCaloriesBurnedToday, 200)
    }
}