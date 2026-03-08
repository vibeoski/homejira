import { useState } from 'react'
import { PhoneStep } from '../components/auth/PhoneStep'
import { MPINStep } from '../components/auth/MPINStep'
import { OTPStep } from '../components/auth/OTPStep'
import { RegisterStep } from '../components/auth/RegisterStep'
import { useAuthStore } from '../store/authStore'
import { householdsApi } from '../api/households'
import { AppLogo } from '../components/ui/AppLogo'
import type { Member } from '../types'

type Step = 'phone' | 'mpin' | 'otp' | 'register'

export function AuthPage() {
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [firebaseToken, setFirebaseToken] = useState<string | null>(null)
  const { setAuth } = useAuthStore()

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
      {/* Brand header — visible on all steps */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <AppLogo size={52} />
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5, color: '#18181b', margin: 0 }}>HomeJira</h1>
          <p style={{ fontSize: 13, color: '#a1a1aa', margin: '3px 0 0' }}>Your household, organized.</p>
        </div>
      </div>

      {step === 'phone' && (
        <PhoneStep
          onRegistered={(p) => { setPhone(p); setStep('mpin') }}
          onUnregistered={(p) => { setPhone(p); setStep('otp') }}
        />
      )}
      {step === 'mpin' && (
        <MPINStep phone={phone} onSuccess={handleSuccess} onBack={() => setStep('phone')} />
      )}
      {step === 'otp' && (
        <OTPStep
          phone={phone}
          onVerified={(token) => { setFirebaseToken(token); setStep('register') }}
          onBack={() => setStep('phone')}
        />
      )}
      {step === 'register' && (
        <RegisterStep phone={phone} onSuccess={handleSuccess} onBack={() => setStep('phone')} firebaseToken={firebaseToken ?? undefined} />
      )}

    </div>
  )
}
