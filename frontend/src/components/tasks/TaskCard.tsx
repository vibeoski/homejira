import { useState } from 'react'
import { Avatar } from '../ui/Avatar'
import { CATEGORIES, PRIORITIES, STATUSES, type Task, type TaskStatus } from '../../types'
import { formatDate, isOverdue, isDueSoon } from '../../utils'

interface Props {
  task: Task
  onStatusChange: (id: string, status: TaskStatus) => void
  onOpen: (task: Task) => void
}

function StatusIcon({ status }: { status: TaskStatus }) {
  const s = STATUSES[status]
  if (status === 'done') {
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="10" fill="#22c55e" />
        <path d="M5.5 10l3 3 6-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (status === 'in_progress') {
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="9" stroke="#6366f1" strokeWidth="1.5" />
        <circle cx="10" cy="10" r="9" stroke="#6366f1" strokeWidth="1.5"
          strokeDasharray="56.5" strokeDashoffset="28" strokeLinecap="round"
          transform="rotate(-90 10 10)" fill="#6366f115" />
        <circle cx="10" cy="10" r="3.5" fill="#6366f1" />
      </svg>
    )
  }
  if (status === 'on_hold') {
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="9" stroke="#d97706" strokeWidth="1.5" />
        <rect x="7" y="6.5" width="2" height="7" rx="1" fill="#d97706" />
        <rect x="11" y="6.5" width="2" height="7" rx="1" fill="#d97706" />
      </svg>
    )
  }
  // open — empty ring
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="9" stroke={s.color} strokeWidth="1.5" strokeDasharray="3 2" />
    </svg>
  )
}

export function TaskCard({ task, onStatusChange, onOpen }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const cat = CATEGORIES[task.category]
  const overdue = isOverdue(task.due_at, task.done)
  const dueSoon = isDueSoon(task.due_at, task.done)

  const handleStatusClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setMenuOpen((v) => !v)
  }

  const handleSelect = (e: React.MouseEvent, status: TaskStatus) => {
    e.stopPropagation()
    setMenuOpen(false)
    onStatusChange(task.id, status)
  }

  return (
    <div
      onClick={() => onOpen(task)}
      style={{
        background: 'white',
        borderRadius: 12,
        padding: '13px 14px 12px',
        marginBottom: 6,
        border: `1px solid ${overdue && !task.done ? '#fecaca' : dueSoon && !task.done ? '#fde68a' : '#ede8e1'}`,
        display: 'flex',
        gap: 11,
        alignItems: 'flex-start',
        opacity: task.done ? 0.5 : 1,
        cursor: 'pointer',
        transition: 'opacity .15s',
        position: 'relative',
      }}
    >
      {/* Status icon — tap to open status menu */}
      <button
        onClick={handleStatusClick}
        title="Change status"
        style={{
          flexShrink: 0, marginTop: 1, padding: 0, border: 'none', background: 'none',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: '50%',
        }}
      >
        <StatusIcon status={task.status ?? 'open'} />
      </button>

      {/* Status popover */}
      {menuOpen && (
        <>
          {/* Invisible backdrop to close on outside tap */}
          <div
            onClick={(e) => { e.stopPropagation(); setMenuOpen(false) }}
            style={{ position: 'fixed', inset: 0, zIndex: 19 }}
          />
          <div style={{
            position: 'absolute',
            top: 32, left: 4,
            background: 'white',
            borderRadius: 12,
            border: '1px solid #ede8e1',
            boxShadow: '0 8px 28px rgba(0,0,0,0.13)',
            zIndex: 20,
            padding: '4px',
            minWidth: 148,
          }}>
            {(Object.entries(STATUSES) as [TaskStatus, { label: string; color: string }][]).map(([k, v]) => {
              const active = (task.status ?? 'open') === k
              return (
                <button
                  key={k}
                  onClick={(e) => handleSelect(e, k)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 9,
                    width: '100%', padding: '8px 10px', borderRadius: 8,
                    border: 'none',
                    background: active ? v.color + '12' : 'transparent',
                    cursor: 'pointer', fontSize: 13,
                    fontWeight: active ? 700 : 500,
                    color: active ? v.color : '#1c1917',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: v.color, flexShrink: 0 }} />
                  {v.label}
                  {active && (
                    <svg style={{ marginLeft: 'auto' }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={v.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  )}
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: 14, fontWeight: 500, lineHeight: 1.4,
          textDecoration: task.done ? 'line-through' : 'none',
          color: task.done ? '#a8a29e' : '#1c1917',
          margin: '0 0 5px',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>{task.title}</p>

        {/* Category + status chip + notes */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: (task.due_at && !task.done) || (task.comments?.length ?? 0) > 0 ? 4 : 0 }}>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 5,
            background: cat.color + '12', color: cat.color,
          }}>{cat.label}</span>
          {!task.done && task.status !== 'open' && (
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 5,
              background: STATUSES[task.status].color + '15',
              color: STATUSES[task.status].color,
            }}>{STATUSES[task.status].label}</span>
          )}
          {task.notes && (
            <span style={{
              fontSize: 12, color: '#a8a29e',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 100,
            }}>{task.notes}</span>
          )}
        </div>

        {/* Due + comments */}
        {((task.due_at && !task.done) || (task.comments?.length ?? 0) > 0) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {task.due_at && !task.done && (
              <span style={{
                fontSize: 11, fontWeight: 500,
                color: overdue ? '#ef4444' : dueSoon ? '#d97706' : '#78716c',
                background: dueSoon && !overdue ? '#fffbeb' : 'transparent',
                borderRadius: dueSoon && !overdue ? 4 : 0,
                padding: dueSoon && !overdue ? '1px 5px' : '0',
              }}>
                {formatDate(task.due_at)}
              </span>
            )}
            {task.comments && task.comments.length > 0 && (
              <span style={{ fontSize: 11, color: '#a8a29e' }}>
                {task.comments.length} comment{task.comments.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Right: Avatar + priority dot */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
        {task.assignee ? (
          <Avatar member={task.assignee} size={26} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <div style={{ width: 26, height: 26, borderRadius: '50%', backgroundColor: '#d4cfc8', flexShrink: 0 }} />
            <span style={{ color: '#a8a29e', fontSize: 11, whiteSpace: 'nowrap' }}>Unassigned</span>
          </div>
        )}
        <span style={{
          width: 7, height: 7, borderRadius: '50%', display: 'block',
          background: PRIORITIES[task.priority].color,
          opacity: task.done ? 0.25 : 0.75,
        }} />
      </div>
    </div>
  )
}
