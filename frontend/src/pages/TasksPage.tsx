import { useState, useCallback } from 'react'
import { Navigate } from 'react-router-dom'
import { useStore } from '../store'
import { useAuthStore } from '../store/authStore'
import { TaskCard } from '../components/tasks/TaskCard'
import { TaskDrawer } from '../components/tasks/TaskDrawer'
import { AddTaskSheet } from '../components/tasks/AddTaskSheet'
import { Spinner } from '../components/ui/Spinner'
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
  const refresh = useCallback(() => fetchTasks(), [fetchTasks])

  if (!isGuest && member && !member.household_id) {
    return <Navigate to="/household" replace />
  }

  const visible = tasks
    .filter((t) => t.category !== 'grocery')
    .filter((t) => catTab === 'all' || t.category === catTab)
    .filter((t) => filterStatus === 'all' ? true : filterStatus === 'open' ? !t.done : t.done)
    .filter((t) => !myTasks || t.assignee_id === member?.id)
    .filter((t) => !search || t.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'recent') return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      const po: Record<string, number> = { urgent: 0, high: 1, normal: 2 }
      return ((a.done ? 10 : 0) + po[a.priority]) - ((b.done ? 10 : 0) + po[b.priority])
    })

  const nonGroceryTasks = tasks.filter((t) => t.category !== 'grocery')
  const openCount = nonGroceryTasks.filter((t) => !t.done).length
  const urgentCount = nonGroceryTasks.filter((t) => !t.done && t.priority === 'urgent').length
  const catTabs = [
    { id: 'all' as const, label: 'All' },
    ...(Object.entries(CATEGORIES) as [Category, { label: string; icon: string; color: string }][])
      .filter(([id]) => id !== 'grocery')
      .map(([id, v]) => ({ id, label: v.label })),
  ]

  return (
    <>
      {/* Sub-header: task stats + member avatars */}
      <div style={{
        background: 'var(--bg-surface)', padding: '10px 16px 0',
        borderBottom: '1px solid var(--border)',
        position: 'sticky', top: 57, zIndex: 49,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
              {openCount} open
              {urgentCount > 0 && <span style={{ color: '#ef4444', fontWeight: 600 }}> · {urgentCount} urgent</span>}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {members.slice(0, 4).map((m, i) => (
              <span
                key={m.id}
                title={m.name}
                style={{
                  marginLeft: i === 0 ? 0 : -8, zIndex: members.length - i,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 28, height: 28, borderRadius: '50%', fontSize: 13,
                  background: m.color + '20', border: `2px solid ${m.color}`,
                }}
              >{m.avatar}</span>
            ))}
            {members.length > 4 && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 28, height: 28, borderRadius: '50%', fontSize: 10, fontWeight: 700,
                background: '#f4f4f5', color: '#71717a', marginLeft: -8, border: '2px solid white',
              }}>+{members.length - 4}</span>
            )}
          </div>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa"
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
              border: '1px solid var(--border)', fontSize: 13, outline: 'none',
              background: 'var(--bg-subtle)', color: 'var(--text-primary)', boxSizing: 'border-box',
            }}
          />
          {search !== '' && (
            <button
              onClick={() => setSearch('')}
              style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', padding: 2, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#a1a1aa',
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
            const cnt = nonGroceryTasks.filter((x) => (t.id === 'all' || x.category === t.id) && !x.done).length
            const active = catTab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setCatTab(t.id)}
                style={{
                  flexShrink: 0, padding: '6px 12px', borderRadius: 99, border: '1px solid',
                  borderColor: active ? ACCENT : '#e4e4e7',
                  background: active ? '#eef2ff' : 'white',
                  color: active ? ACCENT : '#71717a',
                  fontWeight: 600, fontSize: 12,
                  display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer',
                }}
              >
                {t.id !== 'all' && CATEGORIES[t.id as Category].icon} {t.label}
                {cnt > 0 && (
                  <span style={{
                    background: active ? ACCENT : '#e4e4e7',
                    color: active ? 'white' : '#71717a',
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
        <div style={{ display: 'flex', background: 'var(--border)', borderRadius: 99, padding: 2, gap: 1 }}>
          {(['open', 'done', 'all'] as FilterStatus[]).map((k) => (
            <button
              key={k}
              onClick={() => setFilterStatus(k)}
              style={{
                padding: '4px 10px', borderRadius: 99, border: 'none', fontSize: 11, fontWeight: 600,
                background: filterStatus === k ? 'var(--bg-surface)' : 'transparent',
                color: filterStatus === k ? 'var(--text-primary)' : 'var(--text-secondary)',
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
            borderColor: myTasks ? ACCENT : '#e4e4e7',
            background: myTasks ? '#eef2ff' : 'white',
            color: myTasks ? ACCENT : '#71717a',
            fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all .12s',
          }}
        >My tasks</button>
        <button
          onClick={() => setSortBy((s) => s === 'priority' ? 'recent' : 'priority')}
          style={{
            marginLeft: 'auto', background: 'white', border: '1px solid #e4e4e7',
            borderRadius: 99, padding: '4px 10px', fontSize: 11, fontWeight: 600, color: '#71717a', cursor: 'pointer',
          }}
        >{sortBy === 'priority' ? 'Sort: Priority' : 'Sort: Recent'}</button>
      </div>

      {/* Content */}
      <div style={{ padding: '4px 12px 100px' }}>
        {loading ? (
          <Spinner />
        ) : nonGroceryTasks.length === 0 ? (
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
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#18181b', margin: '0 0 6px' }}>No tasks yet</h2>
            <p style={{ fontSize: 13, color: '#a1a1aa', margin: '0 0 24px', lineHeight: 1.6, maxWidth: 240 }}>
              Add your household's first task to get started.
            </p>
            <button
              onClick={() => setShowAdd(true)}
              style={{
                padding: '10px 24px', borderRadius: 8, border: 'none',
                background: ACCENT, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}
            >Add first task</button>
          </div>
        ) : visible.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 20px' }}>
            <p style={{ fontSize: 18, fontWeight: 700, color: '#18181b' }}>All clear!</p>
            <p style={{ fontSize: 13, color: '#a1a1aa', marginTop: 6, marginBottom: 20 }}>Nothing matches these filters.</p>
            <button
              onClick={() => { setCatTab('all'); setFilterStatus('open'); setMyTasks(false); setSearch('') }}
              style={{
                padding: '8px 20px', borderRadius: 8, border: '1px solid #e4e4e7',
                background: 'white', color: '#71717a', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >Reset filters</button>
          </div>
        ) : visible.map((task) => (
          <TaskCard key={task.id} task={task} onToggle={toggleTask} onOpen={setSelected} />
        ))}
      </div>

      {/* FAB */}
      <button
        onClick={() => setShowAdd(true)}
        style={{
          position: 'fixed', bottom: 72, right: 20, width: 50, height: 50,
          borderRadius: 14, background: ACCENT, color: 'white', border: 'none',
          fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(99,102,241,0.35)', zIndex: 40, cursor: 'pointer',
          transition: 'transform .12s',
        }}
        onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(.93)')}
        onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      >+</button>

      {/* Modals */}
      {selected && (
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
    </>
  )
}
