import { useStore } from '../store'
import { useAuthStore } from '../store/authStore'
import { MembersScreen } from '../components/members/MembersScreen'
import { HouseholdPanel } from '../components/members/HouseholdPanel'
import { HouseholdPromo } from '../components/members/HouseholdPromo'

export function MembersPage() {
  const { tasks, members } = useStore()
  const { member } = useAuthStore()

  return (
    <>
      <div style={{
        background: 'var(--bg-surface)', padding: '12px 16px',
        borderBottom: '1px solid var(--border)', position: 'sticky', top: 57, zIndex: 49,
      }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', margin: 0, letterSpacing: 0.2 }}>Household</h2>
      </div>
      <HouseholdPanel />
      {!!member?.household_id && (
        <MembersScreen
          tasks={tasks}
          members={members}
          currentMember={member}
          isAdmin={member.role === 'admin'}
        />
      )}
      <HouseholdPromo />
    </>
  )
}
