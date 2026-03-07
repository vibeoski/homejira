import { create } from 'zustand'
import type { Task, Member, TaskFilter, CreateTaskPayload } from '../types'
import { tasksApi } from '../api/tasks'
import { membersApi } from '../api/members'
import { useAuthStore } from './authStore'
import { GUEST_MEMBER, loadGuestTasks, saveGuestTasks, makeGuestComment } from './guest'

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
    if (useAuthStore.getState().isGuest) {
      const all = loadGuestTasks()
      const f = get().filter
      const filtered = all.filter((t) =>
        (!f.category || t.category === f.category) &&
        (f.done === undefined || t.done === f.done) &&
        (!f.search || t.title.toLowerCase().includes(f.search.toLowerCase()))
      )
      set({ tasks: filtered, loading: false })
      return
    }
    try {
      const tasks = await tasksApi.list(get().filter)
      // Skip re-render if nothing changed
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
    if (useAuthStore.getState().isGuest) {
      set({ members: [GUEST_MEMBER] })
      return
    }
    try {
      const members = await membersApi.list()
      // Skip re-render if nothing changed
      if (JSON.stringify(members) !== JSON.stringify(get().members)) {
        set({ members })
      }
    } catch {
      // silently ignore background poll errors
    }
  },

  createTask: async (payload) => {
    if (useAuthStore.getState().isGuest) {
      const now = new Date().toISOString()
      const newTask: Task = {
        id: crypto.randomUUID(),
        ...payload,
        done: false,
        done_at: undefined,
        created_at: now,
        updated_at: now,
        assignee: GUEST_MEMBER,
        comments: [],
      }
      const all = [...loadGuestTasks(), newTask]
      saveGuestTasks(all)
      set((s) => ({ tasks: [newTask, ...s.tasks] }))
      return
    }
    const task = await tasksApi.create(payload)
    set((s) => ({ tasks: [task, ...s.tasks] }))
  },

  toggleTask: async (id, done) => {
    const previous = get().tasks.find((t) => t.id === id)
    // Optimistic update
    set((s) => ({ tasks: s.tasks.map((t) => t.id === id ? { ...t, done } : t) }))
    if (useAuthStore.getState().isGuest) {
      saveGuestTasks(loadGuestTasks().map((t) => t.id === id ? { ...t, done } : t))
      return
    }
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
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }))
    if (useAuthStore.getState().isGuest) {
      saveGuestTasks(loadGuestTasks().filter((t) => t.id !== id))
      return
    }
    await tasksApi.remove(id)
  },

  addComment: async (taskId, authorId, body) => {
    if (useAuthStore.getState().isGuest) {
      const comment = makeGuestComment(taskId, body)
      const all = loadGuestTasks().map((t) =>
        t.id === taskId ? { ...t, comments: [...(t.comments ?? []), comment] } : t
      )
      saveGuestTasks(all)
      set((s) => ({
        tasks: s.tasks.map((t) =>
          t.id === taskId ? { ...t, comments: [...(t.comments ?? []), comment] } : t
        ),
      }))
      return
    }
    const comment = await tasksApi.addComment(taskId, authorId, body)
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === taskId ? { ...t, comments: [...(t.comments ?? []), comment] } : t
      ),
    }))
  },
}))
