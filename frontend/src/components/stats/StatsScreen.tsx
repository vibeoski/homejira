import { Avatar } from '../ui/Avatar'
import { CATEGORIES, type Task, type Member } from '../../types'

interface Props { tasks: Task[]; members: Member[] }

// ── Shared computation helpers ──────────────────────────────────────────────

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x }

function last7Days() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return startOfDay(d)
  })
}

function dayLabel(d: Date) {
  return d.toLocaleDateString('en-US', { weekday: 'short' })
}

function completionsOnDay(tasks: Task[], day: Date) {
  const next = new Date(day); next.setDate(next.getDate() + 1)
  return tasks.filter(t => {
    if (!t.done_at) return false
    const d = new Date(t.done_at)
    return d >= day && d < next
  }).length
}

// ── Component ────────────────────────────────────────────────────────────────

export function StatsScreen({ tasks, members }: Props) {
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

  const days = last7Days()
  const completionsByDay = days.map(d => completionsOnDay(tasks, d))
  const maxCompletions = Math.max(...completionsByDay, 1)

  const urgentOpen = open.filter(t => t.priority === 'urgent').length
  const highOpen = open.filter(t => t.priority === 'high').length
  const normalOpen = open.filter(t => t.priority === 'normal').length
  const priorityTotal = urgentOpen + highOpen + normalOpen || 1

  const r = 30, circ = 2 * Math.PI * r

  if (tasks.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 24px', textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#faf7f2', border: '2px dashed #d4d4d8', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#a8a29e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
          </svg>
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1c1917', margin: '0 0 8px' }}>Nothing to report yet</h2>
        <p style={{ fontSize: 13, color: '#a8a29e', lineHeight: 1.6, maxWidth: 240, margin: 0 }}>Add some tasks to your household and stats will appear here.</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '16px 12px 100px' }}>

      {/* ── Overall ring ─────────────────────────────────────── */}
      <div style={{ background: 'white', borderRadius: 12, padding: 20, border: '1px solid #ede8e1', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 16 }}>
        <svg width="68" height="68" style={{ flexShrink: 0 }}>
          <circle cx={34} cy={34} r={r} fill="none" stroke="#ede8e1" strokeWidth="5" />
          <circle cx={34} cy={34} r={r} fill="none" stroke="#22c55e" strokeWidth="5"
            strokeDasharray={`${circ}`} strokeDashoffset={`${circ * (1 - pct / 100)}`}
            strokeLinecap="round" transform="rotate(-90 34 34)" style={{ transition: 'stroke-dashoffset .5s' }} />
          <text x={34} y={39} textAnchor="middle" fontSize={13} fontWeight={700} fill="#1c1917">{pct}%</text>
        </svg>
        <div>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#1c1917', margin: 0 }}>{doneCount} of {total} done</p>
          <p style={{ fontSize: 12, color: '#78716c', marginTop: 3 }}>{total - doneCount} remaining</p>
        </div>
      </div>

      {/* ── Quick stats strip ────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
        <QuickTile value={completedThisWeek} label="Done this week" color="#22c55e" icon={
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20,6 9,17 4,12" /></svg>
        } />
        <QuickTile value={inProgress} label="In progress" color="#6366f1" icon={
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12,6 12,12 16,14" /></svg>
        } />
        <QuickTile value={dueSoon} label="Due in 3 days" color="#d97706" icon={
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
        } />
        <QuickTile value={unassigned} label="Unassigned" color="#a8a29e" icon={
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
        } />
      </div>

      {/* ── Urgency alerts ───────────────────────────────────── */}
      {(overdueCount > 0 || urgentCount > 0) && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          {overdueCount > 0 && (
            <div style={{ flex: 1, background: '#fef2f2', borderRadius: 10, padding: '10px 14px', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>⚠</span>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#dc2626', margin: 0 }}>{overdueCount} overdue</p>
                <p style={{ fontSize: 11, color: '#ef4444', margin: 0 }}>Past due date</p>
              </div>
            </div>
          )}
          {urgentCount > 0 && (
            <div style={{ flex: 1, background: '#fff7ed', borderRadius: 10, padding: '10px 14px', border: '1px solid #fed7aa', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>!</span>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#ea580c', margin: 0 }}>{urgentCount} urgent</p>
                <p style={{ fontSize: 11, color: '#f97316', margin: 0 }}>Needs attention</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 7-day completion chart ───────────────────────────── */}
      <div style={{ background: 'white', borderRadius: 12, padding: '16px 14px 12px', border: '1px solid #ede8e1', marginBottom: 10 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: '#a8a29e', letterSpacing: 0.8, textTransform: 'uppercase', margin: '0 0 14px' }}>Completions — last 7 days</p>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 52 }}>
          {completionsByDay.map((count, i) => {
            const isToday = i === 6
            const barH = Math.max(count ? Math.round((count / maxCompletions) * 44) : 3, count ? 6 : 3)
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                {count > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: isToday ? '#6366f1' : '#78716c' }}>{count}</span>
                )}
                <div style={{
                  width: '100%', height: barH, borderRadius: 4,
                  background: count === 0 ? '#f5f5f4' : isToday ? '#6366f1' : '#a5b4fc',
                  transition: 'height .4s',
                }} />
                <span style={{ fontSize: 9, color: isToday ? '#6366f1' : '#a8a29e', fontWeight: isToday ? 700 : 400 }}>
                  {dayLabel(days[i])}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Priority breakdown ───────────────────────────────── */}
      {open.length > 0 && (
        <div style={{ background: 'white', borderRadius: 12, padding: '14px', border: '1px solid #ede8e1', marginBottom: 10 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: '#a8a29e', letterSpacing: 0.8, textTransform: 'uppercase', margin: '0 0 10px' }}>Open tasks by priority</p>
          <div style={{ display: 'flex', height: 8, borderRadius: 99, overflow: 'hidden', marginBottom: 10 }}>
            {urgentOpen > 0 && <div style={{ flex: urgentOpen, background: '#ef4444', transition: 'flex .4s' }} />}
            {highOpen > 0 && <div style={{ flex: highOpen, background: '#f97316', transition: 'flex .4s' }} />}
            {normalOpen > 0 && <div style={{ flex: normalOpen, background: '#d4d4d8', transition: 'flex .4s' }} />}
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <PriorityLegend color="#ef4444" label="Urgent" count={urgentOpen} total={priorityTotal} />
            <PriorityLegend color="#f97316" label="High" count={highOpen} total={priorityTotal} />
            <PriorityLegend color="#d4d4d8" label="Normal" count={normalOpen} total={priorityTotal} />
          </div>
        </div>
      )}

      {/* ── By category ─────────────────────────────────────── */}
      <p style={{ fontSize: 10, fontWeight: 700, color: '#a8a29e', letterSpacing: 0.8, textTransform: 'uppercase', margin: '0 0 8px', paddingLeft: 2 }}>By category</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
        {(Object.entries(CATEGORIES) as [string, { label: string; color: string }][]).map(([k, v]) => {
          const catTasks = tasks.filter(x => x.category === k)
          const catDone = catTasks.filter(x => x.done).length
          const p = catTasks.length ? (catDone / catTasks.length) * 100 : 0
          return (
            <div key={k} style={{ background: 'white', borderRadius: 12, padding: 14, border: '1px solid #ede8e1' }}>
              <div style={{ height: 4, width: 24, borderRadius: 99, background: v.color, marginBottom: 8 }} />
              <p style={{ fontSize: 12, fontWeight: 600, color: '#1c1917', margin: 0 }}>{v.label}</p>
              <p style={{ fontSize: 11, color: '#a8a29e', margin: '2px 0 8px' }}>{catDone}/{catTasks.length} done</p>
              <div style={{ height: 3, background: '#faf7f2', borderRadius: 99 }}>
                <div style={{ height: 3, background: v.color, borderRadius: 99, width: `${p}%`, transition: 'width .4s' }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* ── By member ────────────────────────────────────────── */}
      {members.length > 0 && (
        <>
          <p style={{ fontSize: 10, fontWeight: 700, color: '#a8a29e', letterSpacing: 0.8, textTransform: 'uppercase', margin: '0 0 8px', paddingLeft: 2 }}>By member</p>
          {members.map(m => {
            const assigned = tasks.filter(t => t.assignee_id === m.id)
            const memberDone = assigned.filter(t => t.done).length
            const memberOpen = assigned.filter(t => !t.done).length
            const memberInProgress = assigned.filter(t => !t.done && t.status === 'in_progress').length
            const completePct = assigned.length ? Math.round((memberDone / assigned.length) * 100) : 0
            const hasNone = assigned.length === 0
            return (
              <div key={m.id} style={{ background: 'white', borderRadius: 10, padding: '12px 14px', border: '1px solid #ede8e1', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: hasNone ? 0 : 10 }}>
                  <Avatar member={m} size={32} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#1c1917', margin: 0 }}>{m.name}</p>
                    <p style={{ fontSize: 11, color: '#a8a29e', margin: '1px 0 0' }}>
                      {hasNone ? 'No tasks assigned' : `${memberDone} done · ${memberOpen} open`}
                    </p>
                  </div>
                  {!hasNone && (
                    <span style={{ fontSize: 13, fontWeight: 700, color: completePct === 100 ? '#22c55e' : '#1c1917' }}>{completePct}%</span>
                  )}
                </div>
                {!hasNone && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1, height: 4, background: '#faf7f2', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: 4, background: m.color, borderRadius: 99, width: `${completePct}%`, transition: 'width .4s' }} />
                    </div>
                    {memberInProgress > 0 && (
                      <span style={{ fontSize: 10, color: '#6366f1', fontWeight: 600, flexShrink: 0 }}>{memberInProgress} in progress</span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function QuickTile({ value, label, color, icon }: { value: number; label: string; color: string; icon: React.ReactNode }) {
  return (
    <div style={{ background: 'white', borderRadius: 12, padding: '12px 14px', border: '1px solid #ede8e1', display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 32, height: 32, borderRadius: 10, background: color + '15', color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <p style={{ fontSize: 18, fontWeight: 700, color: '#1c1917', margin: 0, lineHeight: 1 }}>{value}</p>
        <p style={{ fontSize: 10, color: '#a8a29e', margin: '3px 0 0', lineHeight: 1.2 }}>{label}</p>
      </div>
    </div>
  )
}

function PriorityLegend({ color, label, count, total }: { color: string; label: string; count: number; total: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 8, height: 8, borderRadius: 99, background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 11, color: '#78716c' }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#1c1917' }}>{count}</span>
      <span style={{ fontSize: 10, color: '#a8a29e' }}>({Math.round((count / total) * 100)}%)</span>
    </div>
  )
}
