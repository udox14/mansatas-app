'use client'

import { useLayoutEffect, useRef } from 'react'

/** Measure the actual font and available width, rather than truncating names. */
export function FittedUserName({ name }: { name: string }) {
  const heading = useRef<HTMLHeadingElement>(null)
  const text = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const element = heading.current
    const label = text.current
    if (!element || !label) return
    let disposed = false
    function fit() {
      if (disposed || !element || !label) return
      element.style.fontSize = ''
      const base = parseFloat(getComputedStyle(element).fontSize)
      const available = element.clientWidth
      const needed = label.getBoundingClientRect().width
      if (available > 0 && needed > available) element.style.fontSize = `${Math.floor(base * available / needed * 100) / 100}px`
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(element)
    document.fonts?.ready.then(fit)
    return () => { disposed = true; observer.disconnect() }
  }, [name])
  return <h1 ref={heading} className="w-full min-w-0 whitespace-nowrap text-2xl font-bold leading-tight tracking-tight sm:text-3xl"><span ref={text} className="inline-block whitespace-nowrap">{name}</span></h1>
}
