import { create } from 'zustand'
import type { Member } from '../types'

// Initialize from localStorage at module load (before first React render — no auth flash)
const initialToken = localStorage.getItem('hj_token')
const initialMember: Member | null = (() => {
  try {
    const raw = localStorage.getItem('hj_member')
    return raw ? (JSON.parse(raw) as Member) : null
  } catch {
    return null
  }
})()
const initialIsGuest = localStorage.getItem('hj_guest') === 'true'

interface AuthStore {
  token: string | null
  member: Member | null
  isAuthenticated: boolean
  isGuest: boolean

  setAuth: (token: string, member: Member) => void
  updateMember: (member: Member) => void
  clearAuth: () => void
  setGuest: () => void
  clearGuest: () => void
}

export const useAuthStore = create<AuthStore>(() => ({
  token: initialToken,
  member: initialMember,
  isAuthenticated: !!(initialToken && initialMember),
  isGuest: initialIsGuest && !(initialToken && initialMember),

  setAuth: (token, member) => {
    localStorage.setItem('hj_token', token)
    localStorage.setItem('hj_member', JSON.stringify(member))
    localStorage.removeItem('hj_guest')
    useAuthStore.setState({ token, member, isAuthenticated: true, isGuest: false })
  },

  updateMember: (member) => {
    localStorage.setItem('hj_member', JSON.stringify(member))
    useAuthStore.setState((state) => ({
      member,
      isAuthenticated: !!(state.token && member),
    }))
  },

  clearAuth: () => {
    localStorage.removeItem('hj_token')
    localStorage.removeItem('hj_member')
    useAuthStore.setState({ token: null, member: null, isAuthenticated: false })
  },

  setGuest: () => {
    localStorage.setItem('hj_guest', 'true')
    useAuthStore.setState({ isGuest: true, isAuthenticated: false, token: null, member: null })
  },

  clearGuest: () => {
    localStorage.removeItem('hj_guest')
    useAuthStore.setState({ isGuest: false })
  },
}))
