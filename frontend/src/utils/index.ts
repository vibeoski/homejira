export function timeAgo(ts: string): string {
  const s = (Date.now() - new Date(ts).getTime()) / 1000
  if (s < 60)    return 'just now'
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export function formatDate(ts: string): string {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function isOverdue(dueAt: string | undefined, done: boolean): boolean {
  if (!dueAt || done) return false
  return new Date(dueAt).getTime() < Date.now()
}

/** Convert a Date or ISO string to the value format expected by <input type="date"> */
export function toDateInputValue(ts: string): string {
  return new Date(ts).toISOString().slice(0, 10)
}

export function isDueSoon(dueAt: string | undefined, done: boolean): boolean {
  if (!dueAt || done) return false
  const ms = new Date(dueAt).getTime() - Date.now()
  return ms > 0 && ms <= 86_400_000
}

export function groupByDay<T extends { updated_at: string }>(items: T[]): { key: string; label: string; items: T[] }[] {
  const now = new Date()
  const today = new Date(now); today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)

  const map = new Map<string, typeof items>()
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
