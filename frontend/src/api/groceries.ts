import type { Grocery, GroceryFilter, CreateGroceryPayload, UpdateGroceryPayload } from '../types'

const BASE_URL = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8080') + '/api/v1/groceries'

function getAuth(): Record<string, string> {
  const token = localStorage.getItem('token')
  return token ? { 'Authorization': `Bearer ${token}` } : {}
}

export const groceriesApi = {
  async list(filter: GroceryFilter = {}): Promise<Grocery[]> {
    const params = new URLSearchParams()
    if (filter.done !== undefined) params.append('done', String(filter.done))
    if (filter.search) params.append('search', filter.search)

    const res = await fetch(`${BASE_URL}?${params.toString()}`, { headers: getAuth() })
    if (!res.ok) throw new Error('Failed to fetch groceries')
    const data = await res.json()
    return data.groceries
  },

  async create(payload: CreateGroceryPayload): Promise<Grocery> {
    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuth() },
      body: JSON.stringify(payload)
    })
    if (!res.ok) throw new Error('Failed to create grocery')
    const data = await res.json()
    return data.grocery
  },

  async update(id: string, payload: UpdateGroceryPayload): Promise<Grocery> {
    const res = await fetch(`${BASE_URL}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuth() },
      body: JSON.stringify(payload)
    })
    if (!res.ok) throw new Error('Failed to update grocery')
    const data = await res.json()
    return data.grocery
  },

  async delete(id: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/${id}`, {
      method: 'DELETE',
      headers: getAuth()
    })
    if (!res.ok) throw new Error('Failed to delete grocery')
  }
}
