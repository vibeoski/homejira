import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppLogo } from '../components/ui/AppLogo'

const ACCENT = '#6366f1'

function TasksIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
  )
}

function GroceryIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 01-8 0" />
    </svg>
  )
}

function HouseholdIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9,22 9,12 15,12 15,22" />
    </svg>
  )
}

function HouseIllustration() {
  return (
    <div style={{
      width: 64, height: 64, borderRadius: '50%',
      background: '#eef2ff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9,22 9,12 15,12 15,22" />
      </svg>
    </div>
  )
}

function CheckIllustration() {
  return (
    <div style={{
      width: 64, height: 64, borderRadius: '50%',
      background: '#f0fdf4',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
        <polyline points="22,4 12,14.01 9,11.01" />
      </svg>
    </div>
  )
}

function WelcomeBackScreen() {
  const navigate = useNavigate()
  const stored = localStorage.getItem('hj_member')
  const name = stored ? (() => { try { return JSON.parse(stored).name } catch { return null } })() : null

  return (
    <div style={{
      minHeight: '100vh',
      background: '#faf7f2',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 28px',
    }}>
      <AppLogo size={56} />

      <h1 style={{
        fontFamily: 'Fraunces, serif',
        fontSize: 28,
        fontWeight: 700,
        color: '#1c1917',
        margin: '24px 0 8px',
        textAlign: 'center',
      }}>
        {name ? `Welcome back, ${name}` : 'Welcome back'}
      </h1>

      <p style={{
        fontSize: 14,
        color: '#78716c',
        margin: '0 0 36px',
        textAlign: 'center',
      }}>
        Sign in to continue.
      </p>

      <button
        type="button"
        onClick={() => navigate('/auth?mode=login')}
        style={{
          width: '100%',
          maxWidth: 360,
          height: 48,
          borderRadius: 12,
          border: 'none',
          background: ACCENT,
          color: 'white',
          fontSize: 15,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        Sign in →
      </button>

      <button
        type="button"
        onClick={() => navigate('/auth?mode=register')}
        style={{
          background: 'none',
          border: 'none',
          fontSize: 14,
          color: ACCENT,
          cursor: 'pointer',
          marginTop: 12,
          textAlign: 'center',
        }}
      >
        New here? Create an account
      </button>
    </div>
  )
}

const CAROUSEL_SCREENS = [
  {
    key: 'hook',
    render: () => (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <HouseIllustration />
        <h1 style={{
          fontFamily: 'Fraunces, serif',
          fontSize: 30,
          fontWeight: 700,
          color: '#1c1917',
          lineHeight: 1.2,
          margin: '24px 0 16px',
        }}>
          Your home,{'\n'}finally in sync.
        </h1>
        <p style={{
          fontSize: 15,
          color: '#78716c',
          lineHeight: 1.6,
          margin: 0,
        }}>
          No more "did you buy milk?" texts.
          One place for every task, chore,
          and grocery run — shared with
          everyone in your home.
        </p>
      </div>
    ),
  },
  {
    key: 'pillars',
    render: () => (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <h1 style={{
          fontFamily: 'Fraunces, serif',
          fontSize: 30,
          fontWeight: 700,
          color: '#1c1917',
          lineHeight: 1.2,
          margin: '0 0 28px',
        }}>
          Three things.{'\n'}That's it.
        </h1>
        <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
          {[
            { Icon: TasksIcon, label: 'Tasks' },
            { Icon: GroceryIcon, label: 'Grocery' },
            { Icon: HouseholdIcon, label: 'Household' },
          ].map(({ Icon, label }) => (
            <div key={label} style={{
              width: 72,
              height: 72,
              borderRadius: 16,
              background: '#f5f3ff',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}>
              <Icon />
              <span style={{ fontSize: 10, fontWeight: 600, color: ACCENT }}>{label}</span>
            </div>
          ))}
        </div>
        <p style={{
          fontSize: 14,
          color: '#78716c',
          textAlign: 'center',
          lineHeight: 1.6,
          margin: 0,
        }}>
          Assign chores. Track repairs.
          Shop together. Always know
          who's doing what.
        </p>
      </div>
    ),
  },
  {
    key: 'trust',
    render: () => (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <CheckIllustration />
        <h1 style={{
          fontFamily: 'Fraunces, serif',
          fontSize: 30,
          fontWeight: 700,
          color: '#1c1917',
          lineHeight: 1.2,
          margin: '24px 0 16px',
        }}>
          Ready in 60 seconds.
        </h1>
        <p style={{
          fontSize: 15,
          color: '#78716c',
          lineHeight: 1.7,
          margin: 0,
        }}>
          No email. No password.
          Just a username and a
          4-digit PIN. Invite your
          partner, kids, or roommates
          — it's free.
        </p>
      </div>
    ),
  },
]

function NewUserCarousel() {
  const navigate = useNavigate()
  const [screen, setScreen] = useState(0)
  const current = CAROUSEL_SCREENS[screen]

  return (
    <div style={{
      minHeight: '100vh',
      background: '#faf7f2',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        padding: 24,
      }}>
        <AppLogo size={36} />
      </div>

      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 28px',
        paddingBottom: 160,
      }}>
        {current.render()}

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          margin: '32px auto 0',
        }}>
          {CAROUSEL_SCREENS.map((s, i) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setScreen(i)}
              style={{
                height: 8,
                width: i === screen ? 20 : 8,
                borderRadius: 99,
                background: i === screen ? ACCENT : '#ede8e1',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                transition: 'all .15s',
              }}
            />
          ))}
        </div>
      </div>

      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: '#faf7f2',
        padding: '16px 24px',
        paddingBottom: 'env(safe-area-inset-bottom, 16px)',
        borderTop: '1px solid #ede8e1',
      }}>
        <button
          type="button"
          onClick={() => navigate('/auth?mode=register')}
          style={{
            width: '100%',
            height: 48,
            borderRadius: 12,
            border: 'none',
            background: ACCENT,
            color: 'white',
            fontSize: 15,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Get started →
        </button>
        <button
          type="button"
          onClick={() => navigate('/auth?mode=login')}
          style={{
            display: 'block',
            width: '100%',
            background: 'none',
            border: 'none',
            fontSize: 13,
            color: '#a8a29e',
            cursor: 'pointer',
            marginTop: 12,
            textAlign: 'center',
          }}
        >
          Already have an account? Sign in
        </button>
      </div>
    </div>
  )
}

export function OnboardingPage() {
  const isReturning = !!localStorage.getItem('hj_member')
  return isReturning ? <WelcomeBackScreen /> : <NewUserCarousel />
}
