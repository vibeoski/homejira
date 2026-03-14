import type { Task, Member, Comment } from '../types'

export const GUEST_MEMBER: Member = {
  id: 'guest',
  name: 'Guest',
  avatar: 'G',
  color: '#f97316',
  created_at: new Date().toISOString(),
}

const TASKS_KEY = 'hj_guest_tasks'

export function loadGuestTasks(): Task[] {
  try {
    return JSON.parse(localStorage.getItem(TASKS_KEY) ?? '[]')
  } catch {
    return []
  }
}

export function saveGuestTasks(tasks: Task[]): void {
  localStorage.setItem(TASKS_KEY, JSON.stringify(tasks))
}

export function clearGuestData(): void {
  localStorage.removeItem(TASKS_KEY)
}

export function makeGuestComment(taskId: string, body: string): Comment {
  return {
    id: crypto.randomUUID(),
    task_id: taskId,
    author_id: GUEST_MEMBER.id,
    body,
    created_at: new Date().toISOString(),
    author: GUEST_MEMBER,
  }
}
