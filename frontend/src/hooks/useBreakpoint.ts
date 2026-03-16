import { useState, useEffect } from 'react'
import { DESKTOP_BREAKPOINT } from '../constants/layout'

export function useBreakpoint(minWidth = DESKTOP_BREAKPOINT): boolean {
  const [isDesktop, setIsDesktop] = useState(
    () => window.matchMedia(`(min-width: ${minWidth}px)`).matches
  )

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${minWidth}px)`)
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [minWidth])

  return isDesktop
}
