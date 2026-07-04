import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './routes/ProtectedRoute'
import { AppShell } from './components/layout/AppShell'
import { LoginPage } from './pages/auth/LoginPage'
import { SignupPage } from './pages/auth/SignupPage'
import { HomePage } from './pages/HomePage'
import { RoutinePage } from './pages/RoutinePage'
import { CalendarPage } from './pages/CalendarPage'
import { DashboardPage } from './pages/DashboardPage'
import { ProfilePage } from './pages/ProfilePage'
import { SetupPage } from './pages/SetupPage'
import { isSupabaseConfigured } from './lib/supabase'

export default function App() {
  if (!isSupabaseConfigured) return <SetupPage />

  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/registro" element={<SignupPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/rutina" element={<RoutinePage />} />
              <Route path="/calendario" element={<CalendarPage />} />
              <Route path="/progreso" element={<DashboardPage />} />
              <Route path="/perfil" element={<ProfilePage />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
