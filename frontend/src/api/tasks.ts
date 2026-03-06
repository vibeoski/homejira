import { client } from './client'
import type { Task, TaskFilter, CreateTaskPayload, UpdateTaskPayload, Comment, Activity } from '../types'

export const tasksApi = {
  list: async (filter: TaskFilter = {}): Promise<Task[]> => {
    const params: Record<string, string> = {}
    if (filter.category) params.category = filter.category
    if (filter.done !== undefined) params.done = String(filter.done)
    if (filter.search) params.search = filter.search
    const { data } = await client.get('/tasks', { params })
    return data.tasks ?? []
  },
  get: async (id: string): Promise<Task> => {
    const { data } = await client.get(`/tasks/${id}`)
    return data.task
  },
  create: async (payload: CreateTaskPayload): Promise<Task> => {
    const { data } = await client.post('/tasks', payload)
    return data.task
  },
  update: async (id: string, payload: UpdateTaskPayload): Promise<Task> => {
    const { data } = await client.patch(`/tasks/${id}`, payload)
    return data.task
  },
  remove: async (id: string): Promise<void> => {
    await client.delete(`/tasks/${id}`)
  },
  addComment: async (taskId: string, authorId: string, body: string): Promise<Comment> => {
    const { data } = await client.post(`/tasks/${taskId}/comments`, { author_id: authorId, body })
    return data.comment
  },
  getActivity: async (taskId: string): Promise<Activity[]> => {
    const { data } = await client.get(`/tasks/${taskId}/activity`)
    return data.activities ?? []
  },
}
