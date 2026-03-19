import { create } from 'zustand'
import type { Task, Member, TaskFilter, CreateTaskPayload, Grocery, CreateGroceryPayload, UpdateGroceryPayload, UpdateTaskPayload } from '../types'
import { tasksApi } from '../api/tasks'
import { membersApi } from '../api/members'
import { groceriesApi } from '../api/groceries'

function applyTaskPatch(task: Task, payload: UpdateTaskPayload, members: Member[]): Task {
  const now = new Date().toISOString()
  const nextAssigneeID = payload.assignee_id !== undefined ? payload.assignee_id : task.assignee_id
  const nextDueAt = payload.clear_due_at ? undefined : payload.due_at !== undefined ? payload.due_at : task.due_at
  const nextQuantity = payload.quantity !== undefined ? payload.quantity : task.quantity

  // Status is source of truth; done is derived
  let nextStatus = payload.status ?? task.status
  let nextDone = task.done
  if (payload.status !== undefined) {
    nextDone = payload.status === 'done'
  } else if (payload.done !== undefined) {
    nextDone = payload.done
    nextStatus = payload.done ? 'done' : 'open'
  }

  return {
    ...task,
    title: payload.title ?? task.title,
    notes: payload.notes ?? task.notes,
    category: payload.category ?? task.category,
    priority: payload.priority ?? task.priority,
    assignee_id: nextAssigneeID,
    assignee: members.find((member) => member.id === nextAssigneeID) ?? task.assignee,
    due_at: nextDueAt,
    quantity: nextQuantity,
    status: nextStatus,
    done: nextDone,
    done_at: nextDone ? task.done_at ?? now : undefined,
    updated_at: now,
  }
}

interface AppStore {
  tasks: Task[]
  groceries: Grocery[]
  members: Member[]
  filter: TaskFilter
  loading: boolean
  error: string | null
  sseVersion: number
  groceryPending: number
  toast: { message: string } | null

  setFilter: (f: Partial<TaskFilter>) => void
  bumpSse: () => void
  showToast: (message: string) => void
  dismissToast: () => void
  fetchTasks: () => Promise<void>
  fetchGroceries: () => Promise<void>
  fetchMembers: () => Promise<void>
  createTask: (payload: CreateTaskPayload) => Promise<void>
  updateTask: (id: string, payload: UpdateTaskPayload) => Promise<Task>
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
  groceryPending: 0,
  toast: null,

  setFilter: (f) => set((s) => ({ filter: { ...s.filter, ...f } })),
  bumpSse: () => set((s) => ({ sseVersion: s.sseVersion + 1 })),
  showToast: (message) => set({ toast: { message } }),
  dismissToast: () => set({ toast: null }),

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
    // Skip SSE-triggered refresh while optimistic grocery updates are in-flight
    if (get().groceryPending > 0) return
    try {
      const groceries = await groceriesApi.list()
      if (get().groceryPending > 0) return // re-check after await
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

  updateTask: async (id, payload) => {
    const previous = get().tasks.find((t) => t.id === id)
    if (!previous) throw new Error('Task not found')

    const optimistic = applyTaskPatch(previous, payload, get().members)
    set((state) => ({ tasks: state.tasks.map((task) => task.id === id ? optimistic : task) }))
    try {
      const updated = await tasksApi.update(id, payload)
      set((state) => ({ tasks: state.tasks.map((task) => task.id === id ? updated : task) }))
      return updated
    } catch {
      set((state) => ({ tasks: state.tasks.map((task) => task.id === id ? previous : task) }))
      throw new Error('Failed to update task')
    }
  },

  toggleTask: async (id, done) => {
    await get().updateTask(id, { done })
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
    set((s) => ({
      groceries: s.groceries.map((g) => g.id === id ? { ...g, done } : g),
      groceryPending: s.groceryPending + 1,
    }))
    try {
      const updated = await groceriesApi.update(id, { done })
      set((s) => ({
        groceries: s.groceries.map((g) => g.id === id ? updated : g),
        groceryPending: Math.max(0, s.groceryPending - 1),
      }))
    } catch {
      if (previous) {
        set((s) => ({ groceries: s.groceries.map((g) => g.id === id ? previous : g) }))
      }
      set((s) => ({ groceryPending: Math.max(0, s.groceryPending - 1) }))
      get().showToast('Could not update item — please try again.')
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
