import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { householdsApi, type Household } from '../api/households'
import { useAuthStore } from '../store/authStore'

const ACCENT = '#6366f1'

export function JoinPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()

  const [household, setHousehold] = useState<Household | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)

  // Resolve the token to a household name
  useEffect(() => {
    if (!token) { navigate('/'); return }
    householdsApi.getByInviteToken(token)
      .then(({ household }) => setHousehold(household))
      .catch(() => setError('This invite link is invalid or has expired.'))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // If already authenticated, auto-join and redirect
  useEffect(() => {
    if (!loading && household && isAuthenticated) {
      setJoining(true)
      householdsApi.joinByInviteToken(token!)
        .then(() => navigate('/household', { replace: true }))
        .catch((err: unknown) => {
          setJoining(false)
          setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to join household.')
        })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, household, isAuthenticated])

  const handleSignUpAndJoin = () => {
    localStorage.setItem('hj_pending_join', token!)
    navigate('/auth', { replace: true })
  }

  if (loading || joining) {
    return (
      <div style={pageStyle}>
        <p style={{ color: '#71717a', fontSize: 14 }}>
          {joining ? 'Joining household…' : 'Loading…'}
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <p style={{ color: '#ef4444', fontSize: 14, marginBottom: 20 }}>{error}</p>
          <button style={btnStyle} onClick={() => navigate('/')}>Go home</button>
        </div>
      </div>
    )
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={{
          width: 56, height: 56, borderRadius: 16, background: '#eef2ff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18,
        }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            <polyline points="9,22 9,12 15,12 15,22" />
          </svg>
        </div>

        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#18181b', margin: '0 0 8px', textAlign: 'center' }}>
          You're invited!
        </h1>
        <p style={{ fontSize: 14, color: '#71717a', margin: '0 0 4px', textAlign: 'center' }}>
          Join
        </p>
        <p style={{ fontSize: 16, fontWeight: 700, color: ACCENT, margin: '0 0 24px', textAlign: 'center' }}>
          {household?.name}
        </p>

        <button style={btnStyle} onClick={handleSignUpAndJoin}>
          Sign up &amp; join
        </button>

        <button
          onClick={handleSignUpAndJoin}
          style={{
            marginTop: 10, width: '100%', padding: '12px 0', borderRadius: 10,
            border: '1px solid #e4e4e7', background: 'white',
            color: '#18181b', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Sign in
        </button>
      </div>
    </div>
  )
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: '#f4f4f5',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '20px 16px',
}

const cardStyle: React.CSSProperties = {
  background: 'white',
  borderRadius: 16,
  border: '1px solid #e4e4e7',
  padding: '32px 28px',
  width: '100%',
  maxWidth: 360,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
}

const btnStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 0',
  borderRadius: 10,
  border: 'none',
  background: ACCENT,
  color: 'white',
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
}
