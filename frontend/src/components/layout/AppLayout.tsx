import { useEffect, useRef } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { GuestBanner } from './GuestBanner'
import { AccountMenu } from './AccountMenu'
import { AppLogo } from '../ui/AppLogo'
import { useAuthStore } from '../../store/authStore'
import { authApi } from '../../api/auth'
import { useStore } from '../../store'
import { useThemeStore, resolveTheme } from '../../store/themeStore'

export function AppLayout() {
  const { isGuest, isAuthenticated, token, setAuth } = useAuthStore()
  const { fetchTasks, fetchMembers, bumpSse } = useStore()
  const navigate = useNavigate()
  const esRef = useRef<EventSource | null>(null)
  const { theme } = useThemeStore()

  // Apply resolved theme to <html> so CSS vars cascade everywhere
  useEffect(() => {
    const apply = () => {
      document.documentElement.setAttribute('data-theme', resolveTheme(theme))
    }
    apply()
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      mq.addEventListener('change', apply)
      return () => mq.removeEventListener('change', apply)
    }
  }, [theme])

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGuest])

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', minHeight: '100vh', background: 'var(--bg-app)', position: 'relative' }}>
      {isGuest && <GuestBanner />}
      {/* Persistent top bar — visible on every screen */}
      <div style={{
        background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)',
        position: 'sticky', top: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', height: 57, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <AppLogo size={30} />
          <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: -0.3 }}>HomeJira</span>
        </div>
        <AccountMenu />
      </div>
      <Outlet />
      <BottomNav />
    </div>
  )
}
