import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useStore } from '../../store'
import { householdsApi } from '../../api/households'
import { membersApi } from '../../api/members'
import { authApi } from '../../api/auth'

const ACCENT = '#6366f1'

type HouseholdData = Awaited<ReturnType<typeof householdsApi.getMine>>['household']
type RequestsData = Awaited<ReturnType<typeof householdsApi.listRequests>>['requests']

// Persists across tab navigations so re-entering the page is instant
let _cache: { household: HouseholdData; requests: RequestsData } | null = null

export function HouseholdPanel() {
  const { isGuest, member, updateMember, setAuth } = useAuthStore()
  const { fetchTasks, fetchMembers, sseVersion } = useStore()
  const navigate = useNavigate()

  const [household, setHousehold] = useState<HouseholdData>(_cache?.household ?? null)
  const [loadingHousehold, setLoadingHousehold] = useState(_cache === null)

  const [createKind, setCreateKind] = useState<'home' | 'group'>('home')
  const [createName, setCreateName] = useState('')
  const [createBusy, setCreateBusy] = useState(false)

  const [code, setCode] = useState('')
  const [joinBusy, setJoinBusy] = useState(false)

  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [requests, setRequests] = useState<RequestsData>(_cache?.requests ?? [])
  const [requestsLoading, setRequestsLoading] = useState(_cache === null)

  const [copied, setCopied] = useState(false)
  const [sharingLink, setSharingLink] = useState(false)

  const [waitingRequest, setWaitingRequest] = useState<{ id: string; householdName: string } | null>(null)
  const [cancelBusy, setCancelBusy] = useState(false)

  const isAdmin = !!member && member.role === 'admin'
  const hasHousehold = !!member?.household_id

  useEffect(() => {
    if (isGuest || !member) return

    householdsApi.getMine().then(async ({ household: h }) => {
      const hh = h ?? null
      setHousehold(hh)
      _cache = { household: hh, requests: _cache?.requests ?? [] }
      if (hh && !member.household_id) {
        try {
          const fresh = await membersApi.getById(member.id)
          updateMember(fresh)
        } catch {
          updateMember({ ...member, household_id: hh.id })
        }
      }
    }).finally(() => setLoadingHousehold(false))

    if (member.role === 'admin') {
      householdsApi.listRequests().then(({ requests: r }) => {
        setRequests(r)
        _cache = { household: _cache?.household ?? null, requests: r }
      }).finally(() => setRequestsLoading(false))
    } else {
      setRequestsLoading(false)
    }

    if (!member.household_id) {
      householdsApi.getMyRequest().then(({ request }) => {
        if (request) setWaitingRequest({ id: request.id, householdName: 'household' })
      }).catch(() => {})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGuest, member?.id])

  // Refresh join requests whenever the SSE fires a household update
  useEffect(() => {
    if (isGuest || !member || member.role !== 'admin') return
    householdsApi.listRequests().then(({ requests }) => setRequests(requests)).catch(() => {})
  }, [isGuest, member, sseVersion])

  // When SSE fires (triggered by approve/reject on the member channel), check request status
  useEffect(() => {
    if (!waitingRequest || sseVersion === 0) return
    const check = async () => {
      try {
        const { request } = await householdsApi.getMyRequest()
        if (request) return // still pending
        const { token, member: freshMember } = await authApi.refresh()
        if (freshMember.household_id) {
          setAuth(token, freshMember)
          await Promise.all([fetchMembers(), fetchTasks()])
          navigate('/')
        } else {
          setWaitingRequest(null)
          setError('Your join request was declined.')
        }
      } catch {}
    }
    check()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sseVersion])

  if (isGuest || !member) return null

  const handleCancelRequest = async () => {
    if (!waitingRequest) return
    setCancelBusy(true)
    try {
      await householdsApi.cancelRequest(waitingRequest.id)
      setWaitingRequest(null)
    } catch {
      setError('Could not cancel request.')
    } finally {
      setCancelBusy(false)
    }
  }

  // Waiting screen
  if (waitingRequest) {
    return (
      <div style={{ padding: '56px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <div style={{
          width: 64, height: 64, borderRadius: 18, background: '#eef2ff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24,
        }} className="pulsate">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12,6 12,12 16,14" />
          </svg>
        </div>

        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#18181b', margin: '0 0 8px' }}>Waiting for approval</h2>
        <p style={{ fontSize: 13, color: '#71717a', lineHeight: 1.6, maxWidth: 260, margin: '0 0 12px' }}>
          Your request to join
        </p>
        <div style={{
          fontSize: 14, fontWeight: 700, color: ACCENT,
          background: '#eef2ff', padding: '5px 14px', borderRadius: 99,
          margin: '0 0 12px', border: '1px solid #c7d2fe',
        }}>
          {waitingRequest.householdName}
        </div>
        <p style={{ fontSize: 13, color: '#71717a', lineHeight: 1.6, maxWidth: 260, margin: '0 0 36px' }}>
          is pending. The admin will approve or decline. This page updates automatically.
        </p>

        {error && (
          <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fef2f2', color: '#ef4444', fontSize: 12, border: '1px solid #fecaca', marginBottom: 16, width: '100%', maxWidth: 300 }}>
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleCancelRequest}
          disabled={cancelBusy}
          style={{
            padding: '10px 28px', borderRadius: 8, border: '1px solid #e4e4e7',
            background: 'white', color: cancelBusy ? '#a1a1aa' : '#71717a',
            fontSize: 13, fontWeight: 600, cursor: cancelBusy ? 'not-allowed' : 'pointer',
          }}
        >{cancelBusy ? 'Cancelling…' : 'Cancel request'}</button>
      </div>
    )
  }

  const handleCreate = async () => {
    const trimmed = createName.trim()
    if (!trimmed) { setError('Name is required'); return }
    setCreateBusy(true); setError(null); setMessage(null)
    try {
      const { household: h, member: updatedMember } = await householdsApi.create({ name: trimmed, kind: createKind })
      updateMember(updatedMember)
      setHousehold(h)
      await Promise.all([fetchMembers(), fetchTasks()])
      setMessage(`Share code ${h.join_code} with your household.`)
    } catch {
      setError('Could not create household.')
    } finally {
      setCreateBusy(false)
    }
  }

  const handleJoin = async () => {
    const trimmed = code.trim()
    if (!trimmed) { setError('Enter a join code'); return }
    setJoinBusy(true); setError(null); setMessage(null)
    try {
      const { request: req, household: h } = await householdsApi.joinByCode({ code: trimmed })
      setCode('')
      setWaitingRequest({ id: req.id, householdName: h.name })
    } catch {
      setError('Invalid code. Please try again.')
    } finally {
      setJoinBusy(false)
    }
  }

  const handleCopyCode = () => {
    if (!household?.join_code) return
    navigator.clipboard?.writeText(household.join_code).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleShareLink = async () => {
    setSharingLink(true)
    try {
      const { token } = await householdsApi.createInviteLink()
      const url = `https://homejira.app/join/${token}`
      const shareTitle = `Join ${household?.name ?? 'our household'} on HomeJira`
      const shareText = `Join ${household?.name ?? 'our household'} on HomeJira 🏠 — the easiest way to manage your household tasks together.`
      if (navigator.share) {
        await navigator.share({ title: shareTitle, text: shareText, url })
      } else {
        await navigator.clipboard.writeText(`${shareText} Tap to join: ${url}`)
        setMessage('Invite link copied to clipboard!')
        setTimeout(() => setMessage(null), 3000)
      }
    } catch {
      // user cancelled share or clipboard failed — no-op
    } finally {
      setSharingLink(false)
    }
  }

  const handleApprove = async (id: string) => {
    try {
      await householdsApi.approveRequest(id)
      setRequests((prev) => prev.filter((r) => r.id !== id))
      await fetchMembers()
    } catch {}
  }

  const handleReject = async (id: string) => {
    try {
      await householdsApi.rejectRequest(id)
      setRequests((prev) => prev.filter((r) => r.id !== id))
    } catch {}
  }

  // No household: setup screen
  if (!hasHousehold && !household) {
    return (
      <div style={{ padding: '28px 16px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16, background: '#eef2ff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18,
        }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            <polyline points="9,22 9,12 15,12 15,22" />
          </svg>
        </div>

        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#18181b', margin: '0 0 6px', textAlign: 'center' }}>
          Set up your household
        </h2>
        <p style={{ fontSize: 13, color: '#71717a', margin: '0 0 28px', textAlign: 'center', maxWidth: 280, lineHeight: 1.5 }}>
          Create a shared space or join an existing one.
        </p>

        <div style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Create */}
          <div style={{ background: 'white', borderRadius: 12, padding: 18, border: '1px solid #e4e4e7' }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#a1a1aa', letterSpacing: 0.8, marginBottom: 12 }}>CREATE</p>

            <div style={{ display: 'flex', background: '#f4f4f5', padding: 3, borderRadius: 8, marginBottom: 12 }}>
              {(['home', 'group'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setCreateKind(k)}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 6, border: 'none',
                    background: createKind === k ? 'white' : 'transparent',
                    color: createKind === k ? ACCENT : '#71717a',
                    fontWeight: 600, fontSize: 13, cursor: 'pointer',
                    boxShadow: createKind === k ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.15s',
                  }}
                >{k === 'home' ? 'Home' : 'Group'}</button>
              ))}
            </div>

            <input
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder={createKind === 'home' ? 'e.g. The Apartment' : 'e.g. Chore Squad'}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e4e4e7',
                fontSize: 14, marginBottom: 12, boxSizing: 'border-box', background: '#f9f9f9', outline: 'none', color: '#18181b',
              }}
            />

            <button
              type="button"
              onClick={handleCreate}
              disabled={createBusy || !createName.trim()}
              style={{
                width: '100%', padding: '11px 0', borderRadius: 8, border: 'none',
                background: createBusy || !createName.trim() ? '#e4e4e7' : ACCENT,
                color: createBusy || !createName.trim() ? '#a1a1aa' : 'white',
                fontSize: 13, fontWeight: 700, cursor: createBusy || !createName.trim() ? 'not-allowed' : 'pointer',
              }}
            >{createBusy ? 'Creating…' : `Create ${createKind === 'home' ? 'home' : 'group'}`}</button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, height: 1, background: '#e4e4e7' }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: '#a1a1aa', letterSpacing: 0.3 }}>OR</span>
            <div style={{ flex: 1, height: 1, background: '#e4e4e7' }} />
          </div>

          {/* Join */}
          <div style={{ background: 'white', borderRadius: 12, padding: 18, border: '1px solid #e4e4e7' }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#a1a1aa', letterSpacing: 0.8, marginBottom: 12 }}>JOIN EXISTING</p>

            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="INVITE CODE"
                style={{
                  flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid #e4e4e7',
                  fontSize: 14, textTransform: 'uppercase', boxSizing: 'border-box',
                  background: '#f9f9f9', outline: 'none', letterSpacing: 1, color: '#18181b',
                }}
              />
              <button
                type="button"
                onClick={handleJoin}
                disabled={joinBusy || !code.trim()}
                style={{
                  padding: '0 18px', borderRadius: 8, border: 'none',
                  background: joinBusy || !code.trim() ? '#e4e4e7' : '#18181b',
                  color: joinBusy || !code.trim() ? '#a1a1aa' : 'white',
                  fontSize: 13, fontWeight: 700, cursor: joinBusy || !code.trim() ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >{joinBusy ? 'Sending…' : 'Join'}</button>
            </div>
          </div>

          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fef2f2', color: '#ef4444', fontSize: 12, border: '1px solid #fecaca' }}>
              {error}
            </div>
          )}
          {message && !error && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: '#f0fdf4', color: '#15803d', fontSize: 12, border: '1px solid #bbf7d0' }}>
              {message}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Has household: summary card
  const hasRequests = !requestsLoading && requests.length > 0

  return (
    <div style={{ padding: '12px 12px 0' }}>
      <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e4e4e7', overflow: 'hidden', marginBottom: 12 }}>
        {/* Name + role */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid #f4f4f5' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                <polyline points="9,22 9,12 15,12 15,22" />
              </svg>
            </div>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#18181b' }}>
              {loadingHousehold ? 'Loading…' : (household?.name ?? 'Your household')}
            </span>
          </div>
          {isAdmin && (
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#eef2ff', color: ACCENT }}>
              Admin
            </span>
          )}
        </div>

        {/* Invite code */}
        {household?.join_code && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 16px',
            borderBottom: isAdmin ? '1px solid #f4f4f5' : 'none',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: '#a1a1aa' }}>Invite code</span>
              <span style={{
                fontFamily: 'monospace', fontWeight: 700, fontSize: 13,
                background: '#eef2ff', color: ACCENT,
                padding: '2px 7px', borderRadius: 5, letterSpacing: 1,
              }}>{household.join_code}</span>
            </div>
            <button
              type="button"
              onClick={handleCopyCode}
              style={{
                border: 'none', background: copied ? '#f0fdf4' : '#f4f4f5',
                color: copied ? '#15803d' : '#71717a',
                borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
              }}
            >{copied ? 'Copied' : 'Copy'}</button>
          </div>
        )}

        {/* Share invite link — admin only */}
        {isAdmin && (
          <div style={{ padding: '10px 16px', borderBottom: '1px solid #f4f4f5' }}>
            <button
              type="button"
              onClick={handleShareLink}
              disabled={sharingLink}
              style={{
                width: '100%', padding: '9px 0', borderRadius: 8, border: `1px solid ${ACCENT}`,
                background: sharingLink ? '#f4f4f5' : '#eef2ff',
                color: sharingLink ? '#a1a1aa' : ACCENT,
                fontSize: 13, fontWeight: 700, cursor: sharingLink ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
              {sharingLink ? 'Generating…' : 'Share invite link'}
            </button>
          </div>
        )}

        {/* Join requests */}
        {isAdmin && (
          <div style={{ padding: '10px 16px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#71717a' }}>Join requests</span>
              {hasRequests && (
                <span style={{ fontSize: 10, fontWeight: 700, background: ACCENT, color: 'white', borderRadius: 999, padding: '1px 6px' }}>
                  {requests.length}
                </span>
              )}
            </div>

            {requestsLoading ? (
              <p style={{ fontSize: 12, color: '#a1a1aa' }}>Loading…</p>
            ) : requests.length === 0 ? (
              <p style={{ fontSize: 12, color: '#a1a1aa' }}>No pending requests</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {requests.map((r) => (
                  <div key={r.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: '#f9f9f9', borderRadius: 8, padding: '8px 10px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        width: 26, height: 26, borderRadius: '50%',
                        background: r.requester ? r.requester.color + '20' : '#e4e4e7',
                        border: r.requester ? `2px solid ${r.requester.color}` : 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, flexShrink: 0,
                      }}>{r.requester?.avatar ?? '?'}</span>
                      <span style={{ fontSize: 13, color: '#18181b', fontWeight: 600 }}>
                        {r.requester?.name ?? `#${r.requester_id.slice(0, 6)}`}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 5 }}>
                      <button
                        type="button"
                        onClick={() => handleApprove(r.id)}
                        style={{ border: 'none', background: '#dcfce7', color: '#15803d', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                      >Approve</button>
                      <button
                        type="button"
                        onClick={() => handleReject(r.id)}
                        style={{ border: 'none', background: '#fee2e2', color: '#b91c1c', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                      >Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {message && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: '#f0fdf4', color: '#15803d', fontSize: 12, border: '1px solid #bbf7d0', marginBottom: 12 }}>
          {message}
        </div>
      )}

      <div style={{ textAlign: 'center', paddingBottom: 24, paddingTop: 4 }}>
        <a
          href="https://buymeacoffee.com/vibeoski"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 12, color: '#a1a1aa', textDecoration: 'none',
            padding: '6px 12px', borderRadius: 99, border: '1px solid #e4e4e7',
            background: 'white', transition: 'all 0.15s',
          }}
        >
          ☕ Buy me a coffee
        </a>
      </div>
    </div>
  )
}
