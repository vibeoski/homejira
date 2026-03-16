import { useState, useCallback } from 'react'
import { Navigate } from 'react-router-dom'
import { useStore } from '../store'
import { useAuthStore } from '../store/authStore'
import { TaskCard } from '../components/tasks/TaskCard'
import { TaskDrawer } from '../components/tasks/TaskDrawer'
import { AddTaskSheet } from '../components/tasks/AddTaskSheet'
import { FilterSheet } from '../components/tasks/FilterSheet'
import { Spinner } from '../components/ui/Spinner'
import { DesktopTaskDetail } from '../components/layout/desktop/DesktopTaskDetail'
import { useBreakpoint } from '../hooks/useBreakpoint'
import { CATEGORIES, type Task, type Category, type TaskStatus } from '../types'
import { isOverdue, isDueSoon } from '../utils'

export interface TaskFilters {
  status: 'all' | 'active' | 'open' | 'in_progress' | 'on_hold' | 'done'
  priority: 'all' | 'urgent' | 'high' | 'normal'
  category: Category | 'all'
  assigneeId: string | null  // null = anyone, 'unassigned' = no assignee
  due: 'all' | 'overdue' | 'due_soon' | 'no_due'
  sort: 'priority' | 'recent' | 'due'
}

const DEFAULT_FILTERS: TaskFilters = {
  status: 'active',
  priority: 'all',
  category: 'all',
  assigneeId: null,
  due: 'all',
  sort: 'priority',
}

const ACCENT = '#6366f1'

function isDefaultFilters(f: TaskFilters) {
  return (
    f.status === DEFAULT_FILTERS.status &&
    f.priority === DEFAULT_FILTERS.priority &&
    f.category === DEFAULT_FILTERS.category &&
    f.assigneeId === DEFAULT_FILTERS.assigneeId &&
    f.due === DEFAULT_FILTERS.due &&
    f.sort === DEFAULT_FILTERS.sort
  )
}

function activeFilterCount(f: TaskFilters) {
  return [
    f.status !== DEFAULT_FILTERS.status,
    f.priority !== DEFAULT_FILTERS.priority,
    f.category !== DEFAULT_FILTERS.category,
    f.assigneeId !== DEFAULT_FILTERS.assigneeId,
    f.due !== DEFAULT_FILTERS.due,
    f.sort !== DEFAULT_FILTERS.sort,
  ].filter(Boolean).length
}

export function TasksPage() {
  const { tasks, members, loading, fetchTasks, updateTask, deleteTask } = useStore()
  const { member, isGuest } = useAuthStore()
  const [filters, setFilters] = useState<TaskFilters>(DEFAULT_FILTERS)
  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [selected, setSelected] = useState<Task | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [undoTask, setUndoTask] = useState<{ id: string; prevStatus: TaskStatus } | null>(null)
  const [undoTimer, setUndoTimer] = useState<ReturnType<typeof setTimeout> | null>(null)
  const isDesktop = useBreakpoint()
  const refresh = useCallback(() => fetchTasks(), [fetchTasks])

  const handleStatusChange = useCallback(async (id: string, status: TaskStatus) => {
    await updateTask(id, { status })
    if (status === 'done') {
      const openAfter = useStore.getState().tasks.filter((t) => t.status !== 'done')
      if (openAfter.length === 0) {
        if (undoTimer) clearTimeout(undoTimer)
        const prev = tasks.find((t) => t.id === id)
        setUndoTask({ id, prevStatus: prev?.status ?? 'open' })
        const timer = setTimeout(() => { setUndoTask(null); setUndoTimer(null) }, 4000)
        setUndoTimer(timer)
      }
    } else if (undoTask?.id === id) {
      if (undoTimer) clearTimeout(undoTimer)
      setUndoTask(null)
      setUndoTimer(null)
    }
  }, [updateTask, undoTask, undoTimer, tasks])

  if (!isGuest && member && !member.household_id) {
    return <Navigate to="/household" replace />
  }

  const visible = tasks
    .filter((t) => {
      if (filters.category !== 'all') return t.category === filters.category
      return true
    })
    .filter((t) => {
      switch (filters.status) {
        case 'active': return !t.done
        case 'all':    return true
        default:       return t.status === filters.status
      }
    })
    .filter((t) => filters.priority === 'all' || t.priority === filters.priority)
    .filter((t) => {
      if (filters.assigneeId === null) return true
      if (filters.assigneeId === 'unassigned') return !t.assignee_id
      return t.assignee_id === filters.assigneeId
    })
    .filter((t) => {
      switch (filters.due) {
        case 'overdue':  return !t.done && !!t.due_at && isOverdue(t.due_at, t.done)
        case 'due_soon': return !t.done && !!t.due_at && !isOverdue(t.due_at, t.done) && isDueSoon(t.due_at, t.done)
        case 'no_due':   return !t.due_at
        default:         return true
      }
    })
    .filter((t) => !search || t.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (filters.sort === 'recent') return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      if (filters.sort === 'due') {
        if (!a.due_at && !b.due_at) return 0
        if (!a.due_at) return 1
        if (!b.due_at) return -1
        return new Date(a.due_at).getTime() - new Date(b.due_at).getTime()
      }
      const po: Record<string, number> = { urgent: 0, high: 1, normal: 2 }
      const so: Record<string, number> = { in_progress: 0, open: 1, on_hold: 2, done: 3 }
      const aDone = a.done ? 1 : 0, bDone = b.done ? 1 : 0
      if (aDone !== bDone) return aDone - bDone
      const sd = (so[a.status ?? 'open'] ?? 1) - (so[b.status ?? 'open'] ?? 1)
      if (sd !== 0) return sd
      return po[a.priority] - po[b.priority]
    })

  const activeCount = tasks.filter((t) => !t.done).length
  const urgentCount = tasks.filter((t) => !t.done && t.priority === 'urgent').length
  const filterCount = activeFilterCount(filters)

  // Active filter chips
  const chips: { label: string; onRemove: () => void }[] = []
  if (filters.status !== DEFAULT_FILTERS.status) {
    const labels: Record<TaskFilters['status'], string> = {
      all: 'All tasks', active: 'Active', open: 'Open',
      in_progress: 'In Progress', on_hold: 'On Hold', done: 'Done',
    }
    chips.push({ label: labels[filters.status], onRemove: () => setFilters((f) => ({ ...f, status: DEFAULT_FILTERS.status })) })
  }
  if (filters.priority !== 'all') {
    chips.push({ label: `${filters.priority.charAt(0).toUpperCase() + filters.priority.slice(1)} priority`, onRemove: () => setFilters((f) => ({ ...f, priority: 'all' })) })
  }
  if (filters.category !== 'all') {
    chips.push({ label: CATEGORIES[filters.category as Category].label, onRemove: () => setFilters((f) => ({ ...f, category: 'all' })) })
  }
  if (filters.assigneeId !== null) {
    const name = filters.assigneeId === 'unassigned' ? 'Unassigned' : members.find((m) => m.id === filters.assigneeId)?.name ?? 'Member'
    chips.push({ label: name, onRemove: () => setFilters((f) => ({ ...f, assigneeId: null })) })
  }
  if (filters.due !== 'all') {
    const labels: Record<string, string> = { overdue: 'Overdue', due_soon: 'Due soon', no_due: 'No due date' }
    chips.push({ label: labels[filters.due], onRemove: () => setFilters((f) => ({ ...f, due: 'all' })) })
  }
  if (filters.sort !== 'priority') {
    const labels: Record<string, string> = { recent: 'Sort: Recent', due: 'Sort: Due date' }
    chips.push({ label: labels[filters.sort], onRemove: () => setFilters((f) => ({ ...f, sort: 'priority' })) })
  }

  return (
    <>
      {/* Sticky sub-header */}
      <div style={{
        background: 'white', padding: '12px 16px 0',
        borderBottom: '1px solid #ede8e1',
        position: 'sticky', top: 57, zIndex: 49,
      }}>
        {/* Title + member avatars */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: '#78716c', margin: 0, letterSpacing: 0.2, flex: 1 }}>Tasks</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {members.slice(0, 4).map((m, i) => (
              <span key={m.id} title={m.name} style={{
                marginLeft: i === 0 ? 0 : -8, zIndex: members.length - i,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 28, height: 28, borderRadius: '50%', fontSize: 11, fontWeight: 700,
                background: m.color, color: 'white', border: '2px solid white', fontFamily: 'system-ui, sans-serif',
              }}>{m.name?.charAt(0).toUpperCase() || '?'}</span>
            ))}
            {members.length > 4 && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 28, height: 28, borderRadius: '50%', fontSize: 10, fontWeight: 700,
                background: '#faf7f2', color: '#78716c', marginLeft: -8, border: '2px solid white',
              }}>+{members.length - 4}</span>
            )}
          </div>
        </div>

        <p style={{ fontSize: 12, color: '#78716c', margin: '0 0 8px' }}>
          {activeCount} active
          {urgentCount > 0 && <span style={{ color: '#ef4444', fontWeight: 600 }}> · {urgentCount} urgent</span>}
        </p>

        {/* Search + Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: chips.length > 0 ? 8 : 10 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a8a29e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks…"
              style={{
                width: '100%', padding: '9px 32px 9px 32px', borderRadius: 8,
                border: '1px solid #ede8e1', fontSize: 13, outline: 'none',
                background: '#f9f9f9', color: '#1c1917', boxSizing: 'border-box',
              }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', padding: 2, cursor: 'pointer',
                display: 'flex', alignItems: 'center', color: '#a8a29e',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          <button
            onClick={() => setShowFilters(true)}
            style={{
              flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5,
              padding: '0 12px', height: 38, borderRadius: 8,
              border: `1px solid ${filterCount > 0 ? ACCENT : '#ede8e1'}`,
              background: filterCount > 0 ? '#eef2ff' : 'white',
              color: filterCount > 0 ? ACCENT : '#78716c',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="11" y1="18" x2="13" y2="18" />
            </svg>
            Filters
            {filterCount > 0 && (
              <span style={{ background: ACCENT, color: 'white', borderRadius: 99, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>
                {filterCount}
              </span>
            )}
          </button>
        </div>

        {/* Active filter chips */}
        {chips.length > 0 && (
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 10 }}>
            {chips.map((chip) => (
              <span key={chip.label} style={{
                flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '3px 8px 3px 10px', borderRadius: 99,
                background: '#eef2ff', border: '1px solid #c7d2fe',
                color: ACCENT, fontSize: 11, fontWeight: 600,
              }}>
                {chip.label}
                <button onClick={chip.onRemove} style={{
                  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                  color: ACCENT, display: 'flex', alignItems: 'center', lineHeight: 1,
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
            {!isDefaultFilters(filters) && (
              <button onClick={() => setFilters(DEFAULT_FILTERS)} style={{
                flexShrink: 0, padding: '3px 10px', borderRadius: 99,
                border: '1px solid #ede8e1', background: 'white',
                color: '#78716c', fontSize: 11, fontWeight: 600, cursor: 'pointer',
              }}>Clear all</button>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ display: 'flex', flex: 1 }}>
        <div style={{ flex: 1, padding: '8px 12px', paddingBottom: isDesktop ? 40 : 140, minWidth: 0 }}>
          {loading ? (
            <Spinner />
          ) : tasks.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '72px 24px 32px', textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, borderRadius: 20, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                </svg>
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1c1917', margin: '0 0 6px' }}>No tasks yet</h2>
              <p style={{ fontSize: 13, color: '#a8a29e', margin: '0 0 24px', lineHeight: 1.6, maxWidth: 240 }}>
                {isGuest ? 'Add a few preview tasks to try the app locally.' : 'Add your household\'s first task to get started.'}
              </p>
              <button onClick={() => setShowAdd(true)} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: ACCENT, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Add first task
              </button>
            </div>
          ) : visible.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '64px 20px' }}>
              <p style={{ fontSize: 18, fontWeight: 700, color: '#1c1917' }}>Nothing here</p>
              <p style={{ fontSize: 13, color: '#a8a29e', marginTop: 6, marginBottom: 20 }}>No tasks match the current filters.</p>
              <button onClick={() => { setFilters(DEFAULT_FILTERS); setSearch('') }} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #ede8e1', background: 'white', color: '#78716c', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Clear filters
              </button>
            </div>
          ) : visible.map((task) => (
            <TaskCard key={task.id} task={task} onStatusChange={handleStatusChange} onOpen={setSelected} />
          ))}
        </div>

        {isDesktop && selected && (
          <DesktopTaskDetail
            task={selected} members={members}
            onClose={() => setSelected(null)}
            onUpdated={(t) => { setSelected(t); refresh() }}
            onDeleted={(id) => { deleteTask(id); setSelected(null) }}
          />
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => setShowAdd(true)}
        style={{
          position: 'fixed', bottom: isDesktop ? 24 : 72, right: 24, width: 50, height: 50,
          borderRadius: 14, background: ACCENT, color: 'white', border: 'none',
          fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(99,102,241,0.35)', zIndex: 40, cursor: 'pointer',
          transition: 'transform .12s',
        }}
        onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(.93)')}
        onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      >+</button>

      {!isDesktop && selected && (
        <TaskDrawer task={selected} members={members} onClose={() => setSelected(null)}
          onUpdated={(t) => { setSelected(t); refresh() }} onDeleted={(id) => { deleteTask(id); setSelected(null) }} />
      )}

      {showAdd && <AddTaskSheet members={members} onClose={() => setShowAdd(false)} onAdded={refresh} />}

      {showFilters && (
        <FilterSheet
          filters={filters}
          members={members}
          onUpdate={(patch) => setFilters((f) => ({ ...f, ...patch }))}
          onReset={() => setFilters(DEFAULT_FILTERS)}
          onClose={() => setShowFilters(false)}
        />
      )}

      {undoTask && (
        <div style={{
          position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          background: '#1c1917', color: 'white', borderRadius: 10,
          padding: '10px 16px', fontSize: 13, fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: '0 4px 16px rgba(0,0,0,0.20)', zIndex: 200, whiteSpace: 'nowrap',
        }}>
          All tasks done!
          <button
            onClick={async () => {
              if (undoTimer) clearTimeout(undoTimer)
              await updateTask(undoTask.id, { status: undoTask.prevStatus })
              setUndoTask(null); setUndoTimer(null)
            }}
            style={{ background: 'none', border: 'none', color: '#f97316', fontWeight: 700, fontSize: 13, cursor: 'pointer', padding: 0 }}
          >Undo</button>
        </div>
      )}
    </>
  )
}
