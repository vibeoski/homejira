import { useState } from 'react'
import { Avatar } from '../ui/Avatar'
import { HouseholdPromo } from './HouseholdPromo'
import { householdsApi } from '../../api/households'
import { useStore } from '../../store'
import type { Task, Member } from '../../types'

interface Props {
  tasks: Task[]
  members: Member[]
  currentMember: Member | null
  isAdmin: boolean
}

const ACCENT = '#6366f1'

export function MembersScreen({ tasks, members, currentMember, isAdmin }: Props) {
  const { fetchMembers } = useStore()
  const [removing, setRemoving] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)
  const [promoting, setPromoting] = useState<string | null>(null)
  const [flashSuccess, setFlashSuccess] = useState<string | null>(null)
  const [memberError, setMemberError] = useState<{ id: string; msg: string } | null>(null)

  const handlePromote = async (id: string) => {
    setPromoting(id)
    setMemberError(null)
    try {
      await householdsApi.promoteMember(id)
      setFlashSuccess(id)
      setTimeout(() => setFlashSuccess(null), 800)
      await fetchMembers()
    } catch {
      setMemberError({ id, msg: 'Could not promote member. Please try again.' })
    } finally {
      setPromoting(null)
    }
  }

  const handleRemove = async (id: string) => {
    setConfirmRemove(null)
    setRemoving(id)
    setMemberError(null)
    try {
      await householdsApi.removeMember(id)
      await fetchMembers()
    } catch {
      setMemberError({ id, msg: 'Could not remove member. Please try again.' })
    } finally {
      setRemoving(null)
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
            style={{ background: 'white', borderRadius: 12, padding: 16, border: '1px solid #ede8e1', marginBottom: 8 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: open.length > 0 || memberError?.id === m.id ? 12 : 0 }}>
              <Avatar member={m} size={40} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#1c1917' }}>{m.name}</p>
                  {m.role === 'admin' && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 999, background: '#eef2ff', color: ACCENT }}>
                      Admin
                    </span>
                  )}
                  {isSelf && (
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 999, background: '#faf7f2', color: '#78716c' }}>
                      You
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 12, color: '#a8a29e' }}>{open.length} open tasks</p>
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
                        border: 'none', background: promoting === m.id ? '#faf7f2' : '#eef2ff',
                        color: promoting === m.id ? '#a8a29e' : ACCENT,
                        borderRadius: 7, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      }}
                    >{promoting === m.id ? '…' : 'Promote'}</button>
                  )}
                  {confirmRemove === m.id ? (
                    <>
                      <button
                        onClick={() => setConfirmRemove(null)}
                        style={{ border: 'none', background: '#faf7f2', color: '#78716c', borderRadius: 7, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
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
                      style={{ border: 'none', background: '#faf7f2', color: '#a8a29e', borderRadius: 7, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                    >Remove</button>
                  )}
                </div>
              )}
            </div>
            {memberError?.id === m.id && (
              <div style={{ padding: '6px 10px', borderRadius: 7, background: '#fef2f2', color: '#ef4444', fontSize: 11, border: '1px solid #fecaca', marginBottom: open.length > 0 ? 8 : 0 }}>
                {memberError.msg}
              </div>
            )}
            {open.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {open.slice(0, 3).map((t) => (
                  <span key={t.id} style={{ background: '#faf7f2', borderRadius: 6, padding: '3px 8px', fontSize: 11, color: '#78716c' }}>
                    {t.title.length > 22 ? t.title.slice(0, 22) + '…' : t.title}
                  </span>
                ))}
                {open.length > 3 && (
                  <span style={{ background: '#faf7f2', borderRadius: 6, padding: '3px 8px', fontSize: 11, color: '#a8a29e' }}>
                    +{open.length - 3} more
                  </span>
                )}
              </div>
            )}
          </div>
        )
      })}

      <HouseholdPromo />
    </div>
  )
}
