import { useState } from 'react'
import { PhoneStep } from '../components/auth/PhoneStep'
import { MPINStep } from '../components/auth/MPINStep'
import { RegisterStep } from '../components/auth/RegisterStep'
import { useAuthStore } from '../store/authStore'
import { householdsApi } from '../api/households'
import { AppLogo } from '../components/ui/AppLogo'
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
      minHeight: '100vh', background: 'var(--bg-muted)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '20px 16px', gap: 14,
    }}>
      {/* Brand header — visible on all steps */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <AppLogo size={52} />
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5, color: 'var(--text-primary)', margin: 0 }}>HomeJira</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '3px 0 0' }}>Your household, organized.</p>
        </div>
      </div>

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
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>or</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          <button
            onClick={setGuest}
            style={{
              width: '100%', padding: '12px 0', borderRadius: 10,
              border: '1px solid var(--border)', background: 'var(--bg-surface)',
              color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >Continue as guest</button>

          <p style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Data saved locally on this device only.
          </p>
        </div>
      )}
    </div>
  )
}
