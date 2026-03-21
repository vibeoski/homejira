import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useStore } from '../store'
import { useAuthStore } from '../store/authStore'
import { Spinner } from '../components/ui/Spinner'
import { AddGrocerySheet } from '../components/tasks/AddGrocerySheet'
import { useBreakpoint } from '../hooks/useBreakpoint'
import type { Grocery, Member, UpdateGroceryPayload } from '../types'

const ACCENT = '#6366f1'

export function GroceryPage() {
  const { groceries, fetchGroceries, toggleGrocery, deleteGrocery, updateGrocery, sseVersion, members } = useStore()
  const { member } = useAuthStore()
  const isDesktop = useBreakpoint()

  const [loading, setLoading] = useState(groceries.length === 0)
  const [showDone, setShowDone] = useState(true)
  const [historyMode, setHistoryMode] = useState(false)
  const todayKey = (() => { const d = new Date(); d.setHours(0,0,0,0); return d.toISOString() })()
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set([todayKey]))
  const [showAdd, setShowAdd] = useState(false)
  const [selectedItem, setSelectedItem] = useState<Grocery | null>(null)

  // Initial load — shows spinner while data is absent
  const load = useCallback(async () => {
    try { await fetchGroceries() } finally { setLoading(false) }
  }, [fetchGroceries])

  // Silent background refresh for SSE updates — never resets loading state
  const refresh = useCallback(async () => {
    try { await fetchGroceries() } catch { /* ignore */ }
  }, [fetchGroceries])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (sseVersion > 0) refresh() }, [refresh, sseVersion])

  // Keep selectedItem in sync with store (SSE updates)
  useEffect(() => {
    if (!selectedItem) return
    const updated = groceries.find(g => g.id === selectedItem.id)
    if (!updated) setSelectedItem(null) // deleted elsewhere
  }, [groceries, selectedItem])

  const active = groceries.filter(g => !g.done)
  const done = groceries.filter(g => g.done).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())

  const handleCheckAll = async () => {
    await Promise.allSettled(active.map(g => toggleGrocery(g.id, true)))
    setShowDone(true)
  }

  if (!member?.household_id) return <Navigate to="/household" replace />

  if (loading) return <Spinner />

  if (historyMode) {
    return (
      <div style={{ paddingBottom: 80 }}>
        <div style={{ background: 'white', padding: '12px 16px', borderBottom: '1px solid #ede8e1', position: 'sticky', top: 57, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
              const toggle = () => setExpandedDays(prev => {
                const next = new Set(prev)
                if (open) next.delete(key); else next.add(key)
                return next
              })
              return (
                <div key={key} style={{ marginBottom: 8 }}>
                  <button
                    onClick={toggle}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 4px', marginBottom: open ? 4 : 0 }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#a8a29e', letterSpacing: 0.6, textTransform: 'uppercase' }}>{label}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {!open && <span style={{ fontSize: 11, color: '#a8a29e', fontWeight: 600 }}>{items.length} item{items.length !== 1 ? 's' : ''}</span>}
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a8a29e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.15s' }}>
                        <polyline points="9,18 15,12 9,6" />
                      </svg>
                    </div>
                  </button>
                  {open && items.map(item => (
                    <HistoryRow key={item.id} item={item} onDelete={deleteGrocery} onSelect={setSelectedItem} />
                  ))}
                </div>
              )
            })}
          </div>
        )}

        {selectedItem && (
          <GroceryDetailSheet
            item={selectedItem} members={members}
            onClose={() => setSelectedItem(null)}
            onToggle={(checked) => toggleGrocery(selectedItem.id, checked)}
            onUpdate={(payload) => updateGrocery(selectedItem.id, payload)}
            onDelete={() => { deleteGrocery(selectedItem.id); setSelectedItem(null) }}
          />
        )}
      </div>
    )
  }

  const subHeader = (
    <div style={{ background: 'white', padding: '10px 16px', borderBottom: '1px solid #ede8e1', position: 'sticky', top: 57, zIndex: 49, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <h2 style={{ fontSize: 13, fontWeight: 600, color: '#78716c', margin: 0, letterSpacing: 0.2 }}>Grocery</h2>
      <button
        onClick={() => setHistoryMode(true)}
        style={{ background: 'none', border: 'none', color: '#78716c', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '4px 8px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4 }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><polyline points="12,6 12,12 16,14" />
        </svg>
        History {done.length > 0 && `(${done.length})`}
      </button>
    </div>
  )

  const emptyState = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '64px 24px', textAlign: 'center' }}>
      <div style={{ width: 60, height: 60, borderRadius: 18, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
          <line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 01-8 0" />
        </svg>
      </div>
      <p style={{ fontSize: 16, fontWeight: 700, color: '#1c1917', margin: '0 0 6px' }}>List is empty</p>
      <p style={{ fontSize: 13, color: '#a8a29e', margin: 0, lineHeight: 1.6 }}>Tap the + button to add items to your list.</p>
    </div>
  )

  return (
    <div style={{ paddingBottom: isDesktop ? 40 : 80 }}>
      {subHeader}

      {isDesktop ? (
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          {/* Left: active */}
          <div style={{ flex: 1, padding: '0 16px', borderRight: '1px solid #ede8e1', minWidth: 0 }}>
            {active.length > 1 && (
              <div style={{ padding: '10px 0', display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={handleCheckAll} style={{ background: 'none', border: 'none', color: '#78716c', fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: '4px 8px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20,6 9,17 4,12" /></svg>
                  Check all
                </button>
              </div>
            )}
            {active.length === 0 && done.length === 0 && emptyState}
            {active.length === 0 && done.length > 0 && (
              <div style={{ padding: '48px 20px', textAlign: 'center' }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#1c1917', margin: '0 0 6px' }}>All done!</p>
                <p style={{ fontSize: 13, color: '#a8a29e', margin: 0 }}>Everything has been checked off.</p>
              </div>
            )}
            <div style={{ padding: '12px 0' }}>
              {active.map(item => (
                <GroceryRow key={item.id} item={item} onToggle={checked => toggleGrocery(item.id, checked)} onSelect={() => setSelectedItem(item)} />
              ))}
            </div>
          </div>

          {/* Right: done */}
          <div style={{ width: 340, flexShrink: 0, padding: '0 16px' }}>
            {done.length === 0 ? (
              <div style={{ padding: '48px 0', textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: '#a8a29e' }}>No completed items yet.</p>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', padding: '10px 4px' }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#a8a29e', letterSpacing: 0.8, textTransform: 'uppercase', margin: 0 }}>Done ({done.length})</p>
                </div>
                <div>
                  {done.map(item => (
                    <GroceryRow key={item.id} item={item} done onToggle={checked => toggleGrocery(item.id, checked)} onSelect={() => setSelectedItem(item)} />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        <div style={{ padding: '0 12px 0' }}>
          {active.length > 1 && (
            <div style={{ padding: '8px 0', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={handleCheckAll} style={{ background: 'none', border: 'none', color: '#78716c', fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: '4px 8px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20,6 9,17 4,12" /></svg>
                Check all
              </button>
            </div>
          )}

          {active.length === 0 && done.length === 0 && emptyState}

          {active.length > 0 && (
            <div style={{ padding: '12px 0' }}>
              {active.map(item => (
                <GroceryRow key={item.id} item={item} onToggle={checked => toggleGrocery(item.id, checked)} onSelect={() => setSelectedItem(item)} />
              ))}
            </div>
          )}

          {done.length > 0 && (
            <div style={{ padding: '8px 0 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 4px' }}>
                <button onClick={() => setShowDone(v => !v)} style={{ background: 'none', border: 'none', color: '#78716c', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: showDone ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.15s' }}>
                    <polyline points="9,18 15,12 9,6" />
                  </svg>
                  Done ({done.length})
                </button>
                {showDone && (
                  <button onClick={() => setShowDone(false)} style={{ background: 'none', border: 'none', color: '#a8a29e', fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: 0 }}>Hide</button>
                )}
              </div>
              {showDone && (
                <div style={{ padding: '8px 0' }}>
                  {done.map(item => (
                    <GroceryRow key={item.id} item={item} done onToggle={checked => toggleGrocery(item.id, checked)} onSelect={() => setSelectedItem(item)} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <button
        onClick={() => setShowAdd(true)}
        style={{
          position: 'fixed', bottom: isDesktop ? 24 : 72, right: 20, width: 56, height: 56,
          borderRadius: 16, background: ACCENT, color: 'white', border: 'none',
          fontSize: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 8px 24px ${ACCENT}40`, zIndex: 40, cursor: 'pointer', transition: 'transform .1s',
        }}
        onMouseDown={e => (e.currentTarget.style.transform = 'scale(.94)')}
        onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
      >+</button>

      {showAdd && (
        <AddGrocerySheet members={members} onClose={() => setShowAdd(false)} onAdded={() => setShowAdd(false)} />
      )}

      {selectedItem && (
        <GroceryDetailSheet
          item={selectedItem} members={members}
          onClose={() => setSelectedItem(null)}
          onToggle={checked => toggleGrocery(selectedItem.id, checked)}
          onUpdate={payload => updateGrocery(selectedItem.id, payload)}
          onDelete={() => { deleteGrocery(selectedItem.id); setSelectedItem(null) }}
        />
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── GroceryRow ────────────────────────────────────────────────────────────────

interface RowProps {
  item: Grocery
  done?: boolean
  onToggle: (checked: boolean) => void
  onSelect: () => void
}

function GroceryRow({ item, done = false, onToggle, onSelect }: RowProps) {
  return (
    <div
      onClick={onSelect}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '11px 14px', marginBottom: 6,
        background: 'white', borderRadius: 12, border: '1px solid #ede8e1',
        opacity: done ? 0.55 : 1, transition: 'opacity 0.15s', cursor: 'pointer',
      }}
    >
      {/* Circular tick button */}
      <button
        onClick={e => { e.stopPropagation(); onToggle(!done) }}
        style={{
          width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
          border: `1.5px solid ${done ? '#22c55e' : '#d4d4d8'}`,
          background: done ? '#22c55e' : 'transparent',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.15s',
        }}
      >
        {done ? (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20,6 9,17 4,12" />
          </svg>
        ) : (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#d4d4d8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20,6 9,17 4,12" />
          </svg>
        )}
      </button>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, textDecoration: done ? 'line-through' : 'none', color: done ? '#a8a29e' : '#1c1917', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.title}
        </div>
        {(item.quantity || item.notes) && (
          <div style={{ fontSize: 11, color: '#a8a29e', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {[item.quantity, item.notes].filter(Boolean).join(' · ')}
          </div>
        )}
      </div>

      {/* Assignee avatar */}
      {item.assignee && (
        <span style={{
          width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
          background: item.assignee.color ?? ACCENT,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 700, color: 'white',
        }}>
          {item.assignee.name?.charAt(0).toUpperCase()}
        </span>
      )}

      {/* Chevron hint */}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d4d4d8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9,18 15,12 9,6" />
      </svg>
    </div>
  )
}

// ── GroceryDetailSheet ────────────────────────────────────────────────────────

interface DetailSheetProps {
  item: Grocery
  members: Member[]
  onClose: () => void
  onToggle: (checked: boolean) => void
  onUpdate: (payload: UpdateGroceryPayload) => Promise<void>
  onDelete: () => void
}

function GroceryDetailSheet({ item, members, onClose, onToggle, onUpdate, onDelete }: DetailSheetProps) {
  const isDesktop = useBreakpoint()
  const [title, setTitle] = useState(item.title)
  const [quantity, setQuantity] = useState(item.quantity ?? '')
  const [notes, setNotes] = useState(item.notes ?? '')
  const [assigneeId, setAssigneeId] = useState(item.assignee?.id ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [syncing, setSyncing] = useState(false)

  // Debounced field updates — batch pending changes
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRef = useRef<UpdateGroceryPayload>({})

  const scheduleUpdate = (patch: UpdateGroceryPayload) => {
    pendingRef.current = { ...pendingRef.current, ...patch }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const payload = pendingRef.current
      pendingRef.current = {}
      setSyncing(true)
      try { await onUpdate(payload) } finally { setSyncing(false) }
    }, 600)
  }

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  const handleTitle = (v: string) => { setTitle(v); scheduleUpdate({ title: v }) }
  const handleQuantity = (v: string) => { setQuantity(v); scheduleUpdate({ quantity: v || undefined }) }
  const handleNotes = (v: string) => { setNotes(v); scheduleUpdate({ notes: v }) }
  const handleAssignee = (id: string) => {
    setAssigneeId(id)
    onUpdate({ assignee_id: id }) // immediate, no debounce
  }

  return (
    <div
      className="fade-in"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: '#00000040', zIndex: 100, display: 'flex', alignItems: isDesktop ? 'center' : 'flex-end', justifyContent: 'center' }}
    >
      <div
        className={isDesktop ? 'fade-in' : 'slide-up'}
        style={{
          background: 'white', width: '100%', maxWidth: 520,
          borderRadius: isDesktop ? 16 : '18px 18px 0 0',
          padding: isDesktop ? '24px 24px 28px' : '0 20px 44px',
          boxShadow: isDesktop ? '0 8px 40px rgba(0,0,0,0.18)' : '0 -4px 24px rgba(0,0,0,0.10)',
          maxHeight: '92vh', overflowY: 'auto',
        }}
      >
        {!isDesktop && <div style={{ width: 36, height: 3, background: '#d4d4d8', borderRadius: 99, margin: '14px auto 18px' }} />}
        {isDesktop && <div style={{ height: 4 }} />}

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          {/* Done toggle */}
          <button
            onClick={() => onToggle(!item.done)}
            style={{
              width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
              border: `1.5px solid ${item.done ? '#22c55e' : '#d4d4d8'}`,
              background: item.done ? '#22c55e' : 'transparent',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}
          >
            {item.done ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20,6 9,17 4,12" /></svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d4d4d8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20,6 9,17 4,12" /></svg>
            )}
          </button>
          <span style={{ fontSize: 12, color: item.done ? '#22c55e' : '#a8a29e', fontWeight: 600 }}>
            {item.done ? 'Done — tap to reopen' : 'Mark as done'}
          </span>
          <div style={{ flex: 1 }} />
          {syncing && <span style={{ fontSize: 11, color: '#a8a29e' }}>Saving…</span>}
          <button onClick={onClose} style={{ background: '#faf7f2', border: 'none', borderRadius: 8, padding: '5px 12px', fontSize: 13, color: '#78716c', cursor: 'pointer' }}>Done</button>
        </div>

        {/* Title */}
        <p style={{ fontSize: 10, fontWeight: 700, color: '#a8a29e', letterSpacing: 0.8, textTransform: 'uppercase', margin: '0 0 6px' }}>Item</p>
        <input
          value={title}
          onChange={e => handleTitle(e.target.value)}
          placeholder="Item name"
          style={{
            width: '100%', fontSize: 15, fontWeight: 600,
            border: '1px solid #ede8e1', borderRadius: 8, padding: '10px 12px',
            outline: 'none', color: '#1c1917', background: '#fafafa',
            boxSizing: 'border-box', marginBottom: 10,
            textDecoration: item.done ? 'line-through' : 'none',
          }}
        />

        {/* Quantity + Notes */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#a8a29e', letterSpacing: 0.8, textTransform: 'uppercase', margin: '0 0 6px' }}>Qty</p>
            <input
              value={quantity}
              onChange={e => handleQuantity(e.target.value)}
              placeholder="e.g. 2, 500g"
              style={{ width: '100%', fontSize: 13, border: '1px solid #ede8e1', borderRadius: 8, padding: '9px 12px', outline: 'none', color: '#1c1917', background: '#fafafa', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ flex: 2 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#a8a29e', letterSpacing: 0.8, textTransform: 'uppercase', margin: '0 0 6px' }}>Notes</p>
            <input
              value={notes}
              onChange={e => handleNotes(e.target.value)}
              placeholder="Optional notes…"
              style={{ width: '100%', fontSize: 13, border: '1px solid #ede8e1', borderRadius: 8, padding: '9px 12px', outline: 'none', color: '#1c1917', background: '#fafafa', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        {/* Assignee */}
        {members.length > 0 && (
          <>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#a8a29e', letterSpacing: 0.8, textTransform: 'uppercase', margin: '0 0 8px' }}>Assign to</p>
            <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
              <button
                onClick={() => handleAssignee('')}
                style={{
                  padding: '5px 12px', borderRadius: 99, border: '1px solid', fontWeight: 600, fontSize: 12, cursor: 'pointer',
                  borderColor: assigneeId === '' ? '#a8a29e' : '#ede8e1',
                  background: assigneeId === '' ? '#f5f5f4' : 'white',
                  color: assigneeId === '' ? '#78716c' : '#a8a29e',
                }}
              >Unassigned</button>
              {members.map(m => (
                <button key={m.id} onClick={() => handleAssignee(m.id)} style={{
                  padding: '5px 12px', borderRadius: 99, border: '1px solid', fontWeight: 600, fontSize: 12, cursor: 'pointer',
                  borderColor: assigneeId === m.id ? m.color : '#ede8e1',
                  background: assigneeId === m.id ? m.color + '14' : 'white',
                  color: assigneeId === m.id ? m.color : '#78716c',
                }}>{m.name}</button>
              ))}
            </div>
          </>
        )}

        {/* Delete */}
        <div style={{ borderTop: '1px solid #faf7f2', paddingTop: 16 }}>
          {confirmDelete ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={onDelete}
                style={{ flex: 1, padding: '11px 0', borderRadius: 8, border: 'none', background: '#ef4444', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >Delete item</button>
              <button
                onClick={() => setConfirmDelete(false)}
                style={{ flex: 1, padding: '11px 0', borderRadius: 8, border: '1px solid #ede8e1', background: 'white', color: '#78716c', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >Cancel</button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              style={{ width: '100%', padding: '11px 0', borderRadius: 8, border: '1px solid #fecaca', background: '#fef2f2', color: '#ef4444', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >Delete item</button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── HistoryRow ────────────────────────────────────────────────────────────────

function HistoryRow({ item, onDelete, onSelect }: { item: Grocery; onDelete: (id: string) => void; onSelect: (item: Grocery) => void }) {
  return (
    <div
      onClick={() => onSelect(item)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '11px 14px', marginBottom: 6,
        background: 'white', borderRadius: 12, border: '1px solid #ede8e1',
        opacity: 0.6, cursor: 'pointer',
      }}
    >
      <span style={{
        width: 26, height: 26, borderRadius: '50%', background: '#22c55e',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20,6 9,17 4,12" />
        </svg>
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, color: '#a8a29e', textDecoration: 'line-through', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
        {item.quantity && <div style={{ fontSize: 11, color: '#a8a29e', marginTop: 1 }}>{item.quantity}</div>}
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d4d4d8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9,18 15,12 9,6" />
      </svg>
    </div>
  )
}
