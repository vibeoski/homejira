import { useRef, useState } from 'react'
import { authApi } from '../../api/auth'
import { AppLogo } from '../ui/AppLogo'
import type { Member } from '../../types'

interface Props {
  onSuccess: (token: string, member: Member) => void
  onBack: () => void
  onGoRegister: () => void
}

const ACCENT = '#6366f1'

export function LoginFlow({ onSuccess, onBack, onGoRegister }: Props) {
  const [username, setUsername] = useState('')
  const [digits, setDigits] = useState(['', '', '', ''])
  const [phase, setPhase] = useState<'user' | 'pin'>('user')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pinRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ]

  const handleUsernameNext = async () => {
    if (username.trim().length < 3) {
      setError('Username must be at least 3 characters')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const { registered } = await authApi.checkUsername(username.trim())
      if (!registered) {
        setError("Account not found. Please check your username or create an account.")
        setLoading(false)
        return
      }
      setPhase('pin')
      setTimeout(() => pinRefs[0].current?.focus(), 50)
    } catch {
      setError('Could not verify username. Try again.')
    } finally {
      if (phase === 'user') setLoading(false) // Only clear loading if we didn't transition
    }
  }

  const handleDigit = (idx: number, val: string) => {
    if (!/^\d?$/.test(val)) return
    const next = [...digits]
    next[idx] = val
    setDigits(next)
    if (val && idx < 3) pinRefs[idx + 1].current?.focus()
    if (val && idx === 3) {
      const pin = [...next.slice(0, 3), val].join('')
      if (pin.length === 4) handleLogin(pin)
    }
  }

  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) pinRefs[idx - 1].current?.focus()
  }

  const handleLogin = async (pin: string) => {
    setLoading(true)
    setError(null)
    try {
      const { token, member } = await authApi.login({ username: username.trim(), mpin: pin })
      onSuccess(token, member)
    } catch {
      setError('Wrong username or PIN. Try again.')
      setDigits(['', '', '', ''])
      pinRefs[0].current?.focus()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="hj-auth-card" style={{
      background: 'white', borderRadius: 20, padding: '32px 28px',
      width: '100%', maxWidth: 380, border: '1px solid #ede8e1',
      boxShadow: '0 8px 40px #0000000a',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
        <button onClick={onBack} style={{
          background: '#f5f5f4', border: 'none', borderRadius: 8, padding: '6px 10px',
          cursor: 'pointer', fontSize: 16, color: '#78716c', flexShrink: 0,
          transition: 'background 0.12s',
        }}>←</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <AppLogo size={28} />
          <span style={{ fontSize: 17, fontWeight: 800, color: '#1c1917', letterSpacing: -0.4 }}>Sign in</span>
        </div>
      </div>

      {/* Username */}
      <div style={{ marginBottom: 22 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: '#a8a29e', letterSpacing: 0.8, textTransform: 'uppercase' }}>
          Username
        </label>
        <div style={{ position: 'relative', marginTop: 8 }}>
          <span style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            color: '#a8a29e', fontSize: 14, fontWeight: 600, pointerEvents: 'none',
          }}>@</span>
          <input
            type="text"
            value={username}
            onChange={(e) => { setUsername(e.target.value); setError(null) }}
            onKeyDown={(e) => e.key === 'Enter' && phase === 'user' && handleUsernameNext()}
            placeholder="your_username"
            autoFocus
            autoComplete="username"
            disabled={phase === 'pin' || loading}
            style={{
              width: '100%', padding: '11px 12px 11px 28px', borderRadius: 10, fontSize: 14,
              border: `1.5px solid ${error && phase === 'user' ? '#ef4444' : phase === 'pin' ? ACCENT : '#ede8e1'}`,
              outline: 'none', background: phase === 'pin' ? '#f5f5f4' : '#f9f9f9',
              color: '#1c1917', boxSizing: 'border-box', transition: 'border-color 0.15s',
            }}
          />
          {phase === 'pin' && (
            <button
              onClick={() => { setPhase('user'); setDigits(['','','','']); setError(null) }}
              style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', fontSize: 11, color: ACCENT,
                cursor: 'pointer', fontWeight: 600, padding: '2px 4px',
              }}
            >change</button>
          )}
        </div>
      </div>

      {/* PIN — only shown after username confirmed */}
      {phase === 'pin' && (
        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#a8a29e', letterSpacing: 0.8, textTransform: 'uppercase' }}>
            4-digit PIN
          </label>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 12 }}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={pinRefs[i]}
                type="text"
                inputMode="numeric"
                value={d}
                maxLength={1}
                disabled={loading}
                onChange={(e) => handleDigit(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                style={{
                  width: 58, height: 64, textAlign: 'center', fontSize: 24,
                  borderRadius: 12, border: `1.5px solid ${d ? ACCENT : '#ede8e1'}`,
                  fontWeight: 700, outline: 'none',
                  background: loading ? '#f5f5f4' : d ? '#eef2ff' : 'white',
                  color: '#1c1917', opacity: loading ? 0.6 : 1,
                  transition: 'border-color 0.12s, background 0.12s',
                }}
              />
            ))}
          </div>
          <p style={{ textAlign: 'center', fontSize: 11, color: '#a8a29e', marginTop: 10 }}>
            {loading ? '⏳ Verifying…' : 'Enters automatically on last digit'}
          </p>
        </div>
      )}

      {error && (
        <p style={{ color: '#ef4444', fontSize: 12, textAlign: 'center', marginBottom: 14 }}>{error}</p>
      )}

      {/* Continue button (only shown in username phase) */}
      {phase === 'user' && (
        <div style={{ display: 'flex', gap: 10, flexDirection: 'column' }}>
          <button
            onClick={handleUsernameNext}
            disabled={username.trim().length < 3 || loading}
            style={{
              width: '100%', padding: '13px 0', borderRadius: 12, border: 'none',
              background: username.trim().length < 3 || loading ? '#ede8e1' : ACCENT,
              color: username.trim().length < 3 || loading ? '#a8a29e' : 'white',
              fontSize: 14, fontWeight: 700, cursor: username.trim().length < 3 || loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}
          >{loading ? 'Verifying…' : 'Continue →'}</button>
          
          {error?.includes("Account not found") && (
            <button
              onClick={onGoRegister}
              style={{
                width: '100%', padding: '13px 0', borderRadius: 12,
                border: '1.5px solid #e0deff', background: 'white',
                color: ACCENT, fontSize: 14, fontWeight: 700,
                cursor: 'pointer', transition: 'background 0.15s',
                animation: 'fadeIn 0.2s ease',
              }}
            >
              Create an account
            </button>
          )}
        </div>
      )}
    </div>
  )
}
