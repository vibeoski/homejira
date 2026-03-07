import { create } from 'zustand'

export type Theme = 'light' | 'dark' | 'system'

interface ThemeStore {
  theme: Theme
  setTheme: (t: Theme) => void
}

const initialTheme = (localStorage.getItem('hj_theme') as Theme | null) ?? 'system'

export const useThemeStore = create<ThemeStore>((set) => ({
  theme: initialTheme,
  setTheme: (theme) => {
    localStorage.setItem('hj_theme', theme)
    set({ theme })
  },
}))

export function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return theme
}
