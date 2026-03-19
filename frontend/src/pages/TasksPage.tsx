import { useState, useCallback } from 'react'
import { Navigate } from 'react-router-dom'
import { useStore } from '../store'
import { useAuthStore } from '../store/authStore'
import { TaskCard } from '../components/tasks/TaskCard'
import { TaskDrawer } from '../components/tasks/TaskDrawer'
import { AddTaskSheet } from '../components/tasks/AddTaskSheet'
import { Spinner } from '../components/ui/Spinner'
import { DesktopTaskDetail } from '../components/layout/desktop/DesktopTaskDetail'
import { useBreakpoint } from '../hooks/useBreakpoint'
import { STATUSES, type Task, type TaskStatus } from '../types'
import { isOverdue } from '../utils'

type Tab = 'active' | 'urgent' | 'done'

const TABS: { id: Tab; label: string }[] = [
  { id: 'active', label: 'Active' },
  { id: 'urgent', label: 'Urgent' },
  { id: 'done',   label: 'Done'   },
]

const ACCENT = '#6366f1'

// Status groups shown within Active / Urgent tabs
const STATUS_GROUPS: { status: TaskStatus; label: string }[] = [
  { status: 'in_progress', label: 'In Progress' },
  { status: 'open',        label: 'Open'        },
  { status: 'on_hold',     label: 'On Hold'     },
]

interface GroupProps {
  label: string
  status: TaskStatus
  tasks: Task[]
  onStatusChange: (id: string, s: TaskStatus) => void
  onOpen: (t: Task) => void
  defaultOpen?: boolean
}

function TaskGroup({ label, status, tasks, onStatusChange, onOpen, defaultOpen = true }: GroupProps) {
  const [open, setOpen] = useState(defaultOpen)
  const s = STATUSES[status]
  if (tasks.length === 0) return null
  return (
    <div style={{ marginBottom: 4 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          width: '100%', padding: '8px 4px',
          background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: '#78716c', letterSpacing: 0.5, textTransform: 'uppercase', flex: 1 }}>
          {label}
        </span>
        <span style={{
          fontSize: 11, fontWeight: 700, color: 'white',
          background: s.color, borderRadius: 99, padding: '1px 7px',
        }}>{tasks.length}</span>
        <svg
          width="13" height="13" viewBox="0 0 24 24" fill="none"
          stroke="#a8a29e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform .15s', flexShrink: 0 }}
        >
          <polyline points="9,18 15,12 9,6" />
        </svg>
      </button>
      {open && tasks.map((task) => (
        <TaskCard key={task.id} task={task} onStatusChange={onStatusChange} onOpen={onOpen} />
      ))}
    </div>
  )
}

export function TasksPage() {
  const { tasks, members, loading, fetchTasks, updateTask, deleteTask } = useStore()
  const { member } = useAuthStore()
  const [tab, setTab] = useState<Tab>('active')
  const [memberFilter, setMemberFilter] = useState<string | null>(null)
  const [selected, setSelected] = useState<Task | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [undoTask, setUndoTask] = useState<{ id: string; prevStatus: TaskStatus } | null>(null)
  const [undoTimer, setUndoTimer] = useState<ReturnType<typeof setTimeout> | null>(null)
  const isDesktop = useBreakpoint()
  const refresh = useCallback(() => fetchTasks(), [fetchTasks])

  const handleStatusChange = useCallback(async (id: string, status: TaskStatus) => {
    await updateTask(id, { status })
    if (status === 'done') {
      const remaining = useStore.getState().tasks.filter((t) => t.status !== 'done')
      if (remaining.length === 0) {
        if (undoTimer) clearTimeout(undoTimer)
        const prev = tasks.find((t) => t.id === id)
        setUndoTask({ id, prevStatus: prev?.status ?? 'open' })
        const timer = setTimeout(() => { setUndoTask(null); setUndoTimer(null) }, 4000)
        setUndoTimer(timer)
      }
    } else if (undoTask?.id === id) {
      if (undoTimer) clearTimeout(undoTimer)
      setUndoTask(null); setUndoTimer(null)
    }
  }, [updateTask, undoTask, undoTimer, tasks])

  if (member && !member.household_id) {
    return <Navigate to="/household" replace />
  }

  // Apply member filter then tab filter
  const byMember = memberFilter ? tasks.filter((t) => t.assignee_id === memberFilter) : tasks

  const tabFiltered = byMember.filter((t) => {
    switch (tab) {
      case 'active': return !t.done
      case 'urgent': return !t.done && (t.priority === 'urgent' || isOverdue(t.due_at, t.done))
      case 'done':   return t.done
    }
  })

  // Sort: in_progress first, then by priority, done tasks by done_at desc
  const priorityOrder: Record<string, number> = { urgent: 0, high: 1, normal: 2 }
  const statusOrder: Record<string, number> = { in_progress: 0, open: 1, on_hold: 2, done: 3 }
  const sorted = [...tabFiltered].sort((a, b) => {
    if (tab === 'done') {
      return new Date(b.done_at ?? b.updated_at).getTime() - new Date(a.done_at ?? a.updated_at).getTime()
    }
    const sd = (statusOrder[a.status ?? 'open'] ?? 1) - (statusOrder[b.status ?? 'open'] ?? 1)
    if (sd !== 0) return sd
    return priorityOrder[a.priority] - priorityOrder[b.priority]
  })

  // For Active/Urgent: group by status
  const grouped = (tab === 'active' || tab === 'urgent')
    ? STATUS_GROUPS.map((g) => ({ ...g, tasks: sorted.filter((t) => t.status === g.status) }))
    : null

  const activeCount  = tasks.filter((t) => !t.done).length
  const urgentCount  = tasks.filter((t) => !t.done && (t.priority === 'urgent' || isOverdue(t.due_at, t.done))).length
  const tabCount     = tab === 'active' ? activeCount : tab === 'urgent' ? urgentCount : tasks.filter((t) => t.done).length

  return (
    <>
      {/* Sticky header */}
      <div style={{
        background: 'white', padding: '12px 16px 0',
        borderBottom: '1px solid #ede8e1',
        position: 'sticky', top: 57, zIndex: 49,
      }}>
        {/* Title + stats */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
          <div>
            <h2 style={{ fontSize: 13, fontWeight: 600, color: '#78716c', margin: '0 0 2px', letterSpacing: 0.2 }}>Tasks</h2>
            <p style={{ fontSize: 12, color: '#a8a29e', margin: 0 }}>
              {activeCount} active
              {urgentCount > 0 && <span style={{ color: '#ef4444', fontWeight: 600 }}> · {urgentCount} urgent</span>}
            </p>
          </div>

          {/* Member avatar strip — tap to filter */}
          {members.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
              {members.slice(0, 5).map((m, i) => {
                const active = memberFilter === m.id
                return (
                  <button
                    key={m.id}
                    title={`${active ? 'Clear filter' : 'Filter by'} ${m.name}`}
                    onClick={() => setMemberFilter(active ? null : m.id)}
                    style={{
                      marginLeft: i === 0 ? 0 : -6,
                      zIndex: active ? 10 : members.length - i,
                      width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                      background: m.color, color: 'white', border: `2.5px solid ${active ? '#6366f1' : 'white'}`,
                      fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'system-ui, sans-serif',
                      outline: active ? `2px solid #6366f1` : 'none', outlineOffset: 1,
                      transition: 'outline .1s, border-color .1s',
                    }}
                  >{m.name?.charAt(0).toUpperCase() || '?'}</button>
                )
              })}
              {members.length > 5 && (
                <span style={{
                  marginLeft: -6, zIndex: 0,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 30, height: 30, borderRadius: '50%', fontSize: 10, fontWeight: 700,
                  background: '#faf7f2', color: '#78716c', border: '2.5px solid white',
                }}>+{members.length - 5}</span>
              )}
              {memberFilter && (
                <button
                  onClick={() => setMemberFilter(null)}
                  style={{
                    marginLeft: 6, background: 'none', border: 'none', padding: 0,
                    cursor: 'pointer', color: '#a8a29e', display: 'flex', alignItems: 'center',
                  }}
                  title="Clear member filter"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: -1 }}>
          {TABS.map(({ id, label }) => {
            const count = id === 'active' ? activeCount : id === 'urgent' ? urgentCount : tasks.filter((t) => t.done).length
            const active = tab === id
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                style={{
                  padding: '8px 14px', border: 'none', background: 'none',
                  borderBottom: active ? `2px solid ${ACCENT}` : '2px solid transparent',
                  color: active ? ACCENT : '#78716c',
                  fontWeight: active ? 700 : 500, fontSize: 13,
                  cursor: 'pointer', transition: 'all .12s',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                {label}
                {count > 0 && (
                  <span style={{
                    background: active ? ACCENT : '#ede8e1',
                    color: active ? 'white' : '#78716c',
                    borderRadius: 99, padding: '0px 5px', fontSize: 10, fontWeight: 700,
                  }}>{count}</span>
                )}
              </button>
            )
          })}
        </div>
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
                {'Add your household\'s first task to get started.'}
              </p>
              <button onClick={() => setShowAdd(true)} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: ACCENT, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Add first task
              </button>
            </div>
          ) : sorted.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '64px 20px' }}>
              {tab === 'done' ? (
                <>
                  <p style={{ fontSize: 32, margin: '0 0 8px' }}>🎉</p>
                  <p style={{ fontSize: 18, fontWeight: 700, color: '#1c1917', margin: '0 0 6px' }}>Nothing done yet</p>
                  <p style={{ fontSize: 13, color: '#a8a29e', margin: 0 }}>Completed tasks will appear here.</p>
                </>
              ) : tab === 'urgent' ? (
                <>
                  <p style={{ fontSize: 32, margin: '0 0 8px' }}>✓</p>
                  <p style={{ fontSize: 18, fontWeight: 700, color: '#1c1917', margin: '0 0 6px' }}>All clear</p>
                  <p style={{ fontSize: 13, color: '#a8a29e', margin: 0 }}>No urgent or overdue tasks.</p>
                </>
              ) : (
                <>
                  <p style={{ fontSize: 32, margin: '0 0 8px' }}>✓</p>
                  <p style={{ fontSize: 18, fontWeight: 700, color: '#1c1917', margin: '0 0 6px' }}>
                    {memberFilter ? 'No active tasks for this person' : 'All done!'}
                  </p>
                  <p style={{ fontSize: 13, color: '#a8a29e', margin: 0 }}>
                    {memberFilter ? 'Try tapping a different avatar above.' : 'Add a new task to get started.'}
                  </p>
                </>
              )}
            </div>
          ) : grouped ? (
            /* Grouped by status */
            <div style={{ paddingTop: 4 }}>
              {grouped.map((g) => (
                <TaskGroup
                  key={g.status}
                  label={g.label}
                  status={g.status}
                  tasks={g.tasks}
                  onStatusChange={handleStatusChange}
                  onOpen={setSelected}
                  defaultOpen={g.status !== 'on_hold'}
                />
              ))}
            </div>
          ) : (
            /* Flat list (Done tab) */
            sorted.map((task) => (
              <TaskCard key={task.id} task={task} onStatusChange={handleStatusChange} onOpen={setSelected} />
            ))
          )}
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
          onUpdated={(t) => { setSelected(t); refresh() }}
          onDeleted={(id) => { deleteTask(id); setSelected(null) }} />
      )}

      {showAdd && <AddTaskSheet members={members} onClose={() => setShowAdd(false)} onAdded={refresh} />}

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
