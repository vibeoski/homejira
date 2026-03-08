import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

export function GuestBanner() {
  const navigate = useNavigate()
  const { clearGuest } = useAuthStore()

  const handleLogin = () => {
    clearGuest()
    navigate('/auth')
  }

  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 60,
      background: '#18181b', color: 'white',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '9px 16px', gap: 12,
    }}>
      <span style={{ fontSize: 12, color: '#a1a1aa', lineHeight: 1.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        Guest mode · Data stored locally
      </span>
      <button
        onClick={handleLogin}
        style={{
          flexShrink: 0, padding: '5px 12px', borderRadius: 6,
          background: '#6366f1', border: 'none', color: 'white',
          fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
        }}
      >Sign in</button>
    </div>
  )
}
