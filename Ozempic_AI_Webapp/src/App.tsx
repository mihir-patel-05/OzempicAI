import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { LoginScreen } from './auth/LoginScreen'
import { RequireAuth } from './auth/RequireAuth'
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

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginScreen />} />
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
                  <Route path="log/heart-rate" element={<HeartRateScreen />} />
                  <Route path="plans" element={<PlansScreen />} />
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
