import { useState, useEffect, useCallback } from 'react'
import { Avatar } from '../ui/Avatar'
import { CATEGORIES, PRIORITIES, type Task, type Member, type UpdateTaskPayload, type Category, type Activity } from '../../types'
import { tasksApi } from '../../api/tasks'
import { timeAgo, toDateInputValue } from '../../utils'
import { useStore } from '../../store'
import { useAuthStore } from '../../store/authStore'

interface Props {
  task: Task
  members: Member[]
  onClose: () => void
  onUpdated: (t: Task) => void
  onDeleted: (id: string) => void
}

export function TaskDrawer({ task, members, onClose, onUpdated, onDeleted }: Props) {
  const [current, setCurrent] = useState(task)
  const [comment, setComment] = useState('')
  const [sendingComment, setSendingComment] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [activities, setActivities] = useState<Activity[]>([])
  const addComment = useStore((s) => s.addComment)
  const { member: authMember } = useAuthStore()
  const me = members.find((m) => m.id === authMember?.id) ?? members[0]

  const fetchActivities = useCallback(async () => {
    try {
      const data = await tasksApi.getActivity(current.id)
      setActivities(data)
    } catch {}
  }, [current.id])

  useEffect(() => { fetchActivities() }, [fetchActivities])

  const patch = async (payload: UpdateTaskPayload) => {
    setSaving(true)
    try {
      const updated = await tasksApi.update(current.id, payload)
      setCurrent(updated)
      onUpdated(updated)
      fetchActivities()
    } finally {
      setSaving(false)
    }
  }

  const handleAddComment = async () => {
    if (!comment.trim() || !me || sendingComment) return
    const body = comment.trim()
    setComment('')
    setSendingComment(true)
    try {
      await addComment(current.id, me.id, body)
      const fresh = await tasksApi.get(current.id)
      setCurrent(fresh)
    } catch {
      setComment(body)
    } finally {
      setSendingComment(false)
    }
  }

  // Merge comments + activities into a single chronological feed
  type FeedItem = { type: 'comment'; data: NonNullable<Task['comments']>[number]; ts: string }
              | { type: 'activity'; data: Activity; ts: string }

  const feed: FeedItem[] = [
    ...(current.comments ?? []).map((c) => ({ type: 'comment' as const, data: c, ts: c.created_at })),
    ...activities.map((a) => ({ type: 'activity' as const, data: a, ts: a.created_at })),
  ].sort((a, b) => a.ts.localeCompare(b.ts))

  return (
    <div
      className="fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: '#00000040', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
    >
      <div
        className="slide-up"
        style={{ background: '#f4f4f5', width: '100%', maxWidth: 520, borderRadius: '18px 18px 0 0', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 -4px 24px rgba(0,0,0,0.10)' }}
      >
        {/* Handle + close */}
        <div style={{ position: 'sticky', top: 0, background: '#f4f4f5', padding: '14px 16px 10px', zIndex: 1 }}>
          <div style={{ width: 36, height: 3, background: '#d4d4d8', borderRadius: 99, margin: '0 auto 14px' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 15 }}>{CATEGORIES[current.category].icon}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: CATEGORIES[current.category].color }}>
                {CATEGORIES[current.category].label}
              </span>
              <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#d4d4d8', display: 'inline-block' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: PRIORITIES[current.priority].color }}>
                {PRIORITIES[current.priority].label}
              </span>
            </div>
            <button
              onClick={onClose}
              style={{ background: '#e4e4e7', border: 'none', borderRadius: 7, padding: '5px 12px', fontSize: 13, color: '#71717a', cursor: 'pointer' }}
            >Close</button>
          </div>
        </div>

        {/* Zone 1: Identity */}
        <div style={{ background: 'white', margin: '0 10px', borderRadius: 12, padding: '14px 14px 4px', marginBottom: 8, border: '1px solid #e4e4e7' }}>
          <input
            value={current.title}
            onChange={(e) => setCurrent({ ...current, title: e.target.value })}
            onBlur={() => patch({ title: current.title })}
            disabled={saving}
            placeholder="Task title"
            style={{ width: '100%', fontSize: 18, fontWeight: 700, border: 'none', outline: 'none', background: 'transparent', marginBottom: 10, color: '#18181b', boxSizing: 'border-box' }}
          />
          <input
            value={current.notes}
            onChange={(e) => setCurrent({ ...current, notes: e.target.value })}
            onBlur={() => patch({ notes: current.notes })}
            placeholder="Add notes…"
            style={{ width: '100%', fontSize: 13, border: 'none', borderTop: '1px solid #f4f4f5', outline: 'none', background: 'transparent', padding: '10px 0', color: '#71717a', boxSizing: 'border-box' }}
          />
        </div>

        {/* Zone 2: Classification */}
        <div style={{ background: 'white', margin: '0 10px', borderRadius: 12, padding: '14px 14px', marginBottom: 8, border: '1px solid #e4e4e7' }}>
          <FieldLabel>Category</FieldLabel>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
            {(Object.entries(CATEGORIES) as [string, { label: string; icon: string; color: string }][]).map(([k, v]) => (
              <PillBtn key={k} active={current.category === k} color={v.color} onClick={() => patch({ category: k as Category })}>
                {v.icon} {v.label}
              </PillBtn>
            ))}
          </div>

          <div style={{ height: 1, background: '#f4f4f5', marginBottom: 14 }} />

          <FieldLabel>Priority</FieldLabel>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {(Object.entries(PRIORITIES) as [string, { label: string; color: string }][]).map(([k, v]) => (
              <PillBtn key={k} active={current.priority === k} color={v.color} onClick={() => patch({ priority: k as any })}>
                {v.label}
              </PillBtn>
            ))}
          </div>

          <div style={{ height: 1, background: '#f4f4f5', marginBottom: 14 }} />

          <FieldLabel>Assign to</FieldLabel>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
            {members.map((m) => (
              <PillBtn key={m.id} active={current.assignee_id === m.id} color={m.color} onClick={() => patch({ assignee_id: m.id })}>
                {m.avatar} {m.name}
              </PillBtn>
            ))}
          </div>

          <div style={{ height: 1, background: '#f4f4f5', marginBottom: 14 }} />

          <FieldLabel>Due date</FieldLabel>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="date"
              value={current.due_at ? toDateInputValue(current.due_at) : ''}
              onChange={(e) => {
                const val = e.target.value ? new Date(e.target.value).toISOString() : undefined
                setCurrent({ ...current, due_at: val })
                patch(val ? { due_at: val } : { clear_due_at: true })
              }}
              style={{ flex: 1, fontSize: 13, border: '1px solid #e4e4e7', borderRadius: 8, padding: '8px 10px', outline: 'none', background: '#f9f9f9', color: '#18181b' }}
            />
            {current.due_at && (
              <button
                onClick={() => { setCurrent({ ...current, due_at: undefined }); patch({ clear_due_at: true }) }}
                style={{ fontSize: 12, color: '#a1a1aa', background: '#f4f4f5', border: 'none', borderRadius: 7, padding: '7px 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}
              >Clear</button>
            )}
          </div>
        </div>

        {/* Zone 3: Activity feed (comments + change events, chronological) */}
        <div style={{ background: 'white', margin: '0 10px', borderRadius: 12, padding: '14px 14px', marginBottom: 8, border: '1px solid #e4e4e7' }}>
          <FieldLabel>Activity</FieldLabel>

          {feed.length === 0 && (
            <p style={{ fontSize: 13, color: '#a1a1aa', margin: '0 0 12px' }}>No activity yet.</p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: feed.length > 0 ? 14 : 0 }}>
            {feed.map((item) =>
              item.type === 'comment' ? (
                <div key={item.data.id} style={{ display: 'flex', gap: 8 }}>
                  {item.data.author
                    ? <Avatar member={item.data.author} size={26} />
                    : <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#e4e4e7', flexShrink: 0 }} />
                  }
                  <div style={{ background: '#f4f4f5', borderRadius: 10, padding: '8px 10px', flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#a1a1aa', marginBottom: 3 }}>
                      {item.data.author?.name ?? 'Unknown'} · {timeAgo(item.data.created_at)}
                    </div>
                    <div style={{ fontSize: 13, color: '#18181b' }}>{item.data.body}</div>
                  </div>
                </div>
              ) : (
                <div key={item.data.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {item.data.actor
                    ? <Avatar member={item.data.actor} size={22} />
                    : <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#e4e4e7', flexShrink: 0 }} />
                  }
                  <span style={{ fontSize: 12, color: '#71717a', lineHeight: 1.4 }}>
                    <span style={{ fontWeight: 600, color: '#52525b' }}>{item.data.actor?.name ?? 'Someone'}</span>
                    {' '}{describeActivity(item.data)}
                    <span style={{ color: '#a1a1aa' }}> · {timeAgo(item.data.created_at)}</span>
                  </span>
                </div>
              )
            )}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
              placeholder="Add a comment…"
              style={{ flex: 1, fontSize: 13, border: '1px solid #e4e4e7', borderRadius: 8, padding: '9px 10px', outline: 'none', background: '#f9f9f9' }}
            />
            <button
              onClick={handleAddComment}
              disabled={sendingComment || !comment.trim()}
              style={{
                background: sendingComment ? '#c7d2fe' : '#6366f1', color: 'white', border: 'none',
                borderRadius: 8, padding: '0 14px', fontSize: 16, cursor: sendingComment ? 'not-allowed' : 'pointer',
                transition: 'background .15s',
              }}
            >{sendingComment ? '…' : '↑'}</button>
          </div>
        </div>

        {/* Danger zone */}
        <div style={{ margin: '0 10px 36px' }}>
          {confirmDelete ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setConfirmDelete(false)}
                style={{ flex: 1, background: 'white', border: '1px solid #e4e4e7', borderRadius: 10, padding: 12, color: '#71717a', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
              >Cancel</button>
              <button
                onClick={() => { onDeleted(current.id); onClose() }}
                style={{ flex: 1, background: '#ef4444', border: 'none', borderRadius: 10, padding: 12, color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
              >Delete</button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              style={{ width: '100%', background: 'transparent', border: 'none', padding: '12px 0', color: '#d4d4d8', fontWeight: 500, fontSize: 13, cursor: 'pointer' }}
            >Delete task</button>
          )}
        </div>
      </div>
    </div>
  )
}

function describeActivity(a: Activity): string {
  const m = a.meta ?? {}
  switch (a.kind) {
    case 'created':          return 'created this task'
    case 'completed':        return 'marked as complete'
    case 'reopened':         return 'reopened'
    case 'assigned':         return `changed assignee from ${m.from || '—'} to ${m.to || '—'}`
    case 'priority_changed': return `changed priority to ${m.to}`
    case 'category_changed': return `changed category to ${m.to}`
    case 'title_changed':    return `renamed to "${m.to}"`
    case 'notes_changed':    return 'updated the notes'
    case 'due_set':          return `set due date to ${m.to}`
    case 'due_cleared':      return 'removed the due date'
    default:                 return a.kind
  }
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 10, fontWeight: 700, color: '#a1a1aa', letterSpacing: 0.8, textTransform: 'uppercase', margin: '0 0 8px' }}>
      {children}
    </p>
  )
}

function PillBtn({ children, active, color, onClick }: { children: React.ReactNode; active: boolean; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 12px', borderRadius: 99, border: '1px solid', fontWeight: 600, fontSize: 12, cursor: 'pointer',
        borderColor: active ? color : '#e4e4e7',
        background: active ? color + '14' : 'white',
        color: active ? color : '#71717a',
        transition: 'all 0.12s',
      }}
    >{children}</button>
  )
}
