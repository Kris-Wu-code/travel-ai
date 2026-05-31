'use client'

import ThemeProvider, { useTheme } from './theme-provider'
import { ToastProvider } from './toast'

function ThemeToggle() {
  const { theme, toggle } = useTheme()
  return (
    <button type="button" onClick={toggle}
      title={theme === 'dark' ? '切换亮色模式' : '切换暗色模式'}
      style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 9999, width: '40px', height: '40px', borderRadius: '50%', border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--foreground)', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  )
}

export default function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <div className="page-enter">{children}</div>
        <ThemeToggle />
      </ToastProvider>
    </ThemeProvider>
  )
}
