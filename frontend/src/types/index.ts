export type Category = 'grocery' | 'chore' | 'errand' | 'repair'
export type Priority = 'urgent' | 'high' | 'normal'

export interface Member {
  id: string
  name: string
  avatar: string
  color: string
  created_at: string
  phone?: string
  household_id?: string | null
  role?: 'admin' | 'member'
  email?: string
  email_verified?: boolean
  phone_verified?: boolean
}
export interface Comment {
  id: string; task_id: string; author_id: string; body: string; created_at: string; author?: Member
}
export interface Task {
  id: string; title: string; notes: string; category: Category; priority: Priority
  assignee_id: string; done: boolean; done_at?: string; due_at?: string; created_at: string; updated_at: string
  assignee?: Member; comments?: Comment[]
}
export interface TaskFilter { category?: Category; done?: boolean; search?: string }
export interface CreateTaskPayload {
  title: string; notes: string; category: Category; priority: Priority; assignee_id: string; household_id: string
  due_at?: string
}
export interface UpdateTaskPayload {
  title?: string; notes?: string; category?: Category; priority?: Priority
  assignee_id?: string; done?: boolean; due_at?: string; clear_due_at?: boolean
}

export const CATEGORIES: Record<Category, { label: string; icon: string; color: string }> = {
  grocery: { label: 'Grocery', icon: '🛒', color: '#22c55e' },
  chore: { label: 'Chore', icon: '🧹', color: '#f97316' },
  errand: { label: 'Errand', icon: '📦', color: '#0ea5e9' },
  repair: { label: 'Repair', icon: '🔧', color: '#ef4444' },
}
export const PRIORITIES: Record<Priority, { label: string; color: string }> = {
  urgent: { label: 'Urgent', color: '#ef4444' },
  high: { label: 'High', color: '#f97316' },
  normal: { label: 'Normal', color: '#6b7280' },
}

export type ActivityKind =
  | 'created' | 'completed' | 'reopened'
  | 'assigned' | 'priority_changed' | 'category_changed'
  | 'title_changed' | 'notes_changed' | 'due_set' | 'due_cleared'

export interface Activity {
  id: string
  task_id: string
  actor_id?: string | null
  actor?: Member | null
  kind: ActivityKind
  meta?: Record<string, string> | null
  created_at: string
}

// Coin types
export interface CoinTransaction {
  id: string
  member_id: string
  amount: number
  reason: string
  meta?: Record<string, string> | null
  created_at: string
}

// Auth types
export interface AuthCheckResponse { registered: boolean }
export interface AuthResponse { token: string; member: Member }
export interface LoginPayload { phone: string; mpin: string }
export interface RegisterPayload { phone: string; name: string; avatar: string; mpin: string; referral_token?: string; email?: string; firebase_token?: string }
