import { useStore } from '../store'
import { useAuthStore } from '../store/authStore'
import { MembersScreen } from '../components/members/MembersScreen'
import { HouseholdPanel } from '../components/members/HouseholdPanel'
import { useBreakpoint } from '../hooks/useBreakpoint'

export function MembersPage() {
  const { tasks, members } = useStore()
  const { member } = useAuthStore()
  const isDesktop = useBreakpoint()

  return (
    <>
      <div style={{ background: 'white', padding: '12px 16px', borderBottom: '1px solid #ede8e1', position: 'sticky', top: 57, zIndex: 49 }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, color: '#78716c', margin: 0, letterSpacing: 0.2 }}>Household</h2>
      </div>
      {isDesktop ? (
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          <div style={{ width: 380, flexShrink: 0, borderRight: '1px solid #ede8e1' }}>
            <HouseholdPanel />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {!!member?.household_id && (
              <MembersScreen
                tasks={tasks}
                members={members}
                currentMember={member}
                isAdmin={member.role === 'admin'}
              />
            )}
          </div>
        </div>
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
