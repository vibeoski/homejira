import { create } from 'zustand'
import type { Task, Member, TaskFilter, CreateTaskPayload, Grocery, CreateGroceryPayload, UpdateGroceryPayload } from '../types'
import { tasksApi } from '../api/tasks'
import { membersApi } from '../api/members'
import { groceriesApi } from '../api/groceries'

interface AppStore {
  tasks: Task[]
  groceries: Grocery[]
  members: Member[]
  filter: TaskFilter
  loading: boolean
  error: string | null
  sseVersion: number

  setFilter: (f: Partial<TaskFilter>) => void
  bumpSse: () => void
  fetchTasks: () => Promise<void>
  fetchGroceries: () => Promise<void>
  fetchMembers: () => Promise<void>
  createTask: (payload: CreateTaskPayload) => Promise<void>
  toggleTask: (id: string, done: boolean) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  addComment: (taskId: string, body: string) => Promise<void>

  createGrocery: (payload: CreateGroceryPayload) => Promise<void>
  toggleGrocery: (id: string, done: boolean) => Promise<void>
  updateGrocery: (id: string, payload: UpdateGroceryPayload) => Promise<void>
  deleteGrocery: (id: string) => Promise<void>
}

export const useStore = create<AppStore>((set, get) => ({
  tasks: [],
  groceries: [],
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

  fetchGroceries: async () => {
    try {
      const groceries = await groceriesApi.list()
      if (JSON.stringify(groceries) !== JSON.stringify(get().groceries)) {
        set({ groceries })
      }
    } catch {
      // ignore background errors
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

  addComment: async (taskId, body) => {
    const comment = await tasksApi.addComment(taskId, body)
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === taskId ? { ...t, comments: [...(t.comments ?? []), comment] } : t
      ),
    }))
  },

  createGrocery: async (payload) => {
    const g = await groceriesApi.create(payload)
    set((s) => ({ groceries: [g, ...s.groceries] }))
  },

  toggleGrocery: async (id, done) => {
    const previous = get().groceries.find((g) => g.id === id)
    set((s) => ({ groceries: s.groceries.map((g) => g.id === id ? { ...g, done } : g) }))
    try {
      const updated = await groceriesApi.update(id, { done })
      set((s) => ({ groceries: s.groceries.map((g) => g.id === id ? updated : g) }))
    } catch {
      if (previous) {
        set((s) => ({ groceries: s.groceries.map((g) => g.id === id ? previous : g) }))
      }
    }
  },

  updateGrocery: async (id, payload) => {
    const updated = await groceriesApi.update(id, payload)
    set((s) => ({ groceries: s.groceries.map((g) => g.id === id ? updated : g) }))
  },

  deleteGrocery: async (id) => {
    const previous = get().groceries.find((g) => g.id === id)
    set((s) => ({ groceries: s.groceries.filter((g) => g.id !== id) }))
    try {
      await groceriesApi.delete(id)
    } catch {
      if (previous) set((s) => ({ groceries: [previous, ...s.groceries] }))
      throw new Error('Failed to delete grocery')
    }
  },
}))
