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
