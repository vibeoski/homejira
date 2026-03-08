import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from 'firebase/auth'
import { auth } from '../../firebase'
import { useAuthStore } from '../../store/authStore'
import { membersApi } from '../../api/members'
import { authApi } from '../../api/auth'
import { coinsApi, type CoinInfo } from '../../api/coins'
import { timeAgo } from '../../utils'

const COLORS = ['#6366f1', '#0ea5e9', '#22c55e', '#ef4444', '#a855f7', '#f97316', '#ec4899', '#14b8a6']

type Sheet = 'profile' | 'pin' | 'coins' | null

const ACCENT = '#6366f1'

export function AccountMenu() {
  const [open, setOpen] = useState(false)
  const [sheet, setSheet] = useState<Sheet>(null)

  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')
  const [saveBusy, setSaveBusy] = useState(false)

  const [pinCurrent, setPinCurrent] = useState('')
  const [pinNew, setPinNew] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [pinBusy, setPinBusy] = useState(false)
  const [pinError, setPinError] = useState<string | null>(null)
  const [pinSuccess, setPinSuccess] = useState(false)

  const [coinInfo, setCoinInfo] = useState<CoinInfo | null>(null)

  const [editEmail, setEditEmail] = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [emailMessage, setEmailMessage] = useState<string | null>(null)

  const [verifyingPhone, setVerifyingPhone] = useState(false)
  const [phoneOtpSent, setPhoneOtpSent] = useState(false)
  const [phoneOtp, setPhoneOtp] = useState('')
  const [phoneVerifyError, setPhoneVerifyError] = useState<string | null>(null)
  const [phoneVerifySaving, setPhoneVerifySaving] = useState(false)
  const confirmationRef = useRef<ConfirmationResult | null>(null)

  const navigate = useNavigate()
  const { member, clearAuth, updateMember } = useAuthStore()

  useEffect(() => {
    if (member) {
      coinsApi.getMyCoins().then(setCoinInfo).catch(() => {})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member?.id])

  const openProfile = () => {
    if (!member) return
    setEditName(member.name)
    setEditColor(member.color)
    setEditEmail('')
    setEmailMessage(null)
    setSheet('profile')
  }

  const handleAddEmail = async () => {
    if (!editEmail.trim()) return
    setEmailSending(true)
    try {
      const updated = await membersApi.updateMe({ name: member!.name, avatar: member?.avatar ?? '', color: member!.color, email: editEmail.trim() })
      updateMember(updated)
      await authApi.sendEmailVerification(editEmail.trim())
      setEmailMessage('Verification email sent! Check your inbox.')
      setEditEmail('')
      setTimeout(() => setEmailMessage(null), 5000)
    } catch {
      setEmailMessage('Could not add email. Please try again.')
    } finally {
      setEmailSending(false)
    }
  }

  const handleResendVerification = async () => {
    if (!member?.email) return
    setEmailSending(true)
    try {
      await authApi.sendEmailVerification(member.email)
      setEmailMessage('Verification email resent!')
      setTimeout(() => setEmailMessage(null), 3000)
    } catch {
      // no-op
    } finally {
      setEmailSending(false)
    }
  }

  const openPin = () => {
    setPinCurrent(''); setPinNew(''); setPinConfirm('')
    setPinError(null); setPinSuccess(false)
    setSheet('pin')
  }

  const closeSheet = () => {
    setSheet(null)
    setVerifyingPhone(false)
    setPhoneOtpSent(false)
    setPhoneOtp('')
    setPhoneVerifyError(null)
    setPhoneVerifySaving(false)
  }

  const handleStartPhoneVerify = async () => {
    if (!member?.phone) return
    setVerifyingPhone(true)
    setPhoneVerifyError(null)
    try {
      const recaptcha = new RecaptchaVerifier(auth, 'recaptcha-container-account', { size: 'invisible' })
      const result = await signInWithPhoneNumber(auth, member.phone, recaptcha)
      confirmationRef.current = result
      setPhoneOtpSent(true)
    } catch {
      setPhoneVerifyError('Failed to send OTP. Please try again.')
      setVerifyingPhone(false)
    }
  }

  const handleConfirmPhoneOtp = async () => {
    if (!confirmationRef.current || phoneOtp.length !== 6) return
    setPhoneVerifySaving(true)
    setPhoneVerifyError(null)
    try {
      const credential = await confirmationRef.current.confirm(phoneOtp)
      const idToken = await credential.user.getIdToken()
      const updated = await authApi.verifyPhone(idToken)
      updateMember(updated)
      setPhoneOtp('')
      setPhoneOtpSent(false)
      setVerifyingPhone(false)
    } catch {
      setPhoneVerifyError('Invalid code. Please try again.')
    } finally {
      setPhoneVerifySaving(false)
    }
  }

  const handleSaveProfile = async () => {
    if (!editName.trim()) return
    setSaveBusy(true)
    try {
      const updated = await membersApi.updateMe({ name: editName.trim(), avatar: member?.avatar ?? '', color: editColor })
      updateMember(updated)
      closeSheet()
    } finally {
      setSaveBusy(false)
    }
  }

  const handleSavePin = async () => {
    if (pinNew.length !== 4) { setPinError('New PIN must be 4 digits'); return }
    if (pinNew !== pinConfirm) { setPinError('PINs do not match'); return }
    setPinBusy(true); setPinError(null)
    try {
      await authApi.changeMpin(pinCurrent, pinNew)
      setPinSuccess(true)
      setTimeout(closeSheet, 1500)
    } catch (e: unknown) {
      setPinError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Could not change PIN.')
    } finally {
      setPinBusy(false)
    }
  }

  const handleSignOut = () => { setOpen(false); clearAuth(); navigate('/auth') }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Account"
        style={{
          width: 32, height: 32, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700, cursor: 'pointer',
          background: member ? member.color : '#d4d4d8',
          color: 'white',
          border: 'none',
          outline: 'none',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {member ? (member.name?.charAt(0).toUpperCase() || '?') : '?'}
      </button>

      {/* Main sheet */}
      {open && (
        <div
          className="fade-in"
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, background: '#00000040', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <div
            className="slide-up"
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'white', width: '100%', maxWidth: 520, borderRadius: '18px 18px 0 0', paddingBottom: 36, overflow: 'hidden' }}
          >
            <div style={{ width: 36, height: 3, background: '#d4d4d8', borderRadius: 99, margin: '14px auto 0' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 20px 16px' }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: member ? member.color : '#d4d4d8',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, fontWeight: 700, color: 'white', flexShrink: 0,
                fontFamily: 'system-ui, sans-serif',
              }}>
                {member ? (member.name?.charAt(0).toUpperCase() || '?') : '?'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#18181b', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {member?.name ?? ''}
                </p>
                {member?.phone && (
                  <p style={{ fontSize: 12, color: '#a1a1aa', margin: '2px 0 0' }}>{member.phone}</p>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                  {member?.role === 'admin' && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: '#eef2ff', color: ACCENT }}>Admin</span>
                  )}
                  {coinInfo != null && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setOpen(false); setSheet('coins') }}
                      style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: '#fef9c3', color: '#854d0e', border: 'none', cursor: 'pointer' }}
                    >🪙 {coinInfo.balance} coins</button>
                  )}
                </div>
              </div>
            </div>

            <div style={{ height: 1, background: '#f4f4f5' }} />

            <div style={{ padding: '6px 0' }}>
              <>
                <MenuItem label="Edit profile" onClick={() => { setOpen(false); openProfile() }} />
                <MenuItem label="Change PIN" onClick={() => { setOpen(false); openPin() }} />
                <MenuItem label={`🪙 ${coinInfo?.balance ?? 0} coins`} onClick={() => { setOpen(false); setSheet('coins') }} />
                <div style={{ height: 1, background: '#f4f4f5', margin: '4px 0' }} />
                <MenuItem label="Sign out" onClick={handleSignOut} danger />
              </>
            </div>
          </div>
        </div>
      )}

      {/* Profile sheet */}
      {sheet === 'profile' && (
        <div
          className="fade-in"
          onClick={closeSheet}
          style={{ position: 'fixed', inset: 0, background: '#00000040', zIndex: 201, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <div
            className="slide-up"
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'white', width: '100%', maxWidth: 520, borderRadius: '18px 18px 0 0', padding: '0 0 44px', maxHeight: '88vh', overflowY: 'auto' }}
          >
            <div style={{ width: 36, height: 3, background: '#d4d4d8', borderRadius: 99, margin: '14px auto 0' }} />

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0 16px' }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                background: editColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 30, fontWeight: 700, color: 'white', marginBottom: 8,
                fontFamily: 'system-ui, sans-serif', transition: 'background 0.15s',
              }}>
                {editName?.charAt(0).toUpperCase() || '?'}
              </div>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#18181b' }}>{editName || 'Your name'}</p>
            </div>

            <div style={{ padding: '0 20px' }}>
              <FieldLabel>Color</FieldLabel>
              <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
                {COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setEditColor(c)} style={{
                    width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer',
                    border: `3px solid ${editColor === c ? '#18181b' : 'transparent'}`,
                    outline: 'none', padding: 0, transition: 'border-color 0.12s',
                    boxShadow: editColor === c ? '0 0 0 2px white inset' : 'none',
                  }} />
                ))}
              </div>

              <FieldLabel>Name</FieldLabel>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Your name"
                style={{
                  width: '100%', padding: '11px 12px', borderRadius: 8, border: '1px solid #e4e4e7',
                  fontSize: 14, outline: 'none', background: '#f9f9f9', boxSizing: 'border-box', marginBottom: 20, color: '#18181b',
                }}
              />

              {/* Verification status */}
              <div style={{ marginBottom: 20 }}>
                <FieldLabel>Account security</FieldLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

                  {/* Phone verified status */}
                  <div style={{ borderRadius: 8, background: '#f9f9f9', border: '1px solid #e4e4e7', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 8.81a19.79 19.79 0 01-3.07-8.63A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z" />
                        </svg>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 600, color: '#18181b', margin: 0 }}>Phone number</p>
                          <p style={{ fontSize: 11, color: '#a1a1aa', margin: '1px 0 0' }}>{member?.phone}</p>
                        </div>
                      </div>
                      {member?.phone_verified ? (
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#15803d', background: '#dcfce7', padding: '3px 8px', borderRadius: 999 }}>Verified</span>
                      ) : !verifyingPhone ? (
                        <button
                          type="button"
                          onClick={handleStartPhoneVerify}
                          style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', background: '#eef2ff', border: 'none', padding: '3px 8px', borderRadius: 999, cursor: 'pointer' }}
                        >Verify now</button>
                      ) : !phoneOtpSent ? (
                        <span style={{ fontSize: 11, color: '#a1a1aa' }}>Sending…</span>
                      ) : null}
                    </div>

                    {/* Inline OTP entry */}
                    {verifyingPhone && phoneOtpSent && (
                      <div style={{ padding: '10px 12px', borderTop: '1px solid #e4e4e7' }}>
                        <p style={{ fontSize: 12, color: '#71717a', margin: '0 0 8px' }}>
                          Enter the 6-digit code sent to {member?.phone}
                        </p>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={phoneOtp}
                            onChange={(e) => { if (/^\d{0,6}$/.test(e.target.value)) setPhoneOtp(e.target.value) }}
                            placeholder="000000"
                            style={{
                              flex: 1, padding: '9px 10px', borderRadius: 7, border: '1px solid #e4e4e7',
                              fontSize: 16, fontWeight: 700, letterSpacing: 4, outline: 'none',
                              background: 'white', color: '#18181b', textAlign: 'center',
                            }}
                          />
                          <button
                            type="button"
                            onClick={handleConfirmPhoneOtp}
                            disabled={phoneVerifySaving || phoneOtp.length !== 6}
                            style={{
                              padding: '0 14px', borderRadius: 7, border: 'none',
                              background: phoneVerifySaving || phoneOtp.length !== 6 ? '#e4e4e7' : '#6366f1',
                              color: phoneVerifySaving || phoneOtp.length !== 6 ? '#a1a1aa' : 'white',
                              fontSize: 12, fontWeight: 700, cursor: phoneVerifySaving || phoneOtp.length !== 6 ? 'not-allowed' : 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >{phoneVerifySaving ? '…' : 'Confirm'}</button>
                        </div>
                        {phoneVerifyError && (
                          <p style={{ fontSize: 11, color: '#ef4444', margin: '6px 0 0' }}>{phoneVerifyError}</p>
                        )}
                        <button
                          type="button"
                          onClick={() => { setVerifyingPhone(false); setPhoneOtpSent(false); setPhoneOtp(''); setPhoneVerifyError(null) }}
                          style={{ background: 'none', border: 'none', fontSize: 11, color: '#a1a1aa', cursor: 'pointer', padding: '4px 0', marginTop: 4 }}
                        >Cancel</button>
                      </div>
                    )}

                    {/* Invisible recaptcha container */}
                    <div id="recaptcha-container-account" />
                  </div>

                  {/* Email row */}
                  <div style={{ padding: '10px 12px', borderRadius: 8, background: '#f9f9f9', border: '1px solid #e4e4e7' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: member?.email ? 6 : 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                          <polyline points="22,6 12,13 2,6" />
                        </svg>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 600, color: '#18181b', margin: 0 }}>Recovery email</p>
                          {member?.email && <p style={{ fontSize: 11, color: '#a1a1aa', margin: '1px 0 0' }}>{member.email}</p>}
                        </div>
                      </div>
                      {member?.email ? (
                        member?.email_verified ? (
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#15803d', background: '#dcfce7', padding: '3px 8px', borderRadius: 999 }}>Verified</span>
                        ) : (
                          <button type="button" onClick={handleResendVerification} disabled={emailSending}
                            style={{ fontSize: 11, fontWeight: 600, color: '#6366f1', background: '#eef2ff', border: 'none', padding: '3px 8px', borderRadius: 999, cursor: 'pointer' }}>
                            {emailSending ? 'Sending…' : 'Resend'}
                          </button>
                        )
                      ) : null}
                    </div>
                    {!member?.email && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                        <input
                          type="email"
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          placeholder="Add recovery email"
                          style={{ flex: 1, padding: '8px 10px', borderRadius: 7, border: '1px solid #e4e4e7', fontSize: 13, outline: 'none', background: 'white', color: '#18181b' }}
                        />
                        <button type="button" onClick={handleAddEmail} disabled={!editEmail.trim() || emailSending}
                          style={{ padding: '0 12px', borderRadius: 7, border: 'none', background: !editEmail.trim() || emailSending ? '#e4e4e7' : '#6366f1', color: !editEmail.trim() || emailSending ? '#a1a1aa' : 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                          {emailSending ? '…' : 'Add'}
                        </button>
                      </div>
                    )}
                    {!member?.email && (
                      <p style={{ fontSize: 11, color: '#a1a1aa', margin: '6px 0 0', lineHeight: 1.5 }}>
                        🔒 Used only to recover your account if you forget your PIN.
                      </p>
                    )}
                    {emailMessage && (
                      <p style={{ fontSize: 11, color: '#15803d', margin: '6px 0 0' }}>{emailMessage}</p>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={closeSheet} style={{
                  flex: 1, padding: '12px 0', borderRadius: 8, border: '1px solid #e4e4e7',
                  background: 'white', fontSize: 13, fontWeight: 600, color: '#71717a', cursor: 'pointer',
                }}>Cancel</button>
                <button
                  type="button" onClick={handleSaveProfile}
                  disabled={saveBusy || !editName.trim()}
                  style={{
                    flex: 2, padding: '12px 0', borderRadius: 8, border: 'none',
                    background: saveBusy || !editName.trim() ? '#e4e4e7' : ACCENT,
                    color: saveBusy || !editName.trim() ? '#a1a1aa' : 'white',
                    fontSize: 13, fontWeight: 700, cursor: saveBusy || !editName.trim() ? 'not-allowed' : 'pointer',
                  }}
                >{saveBusy ? 'Saving…' : 'Save changes'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Coins sheet */}
      {sheet === 'coins' && (
        <div
          className="fade-in"
          onClick={closeSheet}
          style={{ position: 'fixed', inset: 0, background: '#00000040', zIndex: 201, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <div
            className="slide-up"
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'white', width: '100%', maxWidth: 520, borderRadius: '18px 18px 0 0', padding: '0 0 44px', maxHeight: '80vh', overflowY: 'auto' }}
          >
            <div style={{ width: 36, height: 3, background: '#d4d4d8', borderRadius: 99, margin: '14px auto 0' }} />
            <div style={{ padding: '18px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: 17, fontWeight: 700, color: '#18181b', margin: 0 }}>My Coins</p>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#854d0e', background: '#fef9c3', borderRadius: 12, padding: '4px 14px' }}>
                🪙 {coinInfo?.balance ?? 0}
              </div>
            </div>

            <p style={{ fontSize: 11, fontWeight: 700, color: '#a1a1aa', letterSpacing: 0.8, textTransform: 'uppercase', margin: '20px 20px 10px' }}>
              How to earn
            </p>
            <div style={{ display: 'flex', gap: 8, padding: '0 20px', marginBottom: 20 }}>
              {[
                { icon: '🏠', label: 'Invite to household', coins: '+20' },
                { icon: '👥', label: 'Refer a friend', coins: '+10' },
              ].map((item) => (
                <div key={item.label} style={{ flex: 1, background: '#f9f9f9', borderRadius: 10, padding: '12px 10px', border: '1px solid #f4f4f5', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, marginBottom: 4 }}>{item.icon}</div>
                  <div style={{ fontSize: 11, color: '#71717a', marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#854d0e' }}>{item.coins}</div>
                </div>
              ))}
            </div>

            <div style={{ height: 1, background: '#f4f4f5', margin: '0 20px 16px' }} />
            <p style={{ fontSize: 11, fontWeight: 700, color: '#a1a1aa', letterSpacing: 0.8, textTransform: 'uppercase', margin: '0 20px 10px' }}>
              History
            </p>

            {!coinInfo?.transactions.length ? (
              <p style={{ fontSize: 13, color: '#a1a1aa', padding: '0 20px' }}>No transactions yet. Invite someone to earn coins!</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {coinInfo.transactions.map((t) => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px' }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#18181b', margin: 0 }}>
                        {t.reason === 'household_invite'
                          ? `${t.meta?.member_name ?? 'Someone'} joined your household`
                          : `${t.meta?.referred_name ?? 'Someone'} signed up via your link`}
                      </p>
                      <p style={{ fontSize: 11, color: '#a1a1aa', margin: '2px 0 0' }}>{timeAgo(t.created_at)}</p>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 800, color: '#15803d' }}>+{t.amount}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* PIN sheet */}
      {sheet === 'pin' && (
        <div
          className="fade-in"
          onClick={closeSheet}
          style={{ position: 'fixed', inset: 0, background: '#00000040', zIndex: 201, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <div
            className="slide-up"
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'white', width: '100%', maxWidth: 520, borderRadius: '18px 18px 0 0', padding: '0 20px 44px' }}
          >
            <div style={{ width: 36, height: 3, background: '#d4d4d8', borderRadius: 99, margin: '14px auto 20px' }} />
            <p style={{ fontSize: 17, fontWeight: 700, color: '#18181b', marginBottom: 20 }}>Change PIN</p>

            {pinSuccess ? (
              <div style={{ textAlign: 'center', padding: '28px 0' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </div>
                <p style={{ fontSize: 15, fontWeight: 600, color: '#15803d' }}>PIN changed</p>
              </div>
            ) : (
              <>
                {[
                  { label: 'Current PIN', val: pinCurrent, set: setPinCurrent },
                  { label: 'New PIN', val: pinNew, set: setPinNew },
                  { label: 'Confirm new PIN', val: pinConfirm, set: setPinConfirm },
                ].map(({ label, val, set }) => (
                  <div key={label} style={{ marginBottom: 14 }}>
                    <FieldLabel>{label}</FieldLabel>
                    <PinRow value={val} onChange={set} />
                  </div>
                ))}

                {pinError && <p style={{ fontSize: 12, color: '#ef4444', marginBottom: 14 }}>{pinError}</p>}

                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button type="button" onClick={closeSheet} style={{
                    flex: 1, padding: '12px 0', borderRadius: 8, border: '1px solid #e4e4e7',
                    background: 'white', fontSize: 13, fontWeight: 600, color: '#71717a', cursor: 'pointer',
                  }}>Cancel</button>
                  <button
                    type="button" onClick={handleSavePin}
                    disabled={pinBusy || pinCurrent.length !== 4 || pinNew.length !== 4 || pinConfirm.length !== 4}
                    style={{
                      flex: 2, padding: '12px 0', borderRadius: 8, border: 'none',
                      background: ACCENT, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    }}
                  >{pinBusy ? 'Saving…' : 'Change PIN'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function MenuItem({ label, onClick, accent, danger }: { label: string; onClick: () => void; accent?: boolean; danger?: boolean }) {
  const color = danger ? '#ef4444' : accent ? ACCENT : '#18181b'
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%', padding: '12px 20px', background: 'none', border: 'none',
        textAlign: 'left', fontSize: 14, fontWeight: 500, color, cursor: 'pointer',
        display: 'flex', alignItems: 'center',
      }}
    >{label}</button>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 10, fontWeight: 700, color: '#a1a1aa', letterSpacing: 0.6, textTransform: 'uppercase', margin: '0 0 7px' }}>
      {children}
    </p>
  )
}

function PinRow({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {[0, 1, 2, 3].map((i) => (
        <input
          key={i}
          type="password"
          inputMode="numeric"
          maxLength={1}
          value={value[i] ?? ''}
          onChange={(e) => {
            if (!/^\d?$/.test(e.target.value)) return
            const arr = value.split('')
            arr[i] = e.target.value
            onChange(arr.join('').slice(0, 4))
          }}
          style={{
            flex: 1, height: 48, textAlign: 'center', fontSize: 20, fontWeight: 700,
            borderRadius: 8, border: `1.5px solid ${value[i] ? ACCENT : '#e4e4e7'}`,
            outline: 'none', background: value[i] ? '#eef2ff' : '#f9f9f9',
            color: '#18181b', transition: 'border-color 0.12s, background 0.12s',
          }}
        />
      ))}
    </div>
  )
}
