import { useEffect, useRef } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { AccountMenu } from './AccountMenu'
import { AppLogo } from '../ui/AppLogo'
import { useAuthStore } from '../../store/authStore'
import { authApi } from '../../api/auth'
import { useStore } from '../../store'

export function AppLayout() {
  const { isAuthenticated, token, setAuth } = useAuthStore()
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, token])

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', minHeight: '100vh', position: 'relative', background: 'radial-gradient(ellipse 140% 45% at 60% 0%, rgba(199,210,254,0.65) 0%, transparent 65%), radial-gradient(ellipse 100% 35% at 5% 100%, rgba(167,243,208,0.45) 0%, transparent 65%), radial-gradient(ellipse 80% 30% at 100% 55%, rgba(253,230,138,0.4) 0%, transparent 65%), #faf7f2' }}>
      {/* Persistent top bar — visible on every screen */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', height: 57, flexShrink: 0,
        background: 'white', borderBottom: '1px solid #ede8e1',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <AppLogo size={30} />
          <span style={{ fontSize: 18, fontWeight: 700, color: '#1c1917', letterSpacing: -0.3 }}>HomeJira</span>
        </div>
        <AccountMenu />
      </div>
      <Outlet />
      <BottomNav />
    </div>
  )
}
