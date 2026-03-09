import { create } from 'zustand'
import type { Task, Member, TaskFilter, CreateTaskPayload } from '../types'
import { tasksApi } from '../api/tasks'
import { membersApi } from '../api/members'

interface AppStore {
  tasks: Task[]
  members: Member[]
  filter: TaskFilter
  loading: boolean
  error: string | null
  sseVersion: number

  setFilter: (f: Partial<TaskFilter>) => void
  bumpSse: () => void
  fetchTasks: () => Promise<void>
  fetchMembers: () => Promise<void>
  createTask: (payload: CreateTaskPayload) => Promise<void>
  toggleTask: (id: string, done: boolean) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  addComment: (taskId: string, authorId: string, body: string) => Promise<void>
}

export const useStore = create<AppStore>((set, get) => ({
  tasks: [],
  members: [],
  filter: {},
  loading: false,
  error: null,
  sseVersion: 0,

  setFilter: (f) => set((s) => ({ filter: { ...s.filter, ...f } })),
  bumpSse: () => set((s) => ({ sseVersion: s.sseVersion + 1 })),

  fetchTasks: async () => {
    const isInitial = get().tasks.length === 0
    if (isInitial) set({ loading: true, error: null })
    try {
      const tasks = await tasksApi.list(get().filter)
      if (JSON.stringify(tasks) !== JSON.stringify(get().tasks)) {
        set({ tasks, loading: false })
      } else if (isInitial) {
        set({ loading: false })
      }
    } catch (e: unknown) {
      if (isInitial) set({ error: e instanceof Error ? e.message : 'Failed to load tasks', loading: false })
    }
  },

  fetchMembers: async () => {
    try {
      const members = await membersApi.list()
      if (JSON.stringify(members) !== JSON.stringify(get().members)) {
        set({ members })
      }
    } catch {
      // silently ignore background errors
    }
  },

  createTask: async (payload) => {
    const task = await tasksApi.create(payload)
    set((s) => ({ tasks: [task, ...s.tasks] }))
  },

  toggleTask: async (id, done) => {
    const previous = get().tasks.find((t) => t.id === id)
    set((s) => ({ tasks: s.tasks.map((t) => t.id === id ? { ...t, done } : t) }))
    try {
      const updated = await tasksApi.update(id, { done })
      set((s) => ({ tasks: s.tasks.map((t) => t.id === id ? updated : t) }))
    } catch {
      if (previous) {
        set((s) => ({ tasks: s.tasks.map((t) => t.id === id ? previous : t) }))
      }
    }
  },

  deleteTask: async (id) => {
    const previous = get().tasks.find((t) => t.id === id)
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }))
    try {
      await tasksApi.remove(id)
    } catch {
      if (previous) set((s) => ({ tasks: [previous, ...s.tasks] }))
      throw new Error('Failed to delete task')
    }
  },

  addComment: async (taskId, authorId, body) => {
    const comment = await tasksApi.addComment(taskId, authorId, body)
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === taskId ? { ...t, comments: [...(t.comments ?? []), comment] } : t
      ),
    }))
  },
}))
