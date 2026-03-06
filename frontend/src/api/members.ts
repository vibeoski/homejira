import { client } from './client'
import type { Member } from '../types'
export const membersApi = {
  list: async (): Promise<Member[]> => {
    const { data } = await client.get('/members')
    return data.members ?? []
  },
  getById: async (id: string): Promise<Member> => {
    const { data } = await client.get(`/members/${id}`)
    return data.member
  },
  updateMe: async (payload: { name: string; avatar: string; color: string }): Promise<Member> => {
    const { data } = await client.patch('/members/me', payload)
    return data.member
  },
}
