import { useState } from 'react'
import { CATEGORIES, PRIORITIES, type Category, type Priority, type Member, type CreateTaskPayload } from '../../types'
import { useStore } from '../../store'
import { useAuthStore } from '../../store/authStore'
import { useBreakpoint } from '../../hooks/useBreakpoint'


interface Props {
  members: Member[]
  onClose: () => void
  onAdded: () => void
  hiddenCategories?: Category[]
  defaultCategory?: Category
}

const CATEGORY_CONFIG: Record<Category, {
  heading: string
  titlePlaceholder: string
  notesPlaceholder: string
  defaultPriority: Priority
  submitLabel: string
}> = {
  chore: {
    heading: 'Chore',
    titlePlaceholder: 'e.g. Vacuum the living room',
    notesPlaceholder: 'Details…',
    defaultPriority: 'normal',
    submitLabel: 'Add chore',
  },
  errand: {
    heading: 'Errand',
    titlePlaceholder: 'e.g. Pick up dry cleaning',
    notesPlaceholder: 'Location / details…',
    defaultPriority: 'normal',
    submitLabel: 'Add errand',
  },
  repair: {
    heading: 'Repair',
    titlePlaceholder: 'e.g. Leaking kitchen faucet',
    notesPlaceholder: 'Problem details…',
    defaultPriority: 'high',
    submitLabel: 'Add repair',
  },
}

function Pill({ label, active, color, onClick }: { label: string; active: boolean; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 12px', borderRadius: 99, border: '1px solid', fontWeight: 600, fontSize: 12, cursor: 'pointer',
        borderColor: active ? color : '#ede8e1',
        background: active ? color + '14' : 'white',
        color: active ? color : '#78716c',
        transition: 'all 0.12s',
      }}
    >{label}</button>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 10, fontWeight: 700, color: '#a8a29e', letterSpacing: 0.8, textTransform: 'uppercase', margin: '0 0 8px' }}>
      {children}
    </p>
  )
}

export function AddTaskSheet({ members, onClose, onAdded, hiddenCategories, defaultCategory }: Props) {
  const { createTask } = useStore()
  const { member } = useAuthStore()
  const isDesktop = useBreakpoint()

  const defaultAssignee = members[0]?.id ?? ''
  const initialCategory: Category = defaultCategory ?? (hiddenCategories?.includes('chore') ? (Object.keys(CATEGORY_CONFIG) as Category[]).find(c => !hiddenCategories.includes(c))! : 'chore')

  const [form, setForm] = useState<CreateTaskPayload>({
    title: '', notes: '', category: initialCategory,
    priority: CATEGORY_CONFIG[initialCategory].defaultPriority,
    assignee_id: defaultAssignee,
    household_id: member?.household_id ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const set = <K extends keyof CreateTaskPayload>(k: K, v: CreateTaskPayload[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const handleCategoryChange = (cat: Category) => {
    setForm((f) => ({
      ...f, category: cat,
      priority: CATEGORY_CONFIG[cat].defaultPriority,
      notes: '',
    }))
  }

  const hasHousehold = !!member?.household_id

  const submit = async () => {
    if (!form.title.trim()) return
    if (!hasHousehold) return
    setSaving(true)
    setSubmitError(null)
    try {
      await createTask(form)
      onAdded()
      onClose()
    } catch {
      setSubmitError('Could not add task. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const cfg = CATEGORY_CONFIG[form.category]
  const catColor = CATEGORIES[form.category].color

  return (
    <div
      className="fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: '#00000040', zIndex: 100, display: 'flex', alignItems: isDesktop ? 'center' : 'flex-end', justifyContent: 'center' }}
    >
      <div className={isDesktop ? 'fade-in' : 'slide-up'} style={{
        background: 'white', width: '100%', maxWidth: 520,
        borderRadius: isDesktop ? 16 : '18px 18px 0 0',
        padding: isDesktop ? '24px 24px 28px' : '20px 20px 44px',
        boxShadow: isDesktop ? '0 8px 40px rgba(0,0,0,0.18)' : '0 -4px 24px rgba(0,0,0,0.10)',
        maxHeight: '92vh', overflowY: 'auto',
      }}>
        {!isDesktop && <div style={{ width: 36, height: 3, background: '#d4d4d8', borderRadius: 99, margin: '0 auto 20px' }} />}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <p style={{ fontSize: 18, fontWeight: 700, color: '#1c1917' }}>
            {cfg.heading}
          </p>
          <button
            onClick={onClose}
            style={{ background: '#faf7f2', border: 'none', borderRadius: 7, padding: '5px 12px', fontSize: 13, color: '#78716c', cursor: 'pointer' }}
          >Cancel</button>
        </div>

        <SectionLabel>Category</SectionLabel>
        <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
          {(Object.entries(CATEGORIES) as [Category, { label: string; color: string }][])
            .filter(([k]) => !hiddenCategories?.includes(k))
            .map(([k, v]) => (
              <Pill key={k} label={v.label} color={v.color} active={form.category === k} onClick={() => handleCategoryChange(k)} />
            ))}
        </div>

        <input
          autoFocus
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
          placeholder={cfg.titlePlaceholder}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          style={{
            width: '100%', fontSize: 15, border: `1px solid ${form.title ? catColor + '60' : '#ede8e1'}`,
            borderRadius: 8, padding: '11px 12px', outline: 'none', marginBottom: 10,
            color: '#1c1917', background: '#fafafa', boxSizing: 'border-box',
            transition: 'border-color 0.15s',
          }}
        />

        <input
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          placeholder={cfg.notesPlaceholder}
          style={{
            width: '100%', fontSize: 13, border: '1px solid #ede8e1',
            borderRadius: 8, padding: '10px 12px', outline: 'none', marginBottom: 18,
            color: '#78716c', background: '#fafafa', boxSizing: 'border-box',
          }}
        />

        <SectionLabel>Priority</SectionLabel>
        <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
          {(Object.entries(PRIORITIES) as [Priority, { label: string; color: string }][]).map(([k, v]) => (
            <Pill key={k} label={v.label} color={v.color} active={form.priority === k} onClick={() => set('priority', k)} />
          ))}
        </div>

        <SectionLabel>Due date <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>· optional</span></SectionLabel>
        <input
          type="date"
          value={form.due_at ? form.due_at.slice(0, 10) : ''}
          onChange={(e) => set('due_at', e.target.value ? new Date(e.target.value).toISOString() : undefined)}
          style={{
            width: '100%', fontSize: 13, border: '1px solid #ede8e1',
            borderRadius: 8, padding: '10px 12px', outline: 'none', marginBottom: 18,
            background: '#fafafa', boxSizing: 'border-box', color: '#1c1917',
          }}
        />

        <SectionLabel>Assign to</SectionLabel>
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

        {!hasHousehold && (
          <div style={{ padding: '8px 12px', borderRadius: 8, background: '#fffbeb', color: '#d97706', fontSize: 12, border: '1px solid #fde68a', marginBottom: 10 }}>
            You need to join a household before adding tasks.
          </div>
        )}

        {submitError && (
          <div style={{ padding: '8px 12px', borderRadius: 8, background: '#fef2f2', color: '#ef4444', fontSize: 12, border: '1px solid #fecaca', marginBottom: 10 }}>
            {submitError}
          </div>
        )}

        <button
          onClick={submit}
          disabled={saving || !form.title.trim() || !hasHousehold}
          style={{
            width: '100%', border: 'none', borderRadius: 10, padding: 14,
            fontSize: 15, fontWeight: 700, cursor: saving || !form.title.trim() || !hasHousehold ? 'not-allowed' : 'pointer',
            background: saving || !form.title.trim() || !hasHousehold ? '#ede8e1' : '#6366f1',
            color: saving || !form.title.trim() || !hasHousehold ? '#a8a29e' : 'white',
            transition: 'background 0.15s',
          }}
        >{saving ? 'Adding…' : cfg.submitLabel}</button>
      </div>
    </div>
  )
}
