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
import { CATEGORIES, type Task, type Category } from '../types'

type FilterStatus = 'open' | 'done' | 'all'
type SortBy = 'priority' | 'recent'

const ACCENT = '#6366f1'

export function TasksPage() {
  const { tasks, members, loading, fetchTasks, toggleTask, deleteTask } = useStore()
  const { member, isGuest } = useAuthStore()
  const [catTab, setCatTab] = useState<Category | 'all'>('all')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('open')
  const [sortBy, setSortBy] = useState<SortBy>('priority')
  const [myTasks, setMyTasks] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Task | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [undoTask, setUndoTask] = useState<{ id: string } | null>(null)
  const [undoTimer, setUndoTimer] = useState<ReturnType<typeof setTimeout> | null>(null)
  const isDesktop = useBreakpoint()
  const refresh = useCallback(() => fetchTasks(), [fetchTasks])

  const handleToggle = useCallback(async (id: string, done: boolean) => {
    await toggleTask(id, done)
    if (done) {
      const openAfter = useStore.getState().tasks
        .filter((t) => !t.done)
      if (openAfter.length === 0) {
        if (undoTimer) clearTimeout(undoTimer)
        setUndoTask({ id })
        const timer = setTimeout(() => {
          setUndoTask(null)
          setUndoTimer(null)
        }, 4000)
        setUndoTimer(timer)
      }
    } else if (undoTask?.id === id) {
      if (undoTimer) clearTimeout(undoTimer)
      setUndoTask(null)
      setUndoTimer(null)
    }
  }, [toggleTask, undoTask, undoTimer])

  if (!isGuest && member && !member.household_id) {
    return <Navigate to="/household" replace />
  }

  const visible = tasks
    .filter((t) => catTab === 'all' || t.category === catTab)
    .filter((t) => filterStatus === 'all' ? true : filterStatus === 'open' ? !t.done : t.done)
    .filter((t) => !myTasks || t.assignee_id === member?.id)
    .filter((t) => !search || t.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'recent') return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      const po: Record<string, number> = { urgent: 0, high: 1, normal: 2 }
      const so: Record<string, number> = { in_progress: 0, open: 1, on_hold: 2, done: 3 }
      const aDone = a.done ? 1 : 0
      const bDone = b.done ? 1 : 0
      if (aDone !== bDone) return aDone - bDone
      const statusDiff = (so[a.status ?? 'open'] ?? 1) - (so[b.status ?? 'open'] ?? 1)
      if (statusDiff !== 0) return statusDiff
      return po[a.priority] - po[b.priority]
    })

  const openCount = tasks.filter((t) => !t.done).length
  const urgentCount = tasks.filter((t) => !t.done && t.priority === 'urgent').length
  const catTabs = [
    { id: 'all' as const, label: 'All' },
    ...(Object.entries(CATEGORIES) as [Category, { label: string; color: string }][])
      .map(([id, v]) => ({ id, label: v.label })),
  ]

  return (
    <>
      {/* Sub-header: page title + task stats + member avatars */}
      <div style={{
        background: 'white', padding: '12px 16px 0',
        borderBottom: '1px solid #ede8e1',
        position: 'sticky', top: 57, zIndex: 49,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: '#78716c', margin: 0, letterSpacing: 0.2, flex: 1 }}>Tasks</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {members.slice(0, 4).map((m, i) => (
              <span
                key={m.id}
                title={m.name}
                style={{
                  marginLeft: i === 0 ? 0 : -8, zIndex: members.length - i,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 28, height: 28, borderRadius: '50%', fontSize: 11, fontWeight: 700,
                  background: m.color, color: 'white', border: '2px solid white',
                  fontFamily: 'system-ui, sans-serif',
                }}
              >{m.name?.charAt(0).toUpperCase() || '?'}</span>
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
          {openCount} open
          {urgentCount > 0 && <span style={{ color: '#ef4444', fontWeight: 600 }}> · {urgentCount} urgent</span>}
        </p>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a8a29e"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
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
          {search !== '' && (
            <button
              onClick={() => setSearch('')}
              style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', padding: 2, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#a8a29e',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Category tabs */}
        <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 12 }}>
          {catTabs.map((t) => {
            const cnt = tasks.filter((x) => (t.id === 'all' || x.category === t.id) && !x.done).length
            const active = catTab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setCatTab(t.id)}
                style={{
                  flexShrink: 0, padding: '6px 12px', borderRadius: 99, border: '1px solid',
                  borderColor: active ? ACCENT : '#ede8e1',
                  background: active ? '#eef2ff' : 'white',
                  color: active ? ACCENT : '#78716c',
                  fontWeight: 600, fontSize: 12,
                  display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer',
                }}
              >
                {t.label}
                {cnt > 0 && (
                  <span style={{
                    background: active ? ACCENT : '#ede8e1',
                    color: active ? 'white' : '#78716c',
                    borderRadius: 99, padding: '1px 5px', fontSize: 10, fontWeight: 700,
                  }}>{cnt}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Filter toolbar */}
      <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', background: '#ede8e1', borderRadius: 99, padding: 2, gap: 1 }}>
          {(['open', 'done', 'all'] as FilterStatus[]).map((k) => (
            <button
              key={k}
              onClick={() => setFilterStatus(k)}
              style={{
                padding: '4px 10px', borderRadius: 99, border: 'none', fontSize: 11, fontWeight: 600,
                background: filterStatus === k ? 'white' : 'transparent',
                color: filterStatus === k ? '#1c1917' : '#78716c',
                boxShadow: filterStatus === k ? '0 1px 3px rgba(0,0,0,0.10)' : 'none',
                cursor: 'pointer', transition: 'all .12s',
              }}
            >{k.charAt(0).toUpperCase() + k.slice(1)}</button>
          ))}
        </div>
        <button
          onClick={() => setMyTasks((v) => !v)}
          style={{
            padding: '4px 10px', borderRadius: 99, border: '1px solid',
            borderColor: myTasks ? ACCENT : '#ede8e1',
            background: myTasks ? '#eef2ff' : 'white',
            color: myTasks ? ACCENT : '#78716c',
            fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all .12s',
          }}
        >My tasks</button>
        <button
          onClick={() => setSortBy((s) => s === 'priority' ? 'recent' : 'priority')}
          style={{
            marginLeft: 'auto', background: 'white', border: '1px solid #ede8e1',
            borderRadius: 99, padding: '4px 10px', fontSize: 11, fontWeight: 600, color: '#78716c', cursor: 'pointer',
          }}
        >{sortBy === 'priority' ? 'Sort: Priority' : 'Sort: Recent'}</button>
      </div>

      {/* Content — two columns on desktop, single column on mobile */}
      <div style={{ display: 'flex', flex: 1 }}>
        <div style={{ flex: 1, padding: '4px 12px', paddingBottom: isDesktop ? 40 : 140, minWidth: 0 }}>
          {loading ? (
            <Spinner />
          ) : tasks.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '72px 24px 32px', textAlign: 'center' }}>
              <div style={{
                width: 64, height: 64, borderRadius: 20, background: '#eef2ff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 11l3 3L22 4" />
                  <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                </svg>
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1c1917', margin: '0 0 6px' }}>No tasks yet</h2>
              <p style={{ fontSize: 13, color: '#a8a29e', margin: '0 0 24px', lineHeight: 1.6, maxWidth: 240 }}>
                {isGuest ? 'Add a few preview tasks to try the app locally.' : 'Add your household\'s first task to get started.'}
              </p>
              <button
                onClick={() => setShowAdd(true)}
                style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: ACCENT, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >Add first task</button>
            </div>
          ) : visible.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '64px 20px' }}>
              <p style={{ fontSize: 18, fontWeight: 700, color: '#1c1917' }}>All clear!</p>
              <p style={{ fontSize: 13, color: '#a8a29e', marginTop: 6, marginBottom: 20 }}>Nothing matches these filters.</p>
              <button
                onClick={() => { setCatTab('all'); setFilterStatus('open'); setMyTasks(false); setSearch('') }}
                style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #ede8e1', background: 'white', color: '#78716c', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >Reset filters</button>
            </div>
          ) : visible.map((task) => (
            <TaskCard key={task.id} task={task} onToggle={handleToggle} onOpen={setSelected} />
          ))}
        </div>

        {/* Desktop detail panel */}
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

      {/* Mobile drawer — only on mobile */}
      {!isDesktop && selected && (
        <TaskDrawer
          task={selected} members={members}
          onClose={() => setSelected(null)}
          onUpdated={(t) => { setSelected(t); refresh() }}
          onDeleted={(id) => { deleteTask(id); setSelected(null) }}
        />
      )}
      {showAdd && (
        <AddTaskSheet members={members} onClose={() => setShowAdd(false)} onAdded={refresh} />
      )}
      {undoTask && (
        <div style={{
          position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          background: '#1c1917', color: 'white', borderRadius: 10,
          padding: '10px 16px', fontSize: 13, fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: '0 4px 16px rgba(0,0,0,0.20)', zIndex: 200,
          whiteSpace: 'nowrap',
        }}>
          All tasks done!
          <button
            onClick={async () => {
              if (undoTimer) clearTimeout(undoTimer)
              await toggleTask(undoTask.id, false)
              setUndoTask(null)
              setUndoTimer(null)
            }}
            style={{
              background: 'none', border: 'none', color: '#f97316',
              fontWeight: 700, fontSize: 13, cursor: 'pointer', padding: 0,
            }}
          >Undo</button>
        </div>
      )}
    </>
  )
}
