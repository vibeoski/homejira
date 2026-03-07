import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { coinsApi, type Referrer } from '../api/coins'

const ACCENT = '#6366f1'

export function ReferralPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()

  const [referrer, setReferrer] = useState<Referrer | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) { navigate('/'); return }
    coinsApi.getReferrer(token)
      .then(setReferrer)
      .catch(() => setError('This referral link is invalid or has expired.'))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const handleGetStarted = () => {
    if (token) localStorage.setItem('hj_pending_referral', token)
    navigate('/auth', { replace: true })
  }

  if (loading) {
    return (
      <div style={pageStyle}>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Loading…</p>
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
        {/* App icon */}
        <div style={{
          width: 64, height: 64, borderRadius: 18, background: '#eef2ff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8,
        }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            <polyline points="9,22 9,12 15,12 15,22" />
          </svg>
        </div>

        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase', margin: '0 0 20px' }}>
          HomeJira
        </p>

        {/* Referrer avatar */}
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: referrer ? referrer.color + '20' : '#f4f4f5',
          border: `3px solid ${referrer?.color ?? '#e4e4e7'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 30, marginBottom: 14,
        }}>
          {referrer?.avatar ?? '👤'}
        </div>

        <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px', textAlign: 'center', letterSpacing: -0.3 }}>
          {referrer?.name} invited you!
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 28px', textAlign: 'center', lineHeight: 1.6, maxWidth: 280 }}>
          Join HomeJira — the easiest way to manage household tasks together with your family.
        </p>

        <button style={btnStyle} onClick={handleGetStarted}>
          Sign up &amp; get started
        </button>

        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 16, textAlign: 'center' }}>
          Free forever · No credit card required
        </p>
      </div>
    </div>
  )
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: 'var(--bg-muted)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '20px 16px',
}

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-surface)',
  borderRadius: 20,
  border: '1px solid var(--border)',
  padding: '36px 28px',
  width: '100%',
  maxWidth: 360,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
}

const btnStyle: React.CSSProperties = {
  width: '100%',
  padding: '13px 0',
  borderRadius: 10,
  border: 'none',
  background: ACCENT,
  color: 'white',
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
}
