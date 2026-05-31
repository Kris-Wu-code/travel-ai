'use client'

import { useState } from 'react'

export default function ProgressiveImg({ src, alt, style, className }: {
  src: string; alt: string; style?: React.CSSProperties; className?: string
}) {
  const [loaded, setLoaded] = useState(false)
  return (
    <div style={{ position: 'relative', overflow: 'hidden', ...style }} className={className}>
      <div className="skeleton" style={{ position: 'absolute', inset: 0 }} />
      <img
        src={src}
        alt={alt}
        onLoad={() => setLoaded(true)}
        style={{
          width: '100%', height: '100%', objectFit: 'cover', display: 'block',
          opacity: loaded ? 1 : 0, transition: 'opacity 0.4s ease',
        }}
      />
    </div>
  )
}
