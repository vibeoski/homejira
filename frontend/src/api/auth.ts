import { client } from './client'
import type { AuthCheckResponse, AuthResponse, LoginPayload, RegisterPayload } from '../types'

export const authApi = {
  checkPhone: async (phone: string): Promise<AuthCheckResponse> => {
    const { data } = await client.post('/auth/check-phone', { phone })
    return data
  },
  login: async (payload: LoginPayload): Promise<AuthResponse> => {
    const { data } = await client.post('/auth/login', payload)
    return data
  },
  register: async (payload: RegisterPayload): Promise<AuthResponse> => {
    const { data } = await client.post('/auth/register', payload)
    return data
  },
  refresh: async (): Promise<AuthResponse> => {
    const { data } = await client.post('/auth/refresh')
    return data
  },
  changeMpin: async (currentMpin: string, newMpin: string): Promise<void> => {
    await client.patch('/auth/mpin', { current_mpin: currentMpin, new_mpin: newMpin })
  },
}
