import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './routes/ProtectedRoute'
import { AppShell } from './components/layout/AppShell'
import { LoginPage } from './pages/auth/LoginPage'
import { SignupPage } from './pages/auth/SignupPage'
import { HomePage } from './pages/HomePage'
import { WorkoutPage } from './pages/WorkoutPage'
import { RoutinePage } from './pages/RoutinePage'
import { DietPage } from './pages/DietPage'
import { CalendarPage } from './pages/CalendarPage'
import { ProfilePage } from './pages/ProfilePage'
import { SetupPage } from './pages/SetupPage'
import { Spinner } from './components/ui/Spinner'
import { isSupabaseConfigured } from './lib/supabase'

// Recharts pesa ~380 KB: la página de Progreso se carga solo al entrar
const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
)

export default function App() {
  if (!isSupabaseConfigured) return <SetupPage />

  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/registro" element={<SignupPage />} />
          <Route element={<ProtectedRoute />}>
            {/* Modo entrenamiento: pantalla completa, sin nav inferior */}
            <Route path="/entrenar" element={<WorkoutPage />} />
            <Route element={<AppShell />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/rutina" element={<RoutinePage />} />
              <Route path="/dieta" element={<DietPage />} />
              <Route path="/calendario" element={<CalendarPage />} />
              <Route
                path="/progreso"
                element={
                  <Suspense
                    fallback={
                      <div className="flex justify-center py-20">
                        <Spinner />
                      </div>
                    }
                  >
                    <DashboardPage />
                  </Suspense>
                }
              />
              <Route path="/perfil" element={<ProfilePage />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
