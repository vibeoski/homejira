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

export function MembersScreen({ tasks, members, currentMember, isAdmin }: Props) {
  const { fetchMembers, fetchTasks } = useStore()
  const { updateMember } = useAuthStore()
  const [removing, setRemoving] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)
  const [promoting, setPromoting] = useState<string | null>(null)
  const [flashSuccess, setFlashSuccess] = useState<string | null>(null)
  const [leaveBusy, setLeaveBusy] = useState(false)
  const [leaveError, setLeaveError] = useState<string | null>(null)

  const adminCount = members.filter((m) => m.role === 'admin').length
  const isOnlyAdmin = currentMember?.role === 'admin' && adminCount <= 1

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

  const handleLeave = async () => {
    setLeaveBusy(true)
    setLeaveError(null)
    try {
      const { member: updated } = await householdsApi.leave()
      updateMember(updated)
      await Promise.all([fetchMembers(), fetchTasks()])
    } catch (e: unknown) {
      setLeaveError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Could not leave household.')
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

      {!isOnlyAdmin && (
        <div style={{ marginTop: 8 }}>
          {leaveError && (
            <p style={{ fontSize: 12, color: '#ef4444', textAlign: 'center', marginBottom: 8 }}>{leaveError}</p>
          )}
          <button
            type="button"
            onClick={handleLeave}
            disabled={leaveBusy}
            style={{
              width: '100%', padding: '12px 0', borderRadius: 10,
              border: '1px solid #fecaca', background: 'white',
              color: leaveBusy ? '#a1a1aa' : '#ef4444',
              fontSize: 13, fontWeight: 600, cursor: leaveBusy ? 'not-allowed' : 'pointer',
            }}
          >{leaveBusy ? 'Leaving…' : 'Leave household'}</button>
        </div>
      )}
    </div>
  )
}
