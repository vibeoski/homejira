import { useSearchParams } from 'react-router-dom'
import { authApi } from '../api/auth'
import { useAuthStore } from '../store/authStore'
import { householdsApi } from '../api/households'
import { AppLogo } from '../components/ui/AppLogo'
import { LoginFlow } from '../components/auth/LoginFlow'
import { RegisterFlow } from '../components/auth/RegisterFlow'
import type { Member } from '../types'

type Mode = 'landing' | 'login' | 'register'

const ACCENT = '#6366f1'
const FEATURES = [
  { icon: 'T', label: 'Task management', sub: 'Assign, track & complete household tasks', color: '#6366f1' },
  { icon: 'G', label: 'Shared grocery list', sub: 'Shop together, check off items live', color: '#22c55e' },
  { icon: 'H', label: 'Household hub', sub: 'Invite members, earn coins, stay in sync', color: '#f97316' },
]

export function AuthPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { setAuth, setGuest } = useAuthStore()
  const requestedMode = searchParams.get('mode')
  const mode: Mode = requestedMode === 'login' || requestedMode === 'register' ? requestedMode : 'landing'

  const goToMode = (nextMode: Mode) => {
    if (nextMode === 'landing') {
      setSearchParams({})
      return
    }
    setSearchParams({ mode: nextMode })
  }

  const handleSuccess = async (token: string, member: Member) => {
    const pendingJoin = localStorage.getItem('hj_pending_join')
    if (pendingJoin) {
      localStorage.setItem('hj_token', token)
      try {
        const { member: updated } = await householdsApi.joinByInviteToken(pendingJoin)
        localStorage.removeItem('hj_pending_join')
        try {
          const { token: freshToken, member: freshMember } = await authApi.refresh()
          setAuth(freshToken, freshMember)
        } catch {
          setAuth(token, updated)
        }
        return
      } catch {}
    }
    setAuth(token, member)
  }

  if (mode === 'login') {
    return (
      <AuthShell>
        <LoginFlow 
          onSuccess={handleSuccess} 
          onBack={() => goToMode('landing')}
          onGoRegister={() => goToMode('register')}
        />
      </AuthShell>
    )
  }

  if (mode === 'register') {
    return (
      <AuthShell>
        <RegisterFlow onSuccess={handleSuccess} onBack={() => goToMode('landing')} />
      </AuthShell>
    )
  }

  // ── Landing ───────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #f5f3ef 0%, #eef0fb 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 20px 40px',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes hj-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes hj-fade-up { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }
        .hj-logo-float { animation: hj-float 4s ease-in-out infinite; }
        .hj-fade-up { animation: hj-fade-up 0.45s cubic-bezier(.16,1,.3,1) both; }
        .hj-fade-up-2 { animation: hj-fade-up 0.45s cubic-bezier(.16,1,.3,1) 0.08s both; }
        .hj-fade-up-3 { animation: hj-fade-up 0.45s cubic-bezier(.16,1,.3,1) 0.16s both; }
        .hj-btn-primary { transition: background 0.15s, transform 0.12s, box-shadow 0.15s; }
        .hj-btn-primary:hover { background: #4f46e5 !important; box-shadow: 0 6px 24px #6366f140; transform: translateY(-1px); }
        .hj-btn-primary:active { transform: translateY(0); }
        .hj-btn-secondary:hover { background: #f0efff !important; }
        .hj-feature-card { transition: transform 0.18s, box-shadow 0.18s; }
        .hj-feature-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px #0001; }
      `}</style>

      {/* Logo */}
      <div className="hj-logo-float hj-fade-up" style={{ marginBottom: 20 }}>
        <AppLogo size={72} />
      </div>

      {/* Wordmark */}
      <div className="hj-fade-up" style={{ textAlign: 'center', marginBottom: 8 }}>
        <h1 style={{ fontSize: 36, fontWeight: 800, color: '#1c1917', letterSpacing: -1.2, margin: 0, lineHeight: 1 }}>
          HomeJira
        </h1>
        <p style={{ fontSize: 16, color: '#78716c', marginTop: 8, fontWeight: 500 }}>
          Your household, organized.
        </p>
      </div>

      {/* Feature cards */}
      <div className="hj-fade-up-2" style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 360, margin: '28px 0' }}>
        {FEATURES.map((f) => (
          <div key={f.label} className="hj-feature-card" style={{
            display: 'flex', alignItems: 'center', gap: 14,
            background: 'white', borderRadius: 14, padding: '14px 16px',
            border: '1px solid #ede8e1',
          }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12, background: f.color + '14', color: f.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, fontWeight: 800, flexShrink: 0, border: `1px solid ${f.color}20`
            }}>
              {f.icon}
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#1c1917', margin: 0 }}>{f.label}</p>
              <p style={{ fontSize: 12, color: '#a8a29e', margin: '2px 0 0' }}>{f.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* CTAs */}
      <div className="hj-fade-up-3" style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 360 }}>
        <button
          className="hj-btn-primary"
          onClick={() => goToMode('register')}
          style={{
            width: '100%', padding: '15px 0', borderRadius: 14, border: 'none',
            background: ACCENT, color: 'white', fontSize: 15, fontWeight: 700,
            letterSpacing: -0.2, cursor: 'pointer',
            boxShadow: '0 4px 16px #6366f130',
          }}
        >
          Create account
        </button>
        <button
          className="hj-btn-secondary"
          onClick={() => goToMode('login')}
          style={{
            width: '100%', padding: '15px 0', borderRadius: 14,
            border: '1.5px solid #e0deff', background: 'white',
            color: '#6366f1', fontSize: 15, fontWeight: 700,
            letterSpacing: -0.2, cursor: 'pointer',
            transition: 'background 0.15s',
          }}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={setGuest}
          style={{
            width: '100%',
            padding: '13px 0',
            borderRadius: 14,
            border: '1px dashed #c7d2fe',
            background: '#eef2ff',
            color: ACCENT,
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: -0.1,
            cursor: 'pointer',
          }}
        >
          Try as guest
        </button>
      </div>

      <p style={{ marginTop: 24, fontSize: 12, color: '#c4bfba', textAlign: 'center' }}>
        Join your household. No email required.
      </p>
    </div>
  )
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #f5f3ef 0%, #eef0fb 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '20px 16px',
    }}>
      <style>{`
        @keyframes hj-fade-up { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
        .hj-auth-card { animation: hj-fade-up 0.35s cubic-bezier(.16,1,.3,1) both; }
      `}</style>
      {children}
    </div>
  )
}
