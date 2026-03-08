import { create } from 'zustand'
import { client } from '../api/client'

interface ConfigStore {
  flags: Record<string, boolean>
  loaded: boolean
  fetchConfig: () => Promise<void>
}

export const useConfigStore = create<ConfigStore>((set) => ({
  flags: {},
  loaded: false,
  fetchConfig: async () => {
    try {
      const { data } = await client.get('/config')
      set({ flags: data.flags ?? {}, loaded: true })
    } catch {
      // fail silently — features default to disabled
      set({ loaded: true })
    }
  },
}))

export const isFeatureEnabled = (flags: Record<string, boolean>, key: string) =>
  flags[key] === true
