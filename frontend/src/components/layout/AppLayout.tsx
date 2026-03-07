import { useEffect, useRef } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { GuestBanner } from './GuestBanner'
import { useAuthStore } from '../../store/authStore'
import { authApi } from '../../api/auth'
import { useStore } from '../../store'

export function AppLayout() {
  const { isGuest, isAuthenticated, token, setAuth } = useAuthStore()
  const { fetchTasks, fetchMembers, bumpSse } = useStore()
  const navigate = useNavigate()
  const esRef = useRef<EventSource | null>(null)

  // SSE: subscribe to live updates for authenticated users.
  // EventSource reconnects automatically on drop; we close and recreate when token changes.
  useEffect(() => {
    if (!isAuthenticated || !token) return

    // Initial data load
    fetchTasks()
    fetchMembers()

    const apiBase = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api/v1'
    const es = new EventSource(`${apiBase}/events?token=${encodeURIComponent(token)}`)
    esRef.current = es

    es.onmessage = async () => {
      bumpSse()
      await fetchMembers()
      fetchTasks()

      // Detect removal: if we were in a household but are no longer in the members list,
      // refresh the token (gets fresh household_id) and redirect.
      const currentMember = useAuthStore.getState().member
      if (currentMember?.household_id) {
        const stillPresent = useStore.getState().members.some((m) => m.id === currentMember.id)
        if (!stillPresent) {
          try {
            const { token: newToken, member: fresh } = await authApi.refresh()
            setAuth(newToken, fresh)
          } catch {}
          navigate('/household')
        }
      }
    }

    return () => {
      es.close()
      esRef.current = null
    }
  }, [isAuthenticated, token])

  // Guest mode: poll every 2s (local storage only, no network cost)
  useEffect(() => {
    if (!isGuest) return
    fetchTasks()
    fetchMembers()
    const interval = setInterval(() => {
      fetchTasks()
      fetchMembers()
    }, 2000)
    return () => clearInterval(interval)
  }, [isGuest])

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', minHeight: '100vh', background: '#f4f4f5', position: 'relative' }}>
      {isGuest && <GuestBanner />}
      <Outlet />
      <BottomNav />
    </div>
  )
}
