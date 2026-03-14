import { useState, useEffect, useCallback, useRef } from 'react'
import { Avatar } from '../ui/Avatar'
import { CATEGORIES, PRIORITIES, type Task, type Member, type UpdateTaskPayload, type Category, type Priority, type Activity } from '../../types'
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
  const [saveError, setSaveError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [activities, setActivities] = useState<Activity[]>([])
  const { addComment, deleteTask } = useStore()
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
    const previous = current
    setSaving(true)
    setSaveError(null)
    try {
      const updated = await tasksApi.update(current.id, payload)
      setCurrent(updated)
      onUpdated(updated)
      fetchActivities()
    } catch {
      setCurrent(previous)
      setSaveError('Could not save change. Please try again.')
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

  const handleDelete = async () => {
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteTask(current.id)
      onDeleted(current.id)
      onClose()
    } catch {
      setDeleteError('Could not delete task. Please try again.')
      setConfirmDelete(false)
    } finally {
      setDeleting(false)
    }
  }

  // Swipe-to-close gesture state
  const [isDragging, setIsDragging] = useState(false)
  const [dragY, setDragY] = useState(0)
  const startYRef = useRef(0)
  const sheetRef = useRef<HTMLDivElement>(null)

  const handleTouchStart = (e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY
    setIsDragging(true)
    setDragY(0)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    const delta = e.touches[0].clientY - startYRef.current
    if (delta > 0) {
      setDragY(delta)
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    setIsDragging(false)
    const endY = e.changedTouches[0].clientY
    if (endY - startYRef.current > 80) {
      onClose()
    } else {
      setDragY(0)
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
        ref={sheetRef}
        className="slide-up"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          background: '#faf7f2', width: '100%', maxWidth: 520, borderRadius: '18px 18px 0 0',
          maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 -4px 24px rgba(0,0,0,0.10)',
          transform: dragY > 0 ? `translateY(${dragY}px)` : '',
          transition: isDragging ? 'none' : 'transform 0.2s',
        }}
      >
        {/* Handle + close */}
        <div style={{ position: 'sticky', top: 0, background: '#faf7f2', padding: '14px 16px 10px', zIndex: 1 }}>
          <div style={{ width: 40, height: 4, background: '#d4cfc8', borderRadius: 99, margin: '8px auto 8px' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
              style={{ background: '#ede8e1', border: 'none', borderRadius: 7, padding: '5px 12px', fontSize: 13, color: '#78716c', cursor: 'pointer' }}
            >Close</button>
          </div>
        </div>

        {/* Zone 1: Identity */}
        <div style={{ background: 'white', margin: '0 10px', borderRadius: 12, padding: '14px 14px 4px', marginBottom: 8, border: '1px solid #ede8e1' }}>
          <input
            value={current.title}
            onChange={(e) => setCurrent({ ...current, title: e.target.value })}
            onBlur={() => patch({ title: current.title })}
            disabled={saving}
            placeholder="Task title"
            style={{ width: '100%', fontSize: 18, fontWeight: 700, border: 'none', outline: 'none', background: 'transparent', marginBottom: 10, color: '#1c1917', boxSizing: 'border-box' }}
          />
          <input
            value={current.notes}
            onChange={(e) => setCurrent({ ...current, notes: e.target.value })}
            onBlur={() => patch({ notes: current.notes })}
            placeholder="Add notes…"
            style={{ width: '100%', fontSize: 13, border: 'none', borderTop: '1px solid #faf7f2', outline: 'none', background: 'transparent', padding: '10px 0', color: '#78716c', boxSizing: 'border-box' }}
          />
        </div>

        {/* Zone 2: Classification */}
        <div style={{ background: 'white', margin: '0 10px', borderRadius: 12, padding: '14px 14px', marginBottom: 8, border: '1px solid #ede8e1' }}>
          <FieldLabel>Category</FieldLabel>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
            {(Object.entries(CATEGORIES) as [string, { label: string; color: string }][]).map(([k, v]) => (
              <PillBtn key={k} active={current.category === k} color={v.color} onClick={() => patch({ category: k as Category })}>
                {v.label}
              </PillBtn>
            ))}
          </div>

          <div style={{ height: 1, background: '#faf7f2', marginBottom: 14 }} />

          <FieldLabel>Priority</FieldLabel>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {(Object.entries(PRIORITIES) as [string, { label: string; color: string }][]).map(([k, v]) => (
              <PillBtn key={k} active={current.priority === k} color={v.color} onClick={() => patch({ priority: k as Priority })}>
                {v.label}
              </PillBtn>
            ))}
          </div>

          <div style={{ height: 1, background: '#faf7f2', marginBottom: 14 }} />

          <FieldLabel>Assign to</FieldLabel>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
            {members.map((m) => (
              <PillBtn key={m.id} active={current.assignee_id === m.id} color={m.color} onClick={() => patch({ assignee_id: m.id })}>
                {m.name}
              </PillBtn>
            ))}
          </div>

          <div style={{ height: 1, background: '#faf7f2', marginBottom: 14 }} />

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
              style={{ flex: 1, fontSize: 13, border: '1px solid #ede8e1', borderRadius: 8, padding: '8px 10px', outline: 'none', background: '#f9f9f9', color: '#1c1917' }}
            />
            {current.due_at && (
              <button
                onClick={() => { setCurrent({ ...current, due_at: undefined }); patch({ clear_due_at: true }) }}
                style={{ fontSize: 12, color: '#a8a29e', background: '#faf7f2', border: 'none', borderRadius: 7, padding: '7px 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}
              >Clear</button>
            )}
          </div>
        </div>

        {/* Zone 3: Activity feed (comments + change events, chronological) */}
        <div style={{ background: 'white', margin: '0 10px', borderRadius: 12, padding: '14px 14px', marginBottom: 8, border: '1px solid #ede8e1' }}>
          <FieldLabel>Activity</FieldLabel>

          {feed.length === 0 && (
            <p style={{ fontSize: 13, color: '#a8a29e', margin: '0 0 12px' }}>No activity yet.</p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: feed.length > 0 ? 14 : 0 }}>
            {feed.map((item) =>
              item.type === 'comment' ? (
                <div key={item.data.id} style={{ display: 'flex', gap: 8 }}>
                  {item.data.author
                    ? <Avatar member={item.data.author} size={26} />
                    : <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#ede8e1', flexShrink: 0 }} />
                  }
                  <div style={{ background: '#faf7f2', borderRadius: 10, padding: '8px 10px', flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#a8a29e', marginBottom: 3 }}>
                      {item.data.author?.name ?? 'Unknown'} · {timeAgo(item.data.created_at)}
                    </div>
                    <div style={{ fontSize: 13, color: '#1c1917' }}>{item.data.body}</div>
                  </div>
                </div>
              ) : (
                <div key={item.data.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {item.data.actor
                    ? <Avatar member={item.data.actor} size={22} />
                    : <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#ede8e1', flexShrink: 0 }} />
                  }
                  <span style={{ fontSize: 12, color: '#78716c', lineHeight: 1.4 }}>
                    <span style={{ fontWeight: 600, color: '#52525b' }}>{item.data.actor?.name ?? 'Someone'}</span>
                    {' '}{describeActivity(item.data)}
                    <span style={{ color: '#a8a29e' }}> · {timeAgo(item.data.created_at)}</span>
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
              style={{ flex: 1, fontSize: 13, border: '1px solid #ede8e1', borderRadius: 8, padding: '9px 10px', outline: 'none', background: '#f9f9f9' }}
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
          {saveError && (
            <div style={{ padding: '8px 12px', borderRadius: 8, background: '#fef2f2', color: '#ef4444', fontSize: 12, border: '1px solid #fecaca', marginBottom: 10 }}>
              {saveError}
            </div>
          )}
          {deleteError && (
            <div style={{ padding: '8px 12px', borderRadius: 8, background: '#fef2f2', color: '#ef4444', fontSize: 12, border: '1px solid #fecaca', marginBottom: 10 }}>
              {deleteError}
            </div>
          )}
          {confirmDelete ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setConfirmDelete(false)}
                style={{ flex: 1, background: 'white', border: '1px solid #ede8e1', borderRadius: 10, padding: 12, color: '#78716c', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
              >Cancel</button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{ flex: 1, background: deleting ? '#fca5a5' : '#ef4444', border: 'none', borderRadius: 10, padding: 12, color: 'white', fontWeight: 700, fontSize: 14, cursor: deleting ? 'not-allowed' : 'pointer' }}
              >{deleting ? 'Deleting…' : 'Delete'}</button>
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
    <p style={{ fontSize: 10, fontWeight: 700, color: '#a8a29e', letterSpacing: 0.8, textTransform: 'uppercase', margin: '0 0 8px' }}>
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
        borderColor: active ? color : '#ede8e1',
        background: active ? color + '14' : 'white',
        color: active ? color : '#78716c',
        transition: 'all 0.12s',
      }}
    >{children}</button>
  )
}
