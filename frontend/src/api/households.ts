import { client } from './client'
import type { Member } from '../types'

export interface Household {
  id: string
  name: string
  kind: 'home' | 'group'
  join_code: string
  created_by: string
  created_at: string
}

export interface HouseholdCreatePayload {
  name: string
  kind: 'home' | 'group'
}

export interface JoinByCodePayload {
  code: string
}

export interface JoinRequest {
  id: string
  household_id: string
  requester_id: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  decided_at?: string
  decided_by?: string
  note?: string
  requester?: {
    id: string
    name: string
    avatar: string
    color: string
  }
}

export interface HouseholdInvite {
  id: string
  household_id: string
  invited_phone?: string
  invited_name?: string
  status: 'pending' | 'accepted' | 'rejected' | 'expired'
  created_by: string
  created_at: string
}

export const householdsApi = {
  create: async (payload: HouseholdCreatePayload): Promise<{ household: Household; member: Member }> => {
    const { data } = await client.post('/households', payload)
    return data
  },

  getMine: async (): Promise<{ household: Household | null }> => {
    const { data } = await client.get('/households/me')
    return data
  },

  joinByCode: async (payload: JoinByCodePayload): Promise<{ request: JoinRequest; household: Household }> => {
    const { data } = await client.post('/households/join-by-code', payload)
    return data
  },

  listRequests: async (): Promise<{ requests: JoinRequest[] }> => {
    const { data } = await client.get('/households/requests')
    return data
  },

  approveRequest: async (id: string): Promise<{ request: JoinRequest; member: Member }> => {
    const { data } = await client.post(`/households/requests/${id}/approve`)
    return data
  },

  rejectRequest: async (id: string): Promise<{ request: JoinRequest }> => {
    const { data } = await client.post(`/households/requests/${id}/reject`)
    return data
  },

  createInvite: async (phone: string, name: string): Promise<{ invite: HouseholdInvite }> => {
    const { data } = await client.post('/households/invites', { phone, name })
    return data
  },

  listMyInvites: async (): Promise<{ invites: HouseholdInvite[] }> => {
    const { data } = await client.get('/households/invites/me')
    return data
  },

  acceptInvite: async (id: string): Promise<{ invite: HouseholdInvite; member: Member }> => {
    const { data } = await client.post(`/households/invites/${id}/accept`)
    return data
  },

  rejectInvite: async (id: string): Promise<{ invite: HouseholdInvite }> => {
    const { data } = await client.post(`/households/invites/${id}/reject`)
    return data
  },

  removeMember: async (id: string): Promise<{ member: Member }> => {
    const { data } = await client.post(`/households/members/${id}/remove`)
    return data
  },

  promoteMember: async (id: string): Promise<{ member: Member }> => {
    const { data } = await client.post(`/households/members/${id}/promote`)
    return data
  },

  leave: async (): Promise<{ member: Member }> => {
    const { data } = await client.post('/households/leave')
    return data
  },

  deleteHousehold: async (): Promise<void> => {
    await client.delete('/households')
  },

  getMyRequest: async (): Promise<{ request: JoinRequest | null }> => {
    const { data } = await client.get('/households/requests/mine')
    return data
  },

  cancelRequest: async (id: string): Promise<void> => {
    await client.post(`/households/requests/${id}/cancel`)
  },

  createInviteLink: async (): Promise<{ token: string; household: Household }> => {
    const { data } = await client.post('/households/invite-link')
    return data
  },

  getByInviteToken: async (token: string): Promise<{ household: Household }> => {
    const { data } = await client.get(`/households/link/${token}`)
    return data
  },

  joinByInviteToken: async (token: string): Promise<{ member: Member }> => {
    const { data } = await client.post(`/households/link/${token}/join`)
    return data
  },
}

