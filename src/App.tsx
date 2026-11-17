import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { AuthorizeAppScreen } from './auth/AuthorizeAppScreen'
import { LoginScreen } from './auth/LoginScreen'
import { RequireAuth } from './auth/RequireAuth'
import { ResetPasswordScreen } from './auth/ResetPasswordScreen'
import { Shell } from './components/Shell'
import { TodayScreen } from './features/today/TodayScreen'
import { LogScreen } from './features/log/LogScreen'
import { PlansScreen } from './features/plans/PlansScreen'
import { ProfileScreen } from './features/profile/ProfileScreen'
import { CalorieScreen } from './features/calories/CalorieScreen'
import { WaterScreen } from './features/water/WaterScreen'
import { WeightScreen } from './features/weight/WeightScreen'
import { ExerciseScreen } from './features/exercise/ExerciseScreen'
import { HeartRateScreen } from './features/heartRate/HeartRateScreen'
import { WorkoutTrackerScreen } from './features/workouts/WorkoutTrackerScreen'
import { FastingScreen } from './features/fasting/FastingScreen'

const CoachScreen = lazy(() =>
  import('./features/coach/CoachScreen').then((module) => ({
    default: module.CoachScreen,
  })),
)

const AnalyticsScreen = lazy(() =>
  import('./features/analytics/AnalyticsScreen').then((module) => ({
    default: module.AnalyticsScreen,
  })),
)

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/reset-password" element={<ResetPasswordScreen />} />
        {/* OAuth consent for AI apps connecting over MCP; outside the tab shell. */}
        <Route
          path="/oauth/authorize"
          element={
            <RequireAuth>
              <AuthorizeAppScreen />
            </RequireAuth>
          }
        />
        <Route
          path="/*"
          element={
            <RequireAuth>
              <Shell>
                <Routes>
                  <Route index element={<TodayScreen />} />
                  <Route path="log" element={<LogScreen />} />
                  <Route path="log/calories" element={<CalorieScreen />} />
                  <Route path="log/water" element={<WaterScreen />} />
                  <Route path="log/weight" element={<WeightScreen />} />
                  <Route path="log/exercise" element={<ExerciseScreen />} />
                  <Route path="log/workout" element={<WorkoutTrackerScreen />} />
                  <Route path="log/heart-rate" element={<HeartRateScreen />} />
                  <Route path="plans" element={<PlansScreen />} />
                  <Route path="fasting" element={<FastingScreen />} />
                  <Route
                    path="analytics"
                    element={
                      <Suspense fallback={<p role="status">Loading analytics…</p>}>
                        <AnalyticsScreen />
                      </Suspense>
                    }
                  />
                  <Route
                    path="coach"
                    element={
                      <Suspense fallback={<p role="status">Loading your coach…</p>}>
                        <CoachScreen />
                      </Suspense>
                    }
                  />
                  <Route path="profile" element={<ProfileScreen />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Shell>
            </RequireAuth>
          }
        />
      </Routes>
    </AuthProvider>
  )
}
