import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { membersApi } from '../../api/members'
import { authApi } from '../../api/auth'
import { coinsApi, type CoinInfo } from '../../api/coins'
import { timeAgo } from '../../utils'
import { useThemeStore, type Theme } from '../../store/themeStore'

const AVATARS = ['🧑', '👩', '👨', '🧒', '👧', '👦', '🧓', '👴', '👵',
  '🐱', '🐶', '🦊', '🐼', '🐨', '🦁', '🐯', '🦄', '🌟']

const COLORS = ['#6366f1', '#0ea5e9', '#22c55e', '#ef4444', '#a855f7', '#f97316', '#ec4899', '#14b8a6']

type Sheet = 'profile' | 'pin' | 'coins' | null

const ACCENT = '#6366f1'

export function AccountMenu() {
  const [open, setOpen] = useState(false)
  const [sheet, setSheet] = useState<Sheet>(null)

  const [editName, setEditName] = useState('')
  const [editAvatar, setEditAvatar] = useState('')
  const [editColor, setEditColor] = useState('')
  const [saveBusy, setSaveBusy] = useState(false)

  const [pinCurrent, setPinCurrent] = useState('')
  const [pinNew, setPinNew] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [pinBusy, setPinBusy] = useState(false)
  const [pinError, setPinError] = useState<string | null>(null)
  const [pinSuccess, setPinSuccess] = useState(false)

  const [coinInfo, setCoinInfo] = useState<CoinInfo | null>(null)

  const navigate = useNavigate()
  const { member, isGuest, clearAuth, clearGuest, updateMember } = useAuthStore()
  const { theme, setTheme } = useThemeStore()

  useEffect(() => {
    if (!isGuest && member) {
      coinsApi.getMyCoins().then(setCoinInfo).catch(() => {})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member?.id, isGuest])

  const openProfile = () => {
    if (!member) return
    setEditName(member.name)
    setEditAvatar(member.avatar)
    setEditColor(member.color)
    setSheet('profile')
  }

  const openPin = () => {
    setPinCurrent(''); setPinNew(''); setPinConfirm('')
    setPinError(null); setPinSuccess(false)
    setSheet('pin')
  }

  const closeSheet = () => setSheet(null)

  const handleSaveProfile = async () => {
    if (!editName.trim()) return
    setSaveBusy(true)
    try {
      const updated = await membersApi.updateMe({ name: editName.trim(), avatar: editAvatar, color: editColor })
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
  const handleSignIn = () => { setOpen(false); clearGuest(); navigate('/auth') }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Account"
        style={{
          width: 32, height: 32, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 15, cursor: 'pointer',
          border: `2px solid ${member ? member.color : '#d4d4d8'}`,
          background: member ? member.color + '20' : '#f4f4f5',
          outline: 'none',
        }}
      >
        {isGuest ? '👤' : (member?.avatar ?? '👤')}
      </button>

      {/* Main sheet */}
      {open && (
        <div
          className="fade-in"
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'var(--shadow-overlay)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <div
            className="slide-up"
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--bg-surface)', width: '100%', maxWidth: 520, borderRadius: '18px 18px 0 0', paddingBottom: 36, overflow: 'hidden' }}
          >
            <div style={{ width: 36, height: 3, background: 'var(--border)', borderRadius: 99, margin: '14px auto 0' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 20px 16px' }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: member ? member.color + '20' : '#f4f4f5',
                border: `2px solid ${member ? member.color : '#d4d4d8'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, flexShrink: 0,
              }}>
                {isGuest ? '👤' : (member?.avatar ?? '👤')}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {isGuest ? 'Guest' : (member?.name ?? '')}
                </p>
                {!isGuest && member?.phone && (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>{member.phone}</p>
                )}
                {isGuest && <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>Browsing as guest</p>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                  {!isGuest && member?.role === 'admin' && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: '#eef2ff', color: ACCENT }}>Admin</span>
                  )}
                  {!isGuest && coinInfo != null && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setOpen(false); setSheet('coins') }}
                      style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: '#fef9c3', color: '#854d0e', border: 'none', cursor: 'pointer' }}
                    >🪙 {coinInfo.balance} coins</button>
                  )}
                </div>
              </div>
            </div>

            <div style={{ height: 1, background: 'var(--border-light)' }} />

            <div style={{ padding: '6px 0' }}>
              {isGuest ? (
                <MenuItem label="Sign in" onClick={handleSignIn} accent />
              ) : (
                <>
                  <MenuItem label="Edit profile" onClick={() => { setOpen(false); openProfile() }} />
                  <MenuItem label="Change PIN" onClick={() => { setOpen(false); openPin() }} />
                  <MenuItem label={`🪙 ${coinInfo?.balance ?? 0} coins`} onClick={() => { setOpen(false); setSheet('coins') }} />
                  <div style={{ height: 1, background: 'var(--border-light)', margin: '4px 0' }} />
                  <MenuItem label="Sign out" onClick={handleSignOut} danger />
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Profile sheet */}
      {sheet === 'profile' && (
        <div
          className="fade-in"
          onClick={closeSheet}
          style={{ position: 'fixed', inset: 0, background: 'var(--shadow-overlay)', zIndex: 201, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <div
            className="slide-up"
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--bg-surface)', width: '100%', maxWidth: 520, borderRadius: '18px 18px 0 0', padding: '0 0 44px', maxHeight: '88vh', overflowY: 'auto' }}
          >
            <div style={{ width: 36, height: 3, background: 'var(--border)', borderRadius: 99, margin: '14px auto 0' }} />

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0 16px' }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                background: editColor + '20', border: `2.5px solid ${editColor}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 34, marginBottom: 8, transition: 'border-color 0.15s',
              }}>{editAvatar}</div>
              <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{editName || 'Your name'}</p>
            </div>

            <div style={{ padding: '0 20px' }}>
              <FieldLabel>Avatar</FieldLabel>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 18 }}>
                {AVATARS.map((e) => (
                  <button key={e} type="button" onClick={() => setEditAvatar(e)} style={{
                    fontSize: 22, width: 42, height: 42, borderRadius: 10, cursor: 'pointer',
                    border: `2px solid ${editAvatar === e ? editColor : 'var(--border)'}`,
                    background: editAvatar === e ? editColor + '14' : 'var(--bg-surface)',
                    transition: 'border-color 0.12s',
                  }}>{e}</button>
                ))}
              </div>

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
                  width: '100%', padding: '11px 12px', borderRadius: 8, border: '1px solid var(--border)',
                  fontSize: 14, outline: 'none', background: 'var(--bg-subtle)', boxSizing: 'border-box', marginBottom: 20, color: 'var(--text-primary)',
                }}
              />

              <FieldLabel>Theme</FieldLabel>
              <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
                {([
                  { value: 'light', label: 'Light' },
                  { value: 'dark',  label: 'Dark' },
                  { value: 'system', label: 'System' },
                ] as { value: Theme; label: string }[]).map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTheme(value)}
                    style={{
                      flex: 1, padding: '8px 0', borderRadius: 8,
                      border: `1.5px solid ${theme === value ? ACCENT : 'var(--border)'}`,
                      background: theme === value ? ACCENT + '1a' : 'var(--bg-subtle)',
                      color: theme === value ? ACCENT : 'var(--text-secondary)',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      transition: 'all .12s',
                    }}
                  >{label}</button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={closeSheet} style={{
                  flex: 1, padding: '12px 0', borderRadius: 8, border: '1px solid var(--border)',
                  background: 'var(--bg-surface)', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer',
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
          style={{ position: 'fixed', inset: 0, background: 'var(--shadow-overlay)', zIndex: 201, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <div
            className="slide-up"
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--bg-surface)', width: '100%', maxWidth: 520, borderRadius: '18px 18px 0 0', padding: '0 0 44px', maxHeight: '80vh', overflowY: 'auto' }}
          >
            <div style={{ width: 36, height: 3, background: 'var(--border)', borderRadius: 99, margin: '14px auto 0' }} />
            <div style={{ padding: '18px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>My Coins</p>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#854d0e', background: '#fef9c3', borderRadius: 12, padding: '4px 14px' }}>
                🪙 {coinInfo?.balance ?? 0}
              </div>
            </div>

            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.8, textTransform: 'uppercase', margin: '20px 20px 10px' }}>
              How to earn
            </p>
            <div style={{ display: 'flex', gap: 8, padding: '0 20px', marginBottom: 20 }}>
              {[
                { icon: '🏠', label: 'Invite to household', coins: '+20' },
                { icon: '👥', label: 'Refer a friend', coins: '+10' },
              ].map((item) => (
                <div key={item.label} style={{ flex: 1, background: 'var(--bg-subtle)', borderRadius: 10, padding: '12px 10px', border: '1px solid var(--border-light)', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, marginBottom: 4 }}>{item.icon}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#854d0e' }}>{item.coins}</div>
                </div>
              ))}
            </div>

            <div style={{ height: 1, background: 'var(--border-light)', margin: '0 20px 16px' }} />
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.8, textTransform: 'uppercase', margin: '0 20px 10px' }}>
              History
            </p>

            {!coinInfo?.transactions.length ? (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '0 20px' }}>No transactions yet. Invite someone to earn coins!</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {coinInfo.transactions.map((t) => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px' }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                        {t.reason === 'household_invite'
                          ? `${t.meta?.member_name ?? 'Someone'} joined your household`
                          : `${t.meta?.referred_name ?? 'Someone'} signed up via your link`}
                      </p>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0' }}>{timeAgo(t.created_at)}</p>
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
          style={{ position: 'fixed', inset: 0, background: 'var(--shadow-overlay)', zIndex: 201, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <div
            className="slide-up"
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--bg-surface)', width: '100%', maxWidth: 520, borderRadius: '18px 18px 0 0', padding: '0 20px 44px' }}
          >
            <div style={{ width: 36, height: 3, background: 'var(--border)', borderRadius: 99, margin: '14px auto 20px' }} />
            <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20 }}>Change PIN</p>

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
                    flex: 1, padding: '12px 0', borderRadius: 8, border: '1px solid var(--border)',
                    background: 'var(--bg-surface)', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer',
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
  const color = danger ? '#ef4444' : accent ? ACCENT : 'var(--text-primary)'
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
    <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.6, textTransform: 'uppercase', margin: '0 0 7px' }}>
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
            color: 'var(--text-primary)', transition: 'border-color 0.12s, background 0.12s',
          }}
        />
      ))}
    </div>
  )
}
