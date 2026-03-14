import { useStore } from '../store'
import { useAuthStore } from '../store/authStore'
import { MembersScreen } from '../components/members/MembersScreen'
import { HouseholdPanel } from '../components/members/HouseholdPanel'
import { GuestOnlyNotice } from '../components/ui/GuestOnlyNotice'
export function MembersPage() {
  const { tasks, members } = useStore()
  const { member, isGuest } = useAuthStore()

  return (
    <>
      <div style={{
        background: 'white', padding: '12px 16px',
        borderBottom: '1px solid #ede8e1', position: 'sticky', top: 57, zIndex: 49,
      }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, color: '#78716c', margin: 0, letterSpacing: 0.2 }}>Household</h2>
      </div>
      {isGuest ? (
        <GuestOnlyNotice
          title="Households need a real account"
          description="Guest mode lets you preview task management locally. Create an account to invite people, join a household, and sync updates in real time."
        />
      ) : (
        <>
          <HouseholdPanel />
          {!!member?.household_id && (
        <MembersScreen
          tasks={tasks}
          members={members}
          currentMember={member}
          isAdmin={member.role === 'admin'}
        />
          )}
        </>
      )}
    </>
  )
}
