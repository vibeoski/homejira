import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useStore } from './store'
import { useAuthStore } from './store/authStore'
import { AppLayout } from './components/layout/AppLayout'
import { TasksPage } from './pages/TasksPage'
import { StatsPage } from './pages/StatsPage'
import { MembersPage } from './pages/MembersPage'
import { AuthPage } from './pages/AuthPage'
import { JoinPage } from './pages/JoinPage'
import { GroceryPage } from './pages/GroceryPage'

export default function App() {
  const { fetchTasks, fetchMembers } = useStore()
  const { isAuthenticated, isGuest } = useAuthStore()

  const canAccessApp = isAuthenticated || isGuest

  // Fetch app data once authenticated or in guest mode
  useEffect(() => {
    if (canAccessApp) {
      fetchMembers()
      fetchTasks()
    }
  }, [canAccessApp, fetchTasks, fetchMembers])

  return (
    <BrowserRouter>
      <Routes>
        {/* Auth page: authenticated users go home; guests can still visit to login */}
        <Route
          path="/auth"
          element={isAuthenticated ? <Navigate to="/" replace /> : <AuthPage />}
        />

        {/* App routes: accessible when authenticated or in guest mode */}
        <Route
          path="/"
          element={canAccessApp ? <AppLayout /> : <Navigate to="/auth" replace />}
        >
          <Route index element={<TasksPage />} />
          <Route path="grocery" element={<GroceryPage />} />
          <Route path="stats" element={<StatsPage />} />
          <Route path="household" element={<MembersPage />} />
        </Route>

        {/* Public: shareable household invite link — always accessible */}
        <Route path="/join/:token" element={<JoinPage />} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to={canAccessApp ? '/' : '/auth'} replace />} />
      </Routes>
    </BrowserRouter>
  )
}
