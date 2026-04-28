// MacHomeViewLogicTests.swift
// Tests for the logic functions introduced or changed in MacHomeView.swift (PR phase2).
//
// Covered changes:
//   - mealTitle(for:)           — new helper mapping CalorieLog.MealType → display string
//   - foodSummary(for:)         — new helper summarising a meal's food names
//   - activityIcon(for:)        — new helper mapping ExerciseLog.ExerciseCategory → SF Symbol name
//   - Net-calories formula      — max(totalCalories - totalCaloriesBurnedToday, 0)
//   - todaysExerciseLogs filter — filters ExerciseLog array to logs dated today

import XCTest
@testable import OzempicAI

// MARK: - Logic replicas
// The functions below are direct copies of the private helpers added to MacHomeView in this PR.
// They are reproduced here so the pure logic can be exercised without instantiating a SwiftUI View.

private func mealTitle(for type: CalorieLog.MealType) -> String {
    switch type {
    case .breakfast: return "Breakfast"
    case .lunch:     return "Lunch"
    case .dinner:    return "Dinner"
    case .snack:     return "Snack"
    }
}

private func foodSummary(for logs: [CalorieLog]) -> String {
    guard !logs.isEmpty else { return "Add food to complete your day" }
    return logs.prefix(2).map(\.foodName).joined(separator: ", ")
}

private func activityIcon(for category: ExerciseLog.ExerciseCategory) -> String {
    switch category {
    case .cardio:      return "figure.run"
    case .strength:    return "dumbbell.fill"
    case .flexibility: return "figure.flexibility"
    case .sports:      return "sportscourt.fill"
    case .other:       return "flame.fill"
    }
}

/// Replicates the net-calories formula used in the heroCard section of MacHomeView.
private func netCalories(totalConsumed: Int, totalBurned: Int) -> Int {
    max(totalConsumed - totalBurned, 0)
}

/// Replicates the todaysExerciseLogs computed property added to MacHomeView.
private func todaysExerciseLogs(from logs: [ExerciseLog]) -> [ExerciseLog] {
    logs.filter { Calendar.current.isDateInToday($0.loggedAt) }
}

// MARK: - Helpers

private func makeCalorieLog(
    foodName: String,
    calories: Int = 300,
    mealType: CalorieLog.MealType = .lunch,
    loggedAt: Date = Date()
) -> CalorieLog {
    CalorieLog(
        id: UUID(),
        userId: UUID(),
        foodName: foodName,
        calories: calories,
        mealType: mealType,
        loggedAt: loggedAt
    )
}

private func makeExerciseLog(
    exerciseName: String = "Running",
    category: ExerciseLog.ExerciseCategory = .cardio,
    durationMinutes: Int = 30,
    caloriesBurned: Int = 200,
    loggedAt: Date = Date()
) -> ExerciseLog {
    ExerciseLog(
        id: UUID(),
        userId: UUID(),
        exerciseName: exerciseName,
        category: category,
        durationMinutes: durationMinutes,
        caloriesBurned: caloriesBurned,
        loggedAt: loggedAt
    )
}

// MARK: - mealTitle tests

final class MealTitleTests: XCTestCase {

    func test_breakfast_returnsCorrectTitle() {
        XCTAssertEqual(mealTitle(for: .breakfast), "Breakfast")
    }

    func test_lunch_returnsCorrectTitle() {
        XCTAssertEqual(mealTitle(for: .lunch), "Lunch")
    }

    func test_dinner_returnsCorrectTitle() {
        XCTAssertEqual(mealTitle(for: .dinner), "Dinner")
    }

    func test_snack_returnsCorrectTitle() {
        XCTAssertEqual(mealTitle(for: .snack), "Snack")
    }

    func test_allCasesProduceNonEmptyString() {
        for mealType in CalorieLog.MealType.allCases {
            XCTAssertFalse(mealTitle(for: mealType).isEmpty, "mealTitle should not be empty for \(mealType)")
        }
    }
}

// MARK: - foodSummary tests

final class FoodSummaryTests: XCTestCase {

    func test_emptyLogs_returnsPromptText() {
        XCTAssertEqual(foodSummary(for: []), "Add food to complete your day")
    }

    func test_singleLog_returnsFoodName() {
        let logs = [makeCalorieLog(foodName: "Oatmeal")]
        XCTAssertEqual(foodSummary(for: logs), "Oatmeal")
    }

    func test_twoLogs_returnsBothNamesSeparatedByComma() {
        let logs = [
            makeCalorieLog(foodName: "Oatmeal"),
            makeCalorieLog(foodName: "Berries")
        ]
        XCTAssertEqual(foodSummary(for: logs), "Oatmeal, Berries")
    }

    func test_threeLogs_returnsOnlyFirstTwo() {
        let logs = [
            makeCalorieLog(foodName: "Oatmeal"),
            makeCalorieLog(foodName: "Berries"),
            makeCalorieLog(foodName: "Almonds")
        ]
        let summary = foodSummary(for: logs)
        XCTAssertEqual(summary, "Oatmeal, Berries")
        XCTAssertFalse(summary.contains("Almonds"), "Third item should not appear in summary")
    }

    func test_manyLogs_neverExceedsTwoItems() {
        let logs = (1...10).map { makeCalorieLog(foodName: "Food\($0)") }
        let summary = foodSummary(for: logs)
        let commaCount = summary.filter { $0 == "," }.count
        XCTAssertLessThanOrEqual(commaCount, 1, "At most two food names (one comma) should appear")
    }

    func test_singleLogWithSpecialCharacters_preservesName() {
        let logs = [makeCalorieLog(foodName: "Açaí & Granola")]
        XCTAssertEqual(foodSummary(for: logs), "Açaí & Granola")
    }
}

// MARK: - activityIcon tests

final class ActivityIconTests: XCTestCase {

    func test_cardio_returnsRunningIcon() {
        XCTAssertEqual(activityIcon(for: .cardio), "figure.run")
    }

    func test_strength_returnsDumbbellIcon() {
        XCTAssertEqual(activityIcon(for: .strength), "dumbbell.fill")
    }

    func test_flexibility_returnsFlexibilityIcon() {
        XCTAssertEqual(activityIcon(for: .flexibility), "figure.flexibility")
    }

    func test_sports_returnsSportsCourtIcon() {
        XCTAssertEqual(activityIcon(for: .sports), "sportscourt.fill")
    }

    func test_other_returnsFlameFillIcon() {
        XCTAssertEqual(activityIcon(for: .other), "flame.fill")
    }

    func test_allCasesReturnNonEmptyString() {
        for category in ExerciseLog.ExerciseCategory.allCases {
            XCTAssertFalse(activityIcon(for: category).isEmpty, "activityIcon should not be empty for \(category)")
        }
    }

    func test_allCasesReturnDistinctIcons() {
        let icons = ExerciseLog.ExerciseCategory.allCases.map { activityIcon(for: $0) }
        let uniqueIcons = Set(icons)
        XCTAssertEqual(icons.count, uniqueIcons.count, "Each category should map to a distinct SF Symbol")
    }
}

// MARK: - Net-calories formula tests

final class NetCaloriesTests: XCTestCase {

    func test_burnedLessThanConsumed_returnsPositiveDifference() {
        XCTAssertEqual(netCalories(totalConsumed: 2000, totalBurned: 500), 1500)
    }

    func test_burnedEqualsConsumed_returnsZero() {
        XCTAssertEqual(netCalories(totalConsumed: 1800, totalBurned: 1800), 0)
    }

    func test_burnedExceedsConsumed_clampsToZero() {
        // Burning more than consumed should never show a negative net value.
        XCTAssertEqual(netCalories(totalConsumed: 500, totalBurned: 800), 0)
    }

    func test_bothZero_returnsZero() {
        XCTAssertEqual(netCalories(totalConsumed: 0, totalBurned: 0), 0)
    }

    func test_noExercise_returnsAllConsumed() {
        XCTAssertEqual(netCalories(totalConsumed: 1500, totalBurned: 0), 1500)
    }

    func test_extremeBurnedValue_doesNotUnderflow() {
        XCTAssertEqual(netCalories(totalConsumed: 0, totalBurned: Int.max / 2), 0)
    }
}

// MARK: - todaysExerciseLogs filter tests

final class TodaysExerciseLogsTests: XCTestCase {

    func test_emptyLogs_returnsEmpty() {
        XCTAssertTrue(todaysExerciseLogs(from: []).isEmpty)
    }

    func test_allTodayLogs_returnsAll() {
        let logs = [
            makeExerciseLog(exerciseName: "Running", loggedAt: Date()),
            makeExerciseLog(exerciseName: "Cycling", loggedAt: Date())
        ]
        XCTAssertEqual(todaysExerciseLogs(from: logs).count, 2)
    }

    func test_yesterdayLog_isExcluded() {
        let yesterday = Calendar.current.date(byAdding: .day, value: -1, to: Date())!
        let logs = [makeExerciseLog(exerciseName: "Old Run", loggedAt: yesterday)]
        XCTAssertTrue(todaysExerciseLogs(from: logs).isEmpty)
    }

    func test_tomorrowLog_isExcluded() {
        let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: Date())!
        let logs = [makeExerciseLog(exerciseName: "Future Run", loggedAt: tomorrow)]
        XCTAssertTrue(todaysExerciseLogs(from: logs).isEmpty)
    }

    func test_mixedDates_returnsOnlyToday() {
        let yesterday = Calendar.current.date(byAdding: .day, value: -1, to: Date())!
        let twoDaysAgo = Calendar.current.date(byAdding: .day, value: -2, to: Date())!
        let logs = [
            makeExerciseLog(exerciseName: "Today Run",   loggedAt: Date()),
            makeExerciseLog(exerciseName: "Yesterday",   loggedAt: yesterday),
            makeExerciseLog(exerciseName: "Two Days Ago",loggedAt: twoDaysAgo),
            makeExerciseLog(exerciseName: "Today Lift",  loggedAt: Date())
        ]
        let todays = todaysExerciseLogs(from: logs)
        XCTAssertEqual(todays.count, 2)
        XCTAssertTrue(todays.allSatisfy { $0.exerciseName.hasPrefix("Today") })
    }

    func test_startOfDayLog_isIncluded() {
        let startOfToday = Calendar.current.startOfDay(for: Date())
        let logs = [makeExerciseLog(loggedAt: startOfToday)]
        XCTAssertEqual(todaysExerciseLogs(from: logs).count, 1)
    }

    func test_endOfDayLog_isIncluded() {
        // A log at 23:59:59 of today should still be considered today.
        let endOfToday = Calendar.current.startOfDay(for: Date()).addingTimeInterval(86399)
        let logs = [makeExerciseLog(loggedAt: endOfToday)]
        XCTAssertEqual(todaysExerciseLogs(from: logs).count, 1)
    }
}