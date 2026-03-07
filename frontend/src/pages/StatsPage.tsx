import { Navigate } from 'react-router-dom'
import { useStore } from '../store'
import { useAuthStore } from '../store/authStore'
import { StatsScreen } from '../components/stats/StatsScreen'
import { AccountMenu } from '../components/layout/AccountMenu'
import { AppLogo } from '../components/ui/AppLogo'

export function StatsPage() {
  const { tasks, members } = useStore()
  const { member, isGuest } = useAuthStore()

  if (!isGuest && member && !member.household_id) {
    return <Navigate to="/household" replace />
  }

  return (
    <>
      <div style={{
        background: 'white', padding: '16px 16px 14px',
        borderBottom: '1px solid #e4e4e7', position: 'sticky', top: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <AppLogo size={30} />
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#18181b', letterSpacing: -0.3 }}>Stats</h1>
        </div>
        <AccountMenu />
      </div>
      <StatsScreen tasks={tasks} members={members} />
    </>
  )
}
