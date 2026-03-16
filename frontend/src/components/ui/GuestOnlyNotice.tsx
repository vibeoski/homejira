import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

interface Props {
  title: string
  description: string
}

const ACCENT = '#6366f1'

export function GuestOnlyNotice({ title, description }: Props) {
  const navigate = useNavigate()
  const { clearGuest } = useAuthStore()

  const leaveGuestMode = (mode: 'login' | 'register') => {
    clearGuest()
    navigate(`/auth?mode=${mode}`)
  }

  return (
    <div style={{ padding: '56px 20px 120px', display: 'flex', justifyContent: 'center' }}>
      <div style={{
        width: '100%',
        maxWidth: 360,
        background: 'white',
        border: '1px solid #ede8e1',
        borderRadius: 16,
        padding: '28px 24px',
        textAlign: 'center',
      }}>
        <div style={{
          width: 60,
          height: 60,
          borderRadius: 18,
          background: '#eef2ff',
          color: ACCENT,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24,
          fontWeight: 800,
          margin: '0 auto 18px',
        }}>
          G
        </div>

        <p style={{ fontSize: 11, fontWeight: 700, color: ACCENT, letterSpacing: 0.8, textTransform: 'uppercase', margin: '0 0 10px' }}>
          Guest mode
        </p>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1c1917', margin: '0 0 8px', fontFamily: 'Fraunces, serif' }}>
          {title}
        </h2>
        <p style={{ fontSize: 13, color: '#78716c', lineHeight: 1.6, margin: '0 0 22px' }}>
          {description}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            type="button"
            onClick={() => leaveGuestMode('register')}
            style={{
              width: '100%',
              padding: '12px 0',
              borderRadius: 10,
              border: 'none',
              background: ACCENT,
              color: 'white',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Create account
          </button>
          <button
            type="button"
            onClick={() => leaveGuestMode('login')}
            style={{
              width: '100%',
              padding: '12px 0',
              borderRadius: 10,
              border: '1px solid #ede8e1',
              background: 'white',
              color: '#78716c',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Sign in
          </button>
        </div>
      </div>
    </div>
  )
}
