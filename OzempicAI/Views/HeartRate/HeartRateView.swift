import SwiftUI

struct HeartRateView: View {
    @StateObject private var viewModel = HeartRateViewModel()
    @State private var showManualEntry = false
    @State private var manualBpm = ""

    var body: some View {
        NavigationStack {
            List {
                Section("Resting Heart Rate") {
                    if let bpm = viewModel.restingHeartRate {
                        HStack {
                            Image(systemName: "heart.fill").foregroundStyle(.red)
                            Text("\(Int(bpm)) BPM")
                                .font(.title2.bold())
                        }
                    } else {
                        Text("No data — tap refresh to read from HealthKit")
                            .foregroundStyle(.secondary)
                    }
                }

                Section("Log History") {
                    ForEach(viewModel.logs) { log in
                        HStack {
                            Text("\(log.bpm) BPM")
                            Spacer()
                            Text(log.source.rawValue.capitalized)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
            .navigationTitle("Heart Rate")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button { showManualEntry = true } label: { Image(systemName: "plus") }
                }
                ToolbarItem(placement: .secondaryAction) {
                    Button {
                        Task { await viewModel.fetchFromHealthKit() }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                }
            }
            .alert("Manual Entry", isPresented: $showManualEntry) {
                TextField("BPM", text: $manualBpm).keyboardType(.numberPad)
                Button("Save") {
                    guard let bpm = Int(manualBpm) else { return }
                    Task { await viewModel.logManualReading(bpm: bpm) }
                }
                Button("Cancel", role: .cancel) {}
            }
            .task {
                await viewModel.requestHealthKitAccess()
                await viewModel.loadLogs()
                await viewModel.fetchFromHealthKit()
            }
        }
    }
}
