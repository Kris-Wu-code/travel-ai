'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

type Slide = {
  id: string
  title: string
  subtitle: string
  href: string
  image: string
}

export default function HeroCarousel({ slides, banner }: { slides: Slide[]; banner?: string }) {
  const [current, setCurrent] = useState(0)
  const [paused, setPaused] = useState(false)
  const [fading, setFading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (paused || slides.length <= 1) return
    timerRef.current = setInterval(() => {
      setFading(true)
      setTimeout(() => {
        setCurrent(prev => (prev + 1) % slides.length)
        setFading(false)
      }, 400)
    }, 5000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [paused, slides.length])

  function goTo(index: number) {
    if (index === current) return
    setFading(true)
    setTimeout(() => { setCurrent(index); setFading(false) }, 400)
  }

  if (slides.length === 0) return null

  const slide = slides[current]

  return (
    <div
      className="carousel-hero"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {banner ? <div className="carousel-banner">{banner}</div> : null}

      {/* Dots */}
      <div className="carousel-dots">
        {slides.map((_, i) => (
          <button key={i} type="button"
            className={i === current ? 'carousel-dot active' : 'carousel-dot'}
            onClick={() => goTo(i)}
            aria-label={`切换到第 ${i + 1} 张`}
          />
        ))}
      </div>

      {/* Slide */}
      <Link
        href={slide.href}
        className="carousel-slide"
        style={{ opacity: fading ? 0 : 1, transform: fading ? 'scale(1.04)' : 'scale(1)' }}
      >
        <div className="carousel-slide-bg" style={{ backgroundImage: `url(${slide.image})` }} />
        <div className="carousel-slide-content">
          <h2>{slide.title}</h2>
          <p>{slide.subtitle}</p>
        </div>
      </Link>

      {/* Arrows */}
      {slides.length > 1 ? (
        <>
          <button type="button" className="carousel-arrow left"
            onClick={() => goTo((current - 1 + slides.length) % slides.length)} aria-label="上一张">‹</button>
          <button type="button" className="carousel-arrow right"
            onClick={() => goTo((current + 1) % slides.length)} aria-label="下一张">›</button>
        </>
      ) : null}
    </div>
  )
}
