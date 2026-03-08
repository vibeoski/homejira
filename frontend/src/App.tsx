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
import { ReferralPage } from './pages/ReferralPage'
import { GroceryPage } from './pages/GroceryPage'
import { VerifyEmailPage } from './pages/VerifyEmailPage'

export default function App() {
  const { fetchTasks, fetchMembers } = useStore()
  const { isAuthenticated } = useAuthStore()

  useEffect(() => {
    if (isAuthenticated) {
      fetchMembers()
      fetchTasks()
    }
  }, [isAuthenticated, fetchTasks, fetchMembers])

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/auth"
          element={isAuthenticated ? <Navigate to="/" replace /> : <AuthPage />}
        />

        <Route
          path="/"
          element={isAuthenticated ? <AppLayout /> : <Navigate to="/auth" replace />}
        >
          <Route index element={<TasksPage />} />
          <Route path="grocery" element={<GroceryPage />} />
          <Route path="stats" element={<StatsPage />} />
          <Route path="household" element={<MembersPage />} />
        </Route>

        <Route path="/join/:token" element={<JoinPage />} />
        <Route path="/refer/:token" element={<ReferralPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />

        <Route path="*" element={<Navigate to={isAuthenticated ? '/' : '/auth'} replace />} />
      </Routes>
    </BrowserRouter>
  )
}
