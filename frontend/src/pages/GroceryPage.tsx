import { useEffect, useRef, useState } from 'react'
import { tasksApi } from '../api/tasks'
import { useAuthStore } from '../store/authStore'
import { useStore } from '../store'
import { loadGuestTasks, saveGuestTasks } from '../store/guest'
import { Spinner } from '../components/ui/Spinner'
import { AccountMenu } from '../components/layout/AccountMenu'
import type { Task } from '../types'

const ACCENT = '#6366f1'

export function GroceryPage() {
  const { isGuest, member } = useAuthStore()
  const { sseVersion } = useStore()

  const [active, setActive] = useState<Task[]>([])
  const [done, setDone] = useState<Task[]>([])
  const [showDone, setShowDone] = useState(true)
  const [historyMode, setHistoryMode] = useState(false)
  const todayKey = (() => { const d = new Date(); d.setHours(0,0,0,0); return d.toISOString() })()
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set([todayKey]))
  const [loading, setLoading] = useState(true)

  const [newTitle, setNewTitle] = useState('')
  const [adding, setAdding] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Data fetching ─────────────────────────────────────────────
  const load = async () => {
    if (isGuest) {
      const all = loadGuestTasks().filter((t) => t.category === 'grocery')
      setActive(all.filter((t) => !t.done).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))
      setDone(all.filter((t) => t.done).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()))
      setLoading(false)
      return
    }
    try {
      const all = await tasksApi.list({ category: 'grocery' })
      setActive(all.filter((t) => !t.done))
      setDone(all.filter((t) => t.done).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [isGuest])
  useEffect(() => { if (sseVersion > 0) load() }, [sseVersion])

  // ── Quick add ────────────────────────────────────────────────
  const handleAdd = async () => {
    const title = newTitle.trim()
    if (!title) return
    setAdding(true)
    try {
      if (isGuest) {
        const now = new Date().toISOString()
        const task: Task = {
          id: crypto.randomUUID(), title, notes: '', category: 'grocery', priority: 'normal',
          assignee_id: '', done: false, created_at: now, updated_at: now, comments: [],
        }
        saveGuestTasks([...loadGuestTasks(), task])
        setActive((prev) => [task, ...prev])
      } else {
        const task = await tasksApi.create({
          title, notes: '', category: 'grocery', priority: 'normal',
          assignee_id: member?.id ?? '', household_id: member?.household_id ?? '',
        })
        setActive((prev) => [task, ...prev])
      }
      setNewTitle('')
      inputRef.current?.focus()
    } finally {
      setAdding(false)
    }
  }

  // ── Toggle done ──────────────────────────────────────────────
  const handleToggle = async (task: Task, checked: boolean) => {
    // Optimistic
    if (checked) {
      setActive((prev) => prev.filter((t) => t.id !== task.id))
      setDone((prev) => [{ ...task, done: true }, ...prev])
      setShowDone(true)
    } else {
      setDone((prev) => prev.filter((t) => t.id !== task.id))
      setActive((prev) => [{ ...task, done: false }, ...prev])
    }
    if (isGuest) {
      saveGuestTasks(loadGuestTasks().map((t) => t.id === task.id ? { ...t, done: checked } : t))
      return
    }
    try {
      await tasksApi.update(task.id, { done: checked })
    } catch {
      // Revert
      if (checked) {
        setDone((prev) => prev.filter((t) => t.id !== task.id))
        setActive((prev) => [task, ...prev])
      } else {
        setActive((prev) => prev.filter((t) => t.id !== task.id))
        setDone((prev) => [task, ...prev])
      }
    }
  }

  // ── Check all ─────────────────────────────────────────────────
  const handleCheckAll = async () => {
    const toCheck = [...active]
    setDone((prev) => [...toCheck.map((t) => ({ ...t, done: true })), ...prev])
    setActive([])
    setShowDone(true)
    if (isGuest) {
      saveGuestTasks(loadGuestTasks().map((t) =>
        toCheck.some((c) => c.id === t.id) ? { ...t, done: true } : t
      ))
      return
    }
    await Promise.allSettled(toCheck.map((t) => tasksApi.update(t.id, { done: true })))
  }

  // ── Clear done (hide from active view, stays in history) ──────
  const handleClearDone = () => setShowDone(false)

  // ── Edit item title ───────────────────────────────────────────
  const handleEdit = async (task: Task, newTitle: string) => {
    const title = newTitle.trim()
    if (!title || title === task.title) return
    const update = (list: Task[]) => list.map((t) => t.id === task.id ? { ...t, title } : t)
    setActive((prev) => update(prev))
    setDone((prev) => update(prev))
    if (isGuest) {
      saveGuestTasks(loadGuestTasks().map((t) => t.id === task.id ? { ...t, title } : t))
      return
    }
    try {
      await tasksApi.update(task.id, { title })
    } catch {
      load() // revert on error
    }
  }

  // ── Delete from history ───────────────────────────────────────
  const handleDelete = async (id: string) => {
    setDone((prev) => prev.filter((t) => t.id !== id))
    if (isGuest) {
      saveGuestTasks(loadGuestTasks().filter((t) => t.id !== id))
      return
    }
    try {
      await tasksApi.remove(id)
    } catch {
      load() // revert on error
    }
  }

  // ─────────────────────────────────────────────────────────────

  if (loading) {
    return <Spinner />
  }

  if (historyMode) {
    return (
      <div style={{ paddingBottom: 80 }}>
        {/* History header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 16px 8px',
        }}>
          <button
            onClick={() => setHistoryMode(false)}
            style={{ background: 'none', border: 'none', color: ACCENT, fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15,18 9,12 15,6" />
            </svg>
            Back
          </button>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#18181b' }}>History</span>
          <span style={{ width: 48 }} />
        </div>

        {done.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center' }}>
            <p style={{ color: '#a1a1aa', fontSize: 14 }}>No completed items yet.</p>
          </div>
        ) : (
          <div style={{ padding: '0 12px' }}>
            {groupByDay(done).map(({ key, label, tasks: dayTasks }) => {
              const open = expandedDays.has(key)
              const toggle = () => setExpandedDays((prev) => {
                const next = new Set(prev)
                if (open) next.delete(key); else next.add(key)
                return next
              })
              return (
                <div key={key} style={{ marginBottom: 8 }}>
                  <button
                    onClick={toggle}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: '8px 4px', marginBottom: open ? 4 : 0,
                    }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#a1a1aa', letterSpacing: 0.6, textTransform: 'uppercase' }}>
                      {label}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {!open && (
                        <span style={{ fontSize: 11, color: '#a1a1aa', fontWeight: 600 }}>{dayTasks.length} item{dayTasks.length !== 1 ? 's' : ''}</span>
                      )}
                      <svg
                        width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa"
                        strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                        style={{ transform: open ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.15s' }}
                      >
                        <polyline points="9,18 15,12 9,6" />
                      </svg>
                    </div>
                  </button>
                  {open && dayTasks.map((task) => (
                    <HistoryRow key={task.id} task={task} onDelete={handleDelete} />
                  ))}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ paddingBottom: 80 }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 16px 12px',
      }}>
        <span style={{ fontSize: 18, fontWeight: 800, color: '#18181b' }}>Grocery list</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button
          onClick={() => setHistoryMode(true)}
          style={{ background: 'none', border: 'none', color: '#71717a', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '4px 8px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12,6 12,12 16,14" />
          </svg>
          History {done.length > 0 && `(${done.length})`}
        </button>
        <AccountMenu />
        </div>
      </div>

      {/* Quick-add */}
      <div style={{ padding: '0 12px 12px', display: 'flex', gap: 8 }}>
        <input
          ref={inputRef}
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Add item…"
          style={{
            flex: 1, padding: '11px 14px', borderRadius: 10, border: '1px solid #e4e4e7',
            fontSize: 14, background: 'white', outline: 'none', color: '#18181b',
          }}
        />
        <button
          onClick={handleAdd}
          disabled={adding || !newTitle.trim()}
          style={{
            padding: '0 18px', borderRadius: 10, border: 'none',
            background: adding || !newTitle.trim() ? '#e4e4e7' : ACCENT,
            color: adding || !newTitle.trim() ? '#a1a1aa' : 'white',
            fontSize: 13, fontWeight: 700, cursor: adding || !newTitle.trim() ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
          }}
        >Add</button>
      </div>

      {/* Check all */}
      {active.length > 1 && (
        <div style={{ padding: '0 12px 8px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleCheckAll}
            style={{
              background: 'none', border: 'none', color: '#71717a', fontSize: 12,
              fontWeight: 600, cursor: 'pointer', padding: '4px 8px', borderRadius: 6,
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20,6 9,17 4,12" />
            </svg>
            Check all
          </button>
        </div>
      )}

      {/* Active items */}
      {active.length === 0 && done.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '56px 24px 32px', textAlign: 'center' }}>
          <div style={{
            width: 60, height: 60, borderRadius: 18, background: '#eef2ff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 01-8 0" />
            </svg>
          </div>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#18181b', margin: '0 0 6px' }}>List is empty</p>
          <p style={{ fontSize: 13, color: '#a1a1aa', margin: 0, lineHeight: 1.6 }}>Type an item above and press Enter to add it.</p>
        </div>
      )}

      {active.length > 0 && (
        <div style={{ padding: '0 12px' }}>
          {active.map((task) => (
            <GroceryRow key={task.id} task={task} onToggle={handleToggle} onEdit={handleEdit} />
          ))}
        </div>
      )}

      {/* Done section */}
      {done.length > 0 && (
        <div style={{ padding: '8px 12px 0' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '6px 4px',
          }}>
            <button
              onClick={() => setShowDone((v) => !v)}
              style={{ background: 'none', border: 'none', color: '#71717a', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 5 }}
            >
              <svg
                width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ transform: showDone ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.15s' }}
              >
                <polyline points="9,18 15,12 9,6" />
              </svg>
              Done ({done.length})
            </button>
            {showDone && (
              <button
                onClick={handleClearDone}
                style={{ background: 'none', border: 'none', color: '#a1a1aa', fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: 0 }}
              >
                Hide done
              </button>
            )}
          </div>

          {showDone && (
            <div>
              {done.map((task) => (
                <GroceryRow key={task.id} task={task} done onToggle={handleToggle} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────

function groupByDay(tasks: Task[]): { key: string; label: string; tasks: Task[] }[] {
  const now = new Date()
  const today = new Date(now); today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)

  const map = new Map<string, Task[]>()
  for (const task of tasks) {
    const d = new Date(task.updated_at); d.setHours(0, 0, 0, 0)
    const key = d.toISOString()
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(task)
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, tasks]) => {
      const d = new Date(key)
      let label: string
      if (d.getTime() === today.getTime()) label = 'Today'
      else if (d.getTime() === yesterday.getTime()) label = 'Yesterday'
      else label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) })
      return { key, label, tasks }
    })
}

// ── Sub-components ────────────────────────────────────────────────

interface RowProps {
  task: Task
  done?: boolean
  onToggle: (task: Task, checked: boolean) => void
  onEdit?: (task: Task, newTitle: string) => void
}

function GroceryRow({ task, done = false, onToggle, onEdit }: RowProps) {
  const [editing, setEditing] = useState(false)
  const [editVal, setEditVal] = useState(task.title)
  const inputRef = useRef<HTMLInputElement>(null)

  const startEdit = () => {
    if (done) return
    setEditVal(task.title)
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  const commitEdit = () => {
    setEditing(false)
    onEdit?.(task, editVal)
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '11px 14px', marginBottom: 4,
      background: 'white', borderRadius: 10, border: '1px solid #e4e4e7',
      opacity: done ? 0.6 : 1, transition: 'opacity 0.15s',
    }}>
      <button
        onClick={() => onToggle(task, !done)}
        style={{
          width: 20, height: 20, borderRadius: 6, border: `2px solid ${done ? ACCENT : '#d4d4d8'}`,
          background: done ? ACCENT : 'white', flexShrink: 0, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.15s',
        }}
      >
        {done && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20,6 9,17 4,12" />
          </svg>
        )}
      </button>

      {editing ? (
        <input
          ref={inputRef}
          value={editVal}
          onChange={(e) => setEditVal(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(false) }}
          style={{
            flex: 1, fontSize: 14, border: 'none', outline: 'none',
            borderBottom: `1.5px solid ${ACCENT}`, background: 'transparent',
            color: '#18181b', padding: '1px 0',
          }}
        />
      ) : (
        <span
          onClick={startEdit}
          style={{
            flex: 1, fontSize: 14,
            textDecoration: done ? 'line-through' : 'none',
            color: done ? '#a1a1aa' : '#18181b',
            cursor: done ? 'default' : 'text',
          }}
        >
          {task.title}
        </span>
      )}

      {task.assignee && (
        <span style={{
          width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
          background: (task.assignee.color ?? '#6366f1') + '20',
          border: `1.5px solid ${task.assignee.color ?? '#6366f1'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12,
        }}>
          {task.assignee.avatar ?? '?'}
        </span>
      )}
    </div>
  )
}

function HistoryRow({ task, onDelete }: { task: Task; onDelete: (id: string) => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '11px 14px', marginBottom: 4,
      background: 'white', borderRadius: 10, border: '1px solid #e4e4e7',
    }}>
      <span style={{
        width: 20, height: 20, borderRadius: 6, background: ACCENT,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20,6 9,17 4,12" />
        </svg>
      </span>

      <span style={{ flex: 1, fontSize: 14, color: '#a1a1aa', textDecoration: 'line-through' }}>
        {task.title}
      </span>

      {!confirmDelete ? (
        <button
          onClick={() => setConfirmDelete(true)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#d4d4d8', display: 'flex' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3,6 5,6 21,6" /><path d="M19,6l-1,14a2 2 0 01-2 2H8a2 2 0 01-2-2L5,6" />
            <path d="M10,11v6" /><path d="M14,11v6" /><path d="M9,6V4h6v2" />
          </svg>
        </button>
      ) : (
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => onDelete(task.id)}
            style={{ border: 'none', background: '#fee2e2', color: '#b91c1c', borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
          >Delete</button>
          <button
            onClick={() => setConfirmDelete(false)}
            style={{ border: 'none', background: '#f4f4f5', color: '#71717a', borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
          >Cancel</button>
        </div>
      )}
    </div>
  )
}
