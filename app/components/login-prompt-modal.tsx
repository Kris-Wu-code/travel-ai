'use client'

import type { CSSProperties } from 'react'

type LoginPromptModalProps = {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export default function LoginPromptModal({
  open,
  title,
  description,
  confirmLabel = '去登录',
  cancelLabel = '先看看',
  onConfirm,
  onCancel,
}: LoginPromptModalProps) {
  if (!open) {
    return null
  }

  return (
    <div style={styles.overlay} onClick={onCancel} role="presentation">
      <div style={styles.dialog} onClick={event => event.stopPropagation()} role="dialog" aria-modal="true">
        <div style={styles.title}>{title}</div>
        <div style={styles.description}>{description}</div>
        <div style={styles.actions}>
          <button type="button" style={styles.secondaryBtn} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" style={styles.primaryBtn} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    zIndex: 1000,
  },
  dialog: {
    width: '100%',
    maxWidth: '420px',
    background: '#fff',
    borderRadius: '18px',
    padding: '24px',
    boxShadow: '0 24px 60px rgba(15, 23, 42, 0.22)',
  },
  title: {
    fontSize: '18px',
    fontWeight: 800,
    color: '#111827',
    marginBottom: '10px',
  },
  description: {
    fontSize: '14px',
    lineHeight: 1.7,
    color: '#4b5563',
  },
  actions: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'flex-end',
    marginTop: '22px',
    flexWrap: 'wrap',
  },
  secondaryBtn: {
    padding: '10px 14px',
    borderRadius: '10px',
    border: '1px solid #d1d5db',
    background: '#fff',
    color: '#374151',
    cursor: 'pointer',
    fontWeight: 600,
  },
  primaryBtn: {
    padding: '10px 14px',
    borderRadius: '10px',
    border: 'none',
    background: '#4f46e5',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 700,
  },
}