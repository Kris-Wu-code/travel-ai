'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import GlobalSearch from './global-search'

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
  contentMaxWidth = '1100px',
}: PageShellProps) {
  return (
    <div className="page-shell">
      <header className="page-shell-top">
        <div className="page-shell-top-left">
          <Link href={backHref} className="page-shell-back">
            ← 返回
          </Link>
          <div>
            <h1 className="page-shell-title">{title}</h1>
            {subtitle ? <p className="page-shell-subtitle">{subtitle}</p> : null}
          </div>
        </div>

        <div className="page-shell-top-right">
          <GlobalSearch className="page-shell-search" />
          {actions ? <div className="page-shell-actions">{actions}</div> : null}
        </div>
      </header>

      <main className="page-shell-content" style={{ maxWidth: contentMaxWidth }}>
        {children}
      </main>
    </div>
  )
}
