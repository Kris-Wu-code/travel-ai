'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({ theme: 'light', toggle: () => {} })

export function useTheme() { return useContext(ThemeContext) }

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    const saved = localStorage.getItem('travel-ai:theme') as Theme | null
    if (saved === 'dark' || saved === 'light') { setTheme(saved); return }
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) { setTheme('dark') }
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('travel-ai:theme', theme)
  }, [theme])

  function toggle() { setTheme(prev => prev === 'dark' ? 'light' : 'dark') }

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>
}
