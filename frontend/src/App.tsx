import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useStore } from './store'
import { useAuthStore } from './store/authStore'
import { useConfigStore } from './store/configStore'
import { AppLayout } from './components/layout/AppLayout'
import { DesktopLayout } from './components/layout/desktop/DesktopLayout'
import { useBreakpoint } from './hooks/useBreakpoint'
import { TasksPage } from './pages/TasksPage'
import { StatsPage } from './pages/StatsPage'
import { MembersPage } from './pages/MembersPage'
import { AuthPage } from './pages/AuthPage'
import { JoinPage } from './pages/JoinPage'
import { ReferralPage } from './pages/ReferralPage'
import { GroceryPage } from './pages/GroceryPage'

export function App() {
  const { fetchTasks, fetchMembers } = useStore()
  const { isAuthenticated, isGuest } = useAuthStore()
  const { fetchConfig } = useConfigStore()
  const canAccessApp = isAuthenticated || isGuest
  const isDesktop = useBreakpoint()
  const Layout = isDesktop ? DesktopLayout : AppLayout

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  useEffect(() => {
    if (canAccessApp) {
      fetchMembers()
      fetchTasks()
    }
  }, [canAccessApp, fetchTasks, fetchMembers])

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/auth"
          element={canAccessApp ? <Navigate to="/" replace /> : <AuthPage />}
        />

        <Route
          path="/"
          element={canAccessApp ? <Layout /> : <Navigate to="/auth" replace />}
        >
          <Route index element={<TasksPage />} />
          <Route path="grocery" element={<GroceryPage />} />
          <Route path="stats" element={<StatsPage />} />
          <Route path="household" element={<MembersPage />} />
        </Route>

        <Route path="/join/:token" element={<JoinPage />} />
        <Route path="/refer/:token" element={<ReferralPage />} />

        <Route path="*" element={<Navigate to={canAccessApp ? '/' : '/auth'} replace />} />
      </Routes>
    </BrowserRouter>
  )
}
