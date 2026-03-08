import { useRef, useState } from 'react'
import { authApi } from '../../api/auth'
import type { Member } from '../../types'

interface Props {
  phone: string
  onSuccess: (token: string, member: Member) => void
  onBack: () => void
}

const ACCENT = '#6366f1'

function PinBox({
  digits, refs, onChange, onKeyDown,
}: {
  digits: string[]
  refs: React.RefObject<HTMLInputElement>[]
  onChange: (i: number, v: string) => void
  onKeyDown: (i: number, e: React.KeyboardEvent<HTMLInputElement>) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={refs[i]}
          type="text"
          inputMode="numeric"
          value={d}
          maxLength={1}
          onChange={(e) => onChange(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          style={{
            width: 50, height: 56, textAlign: 'center', fontSize: 22,
            borderRadius: 10, border: `1.5px solid ${d ? ACCENT : '#e4e4e7'}`,
            fontWeight: 700, outline: 'none',
            background: d ? '#eef2ff' : '#f9f9f9',
            color: '#18181b',
            transition: 'border-color 0.12s, background 0.12s',
          }}
        />
      ))}
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 10, fontWeight: 700, color: '#a1a1aa', letterSpacing: 0.7, textTransform: 'uppercase', margin: '0 0 8px' }}>
      {children}
    </p>
  )
}

export function RegisterStep({ phone, onSuccess, onBack }: Props) {
  const [name, setName] = useState('')
  const [mpin, setMpin] = useState(['', '', '', ''])
  const [confirmMpin, setConfirmMpin] = useState(['', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mpinRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)]
  const confirmRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)]

  const makeDigitHandler = (
    digits: string[],
    setDigits: (d: string[]) => void,
    refs: React.RefObject<HTMLInputElement>[],
    nextFirstRef?: React.RefObject<HTMLInputElement>
  ) => (idx: number, val: string) => {
    if (!/^\d?$/.test(val)) return
    const next = [...digits]
    next[idx] = val
    setDigits(next)
    if (val && idx < 3) refs[idx + 1].current?.focus()
    if (val && idx === 3 && nextFirstRef) nextFirstRef.current?.focus()
  }

  const makeKeyDownHandler = (
    digits: string[],
    refs: React.RefObject<HTMLInputElement>[]
  ) => (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) refs[idx - 1].current?.focus()
  }

  const handleSubmit = async () => {
    const pin = mpin.join('')
    const confirm = confirmMpin.join('')
    if (!name.trim()) { setError('Name is required'); return }
    if (pin.length !== 4) { setError('Enter a 4-digit PIN'); return }
    if (confirm.length !== 4) { setError('Confirm your PIN'); return }
    if (pin !== confirm) { setError('PINs do not match'); return }

    setLoading(true)
    setError(null)
    try {
      const referralToken = localStorage.getItem('hj_pending_referral') ?? undefined
      const { token, member } = await authApi.register({ phone, name: name.trim(), avatar: '', mpin: pin, referral_token: referralToken })
      localStorage.removeItem('hj_pending_referral')
      onSuccess(token, member)
    } catch (e: unknown) {
      if ((e as { response?: { status?: number } })?.response?.status === 409) setError('This phone is already registered. Go back and log in.')
      else setError('Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      background: 'white', borderRadius: 16, padding: '32px 28px',
      width: '100%', maxWidth: 380, border: '1px solid #e4e4e7',
      maxHeight: '90vh', overflowY: 'auto',
    }}>
      <button
        onClick={onBack}
        style={{ background: 'none', border: 'none', color: '#71717a', fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 20, fontWeight: 500 }}
      >← Back</button>

      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5, color: '#18181b', margin: '0 0 4px' }}>Create profile</h2>
        <p style={{ color: '#71717a', fontSize: 13 }}>{phone}</p>
      </div>

      <FieldLabel>Your name</FieldLabel>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Alex"
        style={{
          width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 14,
          border: '1px solid #e4e4e7', outline: 'none', background: '#f9f9f9',
          boxSizing: 'border-box', marginBottom: 18, color: '#18181b',
        }}
      />

      <FieldLabel>Set your PIN</FieldLabel>
      <PinBox
        digits={mpin}
        refs={mpinRefs}
        onChange={makeDigitHandler(mpin, setMpin, mpinRefs, confirmRefs[0])}
        onKeyDown={makeKeyDownHandler(mpin, mpinRefs)}
      />

      <div style={{ marginTop: 14 }}><FieldLabel>Confirm PIN</FieldLabel></div>
      <PinBox
        digits={confirmMpin}
        refs={confirmRefs}
        onChange={makeDigitHandler(confirmMpin, setConfirmMpin, confirmRefs)}
        onKeyDown={makeKeyDownHandler(confirmMpin, confirmRefs)}
      />

      {error && <p style={{ color: '#ef4444', fontSize: 12, textAlign: 'center', marginTop: 12 }}>{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={loading}
        style={{
          width: '100%', marginTop: 18, padding: '12px 0', borderRadius: 8, border: 'none',
          background: loading ? '#e4e4e7' : ACCENT,
          color: loading ? '#a1a1aa' : 'white',
          fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'background 0.15s',
        }}
      >{loading ? 'Creating…' : 'Create account'}</button>
    </div>
  )
}
