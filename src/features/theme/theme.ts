import { useEffect, useLayoutEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

const THEME_STORAGE_KEY = 'guiaconcursos-theme'
const DARK_THEME_QUERY = '(prefers-color-scheme: dark)'

function readStoredTheme(): Theme | null {
  if (typeof window === 'undefined') return null

  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
    return storedTheme === 'light' || storedTheme === 'dark' ? storedTheme : null
  } catch {
    return null
  }
}

function getSystemTheme(): Theme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light'
  return window.matchMedia(DARK_THEME_QUERY).matches ? 'dark' : 'light'
}

export function getInitialTheme(): Theme {
  return readStoredTheme() ?? getSystemTheme()
}

export function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    'content',
    theme === 'dark' ? '#091215' : '#f4f6f2',
  )
}

export function initializeTheme() {
  applyTheme(getInitialTheme())
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)
  const [usesSystemPreference, setUsesSystemPreference] = useState(() => readStoredTheme() === null)

  useLayoutEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    if (!usesSystemPreference || typeof window.matchMedia !== 'function') return

    const mediaQuery = window.matchMedia(DARK_THEME_QUERY)
    const updateFromSystem = (event: MediaQueryListEvent) => {
      setTheme(event.matches ? 'dark' : 'light')
    }

    mediaQuery.addEventListener('change', updateFromSystem)
    return () => mediaQuery.removeEventListener('change', updateFromSystem)
  }, [usesSystemPreference])

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme)
    } catch {
      // The selected theme still works for the current visit when storage is unavailable.
    }

    setUsesSystemPreference(false)
    setTheme(nextTheme)
  }

  return { theme, toggleTheme }
}
