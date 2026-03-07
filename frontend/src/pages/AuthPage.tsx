import { useState } from 'react'
import { PhoneStep } from '../components/auth/PhoneStep'
import { MPINStep } from '../components/auth/MPINStep'
import { RegisterStep } from '../components/auth/RegisterStep'
import { useAuthStore } from '../store/authStore'
import { householdsApi } from '../api/households'
import type { Member } from '../types'

type Step = 'phone' | 'mpin' | 'register'

export function AuthPage() {
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const { setAuth, setGuest } = useAuthStore()

  const handleSuccess = async (token: string, member: Member) => {
    const pendingJoin = localStorage.getItem('hj_pending_join')
    if (pendingJoin) {
      localStorage.removeItem('hj_pending_join')
      // Set the token so the API call can authenticate
      localStorage.setItem('hj_token', token)
      try {
        const { member: updatedMember } = await householdsApi.joinByInviteToken(pendingJoin)
        setAuth(token, updatedMember)
        return
      } catch {
        // Join failed (e.g. link expired) — continue with normal auth
      }
    }
    setAuth(token, member)
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#f4f4f5',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '20px 16px', gap: 14,
    }}>
      {step === 'phone' && (
        <PhoneStep
          onRegistered={(p) => { setPhone(p); setStep('mpin') }}
          onUnregistered={(p) => { setPhone(p); setStep('register') }}
        />
      )}
      {step === 'mpin' && (
        <MPINStep phone={phone} onSuccess={handleSuccess} onBack={() => setStep('phone')} />
      )}
      {step === 'register' && (
        <RegisterStep phone={phone} onSuccess={handleSuccess} onBack={() => setStep('phone')} />
      )}

      {step === 'phone' && (
        <div style={{ width: '100%', maxWidth: 380, textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ flex: 1, height: 1, background: '#e4e4e7' }} />
            <span style={{ color: '#a1a1aa', fontSize: 12 }}>or</span>
            <div style={{ flex: 1, height: 1, background: '#e4e4e7' }} />
          </div>

          <button
            onClick={setGuest}
            style={{
              width: '100%', padding: '12px 0', borderRadius: 10,
              border: '1px solid #e4e4e7', background: 'white',
              color: '#71717a', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >Continue as guest</button>

          <p style={{ marginTop: 8, fontSize: 12, color: '#a1a1aa', lineHeight: 1.5 }}>
            Data saved locally on this device only.
          </p>
        </div>
      )}
    </div>
  )
}
