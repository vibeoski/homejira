import { create } from 'zustand'
import type { Member } from '../types'
import { GUEST_MEMBER, GUEST_STORAGE_KEY } from './guest'

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
const initialIsGuest = !initialToken && localStorage.getItem(GUEST_STORAGE_KEY) === 'true'
const initialMember = initialIsGuest ? GUEST_MEMBER : storedMember

interface AuthStore {
  token: string | null
  member: Member | null
  isAuthenticated: boolean
  isGuest: boolean

  setAuth: (token: string, member: Member) => void
  setGuest: () => void
  updateMember: (member: Member) => void
  clearAuth: () => void
  clearGuest: () => void
}

export const useAuthStore = create<AuthStore>(() => ({
  token: initialToken,
  member: initialMember,
  isAuthenticated: !!(initialToken && initialMember && !initialIsGuest),
  isGuest: initialIsGuest,

  setAuth: (token, member) => {
    localStorage.removeItem(GUEST_STORAGE_KEY)
    localStorage.setItem('hj_token', token)
    localStorage.setItem('hj_member', JSON.stringify(member))
    useAuthStore.setState({ token, member, isAuthenticated: true, isGuest: false })
  },

  setGuest: () => {
    localStorage.removeItem('hj_token')
    localStorage.removeItem('hj_member')
    localStorage.setItem(GUEST_STORAGE_KEY, 'true')
    useAuthStore.setState({
      token: null,
      member: GUEST_MEMBER,
      isAuthenticated: false,
      isGuest: true,
    })
  },

  updateMember: (member) => {
    useAuthStore.setState((state) => ({
      token: state.token,
      member,
      isAuthenticated: !!(state.token && member) && !state.isGuest,
      isGuest: state.isGuest,
    }))
    if (!useAuthStore.getState().isGuest) {
      localStorage.setItem('hj_member', JSON.stringify(member))
    }
  },

  clearAuth: () => {
    localStorage.removeItem('hj_token')
    localStorage.removeItem('hj_member')
    useAuthStore.setState({ token: null, member: null, isAuthenticated: false, isGuest: false })
  },

  clearGuest: () => {
    localStorage.removeItem(GUEST_STORAGE_KEY)
    useAuthStore.setState({ token: null, member: null, isAuthenticated: false, isGuest: false })
  },
}))
