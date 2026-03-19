import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TaskCard } from '../components/tasks/TaskCard'
import { STATUSES, type Task, type TaskStatus } from '../types'
import { PREVIEW_MEMBERS, PREVIEW_TASKS } from '../data/previewData'

type Tab = 'active' | 'done'

const ACCENT = '#6366f1'

const STATUS_GROUPS: { status: TaskStatus; label: string }[] = [
  { status: 'in_progress', label: 'In Progress' },
  { status: 'open', label: 'Open' },
  { status: 'on_hold', label: 'On Hold' },
]

// ──────────────────────────────────────────────
// TaskGroup — mirrors TasksPage pattern inline
// ──────────────────────────────────────────────

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

// ──────────────────────────────────────────────
// RegisterSheet — bottom sheet with slide-up
// ──────────────────────────────────────────────

interface RegisterSheetProps {
  onClose: () => void
}

function RegisterSheet({ onClose }: RegisterSheetProps) {
  const navigate = useNavigate()

  const handleRegister = () => navigate('/auth?mode=register')
  const handleLogin = () => navigate('/auth?mode=login')

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.3)',
          zIndex: 50,
        }}
      />
      {/* Sheet */}
      <div
        className="slide-up"
        style={{
          position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: 520,
          background: 'white',
          borderRadius: '20px 20px 0 0',
          padding: '12px 24px 40px',
          zIndex: 51,
          boxShadow: '0 -4px 32px rgba(0,0,0,0.12)',
        }}
      >
        {/* Pill handle */}
        <div style={{
          width: 36, height: 4, borderRadius: 99,
          background: '#ede8e1', margin: '0 auto 24px',
        }} />

        <h2 style={{
          fontFamily: 'Fraunces, serif',
          fontSize: 22, fontWeight: 700,
          color: '#1c1917', margin: '0 0 8px',
          lineHeight: 1.25,
        }}>
          See how it works — for real
        </h2>
        <p style={{
          fontSize: 14, color: '#78716c', margin: '0 0 28px', lineHeight: 1.6,
        }}>
          Create your household and manage tasks together with your people.
        </p>

        <button
          onClick={handleRegister}
          style={{
            width: '100%', padding: '14px 20px',
            background: ACCENT, color: 'white',
            border: 'none', borderRadius: 12,
            fontSize: 15, fontWeight: 700,
            cursor: 'pointer', marginBottom: 16,
            transition: 'opacity .15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
        >
          Get started →
        </button>

        <button
          onClick={handleLogin}
          style={{
            width: '100%', background: 'none', border: 'none',
            fontSize: 13, color: '#a8a29e', cursor: 'pointer',
            padding: '4px 0', textAlign: 'center',
          }}
        >
          Already have an account? Sign in
        </button>
      </div>
    </>
  )
}

// ──────────────────────────────────────────────
// BottomNav — preview-specific (no navigation)
// ──────────────────────────────────────────────

function TasksIcon({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
  )
}

function GroceryIcon({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 01-8 0" />
    </svg>
  )
}

function StatsIcon({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="18" y="3" width="4" height="18" rx="1" />
      <rect x="10" y="8" width="4" height="13" rx="1" />
      <rect x="2" y="13" width="4" height="8" rx="1" />
    </svg>
  )
}

function HouseholdIcon({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9,22 9,12 15,12 15,22" />
    </svg>
  )
}

interface PreviewNavProps {
  onSheetOpen: () => void
}

function PreviewBottomNav({ onSheetOpen }: PreviewNavProps) {
  const MUTED = '#a8a29e'
  const navItems = [
    { id: 'tasks', label: 'Tasks', Icon: TasksIcon, isActive: true, onClick: () => {} },
    { id: 'grocery', label: 'Grocery', Icon: GroceryIcon, isActive: false, onClick: onSheetOpen },
    { id: 'stats', label: 'Stats', Icon: StatsIcon, isActive: false, onClick: onSheetOpen },
    { id: 'household', label: 'Household', Icon: HouseholdIcon, isActive: false, onClick: onSheetOpen },
  ]

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: 520, background: 'white',
      borderTop: '1px solid #ede8e1', display: 'flex',
      paddingBottom: 'env(safe-area-inset-bottom, 8px)',
      zIndex: 40,
    }}>
      {navItems.map(({ id, label, Icon, isActive, onClick }) => {
        const color = isActive ? ACCENT : MUTED
        return (
          <button
            key={id}
            onClick={onClick}
            style={{
              flex: 1, background: 'none', border: 'none',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '10px 0 10px', gap: 4, cursor: 'pointer', position: 'relative',
            }}
          >
            <span style={{
              position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
              width: isActive ? 24 : 0, height: 2, borderRadius: '0 0 2px 2px',
              background: ACCENT, transition: 'width 0.2s ease',
            }} />
            <Icon color={color} />
            <span style={{
              fontSize: 10, fontWeight: 600,
              color, transition: 'color 0.15s',
              letterSpacing: 0.2,
            }}>{label}</span>
          </button>
        )
      })}
    </div>
  )
}

// ──────────────────────────────────────────────
// PreviewPage — main export
// ──────────────────────────────────────────────

export function PreviewPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('active')
  const [sheetOpen, setSheetOpen] = useState(false)

  const openSheet = () => setSheetOpen(true)
  const closeSheet = () => setSheetOpen(false)

  // Tab filtering
  const activeTasks = PREVIEW_TASKS.filter((t) => !t.done)
  const doneTasks = PREVIEW_TASKS.filter((t) => t.done)

  const grouped = STATUS_GROUPS.map((g) => ({
    ...g,
    tasks: activeTasks.filter((t) => t.status === g.status),
  }))

  const PREVIEW_TABS: { id: Tab; label: string; count: number }[] = [
    { id: 'active', label: 'Active', count: activeTasks.length },
    { id: 'done', label: 'Done', count: doneTasks.length },
  ]

  return (
    <div style={{ background: '#faf7f2', minHeight: '100vh' }}>
      {/* ── App header (sticky, mirroring AppLayout top bar) ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 49,
        background: 'white', borderBottom: '1px solid #ede8e1',
      }}>
        {/* Household row */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px 8px',
        }}>
          {/* Household name */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#a8a29e', margin: '0 0 1px', letterSpacing: 0.3, textTransform: 'uppercase' }}>
              Household
            </p>
            <h1 style={{
              fontFamily: 'Fraunces, serif',
              fontSize: 17, fontWeight: 700, color: '#1c1917', margin: 0,
            }}>
              The Martins
            </h1>
          </div>

          {/* Member avatars */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {PREVIEW_MEMBERS.map((m, i) => (
              <div
                key={m.id}
                title={m.name}
                style={{
                  marginLeft: i === 0 ? 0 : -6,
                  zIndex: PREVIEW_MEMBERS.length - i,
                  width: 30, height: 30, borderRadius: '50%',
                  background: m.color, color: 'white',
                  border: '2.5px solid white',
                  fontSize: 11, fontWeight: 700,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'system-ui, sans-serif',
                  flexShrink: 0,
                }}
              >
                {m.name.charAt(0).toUpperCase()}
              </div>
            ))}
          </div>
        </div>

        {/* Preview banner */}
        <div style={{
          background: '#fef3c7',
          padding: '5px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 12, color: '#92400e', flex: 1, textAlign: 'center' }}>
            👋 This is a preview. Create an account to manage your household.
          </span>
          <button
            onClick={() => navigate('/auth?mode=register')}
            style={{
              background: 'none', border: 'none', padding: 0,
              fontSize: 12, fontWeight: 700, color: '#92400e', cursor: 'pointer',
              whiteSpace: 'nowrap', textDecoration: 'underline',
            }}
          >
            Get started →
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, padding: '0 16px', marginBottom: -1 }}>
          {PREVIEW_TABS.map(({ id, label, count }) => {
            const isActive = tab === id
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                style={{
                  padding: '8px 14px', border: 'none', background: 'none',
                  borderBottom: isActive ? `2px solid ${ACCENT}` : '2px solid transparent',
                  color: isActive ? ACCENT : '#78716c',
                  fontWeight: isActive ? 700 : 500, fontSize: 13,
                  cursor: 'pointer', transition: 'all .12s',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                {label}
                {count > 0 && (
                  <span style={{
                    background: isActive ? ACCENT : '#ede8e1',
                    color: isActive ? 'white' : '#78716c',
                    borderRadius: 99, padding: '0px 5px', fontSize: 10, fontWeight: 700,
                  }}>{count}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ padding: '8px 12px', paddingBottom: 140 }}>
        {tab === 'active' ? (
          <div style={{ paddingTop: 4 }}>
            {grouped.map((g) => (
              <TaskGroup
                key={g.status}
                label={g.label}
                status={g.status}
                tasks={g.tasks}
                onStatusChange={openSheet}
                onOpen={openSheet}
                defaultOpen={g.status !== 'on_hold'}
              />
            ))}
          </div>
        ) : (
          doneTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onStatusChange={openSheet}
              onOpen={openSheet}
            />
          ))
        )}
      </div>

      {/* ── FAB ── */}
      <button
        onClick={openSheet}
        style={{
          position: 'fixed', bottom: 72, right: 24,
          width: 56, height: 56, borderRadius: '50%',
          background: ACCENT, color: 'white', border: 'none',
          fontSize: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(99,102,241,0.35)', zIndex: 40, cursor: 'pointer',
          transition: 'transform .12s',
        }}
        onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(.93)')}
        onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      >
        +
      </button>

      {/* ── Bottom Nav ── */}
      <PreviewBottomNav onSheetOpen={openSheet} />

      {/* ── Register Prompt Sheet ── */}
      {sheetOpen && <RegisterSheet onClose={closeSheet} />}
    </div>
  )
}
