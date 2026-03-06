import { useRef, useState } from 'react'
import { authApi } from '../../api/auth'
import type { Member } from '../../types'

interface Props {
  phone: string
  onSuccess: (token: string, member: Member) => void
  onBack: () => void
}

const ACCENT = '#6366f1'

export function MPINStep({ phone, onSuccess, onBack }: Props) {
  const [digits, setDigits] = useState(['', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const refs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ]

  const handleDigit = (idx: number, val: string) => {
    if (!/^\d?$/.test(val)) return
    const next = [...digits]
    next[idx] = val
    setDigits(next)
    if (val && idx < 3) refs[idx + 1].current?.focus()
    if (val && idx === 3) {
      const pin = [...next.slice(0, 3), val].join('')
      if (pin.length === 4) handleLogin(pin)
    }
  }

  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) refs[idx - 1].current?.focus()
  }

  const handleLogin = async (pin: string) => {
    setLoading(true)
    setError(null)
    try {
      const { token, member } = await authApi.login({ phone, mpin: pin })
      onSuccess(token, member)
    } catch {
      setError('Wrong PIN. Please try again.')
      setDigits(['', '', '', ''])
      refs[0].current?.focus()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ background: 'white', borderRadius: 16, padding: '36px 28px', width: '100%', maxWidth: 380, border: '1px solid #e4e4e7' }}>
      <button
        onClick={onBack}
        style={{ background: 'none', border: 'none', color: '#71717a', fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 24, fontWeight: 500 }}
      >← Back</button>

      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5, color: '#18181b', margin: '0 0 4px' }}>Enter your PIN</h2>
        <p style={{ color: '#71717a', fontSize: 13 }}>{phone}</p>
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 20 }}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={refs[i]}
            type="text"
            inputMode="numeric"
            value={d}
            maxLength={1}
            autoFocus={i === 0}
            onChange={(e) => handleDigit(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            style={{
              width: 54, height: 60, textAlign: 'center', fontSize: 24,
              borderRadius: 10, border: `1.5px solid ${d ? ACCENT : '#e4e4e7'}`,
              fontWeight: 700, outline: 'none',
              background: d ? '#eef2ff' : '#f9f9f9',
              color: '#18181b',
              transition: 'border-color 0.12s, background 0.12s',
            }}
          />
        ))}
      </div>

      {error && <p style={{ color: '#ef4444', fontSize: 12, textAlign: 'center', marginBottom: 10 }}>{error}</p>}
      {loading && <p style={{ color: '#a1a1aa', fontSize: 12, textAlign: 'center' }}>Verifying…</p>}
    </div>
  )
}
