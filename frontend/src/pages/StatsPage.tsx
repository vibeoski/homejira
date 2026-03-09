import { Navigate } from 'react-router-dom'
import { useStore } from '../store'
import { useAuthStore } from '../store/authStore'
import { StatsScreen } from '../components/stats/StatsScreen'

export function StatsPage() {
  const { tasks, members } = useStore()
  const { member } = useAuthStore()

  if (member && !member.household_id) {
    return <Navigate to="/household" replace />
  }

  return (
    <>
      <div style={{
        background: 'white', padding: '12px 16px',
        borderBottom: '1px solid #ede8e1', position: 'sticky', top: 57, zIndex: 49,
      }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, color: '#78716c', margin: 0, letterSpacing: 0.2 }}>Stats</h2>
      </div>
      <StatsScreen tasks={tasks} members={members} />
    </>
  )
}
