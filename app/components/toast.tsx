'use client'

import { createContext, useCallback, useContext, useState } from 'react'

type Toast = { id: number; message: string; type: 'success' | 'error' | 'info' }
type ToastCtx = { toast: (msg: string, type?: Toast['type']) => void }

const ToastContext = createContext<ToastCtx>({ toast: () => {} })
export const useToast = () => useContext(ToastContext)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  let nextId = 0

  const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = nextId++
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000)
  }, [])

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 99999, display: 'flex', flexDirection: 'column', gap: '8px', pointerEvents: 'none' }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            padding: '12px 20px', borderRadius: '12px', fontSize: '14px', fontWeight: 600,
            color: '#fff', boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            animation: 'toast-in 0.3s ease, toast-out 0.3s ease 2.7s forwards',
            background: t.type === 'success' ? '#059669' : t.type === 'error' ? '#dc2626' : '#4f46e5',
          }}>{t.message}</div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
