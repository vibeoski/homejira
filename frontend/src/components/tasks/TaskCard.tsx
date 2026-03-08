import { useState } from 'react'
import { Avatar } from '../ui/Avatar'
import { CATEGORIES, PRIORITIES, type Task } from '../../types'
import { formatDate, isOverdue } from '../../utils'

interface Props {
  task: Task
  onToggle: (id: string, done: boolean) => void
  onOpen: (task: Task) => void
}

export function TaskCard({ task, onToggle, onOpen }: Props) {
  const [popping, setPopping] = useState(false)
  const cat = CATEGORIES[task.category]
  const overdue = isOverdue(task.due_at, task.done)

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    setPopping(true)
    onToggle(task.id, !task.done)
    setTimeout(() => setPopping(false), 400)
  }

  return (
    <div
      onClick={() => onOpen(task)}
      style={{
        background: 'white',
        borderRadius: 12,
        padding: '13px 14px 12px',
        marginBottom: 6,
        border: `1px solid ${overdue && !task.done ? '#fecaca' : '#e4e4e7'}`,
        display: 'flex',
        gap: 11,
        alignItems: 'flex-start',
        opacity: task.done ? 0.5 : 1,
        cursor: 'pointer',
        transition: 'opacity .15s',
      }}
    >
      {/* Checkbox */}
      <button
        onClick={handleToggle}
        className={popping ? 'check-pop' : undefined}
        style={{
          width: 20, height: 20, borderRadius: 6, marginTop: 2, flexShrink: 0,
          border: task.done ? 'none' : '1.5px solid #d4d4d8',
          background: task.done ? '#22c55e' : 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', padding: 0, transition: 'background .15s',
        }}
      >
        {task.done && (
          <svg width="11" height="8" viewBox="0 0 11 8" fill="none">
            <path d="M1 4l3 3 6-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: 14, fontWeight: 500, lineHeight: 1.4,
          textDecoration: task.done ? 'line-through' : 'none',
          color: task.done ? '#a1a1aa' : '#18181b',
          margin: '0 0 5px',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>{task.title}</p>

        {/* Category + notes */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: (task.due_at && !task.done) || (task.comments?.length ?? 0) > 0 ? 4 : 0 }}>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 5,
            background: cat.color + '12', color: cat.color,
          }}>{cat.icon} {cat.label}</span>
          {task.notes && (
            <span style={{
              fontSize: 12, color: '#a1a1aa',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110,
            }}>{task.notes}</span>
          )}
        </div>

        {/* Due + comments */}
        {((task.due_at && !task.done) || (task.comments?.length ?? 0) > 0) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {task.due_at && !task.done && (
              <span style={{ fontSize: 11, fontWeight: 500, color: overdue ? '#ef4444' : '#71717a' }}>
                {overdue ? '⚠ ' : ''}{formatDate(task.due_at)}
              </span>
            )}
            {(task.comments?.length ?? 0) > 0 && (
              <span style={{ fontSize: 11, color: '#a1a1aa' }}>
                {task.comments!.length} comment{task.comments!.length !== 1 ? 's' : ''}
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
