import { useEffect, useRef } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { SideNav } from './SideNav'
import { AccountMenu } from '../AccountMenu'
import { AppLogo } from '../../ui/AppLogo'
import { useAuthStore } from '../../../store/authStore'
import { authApi } from '../../../api/auth'
import { useStore } from '../../../store'
import { TOP_BAR_HEIGHT } from '../../../constants/layout'

export function DesktopLayout() {
  const { isAuthenticated, token, setAuth } = useAuthStore()
  const { fetchTasks, fetchMembers, bumpSse } = useStore()
  const navigate = useNavigate()
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!isAuthenticated || !token) return

    fetchTasks()
    fetchMembers()

    const apiBase = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api/v1'
    const es = new EventSource(`${apiBase}/events?token=${encodeURIComponent(token)}`)
    esRef.current = es

    es.onmessage = async () => {
      bumpSse()
      await fetchMembers()
      fetchTasks()

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
    <div style={{ minHeight: '100vh', background: '#faf7f2', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{
        background: 'white',
        borderBottom: '1px solid #ede8e1',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        height: TOP_BAR_HEIGHT,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <AppLogo size={30} />
          <span style={{ fontSize: 18, fontWeight: 700, color: '#1c1917', letterSpacing: -0.3 }}>HomeJira</span>
        </div>
        <AccountMenu />
      </div>

      {/* Body: sidebar + content */}
      <div style={{ display: 'flex', flex: 1 }}>
        <SideNav />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <Outlet />
        </div>
      </div>
    </div>
  )
}
