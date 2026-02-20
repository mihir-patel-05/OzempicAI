import Foundation
import HealthKit

class HealthKitService {
    private let store = HKHealthStore()

    var isAvailable: Bool { HKHealthStore.isHealthDataAvailable() }

    func requestAuthorization() async throws {
        guard isAvailable else { return }
        let heartRateType = HKQuantityType(.heartRate)
        try await store.requestAuthorization(toShare: [], read: [heartRateType])
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
}
