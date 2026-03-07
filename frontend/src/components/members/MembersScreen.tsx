import { useState } from 'react'
import { Avatar } from '../ui/Avatar'
import { householdsApi } from '../../api/households'
import { useStore } from '../../store'
import { useAuthStore } from '../../store/authStore'
import type { Task, Member } from '../../types'

interface Props {
  tasks: Task[]
  members: Member[]
  currentMember: Member | null
  isAdmin: boolean
}

const ACCENT = '#6366f1'

type LeaveStep = 'confirm' | 'last_admin_choice' | 'pick_admin' | 'confirm_delete' | null

export function MembersScreen({ tasks, members, currentMember, isAdmin }: Props) {
  const { fetchMembers, fetchTasks } = useStore()
  const { updateMember, clearAuth } = useAuthStore()
  const [removing, setRemoving] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)
  const [promoting, setPromoting] = useState<string | null>(null)
  const [flashSuccess, setFlashSuccess] = useState<string | null>(null)

  const [leaveStep, setLeaveStep] = useState<LeaveStep>(null)
  const [selectedAdminId, setSelectedAdminId] = useState<string | null>(null)
  const [leaveBusy, setLeaveBusy] = useState(false)
  const [leaveError, setLeaveError] = useState<string | null>(null)

  const adminCount = members.filter((m) => m.role === 'admin').length
  const isOnlyAdmin = currentMember?.role === 'admin' && adminCount <= 1
  const isSoleMember = members.length === 1

  const handlePromote = async (id: string) => {
    setPromoting(id)
    try {
      await householdsApi.promoteMember(id)
      setFlashSuccess(id)
      setTimeout(() => setFlashSuccess(null), 800)
      await fetchMembers()
    } catch {
      // no-op
    } finally {
      setPromoting(null)
    }
  }

  const handleRemove = async (id: string) => {
    setConfirmRemove(null)
    setRemoving(id)
    try {
      await householdsApi.removeMember(id)
      await fetchMembers()
    } catch {
      // no-op
    } finally {
      setRemoving(null)
    }
  }

  const openLeave = () => {
    setLeaveError(null)
    setSelectedAdminId(null)
    if (isOnlyAdmin && isSoleMember) {
      setLeaveStep('confirm_delete')
    } else if (isOnlyAdmin) {
      setLeaveStep('last_admin_choice')
    } else {
      setLeaveStep('confirm')
    }
  }

  const handleLeave = async () => {
    setLeaveBusy(true)
    setLeaveError(null)
    try {
      if (selectedAdminId) {
        await householdsApi.promoteMember(selectedAdminId)
      }
      const { member: updated } = await householdsApi.leave()
      updateMember(updated)
      await Promise.all([fetchMembers(), fetchTasks()])
      setLeaveStep(null)
    } catch (e: unknown) {
      setLeaveError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Could not leave household.')
    } finally {
      setLeaveBusy(false)
    }
  }

  const handleDeleteHousehold = async () => {
    setLeaveBusy(true)
    setLeaveError(null)
    try {
      await householdsApi.deleteHousehold()
      clearAuth()
    } catch (e: unknown) {
      setLeaveError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Could not delete household.')
    } finally {
      setLeaveBusy(false)
    }
  }

  return (
    <div style={{ padding: '8px 12px 100px' }}>
      {members.map((m) => {
        const mine = tasks.filter((x) => x.assignee_id === m.id)
        const open = mine.filter((x) => !x.done)
        const urgent = open.filter((x) => x.priority === 'urgent')
        const isSelf = m.id === currentMember?.id
        return (
          <div
            key={m.id}
            className={flashSuccess === m.id ? 'flash-green' : undefined}
            style={{ background: 'white', borderRadius: 12, padding: 16, border: '1px solid #e4e4e7', marginBottom: 8 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: open.length > 0 ? 12 : 0 }}>
              <Avatar member={m} size={40} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#18181b' }}>{m.name}</p>
                  {m.role === 'admin' && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 999, background: '#eef2ff', color: ACCENT }}>
                      Admin
                    </span>
                  )}
                  {isSelf && (
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 999, background: '#f4f4f5', color: '#71717a' }}>
                      You
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 12, color: '#a1a1aa' }}>{open.length} open tasks</p>
              </div>
              {urgent.length > 0 && (
                <span style={{ background: '#fef2f2', color: '#ef4444', borderRadius: 99, padding: '3px 8px', fontSize: 11, fontWeight: 700 }}>
                  {urgent.length} urgent
                </span>
              )}
              {isAdmin && !isSelf && (
                <div style={{ display: 'flex', gap: 5 }}>
                  {m.role !== 'admin' && confirmRemove !== m.id && (
                    <button
                      onClick={() => handlePromote(m.id)}
                      disabled={promoting === m.id}
                      style={{
                        border: 'none', background: promoting === m.id ? '#f4f4f5' : '#eef2ff',
                        color: promoting === m.id ? '#a1a1aa' : ACCENT,
                        borderRadius: 7, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      }}
                    >{promoting === m.id ? '…' : 'Promote'}</button>
                  )}
                  {confirmRemove === m.id ? (
                    <>
                      <button
                        onClick={() => setConfirmRemove(null)}
                        style={{ border: 'none', background: '#f4f4f5', color: '#71717a', borderRadius: 7, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                      >Cancel</button>
                      <button
                        onClick={() => handleRemove(m.id)}
                        disabled={removing === m.id}
                        style={{ border: 'none', background: '#ef4444', color: 'white', borderRadius: 7, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                      >{removing === m.id ? '…' : 'Confirm'}</button>
                    </>
                  ) : (
                    <button
                      onClick={() => setConfirmRemove(m.id)}
                      style={{ border: 'none', background: '#f4f4f5', color: '#a1a1aa', borderRadius: 7, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                    >Remove</button>
                  )}
                </div>
              )}
            </div>
            {open.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {open.slice(0, 3).map((t) => (
                  <span key={t.id} style={{ background: '#f4f4f5', borderRadius: 6, padding: '3px 8px', fontSize: 11, color: '#71717a' }}>
                    {t.title.length > 22 ? t.title.slice(0, 22) + '…' : t.title}
                  </span>
                ))}
                {open.length > 3 && (
                  <span style={{ background: '#f4f4f5', borderRadius: 6, padding: '3px 8px', fontSize: 11, color: '#a1a1aa' }}>
                    +{open.length - 3} more
                  </span>
                )}
              </div>
            )}
          </div>
        )
      })}

      <div style={{ marginTop: 8, marginBottom: 8 }}>
        <button
          type="button"
          onClick={openLeave}
          style={{
            width: '100%', padding: '12px 0', borderRadius: 10,
            border: '1px solid #fecaca', background: 'var(--bg-surface)',
            color: '#ef4444', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >Leave household</button>
      </div>

      {/* Leave flow modal */}
      {leaveStep && (
        <div
          className="fade-in"
          onClick={() => { if (!leaveBusy) setLeaveStep(null) }}
          style={{ position: 'fixed', inset: 0, background: 'var(--shadow-overlay)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <div
            className="slide-up"
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--bg-surface)', width: '100%', maxWidth: 520, borderRadius: '18px 18px 0 0', padding: '0 20px 44px' }}
          >
            <div style={{ width: 36, height: 3, background: 'var(--border)', borderRadius: 99, margin: '14px auto 20px' }} />

            {/* Simple confirm leave */}
            {leaveStep === 'confirm' && (
              <>
                <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Leave household?</p>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.5 }}>
                  Your open tasks will be reassigned. You can rejoin with an invite code.
                </p>
                {leaveError && <p style={{ fontSize: 12, color: '#ef4444', marginBottom: 12 }}>{leaveError}</p>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={() => setLeaveStep(null)} style={cancelBtnStyle}>Cancel</button>
                  <button type="button" onClick={handleLeave} disabled={leaveBusy} style={dangerBtnStyle}>
                    {leaveBusy ? 'Leaving…' : 'Yes, leave'}
                  </button>
                </div>
              </>
            )}

            {/* Sole admin with other members: choose action */}
            {leaveStep === 'last_admin_choice' && (
              <>
                <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>You are the only admin</p>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.5 }}>
                  Before leaving, assign a new admin or delete the group.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setLeaveStep('pick_admin')}
                    style={{
                      width: '100%', padding: '12px 0', borderRadius: 10,
                      border: '1px solid #6366f1', background: '#eef2ff',
                      color: '#6366f1', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    }}
                  >Assign new admin & leave</button>
                  <button
                    type="button"
                    onClick={() => setLeaveStep('confirm_delete')}
                    style={dangerBtnStyle}
                  >Delete group</button>
                  <button type="button" onClick={() => setLeaveStep(null)} style={cancelBtnStyle}>Cancel</button>
                </div>
              </>
            )}

            {/* Pick who becomes the new admin */}
            {leaveStep === 'pick_admin' && (
              <>
                <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>Choose a new admin</p>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
                  They will take over as admin. You will leave after promoting them.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20, maxHeight: 240, overflowY: 'auto' }}>
                  {members.filter((m) => m.id !== currentMember?.id).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedAdminId(m.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 12px', borderRadius: 10,
                        border: `1.5px solid ${selectedAdminId === m.id ? '#6366f1' : 'var(--border)'}`,
                        background: selectedAdminId === m.id ? '#eef2ff' : 'var(--bg-subtle)',
                        cursor: 'pointer', textAlign: 'left',
                      }}
                    >
                      <span style={{
                        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                        background: m.color + '20', border: `2px solid ${m.color}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                      }}>{m.avatar}</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{m.name}</span>
                      {selectedAdminId === m.id && (
                        <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#6366f1' }}>Selected</span>
                      )}
                    </button>
                  ))}
                </div>
                {leaveError && <p style={{ fontSize: 12, color: '#ef4444', marginBottom: 12 }}>{leaveError}</p>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={() => setLeaveStep('last_admin_choice')} style={cancelBtnStyle}>Back</button>
                  <button
                    type="button"
                    onClick={handleLeave}
                    disabled={!selectedAdminId || leaveBusy}
                    style={{
                      ...dangerBtnStyle,
                      background: !selectedAdminId || leaveBusy ? '#e4e4e7' : '#ef4444',
                      color: !selectedAdminId || leaveBusy ? '#a1a1aa' : 'white',
                      cursor: !selectedAdminId || leaveBusy ? 'not-allowed' : 'pointer',
                    }}
                  >{leaveBusy ? 'Saving…' : 'Make admin & leave'}</button>
                </div>
              </>
            )}

            {/* Confirm delete group */}
            {leaveStep === 'confirm_delete' && (
              <>
                <p style={{ fontSize: 17, fontWeight: 700, color: '#ef4444', marginBottom: 8 }}>Delete group?</p>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.5 }}>
                  This will permanently delete the household, all tasks, and remove all members. This cannot be undone.
                </p>
                {leaveError && <p style={{ fontSize: 12, color: '#ef4444', marginBottom: 12 }}>{leaveError}</p>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setLeaveStep(isSoleMember ? null : 'last_admin_choice')}
                    style={cancelBtnStyle}
                  >Cancel</button>
                  <button type="button" onClick={handleDeleteHousehold} disabled={leaveBusy} style={dangerBtnStyle}>
                    {leaveBusy ? 'Deleting…' : 'Delete group'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const cancelBtnStyle: React.CSSProperties = {
  flex: 1, padding: '12px 0', borderRadius: 10,
  border: '1px solid var(--border)', background: 'var(--bg-surface)',
  color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
}

const dangerBtnStyle: React.CSSProperties = {
  flex: 2, padding: '12px 0', borderRadius: 10,
  border: 'none', background: '#ef4444',
  color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer',
}
