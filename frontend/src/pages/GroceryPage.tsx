import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { useStore } from '../store'
import { Spinner } from '../components/ui/Spinner'
import { AddGrocerySheet } from '../components/tasks/AddGrocerySheet'
import type { Grocery } from '../types'

const ACCENT = '#6366f1'

export function GroceryPage() {
  const { member } = useAuthStore()
  const { groceries, fetchGroceries, toggleGrocery, deleteGrocery, updateGrocery, sseVersion, members } = useStore()

  const [loading, setLoading] = useState(groceries.length === 0)
  const [showDone, setShowDone] = useState(true)
  const [historyMode, setHistoryMode] = useState(false)
  const todayKey = (() => { const d = new Date(); d.setHours(0,0,0,0); return d.toISOString() })()
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set([todayKey]))
  const [showAdd, setShowAdd] = useState(false)

  const load = async () => {
    try {
      await fetchGroceries()
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])
  useEffect(() => { if (sseVersion > 0) load() }, [sseVersion])

  const active = groceries.filter(g => !g.done)
  const done = groceries.filter(g => g.done).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())

  const handleCheckAll = async () => {
    const toCheck = [...active]
    await Promise.allSettled(toCheck.map((g) => toggleGrocery(g.id, true)))
    setShowDone(true)
  }

  const handleClearDone = () => setShowDone(false)

  if (loading) return <Spinner />

  if (historyMode) {
    return (
      <div style={{ paddingBottom: 80 }}>
        <div style={{
          background: 'white', padding: '16px 16px 14px',
          borderBottom: '1px solid #ede8e1',
          position: 'sticky', top: 0, zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <button
            onClick={() => setHistoryMode(false)}
            style={{ background: 'none', border: 'none', color: ACCENT, fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15,18 9,12 15,6" />
            </svg>
            Back
          </button>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#1c1917' }}>History</span>
          <span style={{ width: 48 }} />
        </div>

        {done.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center' }}>
            <p style={{ color: '#a8a29e', fontSize: 14 }}>No completed items yet.</p>
          </div>
        ) : (
          <div style={{ padding: '0 12px' }}>
            {groupByDay(done).map(({ key, label, items }) => {
              const open = expandedDays.has(key)
              const toggle = () => setExpandedDays((prev) => {
                const next = new Set(prev)
                if (open) next.delete(key); else next.add(key)
                return next
              })
              return (
                <div key={key} style={{ marginBottom: 8 }}>
                  <button
                    onClick={toggle}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: '8px 4px', marginBottom: open ? 4 : 0,
                    }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#a8a29e', letterSpacing: 0.6, textTransform: 'uppercase' }}>
                      {label}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {!open && (
                        <span style={{ fontSize: 11, color: '#a8a29e', fontWeight: 600 }}>{items.length} item{items.length !== 1 ? 's' : ''}</span>
                      )}
                      <svg
                        width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a8a29e"
                        strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                        style={{ transform: open ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.15s' }}
                      >
                        <polyline points="9,18 15,12 9,6" />
                      </svg>
                    </div>
                  </button>
                  {open && items.map((item) => (
                    <HistoryRow key={item.id} item={item} onDelete={deleteGrocery} />
                  ))}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ paddingBottom: 80 }}>
      <div style={{
        background: 'white', padding: '10px 16px',
        borderBottom: '1px solid #ede8e1',
        position: 'sticky', top: 57, zIndex: 49,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, color: '#78716c', margin: 0, letterSpacing: 0.2 }}>Grocery</h2>
        <button
          onClick={() => setHistoryMode(true)}
          style={{ background: 'none', border: 'none', color: '#78716c', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '4px 8px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12,6 12,12 16,14" />
          </svg>
          History {done.length > 0 && `(${done.length})`}
        </button>
      </div>

      <div style={{ padding: '0 12px 0' }}>
        {active.length > 1 && (
          <div style={{ padding: '8px 0', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={handleCheckAll}
              style={{
                background: 'none', border: 'none', color: '#78716c', fontSize: 11,
                fontWeight: 600, cursor: 'pointer', padding: '4px 8px', borderRadius: 6,
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20,6 9,17 4,12" />
              </svg>
              Check all
            </button>
          </div>
        )}

        {active.length === 0 && done.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '64px 24px', textAlign: 'center' }}>
            <div style={{
              width: 60, height: 60, borderRadius: 18, background: '#eef2ff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
            }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 01-8 0" />
              </svg>
            </div>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#1c1917', margin: '0 0 6px' }}>List is empty</p>
            <p style={{ fontSize: 13, color: '#a8a29e', margin: 0, lineHeight: 1.6 }}>Tap the + button to add items to your list.</p>
          </div>
        )}

        {active.length > 0 && (
          <div style={{ padding: '12px 0' }}>
            {active.map((item) => (
              <GroceryRow 
                key={item.id} 
                item={item} 
                onToggle={(checked) => toggleGrocery(item.id, checked)} 
                onEdit={(updates) => updateGrocery(item.id, updates)} 
                onDelete={() => deleteGrocery(item.id)} 
              />
            ))}
          </div>
        )}

        {done.length > 0 && (
          <div style={{ padding: '8px 0 0' }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '6px 4px',
            }}>
              <button
                onClick={() => setShowDone((v) => !v)}
                style={{ background: 'none', border: 'none', color: '#78716c', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 5 }}
              >
                <svg
                  width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  style={{ transform: showDone ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.15s' }}
                >
                  <polyline points="9,18 15,12 9,6" />
                </svg>
                Done ({done.length})
              </button>
              {showDone && (
                <button
                  onClick={handleClearDone}
                  style={{ background: 'none', border: 'none', color: '#a8a29e', fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: 0 }}
                >
                  Hide
                </button>
              )}
            </div>

            {showDone && (
              <div style={{ padding: '8px 0' }}>
                {done.map((item) => (
                  <GroceryRow 
                    key={item.id} 
                    item={item} 
                    done 
                    onToggle={(checked) => toggleGrocery(item.id, checked)} 
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <button
        onClick={() => setShowAdd(true)}
        style={{
          position: 'fixed', bottom: 72, right: 20, width: 56, height: 56,
          borderRadius: 16, background: ACCENT, color: 'white', border: 'none',
          fontSize: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 8px 24px ${ACCENT}40`, zIndex: 40, cursor: 'pointer',
          transition: 'transform .1s',
        }}
        onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(.94)')}
        onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      >+</button>

      {showAdd && (
        <AddGrocerySheet 
          members={members} 
          onClose={() => setShowAdd(false)} 
          onAdded={() => { setShowAdd(false); }} 
        />
      )}
    </div>
  )
}

function groupByDay(items: Grocery[]): { key: string; label: string; items: Grocery[] }[] {
  const now = new Date()
  const today = new Date(now); today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)

  const map = new Map<string, Grocery[]>()
  for (const item of items) {
    const d = new Date(item.updated_at); d.setHours(0, 0, 0, 0)
    const key = d.toISOString()
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(item)
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, items]) => {
      const d = new Date(key)
      let label: string
      if (d.getTime() === today.getTime()) label = 'Today'
      else if (d.getTime() === yesterday.getTime()) label = 'Yesterday'
      else label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) })
      return { key, label, items }
    })
}

interface RowProps {
  item: Grocery
  done?: boolean
  onToggle: (checked: boolean) => void
  onEdit?: (updates: { title?: string; quantity?: string; notes?: string }) => void
  onDelete?: () => void
}

function GroceryRow({ item, done = false, onToggle, onEdit, onDelete }: RowProps) {
  const [editing, setEditing] = useState(false)
  const [editVal, setEditVal] = useState(item.title)
  const [editQty, setEditQty] = useState(item.quantity ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showNotes, setShowNotes] = useState(false)

  const startEdit = () => {
    if (done) return
    setEditVal(item.title)
    setEditQty(item.quantity ?? '')
    setEditing(true)
  }

  const commitEdit = () => {
    setEditing(false)
    if (editVal.trim() === item.title && editQty.trim() === (item.quantity ?? '')) return
    onEdit?.({ title: editVal.trim(), quantity: editQty.trim() || undefined })
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: '12px 14px', marginBottom: 6,
      background: 'white', borderRadius: 12, border: '1px solid #ede8e1',
      opacity: done ? 0.6 : 1, transition: 'opacity 0.15s',
    }}>
      <button
        onClick={() => onToggle(!done)}
        style={{
          width: 22, height: 22, borderRadius: 7, border: `2px solid ${done ? ACCENT : '#d4d4d8'}`,
          background: done ? ACCENT : 'white', flexShrink: 0, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.15s', marginTop: 1,
        }}
      >
        {done && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20,6 9,17 4,12" />
          </svg>
        )}
      </button>

      {editing ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input
            autoFocus
            value={editVal}
            onChange={(e) => setEditVal(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(false) }}
            style={{ fontSize: 14, border: 'none', outline: 'none', borderBottom: `2px solid ${ACCENT}`, color: '#1c1917', background: 'transparent' }}
          />
          <input
            value={editQty}
            onChange={(e) => setEditQty(e.target.value)}
            onBlur={commitEdit}
            placeholder="Quantity…"
            style={{ fontSize: 12, border: 'none', outline: 'none', borderBottom: `1px solid #d4d4d8`, color: '#78716c', background: 'transparent' }}
          />
        </div>
      ) : (
        <div style={{ flex: 1 }} onClick={startEdit}>
          <div style={{ fontSize: 14, textDecoration: done ? 'line-through' : 'none', color: done ? '#a8a29e' : '#1c1917', fontWeight: 500 }}>
            {item.title}
          </div>
          {(item.quantity || item.notes) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              {item.quantity && <span style={{ fontSize: 12, color: '#78716c' }}>{item.quantity}</span>}
              {item.notes && !done && (
                <button 
                  onClick={(e) => { e.stopPropagation(); setShowNotes(!showNotes) }}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: ACCENT, fontSize: 11, fontWeight: 600 }}
                >
                  {showNotes ? 'Hide notes' : 'View notes'}
                </button>
              )}
            </div>
          )}
          {showNotes && item.notes && !done && (
            <div style={{ fontSize: 12, color: '#78716c', marginTop: 6, background: '#faf7f2', padding: '6px 10px', borderRadius: 8 }}>
              {item.notes}
            </div>
          )}
        </div>
      )}

      {item.assignee && !confirmDelete && (
        <span style={{
          width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
          background: item.assignee.color ?? ACCENT,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, color: 'white',
        }}>
          {item.assignee.name?.charAt(0).toUpperCase()}
        </span>
      )}

      {onDelete && !editing && (
        confirmDelete ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => onDelete()} style={{ border: 'none', background: '#fee2e2', color: '#b91c1c', borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Delete</button>
            <button onClick={() => setConfirmDelete(false)} style={{ border: 'none', background: '#fafafa', color: '#78716c', borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          </div>
        ) : (
          <button onClick={() => setConfirmDelete(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#d4d4d8' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3,6 5,6 21,6" /><path d="M19,6l-1,14a2 2 0 01-2 2H8a2 2 0 01-2-2L5,6" /><path d="M10,11v6" /><path d="M14,11v6" /><path d="M9,6V4h6v2" />
            </svg>
          </button>
        )
      )}
    </div>
  )
}

function HistoryRow({ item, onDelete }: { item: Grocery; onDelete: (id: string) => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: '12px 14px', marginBottom: 6,
      background: 'white', borderRadius: 12, border: '1px solid #ede8e1',
    }}>
      <span style={{
        width: 22, height: 22, borderRadius: 7, background: ACCENT,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
      }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20,6 9,17 4,12" />
        </svg>
      </span>

      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, color: '#a8a29e', textDecoration: 'line-through' }}>
          {item.title}
        </div>
        {item.quantity && <div style={{ fontSize: 12, color: '#a8a29e', marginTop: 2 }}>{item.quantity}</div>}
      </div>

      {!confirmDelete ? (
        <button onClick={() => setConfirmDelete(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#d4d4d8' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3,6 5,6 21,6" /><path d="M19,6l-1,14a2 2 0 01-2 2H8a2 2 0 01-2-2L5,6" /><path d="M10,11v6" /><path d="M14,11v6" /><path d="M9,6V4h6v2" />
          </svg>
        </button>
      ) : (
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => onDelete(item.id)} style={{ border: 'none', background: '#fee2e2', color: '#b91c1c', borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Delete</button>
          <button onClick={() => setConfirmDelete(false)} style={{ border: 'none', background: '#fafafa', color: '#78716c', borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
        </div>
      )}
    </div>
  )
}
