import { CATEGORIES, PRIORITIES, STATUSES, type Member, type Category } from '../../types'
import type { TaskFilters } from '../../pages/TasksPage'

interface Props {
  filters: TaskFilters
  members: Member[]
  onUpdate: (patch: Partial<TaskFilters>) => void
  onReset: () => void
  onClose: () => void
}

const STATUS_OPTIONS: { value: TaskFilters['status']; label: string; color: string }[] = [
  { value: 'active',      label: 'Active',       color: '#6366f1' },
  { value: 'open',        label: 'Open',         color: STATUSES.open.color },
  { value: 'in_progress', label: 'In Progress',  color: STATUSES.in_progress.color },
  { value: 'on_hold',     label: 'On Hold',      color: STATUSES.on_hold.color },
  { value: 'done',        label: 'Done',         color: STATUSES.done.color },
  { value: 'all',         label: 'All',          color: '#78716c' },
]

const DUE_OPTIONS: { value: TaskFilters['due']; label: string }[] = [
  { value: 'all',      label: 'Any date' },
  { value: 'overdue',  label: 'Overdue' },
  { value: 'due_soon', label: 'Due soon' },
  { value: 'no_due',   label: 'No due date' },
]

const SORT_OPTIONS: { value: TaskFilters['sort']; label: string }[] = [
  { value: 'priority', label: 'Priority' },
  { value: 'recent',   label: 'Most recent' },
  { value: 'due',      label: 'Due date' },
]

export function FilterSheet({ filters, members, onUpdate, onReset, onClose }: Props) {
  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: '#00000040', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
    >
      <div
        className="slide-up"
        style={{
          background: '#faf7f2', width: '100%', maxWidth: 520,
          borderRadius: '18px 18px 0 0', maxHeight: '86vh', overflowY: 'auto',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.10)',
        }}
      >
        {/* Header */}
        <div style={{
          position: 'sticky', top: 0, background: '#faf7f2',
          padding: '14px 16px 12px', borderBottom: '1px solid #ede8e1', zIndex: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ width: 40, height: 4, background: '#d4cfc8', borderRadius: 99, position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)' }} />
          <span style={{ fontSize: 15, fontWeight: 700, color: '#1c1917', marginTop: 8 }}>Filter & Sort</span>
          <button
            onClick={onClose}
            style={{ background: '#ede8e1', border: 'none', borderRadius: 7, padding: '5px 12px', fontSize: 13, color: '#78716c', cursor: 'pointer', marginTop: 8 }}
          >Done</button>
        </div>

        <div style={{ padding: '16px 14px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Status */}
          <Section label="Status">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {STATUS_OPTIONS.map(({ value, label, color }) => (
                <Pill
                  key={value}
                  active={filters.status === value}
                  color={color}
                  onClick={() => onUpdate({ status: value })}
                >{label}</Pill>
              ))}
            </div>
          </Section>

          <Divider />

          {/* Priority */}
          <Section label="Priority">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Pill active={filters.priority === 'all'} color="#78716c" onClick={() => onUpdate({ priority: 'all' })}>All</Pill>
              {(Object.entries(PRIORITIES) as ['urgent' | 'high' | 'normal', { label: string; color: string }][]).map(([k, v]) => (
                  <Pill key={k} active={filters.priority === k} color={v.color} onClick={() => onUpdate({ priority: k })}>
                    {v.label}
                  </Pill>
                ))}
            </div>
          </Section>

          <Divider />

          {/* Category */}
          <Section label="Category">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Pill active={filters.category === 'all'} color="#78716c" onClick={() => onUpdate({ category: 'all' })}>All</Pill>
              {(Object.entries(CATEGORIES) as [Category, { label: string; color: string }][]).map(([k, v]) => (
                <Pill key={k} active={filters.category === k} color={v.color} onClick={() => onUpdate({ category: k })}>
                  {v.label}
                </Pill>
              ))}
            </div>
          </Section>

          <Divider />

          {/* Assignee */}
          {members.length > 0 && (
            <>
              <Section label="Assigned to">
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <button
                    onClick={() => onUpdate({ assigneeId: null })}
                    style={{
                      padding: '6px 12px', borderRadius: 99, border: '1px solid',
                      borderColor: filters.assigneeId === null ? '#6366f1' : '#ede8e1',
                      background: filters.assigneeId === null ? '#eef2ff' : 'white',
                      color: filters.assigneeId === null ? '#6366f1' : '#78716c',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}
                  >Anyone</button>
                  <button
                    onClick={() => onUpdate({ assigneeId: 'unassigned' })}
                    style={{
                      padding: '6px 12px', borderRadius: 99, border: '1px solid',
                      borderColor: filters.assigneeId === 'unassigned' ? '#6366f1' : '#ede8e1',
                      background: filters.assigneeId === 'unassigned' ? '#eef2ff' : 'white',
                      color: filters.assigneeId === 'unassigned' ? '#6366f1' : '#78716c',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}
                  >Unassigned</button>
                  {members.map((m) => {
                    const active = filters.assigneeId === m.id
                    return (
                      <button
                        key={m.id}
                        onClick={() => onUpdate({ assigneeId: active ? null : m.id })}
                        title={m.name}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '5px 10px 5px 5px', borderRadius: 99, border: '2px solid',
                          borderColor: active ? m.color : '#ede8e1',
                          background: active ? m.color + '14' : 'white',
                          cursor: 'pointer',
                        }}
                      >
                        <span style={{
                          width: 22, height: 22, borderRadius: '50%', background: m.color,
                          color: 'white', fontSize: 10, fontWeight: 700,
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}>{m.name.charAt(0).toUpperCase()}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: active ? m.color : '#78716c' }}>{m.name}</span>
                      </button>
                    )
                  })}
                </div>
              </Section>
              <Divider />
            </>
          )}

          {/* Due date */}
          <Section label="Due date">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {DUE_OPTIONS.map(({ value, label }) => (
                <Pill
                  key={value}
                  active={filters.due === value}
                  color={value === 'overdue' ? '#ef4444' : value === 'due_soon' ? '#d97706' : '#6366f1'}
                  onClick={() => onUpdate({ due: value })}
                >{label}</Pill>
              ))}
            </div>
          </Section>

          <Divider />

          {/* Sort */}
          <Section label="Sort by">
            <div style={{ display: 'flex', gap: 6 }}>
              {SORT_OPTIONS.map(({ value, label }) => (
                <Pill key={value} active={filters.sort === value} color="#6366f1" onClick={() => onUpdate({ sort: value })}>
                  {label}
                </Pill>
              ))}
            </div>
          </Section>

          {/* Reset */}
          <button
            onClick={onReset}
            style={{
              marginTop: 4, background: 'transparent', border: 'none',
              color: '#a8a29e', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '8px 0',
            }}
          >Reset all filters</button>
        </div>
      </div>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ fontSize: 10, fontWeight: 700, color: '#a8a29e', letterSpacing: 0.8, textTransform: 'uppercase', margin: '0 0 10px' }}>{label}</p>
      {children}
    </div>
  )
}

function Divider() {
  return <div style={{ height: 1, background: '#ede8e1' }} />
}

function Pill({ children, active, color, onClick }: { children: React.ReactNode; active: boolean; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 13px', borderRadius: 99, border: '1px solid', fontSize: 12, fontWeight: 600, cursor: 'pointer',
        borderColor: active ? color : '#ede8e1',
        background: active ? color + '14' : 'white',
        color: active ? color : '#78716c',
        transition: 'all 0.12s',
      }}
    >{children}</button>
  )
}
