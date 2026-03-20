import { Navigate } from 'react-router-dom'
import { useStore } from '../store'
import { useAuthStore } from '../store/authStore'
import { StatsScreen } from '../components/stats/StatsScreen'
import { Avatar } from '../components/ui/Avatar'
import { CATEGORIES, type Task, type Member } from '../types'
import { useBreakpoint } from '../hooks/useBreakpoint'

export function StatsPage() {
  const { tasks, members } = useStore()
  const { member } = useAuthStore()
  const isDesktop = useBreakpoint()

  if (member && !member.household_id) {
    return <Navigate to="/household" replace />
  }

  return (
    <>
      <div style={{ background: 'white', padding: '12px 16px', borderBottom: '1px solid #ede8e1', position: 'sticky', top: 57, zIndex: 49 }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, color: '#78716c', margin: 0, letterSpacing: 0.2 }}>Stats</h2>
      </div>
      {isDesktop
        ? <DesktopStats tasks={tasks} members={members} />
        : <StatsScreen tasks={tasks} members={members} />
      }
    </>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// ── Desktop layout ────────────────────────────────────────────────────────────

function DesktopStats({ tasks, members }: { tasks: Task[]; members: Member[] }) {
  const now = new Date()
  const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7)
  const in3Days = new Date(now); in3Days.setDate(in3Days.getDate() + 3)

  const open = tasks.filter(t => !t.done)
  const done = tasks.filter(t => t.done)
  const total = tasks.length
  const doneCount = done.length
  const pct = total ? Math.round((doneCount / total) * 100) : 0

  const completedThisWeek = done.filter(t => t.done_at && new Date(t.done_at) >= weekAgo).length
  const dueSoon = open.filter(t => t.due_at && new Date(t.due_at) <= in3Days && new Date(t.due_at) >= now).length
  const inProgress = open.filter(t => t.status === 'in_progress').length
  const unassigned = open.filter(t => !t.assignee_id).length
  const overdueCount = open.filter(t => t.due_at && new Date(t.due_at) < now).length
  const urgentCount = open.filter(t => t.priority === 'urgent').length

  const urgentOpen = open.filter(t => t.priority === 'urgent').length
  const highOpen = open.filter(t => t.priority === 'high').length
  const normalOpen = open.filter(t => t.priority === 'normal').length
  const priorityTotal = urgentOpen + highOpen + normalOpen || 1

  const r = 42, circ = 2 * Math.PI * r

  if (tasks.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 24px', textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#faf7f2', border: '2px dashed #d4d4d8', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#a8a29e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
          </svg>
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1c1917', margin: '0 0 8px' }}>Nothing to report yet</h2>
        <p style={{ fontSize: 13, color: '#a8a29e', lineHeight: 1.6, maxWidth: 240, margin: 0 }}>Add some tasks to your household and stats will appear here.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start' }}>
      {/* ── Left column ──────────────────────────────────────── */}
      <div style={{ width: 300, flexShrink: 0, padding: '20px 16px 40px 20px', borderRight: '1px solid #ede8e1' }}>

        {/* Overall ring */}
        <div style={{ background: 'white', borderRadius: 14, padding: '24px 20px', border: '1px solid #ede8e1', marginBottom: 12, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <svg width="96" height="96" style={{ marginBottom: 14 }}>
            <circle cx={48} cy={48} r={r} fill="none" stroke="#ede8e1" strokeWidth="7" />
            <circle cx={48} cy={48} r={r} fill="none" stroke="#22c55e" strokeWidth="7"
              strokeDasharray={`${circ}`} strokeDashoffset={`${circ * (1 - pct / 100)}`}
              strokeLinecap="round" transform="rotate(-90 48 48)" style={{ transition: 'stroke-dashoffset .5s' }} />
            <text x={48} y={54} textAnchor="middle" fontSize={16} fontWeight={700} fill="#1c1917">{pct}%</text>
          </svg>
          <p style={{ fontSize: 18, fontWeight: 700, color: '#1c1917', margin: '0 0 4px' }}>{doneCount} of {total} done</p>
          <p style={{ fontSize: 13, color: '#78716c', margin: 0 }}>{total - doneCount} remaining</p>
        </div>

        {/* Quick stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          <DesktopTile value={completedThisWeek} label="Done this week" color="#22c55e" />
          <DesktopTile value={inProgress} label="In progress" color="#6366f1" />
          <DesktopTile value={dueSoon} label="Due in 3 days" color="#d97706" />
          <DesktopTile value={unassigned} label="Unassigned" color="#a8a29e" />
        </div>

        {/* Urgency alerts */}
        {overdueCount > 0 && (
          <div style={{ background: '#fef2f2', borderRadius: 10, padding: '12px 14px', border: '1px solid #fecaca', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>⚠</span>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#dc2626', margin: 0 }}>{overdueCount} overdue</p>
              <p style={{ fontSize: 12, color: '#ef4444', margin: 0 }}>Past due date</p>
            </div>
          </div>
        )}
        {urgentCount > 0 && (
          <div style={{ background: '#fff7ed', borderRadius: 10, padding: '12px 14px', border: '1px solid #fed7aa', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>!</span>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#ea580c', margin: 0 }}>{urgentCount} urgent</p>
              <p style={{ fontSize: 12, color: '#f97316', margin: 0 }}>Needs attention</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Right column ─────────────────────────────────────── */}
      <div style={{ flex: 1, padding: '20px 20px 40px', minWidth: 0 }}>

        {/* Priority breakdown */}
        {open.length > 0 && (
          <>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#a8a29e', letterSpacing: 0.8, textTransform: 'uppercase', margin: '0 0 10px 2px' }}>Open tasks by priority</p>
            <div style={{ background: 'white', borderRadius: 12, padding: '14px 16px', border: '1px solid #ede8e1', marginBottom: 20 }}>
              <div style={{ display: 'flex', height: 10, borderRadius: 99, overflow: 'hidden', marginBottom: 12 }}>
                {urgentOpen > 0 && <div style={{ flex: urgentOpen, background: '#ef4444', transition: 'flex .4s' }} />}
                {highOpen > 0 && <div style={{ flex: highOpen, background: '#f97316', transition: 'flex .4s' }} />}
                {normalOpen > 0 && <div style={{ flex: normalOpen, background: '#d4d4d8', transition: 'flex .4s' }} />}
              </div>
              <div style={{ display: 'flex', gap: 20 }}>
                <PriorityLegendD color="#ef4444" label="Urgent" count={urgentOpen} total={priorityTotal} />
                <PriorityLegendD color="#f97316" label="High" count={highOpen} total={priorityTotal} />
                <PriorityLegendD color="#d4d4d8" label="Normal" count={normalOpen} total={priorityTotal} />
              </div>
            </div>
          </>
        )}

        {/* By category */}
        <p style={{ fontSize: 10, fontWeight: 700, color: '#a8a29e', letterSpacing: 0.8, textTransform: 'uppercase', margin: '0 0 10px 2px' }}>By category</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
          {(Object.entries(CATEGORIES) as [string, { label: string; color: string }][]).map(([k, v]) => {
            const catTasks = tasks.filter(x => x.category === k)
            const catDone = catTasks.filter(x => x.done).length
            const p = catTasks.length ? (catDone / catTasks.length) * 100 : 0
            return (
              <div key={k} style={{ background: 'white', borderRadius: 12, padding: '14px 16px', border: '1px solid #ede8e1' }}>
                <div style={{ height: 4, width: 28, borderRadius: 99, background: v.color, marginBottom: 10 }} />
                <p style={{ fontSize: 13, fontWeight: 600, color: '#1c1917', margin: '0 0 2px' }}>{v.label}</p>
                <p style={{ fontSize: 12, color: '#a8a29e', margin: '0 0 10px' }}>{catDone}/{catTasks.length} done</p>
                <div style={{ height: 4, background: '#faf7f2', borderRadius: 99 }}>
                  <div style={{ height: 4, background: v.color, borderRadius: 99, width: `${p}%`, transition: 'width .4s' }} />
                </div>
              </div>
            )
          })}
        </div>

        {/* By member */}
        {members.length > 0 && (
          <>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#a8a29e', letterSpacing: 0.8, textTransform: 'uppercase', margin: '0 0 10px 2px' }}>By member</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {members.map(m => {
                const assigned = tasks.filter(t => t.assignee_id === m.id)
                const memberDone = assigned.filter(t => t.done).length
                const memberOpen = assigned.filter(t => !t.done).length
                const memberInProgress = assigned.filter(t => !t.done && t.status === 'in_progress').length
                const completePct = assigned.length ? Math.round((memberDone / assigned.length) * 100) : 0
                const hasNone = assigned.length === 0
                return (
                  <div key={m.id} style={{ background: 'white', borderRadius: 10, padding: '12px 16px', border: '1px solid #ede8e1' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: hasNone ? 0 : 10 }}>
                      <Avatar member={m} size={34} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#1c1917', margin: '0 0 2px' }}>{m.name}</p>
                        <p style={{ fontSize: 11, color: '#a8a29e', margin: 0 }}>
                          {hasNone ? 'No tasks assigned' : `${memberDone} done · ${memberOpen} open`}
                          {memberInProgress > 0 && ` · ${memberInProgress} in progress`}
                        </p>
                      </div>
                      {!hasNone && (
                        <span style={{ fontSize: 14, fontWeight: 700, color: completePct === 100 ? '#22c55e' : '#1c1917', flexShrink: 0 }}>{completePct}%</span>
                      )}
                    </div>
                    {!hasNone && (
                      <div style={{ height: 4, background: '#faf7f2', borderRadius: 99 }}>
                        <div style={{ height: 4, background: m.color, borderRadius: 99, width: `${completePct}%`, transition: 'width .4s' }} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DesktopTile({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div style={{ background: 'white', borderRadius: 10, padding: '10px 14px', border: '1px solid #ede8e1' }}>
      <p style={{ fontSize: 20, fontWeight: 700, color, margin: 0, lineHeight: 1 }}>{value}</p>
      <p style={{ fontSize: 10, color: '#a8a29e', margin: '4px 0 0', lineHeight: 1.3 }}>{label}</p>
    </div>
  )
}

function PriorityLegendD({ color, label, count, total }: { color: string; label: string; count: number; total: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 10, height: 10, borderRadius: 99, background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 12, color: '#78716c' }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#1c1917' }}>{count}</span>
      <span style={{ fontSize: 11, color: '#a8a29e' }}>({Math.round((count / total) * 100)}%)</span>
    </div>
  )
}
