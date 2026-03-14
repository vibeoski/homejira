import { create } from 'zustand'
import type { Task, Member, TaskFilter, CreateTaskPayload, Grocery, CreateGroceryPayload, UpdateGroceryPayload, UpdateTaskPayload } from '../types'
import { tasksApi } from '../api/tasks'
import { membersApi } from '../api/members'
import { groceriesApi } from '../api/groceries'
import { useAuthStore } from './authStore'
import { GUEST_MEMBER, loadGuestTasks, makeGuestComment, saveGuestTasks } from './guest'

function hydrateGuestTask(task: Task): Task {
  return {
    ...task,
    assignee: task.assignee_id === GUEST_MEMBER.id ? GUEST_MEMBER : undefined,
  }
}

function hydrateGuestTasks(tasks: Task[]): Task[] {
  return tasks.map(hydrateGuestTask)
}

function applyTaskPatch(task: Task, payload: UpdateTaskPayload, members: Member[]): Task {
  const now = new Date().toISOString()
  const nextDone = payload.done ?? task.done
  const nextAssigneeID = payload.assignee_id !== undefined ? payload.assignee_id : task.assignee_id
  const nextDueAt = payload.clear_due_at ? undefined : payload.due_at !== undefined ? payload.due_at : task.due_at
  const nextQuantity = payload.quantity !== undefined ? payload.quantity : task.quantity

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

  setFilter: (f: Partial<TaskFilter>) => void
  bumpSse: () => void
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

  setFilter: (f) => set((s) => ({ filter: { ...s.filter, ...f } })),
  bumpSse: () => set((s) => ({ sseVersion: s.sseVersion + 1 })),

  fetchTasks: async () => {
    if (useAuthStore.getState().isGuest) {
      set({
        tasks: hydrateGuestTasks(loadGuestTasks()),
        members: [GUEST_MEMBER],
        loading: false,
        error: null,
      })
      return
    }

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
    if (useAuthStore.getState().isGuest) {
      set({ groceries: [] })
      return
    }

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
    if (useAuthStore.getState().isGuest) {
      set({ members: [GUEST_MEMBER] })
      return
    }

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
    if (useAuthStore.getState().isGuest) {
      const now = new Date().toISOString()
      const task = hydrateGuestTask({
        id: crypto.randomUUID(),
        title: payload.title.trim(),
        notes: payload.notes.trim(),
        category: payload.category,
        priority: payload.priority,
        assignee_id: payload.assignee_id || GUEST_MEMBER.id,
        done: false,
        due_at: payload.due_at,
        quantity: payload.quantity,
        created_at: now,
        updated_at: now,
        comments: [],
      })
      const tasks = [task, ...get().tasks]
      saveGuestTasks(tasks)
      set({ tasks, members: [GUEST_MEMBER] })
      return
    }

    const task = await tasksApi.create(payload)
    set((s) => ({ tasks: [task, ...s.tasks] }))
  },

  updateTask: async (id, payload) => {
    const previous = get().tasks.find((t) => t.id === id)
    if (!previous) throw new Error('Task not found')

    const members = get().members.length > 0 ? get().members : [GUEST_MEMBER]
    const optimistic = applyTaskPatch(previous, payload, members)

    if (useAuthStore.getState().isGuest) {
      const tasks = get().tasks.map((task) => task.id === id ? optimistic : task)
      saveGuestTasks(tasks)
      set({ tasks, members: [GUEST_MEMBER] })
      return optimistic
    }

    set((state) => ({ tasks: state.tasks.map((task) => task.id === id ? optimistic : task) }))
    try {
      const updated = await tasksApi.update(id, payload)
      set((state) => ({ tasks: state.tasks.map((task) => task.id === id ? updated : task) }))
      return updated
    } catch {
      if (previous) {
        set((state) => ({ tasks: state.tasks.map((task) => task.id === id ? previous : task) }))
      }
      throw new Error('Failed to update task')
    }
  },

  toggleTask: async (id, done) => {
    await get().updateTask(id, { done })
  },

  deleteTask: async (id) => {
    const previous = get().tasks.find((t) => t.id === id)

    if (useAuthStore.getState().isGuest) {
      const tasks = get().tasks.filter((task) => task.id !== id)
      saveGuestTasks(tasks)
      set({ tasks })
      return
    }

    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }))
    try {
      await tasksApi.remove(id)
    } catch {
      if (previous) set((s) => ({ tasks: [previous, ...s.tasks] }))
      throw new Error('Failed to delete task')
    }
  },

  addComment: async (taskId, body) => {
    if (useAuthStore.getState().isGuest) {
      const comment = makeGuestComment(taskId, body)
      const tasks = get().tasks.map((task) =>
        task.id === taskId
          ? { ...task, comments: [...(task.comments ?? []), comment], updated_at: comment.created_at }
          : task
      )
      saveGuestTasks(tasks)
      set({ tasks })
      return
    }

    const comment = await tasksApi.addComment(taskId, body)
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === taskId ? { ...t, comments: [...(t.comments ?? []), comment] } : t
      ),
    }))
  },

  createGrocery: async (payload) => {
    if (useAuthStore.getState().isGuest) {
      throw new Error('Grocery list is unavailable in guest mode')
    }

    const g = await groceriesApi.create(payload)
    set((s) => ({ groceries: [g, ...s.groceries] }))
  },

  toggleGrocery: async (id, done) => {
    if (useAuthStore.getState().isGuest) {
      throw new Error('Grocery list is unavailable in guest mode')
    }

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
    if (useAuthStore.getState().isGuest) {
      throw new Error('Grocery list is unavailable in guest mode')
    }

    const updated = await groceriesApi.update(id, payload)
    set((s) => ({ groceries: s.groceries.map((g) => g.id === id ? updated : g) }))
  },

  deleteGrocery: async (id) => {
    if (useAuthStore.getState().isGuest) {
      throw new Error('Grocery list is unavailable in guest mode')
    }

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
