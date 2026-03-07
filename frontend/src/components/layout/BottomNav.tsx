import { useLocation, useNavigate } from 'react-router-dom'

function TasksIcon({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
  )
}

function StatsIcon({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="18" y="3" width="4" height="18" rx="1" />
      <rect x="10" y="8" width="4" height="13" rx="1" />
      <rect x="2" y="13" width="4" height="8" rx="1" />
    </svg>
  )
}

function HouseholdIcon({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9,22 9,12 15,12 15,22" />
    </svg>
  )
}

function GroceryIcon({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 01-8 0" />
    </svg>
  )
}

const NAV = [
  { id: '/', label: 'Tasks', Icon: TasksIcon },
  { id: '/grocery', label: 'Grocery', Icon: GroceryIcon },
  { id: '/stats', label: 'Stats', Icon: StatsIcon },
  { id: '/household', label: 'Household', Icon: HouseholdIcon },
]

const ACCENT = '#6366f1'
const MUTED = '#a1a1aa'

export function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: 520, background: 'white',
      borderTop: '1px solid #e4e4e7', display: 'flex',
      paddingBottom: 'env(safe-area-inset-bottom, 8px)',
      zIndex: 40,
    }}>
      {NAV.map(({ id, label, Icon }) => {
        const isActive = location.pathname === id
        const color = isActive ? ACCENT : MUTED
        return (
          <button
            key={id}
            onClick={() => navigate(id)}
            style={{
              flex: 1, background: 'none', border: 'none',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '10px 0 10px', gap: 4, cursor: 'pointer', position: 'relative',
            }}
          >
            <span style={{
              position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
              width: isActive ? 24 : 0, height: 2, borderRadius: '0 0 2px 2px',
              background: ACCENT, transition: 'width 0.2s ease',
            }} />
            <Icon color={color} />
            <span style={{
              fontSize: 10, fontWeight: 600,
              color, transition: 'color 0.15s',
              letterSpacing: 0.2,
            }}>{label}</span>
          </button>
        )
      })}
    </div>
  )
}
