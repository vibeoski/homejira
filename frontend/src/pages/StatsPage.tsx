import { Navigate } from 'react-router-dom'
import { useStore } from '../store'
import { useAuthStore } from '../store/authStore'
import { StatsScreen } from '../components/stats/StatsScreen'

export function StatsPage() {
  const { tasks, members } = useStore()
  const { member, isGuest } = useAuthStore()

  if (!isGuest && member && !member.household_id) {
    return <Navigate to="/household" replace />
  }

  return <StatsScreen tasks={tasks} members={members} />
}
