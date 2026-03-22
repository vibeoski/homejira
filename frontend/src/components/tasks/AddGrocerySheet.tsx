import { useState, useRef, useEffect } from 'react'
import { type Member, type CreateGroceryPayload } from '../../types'
import { useStore } from '../../store'
import { useBreakpoint } from '../../hooks/useBreakpoint'

interface Props {
  members: Member[]
  onClose: () => void
  onAdded: () => void
}

export function AddGrocerySheet({ members, onClose, onAdded }: Props) {
  const { createGrocery } = useStore()
  const isDesktop = useBreakpoint()

  const [form, setForm] = useState<CreateGroceryPayload>({
    title: '', quantity: '', notes: '',
    assignee_id: members[0]?.id ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  
  const titleInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    titleInputRef.current?.focus()
  }, [])

  const set = <K extends keyof CreateGroceryPayload>(k: K, v: CreateGroceryPayload[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    setSubmitError(null)
    try {
      await createGrocery({
        ...form,
        title: form.title.trim(),
        quantity: form.quantity?.trim() || undefined,
        notes: form.notes.trim(),
      })
      onAdded()
      onClose()
    } catch {
      setSubmitError('Could not add item. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const ACCENT = '#6366f1'

  return (
    <div
      className="fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: '#00000040', zIndex: 100, display: 'flex', alignItems: isDesktop ? 'center' : 'flex-end', justifyContent: 'center' }}
    >
      <div className={isDesktop ? 'fade-in' : 'slide-up'} style={{
        background: 'white', width: '100%', maxWidth: 520,
        borderRadius: isDesktop ? 16 : '18px 18px 0 0',
        padding: isDesktop ? '24px 24px 28px' : '20px 20px calc(24px + env(safe-area-inset-bottom, 20px))',
        boxShadow: isDesktop ? '0 8px 40px rgba(0,0,0,0.18)' : '0 -4px 24px rgba(0,0,0,0.10)',
        maxHeight: '92vh', overflowY: 'auto',
      }}>
        {!isDesktop && <div style={{ width: 36, height: 3, background: '#d4d4d8', borderRadius: 99, margin: '0 auto 20px' }} />}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <p style={{ fontSize: 18, fontWeight: 700, color: '#1c1917' }}>
            New Grocery Item
          </p>
          <button
            onClick={onClose}
            style={{ background: '#faf7f2', border: 'none', borderRadius: 7, padding: '5px 12px', fontSize: 13, color: '#78716c', cursor: 'pointer' }}
          >Cancel</button>
        </div>

        <p style={{ fontSize: 10, fontWeight: 700, color: '#a8a29e', letterSpacing: 0.8, textTransform: 'uppercase', margin: '0 0 8px' }}>
          Item Details
        </p>
        
        <input
          ref={titleInputRef}
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
          placeholder="e.g. Milk, bread, eggs"
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          style={{
            width: '100%', fontSize: 15, border: `1px solid ${form.title ? ACCENT + '60' : '#ede8e1'}`,
            borderRadius: 8, padding: '11px 12px', outline: 'none', marginBottom: 10,
            color: '#1c1917', background: '#fafafa', boxSizing: 'border-box',
          }}
        />

        <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
          <input
            value={form.quantity}
            onChange={(e) => set('quantity', e.target.value)}
            placeholder="Quantity (e.g. 2, 500g)"
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            style={{
              flex: 1, fontSize: 14, border: '1px solid #ede8e1',
              borderRadius: 8, padding: '10px 12px', outline: 'none',
              color: '#1c1917', background: '#fafafa', boxSizing: 'border-box',
            }}
          />
          <input
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Optional notes…"
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            style={{
              flex: 2, fontSize: 14, border: '1px solid #ede8e1',
              borderRadius: 8, padding: '10px 12px', outline: 'none',
              color: '#1c1917', background: '#fafafa', boxSizing: 'border-box',
            }}
          />
        </div>

        <p style={{ fontSize: 10, fontWeight: 700, color: '#a8a29e', letterSpacing: 0.8, textTransform: 'uppercase', margin: '0 0 8px' }}>
          Assign to
        </p>
        <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
          {members.map((m) => (
            <button key={m.id} onClick={() => set('assignee_id', m.id)} style={{
              padding: '5px 12px', borderRadius: 99, border: '1px solid', fontWeight: 600, fontSize: 12, cursor: 'pointer',
              borderColor: form.assignee_id === m.id ? m.color : '#ede8e1',
              background: form.assignee_id === m.id ? m.color + '14' : 'white',
              color: form.assignee_id === m.id ? m.color : '#78716c',
            }}>{m.name}</button>
          ))}
        </div>

        {submitError && (
          <div style={{ padding: '8px 12px', borderRadius: 8, background: '#fef2f2', color: '#ef4444', fontSize: 12, border: '1px solid #fecaca', marginBottom: 10 }}>
            {submitError}
          </div>
        )}

        <button
          onClick={submit}
          disabled={saving || !form.title.trim()}
          style={{
            width: '100%', border: 'none', borderRadius: 10, padding: 14,
            fontSize: 15, fontWeight: 700, cursor: saving || !form.title.trim() ? 'not-allowed' : 'pointer',
            background: saving || !form.title.trim() ? '#ede8e1' : ACCENT,
            color: saving || !form.title.trim() ? '#a8a29e' : 'white',
            transition: 'background 0.15s',
          }}
        >{saving ? 'Adding…' : 'Add to Grocery List'}</button>
      </div>
    </div>
  )
}
