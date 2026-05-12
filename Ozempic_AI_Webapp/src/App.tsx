import { Navigate, Route, Routes } from 'react-router-dom'
import { Shell } from './components/Shell'
import { TodayScreen } from './features/today/TodayScreen'
import { LogScreen } from './features/log/LogScreen'
import { PlansScreen } from './features/plans/PlansScreen'
import { ProfileScreen } from './features/profile/ProfileScreen'

export function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<TodayScreen />} />
        <Route path="/log" element={<LogScreen />} />
        <Route path="/plans" element={<PlansScreen />} />
        <Route path="/profile" element={<ProfileScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  )
}
