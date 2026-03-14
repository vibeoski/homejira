import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

const ACCENT = '#6366f1'

export function GuestBanner() {
  const navigate = useNavigate()
  const { clearGuest } = useAuthStore()

  const leaveGuestMode = (mode: 'login' | 'register') => {
    clearGuest()
    navigate(`/auth?mode=${mode}`)
  }

  return (
    <div style={{
      padding: '10px 16px',
      background: '#eef2ff',
      borderBottom: '1px solid #c7d2fe',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      justifyContent: 'space-between',
      flexWrap: 'wrap',
    }}>
      <div>
        <p style={{ fontSize: 11, fontWeight: 700, color: ACCENT, margin: 0, letterSpacing: 0.7, textTransform: 'uppercase' }}>
          Guest mode
        </p>
        <p style={{ fontSize: 12, color: '#4338ca', margin: '2px 0 0' }}>
          Preview tasks saved only on this device. No account yet.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={() => leaveGuestMode('login')}
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid #c7d2fe',
            background: 'white',
            color: ACCENT,
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => leaveGuestMode('register')}
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            border: 'none',
            background: ACCENT,
            color: 'white',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Create account
        </button>
      </div>
    </div>
  )
}
