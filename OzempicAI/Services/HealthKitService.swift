import Foundation
import HealthKit

class HealthKitService {
    private let store = HKHealthStore()

    var isAvailable: Bool { HKHealthStore.isHealthDataAvailable() }

    func requestAuthorization() async throws {
        guard isAvailable else { return }
        let heartRateType = HKQuantityType(.heartRate)
        let workoutType = HKObjectType.workoutType()
        try await store.requestAuthorization(toShare: [], read: [heartRateType, workoutType])
    }

    func fetchRestingHeartRate() async throws -> Double? {
        let heartRateType = HKQuantityType(.heartRate)
        let sortDescriptor = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)
        return try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: heartRateType,
                predicate: nil,
                limit: 1,
                sortDescriptors: [sortDescriptor]
            ) { _, samples, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                let bpm = (samples?.first as? HKQuantitySample)?
                    .quantity.doubleValue(for: .init(from: "count/min"))
                continuation.resume(returning: bpm)
            }
            store.execute(query)
        }
    }

    func fetchWorkouts(since startDate: Date = Calendar.current.date(byAdding: .day, value: -30, to: .now)!) async throws -> [HKWorkout] {
        let workoutType = HKObjectType.workoutType()
        let predicate = HKQuery.predicateForSamples(withStart: startDate, end: .now, options: .strictStartDate)
        let sortDescriptor = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)

        return try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: workoutType,
                predicate: predicate,
                limit: HKObjectQueryNoLimit,
                sortDescriptors: [sortDescriptor]
            ) { _, samples, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                let workouts = (samples as? [HKWorkout]) ?? []
                continuation.resume(returning: workouts)
            }
            store.execute(query)
        }
    }

    // MARK: - HKWorkout → ExerciseLog Mapping

    static func mapCategory(_ type: HKWorkoutActivityType) -> ExerciseLog.ExerciseCategory {
        switch type {
        case .running, .cycling, .swimming, .walking, .hiking,
             .elliptical, .rowing, .stairClimbing, .jumpRope:
            return .cardio
        case .traditionalStrengthTraining, .functionalStrengthTraining:
            return .strength
        case .yoga, .pilates, .flexibility:
            return .flexibility
        case .basketball, .soccer, .tennis, .baseball, .volleyball,
             .hockey, .golf, .tableTennis, .badminton, .racquetball:
            return .sports
        default:
            return .other
        }
    }

    static func displayName(for type: HKWorkoutActivityType) -> String {
        switch type {
        case .running: return "Running"
        case .cycling: return "Cycling"
        case .swimming: return "Swimming"
        case .walking: return "Walking"
        case .hiking: return "Hiking"
        case .elliptical: return "Elliptical"
        case .rowing: return "Rowing"
        case .stairClimbing: return "Stair Climbing"
        case .jumpRope: return "Jump Rope"
        case .traditionalStrengthTraining: return "Strength Training"
        case .functionalStrengthTraining: return "Functional Training"
        case .yoga: return "Yoga"
        case .pilates: return "Pilates"
        case .flexibility: return "Flexibility"
        case .basketball: return "Basketball"
        case .soccer: return "Soccer"
        case .tennis: return "Tennis"
        case .baseball: return "Baseball"
        case .volleyball: return "Volleyball"
        case .hockey: return "Hockey"
        case .golf: return "Golf"
        default: return "Workout"
        }
    }
}
