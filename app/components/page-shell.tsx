'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'

type PageShellProps = {
  backHref: string
  title: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
  contentMaxWidth?: string
}

export default function PageShell({
  backHref,
  title,
  subtitle,
  actions,
  children,
  contentMaxWidth = '900px',
}: PageShellProps) {
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <Link href={backHref} style={styles.back}>
          ← 返回
        </Link>
        <div style={styles.headerMain}>
          <h1 style={styles.title}>{title}</h1>
          {subtitle ? <p style={styles.subtitle}>{subtitle}</p> : null}
        </div>
        {actions ? <div style={styles.actions}>{actions}</div> : null}
      </div>

      <div style={{ ...styles.content, maxWidth: contentMaxWidth }}>
        {children}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    background: '#f5f7fa',
    fontFamily: 'system-ui, sans-serif',
  },
  header: {
    background: '#fff',
    padding: '0 32px',
    minHeight: '64px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  back: {
    background: 'none',
    border: 'none',
    fontSize: '15px',
    color: '#4f46e5',
    cursor: 'pointer',
    padding: '0',
    fontWeight: '500',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
  },
  headerMain: {
    minWidth: 0,
  },
  title: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1a1a2e',
    margin: 0,
  },
  subtitle: {
    margin: '4px 0 0',
    color: '#6b7280',
    fontSize: '14px',
  },
  actions: {
    marginLeft: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  content: {
    margin: '0 auto',
    padding: '40px 24px',
  },
}