import { create } from 'zustand'
import type { Member } from '../types'

// Clean up any legacy guest mode data
localStorage.removeItem('hj_guest')
localStorage.removeItem('hj_guest_tasks')

// Initialize from localStorage at module load (before first React render — no auth flash)
const initialToken = localStorage.getItem('hj_token')
const storedMember: Member | null = (() => {
  try {
    const raw = localStorage.getItem('hj_member')
    return raw ? (JSON.parse(raw) as Member) : null
  } catch {
    return null
  }
})()

interface AuthStore {
  token: string | null
  member: Member | null
  isAuthenticated: boolean

  setAuth: (token: string, member: Member) => void
  updateMember: (member: Member) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthStore>(() => ({
  token: initialToken,
  member: storedMember,
  isAuthenticated: !!(initialToken && storedMember),

  setAuth: (token, member) => {
    localStorage.setItem('hj_token', token)
    localStorage.setItem('hj_member', JSON.stringify(member))
    useAuthStore.setState({ token, member, isAuthenticated: true })
  },

  updateMember: (member) => {
    localStorage.setItem('hj_member', JSON.stringify(member))
    useAuthStore.setState((state) => ({
      token: state.token,
      member,
      isAuthenticated: !!(state.token && member),
    }))
  },

  clearAuth: () => {
    localStorage.removeItem('hj_token')
    localStorage.removeItem('hj_member')
    localStorage.removeItem('hj_pending_join')
    useAuthStore.setState({ token: null, member: null, isAuthenticated: false })
  },
}))
