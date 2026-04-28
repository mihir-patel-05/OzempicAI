// MacExerciseLogViewLogicTests.swift
// Tests for helper logic in MacExerciseLogView.swift.
//
// While the primary PR change in MacExerciseLogView is structural (wrapping in ScrollView),
// the helper functions that render dynamic content — detailText(for:) and filteredLogs —
// are exercised by the new ScrollView layout and must remain correct.
//
// The private functions are replicated here as standalone functions so their logic
// can be verified independently.

import XCTest
@testable import OzempicAI

// MARK: - Logic replicas

/// Replicates MacExerciseLogView.detailText(for:)
private func detailText(for log: ExerciseLog) -> String {
    var parts: [String] = []
    if let sets = log.sets, let reps = log.repsPerSet {
        parts.append("\(sets)x\(reps)")
    }
    if let w = log.weight, let unit = log.weightUnit {
        parts.append("\(Int(w))\(unit.rawValue)")
    }
    return parts.joined(separator: " · ")
}

/// Replicates MacExerciseLogView.filteredLogs (filtering step only, without sort)
private func filteredLogs(_ logs: [ExerciseLog], category: ExerciseLog.ExerciseCategory?) -> [ExerciseLog] {
    guard let cat = category else { return logs }
    return logs.filter { $0.category == cat }
}

// MARK: - Helpers

private func makeLog(
    category: ExerciseLog.ExerciseCategory = .cardio,
    sets: Int? = nil,
    repsPerSet: Int? = nil,
    weight: Double? = nil,
    weightUnit: ExerciseLog.WeightUnit? = nil
) -> ExerciseLog {
    ExerciseLog(
        id: UUID(),
        userId: UUID(),
        exerciseName: "Test",
        category: category,
        durationMinutes: 30,
        caloriesBurned: 200,
        sets: sets,
        repsPerSet: repsPerSet,
        weight: weight,
        weightUnit: weightUnit,
        loggedAt: Date()
    )
}

// MARK: - detailText tests

final class DetailTextTests: XCTestCase {

    func test_noStrengthFields_returnsEmptyString() {
        let log = makeLog()
        XCTAssertEqual(detailText(for: log), "")
    }

    func test_setsAndReps_returnsFormattedString() {
        let log = makeLog(sets: 3, repsPerSet: 12)
        XCTAssertEqual(detailText(for: log), "3x12")
    }

    func test_weightWithLbUnit_returnsFormattedString() {
        let log = makeLog(weight: 135.0, weightUnit: .lb)
        XCTAssertEqual(detailText(for: log), "135lb")
    }

    func test_weightWithKgUnit_returnsFormattedString() {
        let log = makeLog(weight: 60.0, weightUnit: .kg)
        XCTAssertEqual(detailText(for: log), "60kg")
    }

    func test_allStrengthFields_returnsJoinedString() {
        let log = makeLog(sets: 4, repsPerSet: 10, weight: 100.0, weightUnit: .lb)
        XCTAssertEqual(detailText(for: log), "4x10 · 100lb")
    }

    func test_setsWithoutReps_omitsSetsEntry() {
        // Only repsPerSet without sets should not produce a sets×reps token.
        let log = makeLog(sets: 3)
        XCTAssertEqual(detailText(for: log), "")
    }

    func test_repsWithoutSets_omitsRepsEntry() {
        let log = makeLog(repsPerSet: 10)
        XCTAssertEqual(detailText(for: log), "")
    }

    func test_weightWithoutUnit_omitsWeightEntry() {
        let log = makeLog(weight: 50.0)
        XCTAssertEqual(detailText(for: log), "")
    }

    func test_fractionalWeight_isTruncatedToInt() {
        // The view uses Int(w) to format weight.
        let log = makeLog(weight: 67.8, weightUnit: .kg)
        XCTAssertEqual(detailText(for: log), "67kg")
    }

    func test_zeroWeight_showsZero() {
        let log = makeLog(weight: 0.0, weightUnit: .lb)
        XCTAssertEqual(detailText(for: log), "0lb")
    }
}

// MARK: - filteredLogs tests

final class FilteredLogsTests: XCTestCase {

    private let allLogs: [ExerciseLog] = [
        makeLog(category: .cardio),
        makeLog(category: .strength),
        makeLog(category: .flexibility),
        makeLog(category: .sports),
        makeLog(category: .other)
    ]

    func test_nilCategoryFilter_returnsAllLogs() {
        let result = filteredLogs(allLogs, category: nil)
        XCTAssertEqual(result.count, allLogs.count)
    }

    func test_cardioFilter_returnsOnlyCardioLogs() {
        let result = filteredLogs(allLogs, category: .cardio)
        XCTAssertTrue(result.allSatisfy { $0.category == .cardio })
        XCTAssertEqual(result.count, 1)
    }

    func test_strengthFilter_returnsOnlyStrengthLogs() {
        let result = filteredLogs(allLogs, category: .strength)
        XCTAssertTrue(result.allSatisfy { $0.category == .strength })
    }

    func test_filterOnEmptyList_returnsEmpty() {
        let result = filteredLogs([], category: .cardio)
        XCTAssertTrue(result.isEmpty)
    }

    func test_filterWithNoMatches_returnsEmpty() {
        let cardioOnlyLogs = [makeLog(category: .cardio), makeLog(category: .cardio)]
        let result = filteredLogs(cardioOnlyLogs, category: .flexibility)
        XCTAssertTrue(result.isEmpty)
    }

    func test_filterWithMultipleMatches_returnsAll() {
        let logs = [
            makeLog(category: .strength),
            makeLog(category: .strength),
            makeLog(category: .cardio)
        ]
        let result = filteredLogs(logs, category: .strength)
        XCTAssertEqual(result.count, 2)
    }
}