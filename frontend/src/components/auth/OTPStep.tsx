import { useEffect, useRef, useState } from 'react'
import { RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from 'firebase/auth'
import { auth } from '../../firebase'

interface Props {
  phone: string
  onVerified: (firebaseToken: string) => void
  onBack: () => void
}

const ACCENT = '#6366f1'
const RESEND_SECONDS = 30

export function OTPStep({ phone, onVerified, onBack }: Props) {
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(RESEND_SECONDS)

  const confirmationRef = useRef<ConfirmationResult | null>(null)
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null)
  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ]

  const sendOTP = async () => {
    setSending(true)
    setError(null)
    try {
      // Clean up any existing recaptcha verifier
      if (recaptchaRef.current) {
        recaptchaRef.current.clear()
        recaptchaRef.current = null
      }
      const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' })
      recaptchaRef.current = verifier
      const result = await signInWithPhoneNumber(auth, phone, verifier)
      confirmationRef.current = result
      setCountdown(RESEND_SECONDS)
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code
      if (code === 'auth/too-many-requests') {
        setError('Too many attempts. Please wait a few minutes and try again.')
      } else if (code === 'auth/invalid-phone-number') {
        setError('This phone number is not valid for SMS verification.')
      } else {
        setError('Failed to send verification code. Please try again.')
      }
    } finally {
      setSending(false)
    }
  }

  // Send OTP on mount
  useEffect(() => {
    sendOTP()
    // Cleanup on unmount
    return () => {
      if (recaptchaRef.current) {
        recaptchaRef.current.clear()
        recaptchaRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  const handleDigit = (idx: number, val: string) => {
    if (!/^\d?$/.test(val)) return
    const next = [...digits]
    next[idx] = val
    setDigits(next)
    if (val && idx < 5) {
      inputRefs[idx + 1].current?.focus()
    }
    // Auto-submit when all 6 digits are filled
    if (val && idx === 5) {
      const code = [...next.slice(0, 5), val].join('')
      if (code.length === 6) submitCode(code)
    }
  }

  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      inputRefs[idx - 1].current?.focus()
    }
  }

  const submitCode = async (code: string) => {
    if (!confirmationRef.current) {
      setError('Verification session expired. Please resend the code.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await confirmationRef.current.confirm(code)
      const idToken = await result.user.getIdToken()
      onVerified(idToken)
    } catch (e: unknown) {
      const errorCode = (e as { code?: string })?.code
      if (errorCode === 'auth/invalid-verification-code') {
        setError('Invalid code. Please check and try again.')
      } else if (errorCode === 'auth/code-expired') {
        setError('Code expired. Please tap "Resend" to get a new one.')
      } else if (errorCode === 'auth/too-many-requests') {
        setError('Too many attempts. Please wait a few minutes.')
      } else {
        setError('Verification failed. Please try again.')
      }
      setDigits(['', '', '', '', '', ''])
      inputRefs[0].current?.focus()
    } finally {
      setLoading(false)
    }
  }

  const handleResend = () => {
    setDigits(['', '', '', '', '', ''])
    setError(null)
    sendOTP()
  }

  const canSubmit = digits.every((d) => d !== '') && !loading

  return (
    <div style={{
      background: 'white', borderRadius: 16, padding: '36px 28px',
      width: '100%', maxWidth: 380, border: '1px solid #e4e4e7',
    }}>
      {/* Hidden recaptcha container */}
      <div id="recaptcha-container" />

      <button
        onClick={onBack}
        style={{ background: 'none', border: 'none', color: '#71717a', fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 24, fontWeight: 500 }}
      >← Back</button>

      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5, color: '#18181b', margin: '0 0 4px' }}>Verify your number</h2>
        <p style={{ color: '#71717a', fontSize: 13, margin: 0 }}>
          {sending ? 'Sending code…' : `We sent a 6-digit code to ${phone}`}
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 20 }}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={inputRefs[i]}
            type="text"
            inputMode="numeric"
            value={d}
            maxLength={1}
            autoFocus={i === 0}
            disabled={loading || sending}
            onChange={(e) => handleDigit(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            style={{
              width: 42, height: 52, textAlign: 'center', fontSize: 20,
              borderRadius: 10, border: `1.5px solid ${d ? ACCENT : '#e4e4e7'}`,
              fontWeight: 700, outline: 'none',
              background: d ? '#eef2ff' : '#f9f9f9',
              color: '#18181b',
              transition: 'border-color 0.12s, background 0.12s',
              opacity: loading || sending ? 0.6 : 1,
            }}
          />
        ))}
      </div>

      {error && (
        <p style={{ color: '#ef4444', fontSize: 12, textAlign: 'center', marginBottom: 12 }}>{error}</p>
      )}
      {loading && (
        <p style={{ color: '#a1a1aa', fontSize: 12, textAlign: 'center', marginBottom: 12 }}>Verifying…</p>
      )}

      <button
        onClick={() => canSubmit && submitCode(digits.join(''))}
        disabled={!canSubmit}
        style={{
          width: '100%', marginTop: 4, padding: '12px 0', borderRadius: 8, border: 'none',
          background: !canSubmit ? '#e4e4e7' : ACCENT,
          color: !canSubmit ? '#a1a1aa' : 'white',
          fontSize: 14, fontWeight: 700, cursor: !canSubmit ? 'not-allowed' : 'pointer',
          transition: 'background 0.15s',
        }}
      >{loading ? 'Verifying…' : 'Verify'}</button>

      <div style={{ textAlign: 'center', marginTop: 16 }}>
        {countdown > 0 ? (
          <p style={{ fontSize: 12, color: '#a1a1aa', margin: 0 }}>
            Resend code in <span style={{ fontWeight: 600 }}>{countdown}s</span>
          </p>
        ) : (
          <button
            onClick={handleResend}
            disabled={sending}
            style={{
              background: 'none', border: 'none', color: ACCENT, fontSize: 13,
              fontWeight: 600, cursor: sending ? 'not-allowed' : 'pointer',
              opacity: sending ? 0.5 : 1,
            }}
          >{sending ? 'Sending…' : 'Resend code'}</button>
        )}
      </div>
    </div>
  )
}
