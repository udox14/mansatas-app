'use client'

import { useLayoutEffect, useRef } from 'react'

export function RunningText({ text }: { text: string }) {
  const container = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLParagraphElement>(null)
  useLayoutEffect(() => {
    const viewport = container.current
    const label = content.current
    if (!viewport || !label) return
    let disposed = false
    function measure() {
      if (disposed || !viewport || !label) return
      const start = viewport.clientWidth
      const end = label.scrollWidth
      viewport.style.setProperty('--announcement-start', `${start}px`)
      viewport.style.setProperty('--announcement-end', `${-end}px`)
      viewport.style.setProperty('--announcement-duration', `${(start + end) / 40}s`)
      viewport.dataset.ready = 'true'
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(viewport)
    observer.observe(label)
    document.fonts?.ready.then(measure)
    return () => { disposed = true; observer.disconnect() }
  }, [text])
  return <div ref={container} className="dashboard-announcement min-w-0 flex-1 overflow-hidden"><p ref={content} className="dashboard-announcement-text w-max whitespace-nowrap font-medium">{text}</p></div>
}
