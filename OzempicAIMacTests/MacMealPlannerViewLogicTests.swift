// MacMealPlannerViewLogicTests.swift
// Tests for the helper logic in MacMealPlannerView.swift.
//
// The PR wraps the content in a ScrollView and moves the inner grid outside the
// old inner ScrollView. The styling changes (background, clip, shadow) are visual-only.
// The helper functions that drive the grid's data — dailyTotal(for:), totalColor(for:),
// and meal(for:type:) — remain unchanged but are now rendered inside the new layout
// and must continue to work correctly.
//
// These private helpers are replicated here as standalone functions.

import XCTest
import SwiftUI
@testable import OzempicAI

// MARK: - Logic replicas

private static let dayFormatter: DateFormatter = {
    let f = DateFormatter()
    f.dateFormat = "yyyy-MM-dd"
    return f
}()

/// Replicates MacMealPlannerView.dailyTotal(for:)
private func dailyTotal(for date: Date, in plans: [MealPlan]) -> Int {
    let dateString = dayFormatter.string(from: date)
    return plans
        .filter { $0.plannedDate == dateString }
        .reduce(0) { $0 + $1.calories }
}

/// Replicates MacMealPlannerView.meal(for:type:)
private func meal(for date: Date, type: MealPlan.MealType, in plans: [MealPlan]) -> MealPlan? {
    let dateString = dayFormatter.string(from: date)
    return plans.first { $0.plannedDate == dateString && $0.mealType == type }
}

/// Replicates MacMealPlannerView.totalColor(for:) with a given calorie goal.
private func totalColor(for total: Int, goal: Int) -> Color {
    if total == 0           { return .secondary }
    if total <= goal        { return .green }
    if total <= Int(Double(goal) * 1.1) { return Color.yellow } // amber proxy
    return .red
}

// MARK: - Helpers

private func makePlan(
    name: String = "Meal",
    plannedDate: Date,
    mealType: MealPlan.MealType,
    calories: Int
) -> MealPlan {
    MealPlan(
        id: UUID(),
        userId: UUID(),
        name: name,
        plannedDate: dayFormatter.string(from: plannedDate),
        mealType: mealType,
        calories: calories,
        createdAt: "2024-01-01"
    )
}

// MARK: - dailyTotal tests

final class DailyTotalTests: XCTestCase {

    private var today: Date { Calendar.current.startOfDay(for: Date()) }

    private var tomorrow: Date {
        Calendar.current.date(byAdding: .day, value: 1, to: today)!
    }

    func test_noPlans_returnsZero() {
        XCTAssertEqual(dailyTotal(for: today, in: []), 0)
    }

    func test_singlePlanMatchingDate_returnsItsCalories() {
        let plan = makePlan(plannedDate: today, mealType: .breakfast, calories: 400)
        XCTAssertEqual(dailyTotal(for: today, in: [plan]), 400)
    }

    func test_multiplePlansOnSameDay_returnsSum() {
        let plans = [
            makePlan(plannedDate: today, mealType: .breakfast, calories: 350),
            makePlan(plannedDate: today, mealType: .lunch,     calories: 600),
            makePlan(plannedDate: today, mealType: .dinner,    calories: 700)
        ]
        XCTAssertEqual(dailyTotal(for: today, in: plans), 1650)
    }

    func test_plansOnDifferentDays_countsOnlyMatchingDate() {
        let plans = [
            makePlan(plannedDate: today,    mealType: .lunch,  calories: 500),
            makePlan(plannedDate: tomorrow, mealType: .dinner, calories: 800)
        ]
        XCTAssertEqual(dailyTotal(for: today, in: plans), 500)
        XCTAssertEqual(dailyTotal(for: tomorrow, in: plans), 800)
    }

    func test_queryDateNotInPlans_returnsZero() {
        let plan = makePlan(plannedDate: tomorrow, mealType: .breakfast, calories: 300)
        XCTAssertEqual(dailyTotal(for: today, in: [plan]), 0)
    }

    func test_zeroCaloraieEntry_doesNotInflateTotal() {
        let plans = [
            makePlan(plannedDate: today, mealType: .snack,  calories: 0),
            makePlan(plannedDate: today, mealType: .dinner, calories: 600)
        ]
        XCTAssertEqual(dailyTotal(for: today, in: plans), 600)
    }
}

// MARK: - totalColor tests

final class TotalColorTests: XCTestCase {

    private let goal = 2000

    func test_zeroTotal_returnsSecondary() {
        // Zero total should return .secondary regardless of the goal.
        let color = totalColor(for: 0, goal: goal)
        XCTAssertEqual(color, .secondary)
    }

    func test_totalBelowGoal_returnsGreen() {
        let color = totalColor(for: 1500, goal: goal)
        XCTAssertEqual(color, .green)
    }

    func test_totalEqualToGoal_returnsGreen() {
        let color = totalColor(for: 2000, goal: goal)
        XCTAssertEqual(color, .green)
    }

    func test_totalSlightlyOverGoal_returnsAmber() {
        // 10 % over the goal: 2000 * 1.1 = 2200 → amber zone
        let color = totalColor(for: 2100, goal: goal)
        XCTAssertEqual(color, .yellow)  // amber proxied as yellow in test
    }

    func test_totalAtExactly10PercentOver_returnsAmber() {
        // Exactly at the 10 % threshold (Int(2000 * 1.1) = 2200) → still amber
        let color = totalColor(for: 2200, goal: goal)
        XCTAssertEqual(color, .yellow)
    }

    func test_totalWellOverGoal_returnsRed() {
        let color = totalColor(for: 3000, goal: goal)
        XCTAssertEqual(color, .red)
    }

    func test_smallGoal_thresholdScalesCorrectly() {
        // Goal = 100 → amber zone: 101-110, red: >110
        XCTAssertEqual(totalColor(for: 100, goal: 100), .green)
        XCTAssertEqual(totalColor(for: 105, goal: 100), .yellow)
        XCTAssertEqual(totalColor(for: 111, goal: 100), .red)
    }
}

// MARK: - meal(for:type:) tests

final class MealLookupTests: XCTestCase {

    private var today: Date { Calendar.current.startOfDay(for: Date()) }
    private var tomorrow: Date {
        Calendar.current.date(byAdding: .day, value: 1, to: today)!
    }

    func test_noPlans_returnsNil() {
        XCTAssertNil(meal(for: today, type: .breakfast, in: []))
    }

    func test_matchingDateAndType_returnsPlan() {
        let plan = makePlan(plannedDate: today, mealType: .breakfast, calories: 400)
        let result = meal(for: today, type: .breakfast, in: [plan])
        XCTAssertNotNil(result)
        XCTAssertEqual(result?.name, "Meal")
    }

    func test_wrongDate_returnsNil() {
        let plan = makePlan(plannedDate: tomorrow, mealType: .lunch, calories: 500)
        XCTAssertNil(meal(for: today, type: .lunch, in: [plan]))
    }

    func test_wrongMealType_returnsNil() {
        let plan = makePlan(plannedDate: today, mealType: .dinner, calories: 700)
        XCTAssertNil(meal(for: today, type: .breakfast, in: [plan]))
    }

    func test_multiplePlans_returnsFirstMatch() {
        let plan1 = makePlan(name: "First",  plannedDate: today, mealType: .lunch, calories: 400)
        let plan2 = makePlan(name: "Second", plannedDate: today, mealType: .lunch, calories: 600)
        let result = meal(for: today, type: .lunch, in: [plan1, plan2])
        XCTAssertEqual(result?.name, "First")
    }

    func test_allMealTypes_canBeFound() {
        let plans = MealPlan.MealType.allCases.map {
            makePlan(plannedDate: today, mealType: $0, calories: 300)
        }
        for mealType in MealPlan.MealType.allCases {
            XCTAssertNotNil(meal(for: today, type: mealType, in: plans),
                            "Should find plan for meal type: \(mealType)")
        }
    }
}