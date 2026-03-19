import { useLocation, useNavigate } from 'react-router-dom'
import { SIDE_NAV_WIDTH, TOP_BAR_HEIGHT } from '../../../constants/layout'

const ACCENT = '#6366f1'
const MUTED = '#78716c'

function TasksIcon({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
  )
}

function GroceryIcon({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 01-8 0" />
    </svg>
  )
}

function StatsIcon({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="18" y="3" width="4" height="18" rx="1" />
      <rect x="10" y="8" width="4" height="13" rx="1" />
      <rect x="2" y="13" width="4" height="8" rx="1" />
    </svg>
  )
}

function HouseholdIcon({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9,22 9,12 15,12 15,22" />
    </svg>
  )
}

const NAV = [
  { id: '/', label: 'Tasks', Icon: TasksIcon },
  { id: '/grocery', label: 'Grocery', Icon: GroceryIcon },
  { id: '/stats', label: 'Stats', Icon: StatsIcon },
  { id: '/household', label: 'Household', Icon: HouseholdIcon },
]

export function SideNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const navItems = NAV

  return (
    <div style={{
      width: SIDE_NAV_WIDTH,
      flexShrink: 0,
      background: 'white',
      borderRight: '1px solid #ede8e1',
      display: 'flex',
      flexDirection: 'column',
      position: 'sticky',
      top: TOP_BAR_HEIGHT,
      height: `calc(100vh - ${TOP_BAR_HEIGHT}px)`,
      overflowY: 'auto',
      paddingTop: 12,
    }}>
      {navItems.map(({ id, label, Icon }) => {
        const isActive = location.pathname === id
        return (
          <button
            key={id}
            onClick={() => navigate(id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              margin: '2px 10px',
              padding: '9px 12px',
              borderRadius: 8,
              border: 'none',
              background: isActive ? '#eef2ff' : 'transparent',
              color: isActive ? ACCENT : MUTED,
              fontSize: 14,
              fontWeight: isActive ? 700 : 500,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            <Icon color={isActive ? ACCENT : MUTED} />
            {label}
          </button>
        )
      })}
    </div>
  )
}
