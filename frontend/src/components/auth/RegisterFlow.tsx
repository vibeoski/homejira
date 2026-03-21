import { useRef, useState } from 'react'
import { authApi } from '../../api/auth'
import { AppLogo } from '../ui/AppLogo'
import type { Member } from '../../types'

interface Props {
  onSuccess: (token: string, member: Member) => void
  onBack: () => void
}

const ACCENT = '#6366f1'
const TOTAL_STEPS = 3

function StepIndicator({ step }: { step: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 24 }}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <div key={i} style={{
          height: 4, flex: 1, borderRadius: 99,
          background: i < step ? ACCENT : '#ede8e1',
          transition: 'background 0.3s',
        }} />
      ))}
      <span style={{ fontSize: 11, color: '#a8a29e', fontWeight: 600, whiteSpace: 'nowrap', marginLeft: 4 }}>
        {step}/{TOTAL_STEPS}
      </span>
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 700, color: '#a8a29e', letterSpacing: 0.8, textTransform: 'uppercase', margin: '0 0 8px' }}>
      {children}
    </p>
  )
}

export function RegisterFlow({ onSuccess, onBack }: Props) {
  const [step, setStep] = useState(1)
  const [username, setUsername] = useState('')
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'taken' | 'ok'>('idle')
  const [name, setName] = useState('')
  const [avatar] = useState('')
  const [mpin, setMpin] = useState(['', '', '', ''])
  const [confirmMpin, setConfirmMpin] = useState(['', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mpinRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)]
  const confirmRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)]

  // ── Step 1: Username ──────────────────────────────────────────────────────
  const usernameValid = /^[a-zA-Z0-9_]{3,30}$/.test(username)

  const checkUsernameAndNext = async () => {
    if (!usernameValid) {
      setError('3–30 chars, letters / numbers / underscores only')
      return
    }
    setError(null)
    setUsernameStatus('checking')
    try {
      const { registered } = await authApi.checkUsername(username)
      if (registered) {
        setUsernameStatus('taken')
        setError('Username already taken — try another')
      } else {
        setUsernameStatus('ok')
        setStep(2)
      }
    } catch {
      setUsernameStatus('idle')
      setError('Could not check username. Try again.')
    }
  }

  // ── Step 2: Name & avatar ─────────────────────────────────────────────────
  const handleStep2Next = () => {
    if (!name.trim()) { setError('Name is required'); return }
    setError(null)
    setStep(3)
    setTimeout(() => mpinRefs[0].current?.focus(), 50)
  }

  // ── Step 3: PIN ───────────────────────────────────────────────────────────
  const makeDigitHandler = (
    digits: string[], setDigits: (d: string[]) => void,
    refs: React.RefObject<HTMLInputElement | null>[],
    nextFirst?: React.RefObject<HTMLInputElement | null>
  ) => (idx: number, val: string) => {
    if (!/^\d?$/.test(val)) return
    const next = [...digits]; next[idx] = val; setDigits(next)
    if (val && idx < 3) refs[idx + 1].current?.focus()
    if (val && idx === 3 && nextFirst) nextFirst.current?.focus()
  }

  const makeKdHandler = (digits: string[], refs: React.RefObject<HTMLInputElement | null>[]) =>
    (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Backspace' && !digits[idx] && idx > 0) refs[idx - 1].current?.focus()
    }

  const handleRegister = async () => {
    const pin = mpin.join('')
    const confirm = confirmMpin.join('')
    if (pin.length !== 4) { setError('Enter a 4-digit PIN'); return }
    if (pin !== confirm) { setError('PINs don\'t match – try again'); return }
    setError(null)
    setLoading(true)
    try {
      const referralToken = localStorage.getItem('hj_pending_referral') ?? undefined
      const { token, member } = await authApi.register({
        username, name: name.trim(), avatar, mpin: pin, referral_token: referralToken,
      })
      localStorage.removeItem('hj_pending_referral')
      onSuccess(token, member)
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status
      setError(status === 409 ? 'Username already taken – go back and pick another' : 'Registration failed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const goBack = () => {
    if (step > 1) { setStep(s => s - 1); setError(null) }
    else onBack()
  }

  return (
    <div className="hj-auth-card" style={{
      background: 'white', borderRadius: 20, padding: '28px 28px 32px',
      width: '100%', maxWidth: 380, border: '1px solid #ede8e1',
      boxShadow: '0 8px 40px #0000000a',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <button onClick={goBack} style={{
          background: '#f5f5f4', border: 'none', borderRadius: 8, padding: '6px 10px',
          cursor: 'pointer', fontSize: 16, color: '#78716c', flexShrink: 0,
          transition: 'background 0.12s',
        }}>←</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <AppLogo size={28} />
          <span style={{ fontSize: 17, fontWeight: 800, color: '#1c1917', letterSpacing: -0.4 }}>Create account</span>
        </div>
      </div>

      <StepIndicator step={step} />

      {/* ── Step 1: Username ── */}
      {step === 1 && (
        <>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1c1917', margin: '0 0 4px', letterSpacing: -0.5, fontFamily: 'Fraunces, serif' }}>
            Choose a username
          </h2>
          <p style={{ fontSize: 13, color: '#78716c', margin: '0 0 20px' }}>
            This is how other household members will find you.
          </p>
          <FieldLabel>Username</FieldLabel>
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
              color: '#a8a29e', fontSize: 14, fontWeight: 600, pointerEvents: 'none',
            }}>@</span>
            <input
              type="text"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setUsernameStatus('idle'); setError(null) }}
              onKeyDown={(e) => e.key === 'Enter' && checkUsernameAndNext()}
              placeholder="your_username"
              autoFocus
              autoComplete="username"
              style={{
                width: '100%', padding: '11px 40px 11px 28px', borderRadius: 10, fontSize: 14,
                border: `1.5px solid ${
                  usernameStatus === 'taken' ? '#ef4444' :
                  usernameStatus === 'ok' ? ACCENT :
                  error ? '#ef4444' : '#ede8e1'
                }`,
                outline: 'none', background: '#f9f9f9', color: '#1c1917',
                boxSizing: 'border-box', transition: 'border-color 0.15s',
              }}
            />
            {/* Status indicator */}
            <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, fontWeight: 700 }}>
              {usernameStatus === 'checking' && <span style={{ color: '#a8a29e' }}>...</span>}
              {usernameStatus === 'taken' && <span style={{ color: '#ef4444' }}>Taken</span>}
              {usernameStatus === 'ok' && <span style={{ color: ACCENT }}>OK</span>}
            </span>
          </div>
          <p style={{ fontSize: 11, color: '#a8a29e', marginTop: 6 }}>3–30 chars · letters, numbers, underscores</p>
          {error && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 8 }}>{error}</p>}
          <button
            onClick={checkUsernameAndNext}
            disabled={!usernameValid || usernameStatus === 'checking'}
            style={{
              width: '100%', marginTop: 20, padding: '13px 0', borderRadius: 12, border: 'none',
              background: !usernameValid || usernameStatus === 'checking' ? '#ede8e1' : ACCENT,
              color: !usernameValid || usernameStatus === 'checking' ? '#a8a29e' : 'white',
              fontSize: 14, fontWeight: 700,
              cursor: !usernameValid || usernameStatus === 'checking' ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}
          >{usernameStatus === 'checking' ? 'Checking…' : 'Continue →'}</button>
        </>
      )}

      {/* ── Step 2: Name & Avatar ── */}
      {step === 2 && (
        <>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1c1917', margin: '0 0 4px', letterSpacing: -0.5, fontFamily: 'Fraunces, serif' }}>
            Tell us about you
          </h2>
          <p style={{ fontSize: 13, color: '#78716c', margin: '0 0 20px' }}>
            Choose a display name for your profile.
          </p>

          <FieldLabel>Display name</FieldLabel>
          <input
            value={name}
            onChange={(e) => { setName(e.target.value); setError(null) }}
            onKeyDown={(e) => e.key === 'Enter' && handleStep2Next()}
            placeholder="e.g. Alex"
            autoFocus
            style={{
              width: '100%', padding: '11px 12px', borderRadius: 10, fontSize: 14,
              border: `1.5px solid ${error ? '#ef4444' : '#ede8e1'}`,
              outline: 'none', background: '#f9f9f9', color: '#1c1917',
              boxSizing: 'border-box', marginBottom: 18, transition: 'border-color 0.15s',
            }}
          />

          {/* Avatar selection removed */}

          {error && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 10 }}>{error}</p>}
          <button
            onClick={handleStep2Next}
            disabled={!name.trim()}
            style={{
              width: '100%', marginTop: 20, padding: '13px 0', borderRadius: 12, border: 'none',
              background: !name.trim() ? '#ede8e1' : ACCENT,
              color: !name.trim() ? '#a8a29e' : 'white',
              fontSize: 14, fontWeight: 700,
              cursor: !name.trim() ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}
          >Continue →</button>
        </>
      )}

      {/* ── Step 3: PIN ── */}
      {step === 3 && (
        <>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1c1917', margin: '0 0 4px', letterSpacing: -0.5, fontFamily: 'Fraunces, serif' }}>
            Set your PIN
          </h2>
          <p style={{ fontSize: 13, color: '#78716c', margin: '0 0 22px' }}>
            This 4-digit PIN is how you'll log in. Keep it secret!
          </p>

          <FieldLabel>Set PIN</FieldLabel>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 16 }}>
            {mpin.map((d, i) => (
              <input key={i} ref={mpinRefs[i]} type="text" inputMode="numeric" value={d} maxLength={1}
                onChange={(e) => makeDigitHandler(mpin, setMpin, mpinRefs, confirmRefs[0])(i, e.target.value)}
                onKeyDown={(e) => makeKdHandler(mpin, mpinRefs)(i, e)}
                style={{
                  width: 58, height: 64, textAlign: 'center', fontSize: 24,
                  borderRadius: 12, border: `1.5px solid ${d ? ACCENT : '#ede8e1'}`,
                  fontWeight: 700, outline: 'none',
                  background: d ? '#eef2ff' : 'white',
                  color: '#1c1917', transition: 'border-color 0.12s, background 0.12s',
                }}
              />
            ))}
          </div>

          <FieldLabel>Confirm PIN</FieldLabel>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 4 }}>
            {confirmMpin.map((d, i) => (
              <input key={i} ref={confirmRefs[i]} type="text" inputMode="numeric" value={d} maxLength={1}
                onChange={(e) => makeDigitHandler(confirmMpin, setConfirmMpin, confirmRefs)(i, e.target.value)}
                onKeyDown={(e) => makeKdHandler(confirmMpin, confirmRefs)(i, e)}
                style={{
                  width: 58, height: 64, textAlign: 'center', fontSize: 24,
                  borderRadius: 12, border: `1.5px solid ${d ? ACCENT : '#ede8e1'}`,
                  fontWeight: 700, outline: 'none',
                  background: d ? '#eef2ff' : 'white',
                  color: '#1c1917', transition: 'border-color 0.12s, background 0.12s',
                }}
              />
            ))}
          </div>

          {error && <p style={{ color: '#ef4444', fontSize: 12, textAlign: 'center', marginTop: 10 }}>{error}</p>}

          <button
            onClick={handleRegister}
            disabled={loading || mpin.join('').length !== 4 || confirmMpin.join('').length !== 4}
            style={{
              width: '100%', marginTop: 20, padding: '13px 0', borderRadius: 12, border: 'none',
              background: loading || mpin.join('').length !== 4 || confirmMpin.join('').length !== 4 ? '#ede8e1' : ACCENT,
              color: loading || mpin.join('').length !== 4 || confirmMpin.join('').length !== 4 ? '#a8a29e' : 'white',
              fontSize: 14, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}
          >{loading ? 'Creating account…' : 'Create account'}</button>

          {/* Summary */}
          <div style={{
            marginTop: 16, padding: '10px 14px', borderRadius: 10,
            background: '#f5f5f4', display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%', background: ACCENT, color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700
            }}>
              {name?.charAt(0).toUpperCase() || '?'}
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#1c1917', margin: 0 }}>{name}</p>
              <p style={{ fontSize: 11, color: '#a8a29e', margin: '1px 0 0' }}>@{username}</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
