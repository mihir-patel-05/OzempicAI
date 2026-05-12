import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { LoginScreen } from './auth/LoginScreen'
import { RequireAuth } from './auth/RequireAuth'
import { Shell } from './components/Shell'
import { TodayScreen } from './features/today/TodayScreen'
import { LogScreen } from './features/log/LogScreen'
import { PlansScreen } from './features/plans/PlansScreen'
import { ProfileScreen } from './features/profile/ProfileScreen'

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
