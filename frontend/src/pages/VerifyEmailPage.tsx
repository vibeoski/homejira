import { useEffect, useState } from 'react'
import { client } from '../api/client'

const ACCENT = '#6366f1'

function getToken() {
  return new URLSearchParams(window.location.search).get('token')
}

export function VerifyEmailPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    () => (getToken() ? 'loading' : 'error')
  )

  useEffect(() => {
    const token = getToken()
    if (!token) return
    client.get(`/auth/email/verify?token=${encodeURIComponent(token)}`)
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'))
  }, [])

  return (
    <div style={{
      minHeight: '100vh',
      background: '#faf7f2',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 20px',
    }}>
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 40 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, background: ACCENT,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18,
        }}>🏠</div>
        <span style={{ fontSize: 20, fontWeight: 800, color: '#18181b', fontFamily: 'Fraunces, serif', letterSpacing: -0.5 }}>
          HomeJira
        </span>
      </div>

      <div style={{
        background: 'white',
        borderRadius: 16,
        padding: '40px 32px',
        maxWidth: 380,
        width: '100%',
        border: '1px solid #e4e4e7',
        textAlign: 'center',
      }}>
        {status === 'loading' && (
          <>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', background: '#eef2ff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
              fontSize: 24,
            }}>✉️</div>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#18181b', margin: '0 0 8px' }}>Verifying…</p>
            <p style={{ fontSize: 13, color: '#a1a1aa', margin: 0 }}>Please wait while we verify your email.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', background: '#dcfce7',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <p style={{ fontSize: 17, fontWeight: 800, color: '#15803d', margin: '0 0 8px' }}>Email verified!</p>
            <p style={{ fontSize: 13, color: '#71717a', margin: 0, lineHeight: 1.6 }}>
              Your email has been verified. You can close this tab.
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', background: '#fee2e2',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#b91c1c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <p style={{ fontSize: 17, fontWeight: 800, color: '#b91c1c', margin: '0 0 8px' }}>Verification failed</p>
            <p style={{ fontSize: 13, color: '#71717a', margin: 0, lineHeight: 1.6 }}>
              This link is invalid or has expired. Please request a new verification email from your account settings.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
