import { client } from './client'
import type { Grocery, GroceryFilter, CreateGroceryPayload, UpdateGroceryPayload } from '../types'

export const groceriesApi = {
  async list(filter: GroceryFilter = {}): Promise<Grocery[]> {
    const params = new URLSearchParams()
    if (filter.done !== undefined) params.append('done', String(filter.done))
    if (filter.search) params.append('search', filter.search)
    const { data } = await client.get(`/groceries?${params.toString()}`)
    return data.groceries
  },

  async create(payload: CreateGroceryPayload): Promise<Grocery> {
    const { data } = await client.post('/groceries', payload)
    return data.grocery
  },

  async update(id: string, payload: UpdateGroceryPayload): Promise<Grocery> {
    const { data } = await client.patch(`/groceries/${id}`, payload)
    return data.grocery
  },

  async delete(id: string): Promise<void> {
    await client.delete(`/groceries/${id}`)
  },
}
