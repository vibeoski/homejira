import { Avatar } from '../ui/Avatar'
import { CATEGORIES, type Task, type Member } from '../../types'

interface Props { tasks: Task[]; members: Member[] }

export function StatsScreen({ tasks, members }: Props) {
  const householdTasks = tasks.filter((x) => x.category !== 'grocery')
  const done = householdTasks.filter((x) => x.done).length
  const total = householdTasks.length
  const pct = total ? Math.round((done / total) * 100) : 0
  const overdueCount = householdTasks.filter((x) => !x.done && x.due_at && new Date(x.due_at) < new Date()).length
  const urgentCount = householdTasks.filter((x) => !x.done && x.priority === 'urgent').length
  const r = 30, circ = 2 * Math.PI * r

  return (
    <div style={{ padding: '16px 12px 100px' }}>
      {/* Overall ring */}
      <div style={{ background: 'white', borderRadius: 12, padding: 20, border: '1px solid #e4e4e7', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 16 }}>
        {total === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%', background: '#f4f4f5',
              border: '1.5px dashed #d4d4d8', display: 'flex', alignItems: 'center',
              justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
              </svg>
            </div>
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#18181b' }}>No tasks yet</p>
              <p style={{ fontSize: 12, color: '#a1a1aa', marginTop: 3 }}>Add tasks to see progress here.</p>
            </div>
          </div>
        ) : (
          <>
            <svg width="68" height="68" style={{ flexShrink: 0 }}>
              <circle cx={34} cy={34} r={r} fill="none" stroke="#e4e4e7" strokeWidth="5" />
              <circle cx={34} cy={34} r={r} fill="none" stroke="#22c55e" strokeWidth="5"
                strokeDasharray={`${circ}`} strokeDashoffset={`${circ * (1 - pct / 100)}`}
                strokeLinecap="round" transform="rotate(-90 34 34)" style={{ transition: 'stroke-dashoffset .5s' }} />
              <text x={34} y={39} textAnchor="middle" fontSize={13} fontWeight={700} fill="#18181b">{pct}%</text>
            </svg>
            <div>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#18181b' }}>{done} of {total} done</p>
              <p style={{ fontSize: 12, color: '#71717a', marginTop: 3 }}>{total - done} remaining</p>
            </div>
          </>
        )}
      </div>

      {/* Urgency summary */}
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

      {/* By category */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
        {(Object.entries(CATEGORIES) as [string, { label: string; icon: string; color: string }][]).map(([k, v]) => {
          const catTasks = tasks.filter((x) => x.category === k)
          const catDone = catTasks.filter((x) => x.done).length
          const p = catTasks.length ? (catDone / catTasks.length) * 100 : 0
          return (
            <div key={k} style={{ background: 'white', borderRadius: 12, padding: 14, border: '1px solid #e4e4e7' }}>
              <div style={{ fontSize: 20, marginBottom: 5 }}>{v.icon}</div>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#18181b' }}>{v.label}</p>
              <p style={{ fontSize: 11, color: '#a1a1aa', margin: '2px 0 8px' }}>{catDone}/{catTasks.length} done</p>
              <div style={{ height: 3, background: '#f4f4f5', borderRadius: 99 }}>
                <div style={{ height: 3, background: v.color, borderRadius: 99, width: `${p}%`, transition: 'width .4s' }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* By member */}
      {members.length > 0 && (<>
      <p style={{ fontSize: 10, fontWeight: 700, color: '#a1a1aa', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, paddingLeft: 4 }}>By member</p>
      {members.map((m) => {
        const mine = tasks.filter((x) => x.assignee_id === m.id)
        const myDone = mine.filter((x) => x.done).length
        const hasNone = mine.length === 0
        return (
          <div key={m.id} style={{ background: 'white', borderRadius: 10, padding: '12px 14px', border: '1px solid #e4e4e7', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar member={m} size={32} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#18181b' }}>{m.name}</p>
              {hasNone ? (
                <p style={{ fontSize: 11, color: '#a1a1aa', marginTop: 2 }}>No tasks assigned</p>
              ) : (
                <div style={{ height: 3, background: '#f4f4f5', borderRadius: 99, marginTop: 5 }}>
                  <div style={{ height: 3, background: m.color, borderRadius: 99, width: `${(myDone / mine.length) * 100}%`, transition: 'width .4s' }} />
                </div>
              )}
            </div>
            {!hasNone && (
              <span style={{ fontSize: 12, color: '#71717a', fontWeight: 600 }}>{myDone}/{mine.length}</span>
            )}
          </div>
        )
      })}
      </>)}
    </div>
  )
}
