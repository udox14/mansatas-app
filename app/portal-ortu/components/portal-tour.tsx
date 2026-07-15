'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

export type PortalTourStep = {
  target: string
  title: string
  description: string
}

type PortalTourProps = {
  open: boolean
  steps: PortalTourStep[]
  onClose: () => void
  onStepChange?: (index: number, step: PortalTourStep) => void
}

type TargetRect = {
  top: number
  left: number
  width: number
  height: number
}

const PADDING = 8

function findVisibleTourTarget(targetId: string) {
  const targets = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour-id="${targetId}"]`))
  return targets.find((target) => {
    const rect = target.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0
  }) || null
}

export function PortalTour({ open, steps, onClose, onStepChange }: PortalTourProps) {
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<TargetRect | null>(null)
  const onStepChangeRef = useRef(onStepChange)

  const step = steps[index]
  const clampedIndex = Math.min(index, Math.max(steps.length - 1, 0))

  useEffect(() => {
    onStepChangeRef.current = onStepChange
  }, [onStepChange])

  useEffect(() => {
    if (open) {
      setIndex(0)
    } else {
      setRect(null)
    }
  }, [open])

  useEffect(() => {
    if (!open || !step) return
    onStepChangeRef.current?.(index, step)
  }, [index, open, step])

  useEffect(() => {
    if (!open || !step) return

    let canceled = false
    let attempts = 0

    const measure = () => {
      if (canceled) return

      const target = findVisibleTourTarget(step.target)
      if (!target) {
        attempts += 1
        if (attempts < 6) {
          window.setTimeout(measure, 90)
          return
        }
        const next = index + 1
        if (next < steps.length) setIndex(next)
        else onClose()
        return
      }

      target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
      window.setTimeout(() => {
        if (canceled) return
        const nextRect = target.getBoundingClientRect()
        setRect({
          top: nextRect.top,
          left: nextRect.left,
          width: nextRect.width,
          height: nextRect.height,
        })
      }, 180)
    }

    measure()

    const refresh = () => {
      const target = findVisibleTourTarget(step.target)
      if (!target) return
      const nextRect = target.getBoundingClientRect()
      setRect({
        top: nextRect.top,
        left: nextRect.left,
        width: nextRect.width,
        height: nextRect.height,
      })
    }

    window.addEventListener('resize', refresh)
    window.addEventListener('scroll', refresh, true)
    return () => {
      canceled = true
      window.removeEventListener('resize', refresh)
      window.removeEventListener('scroll', refresh, true)
    }
  }, [index, onClose, open, step, steps.length])

  const popoverStyle = useMemo(() => {
    if (!rect) return { left: 16, top: 96, width: 'calc(100vw - 32px)' }

    const popoverWidth = Math.min(360, window.innerWidth - 32)
    const left = Math.min(
      Math.max(16, rect.left + rect.width / 2 - popoverWidth / 2),
      window.innerWidth - popoverWidth - 16
    )
    const belowTop = rect.top + rect.height + PADDING + 14
    const aboveTop = rect.top - 220
    const top = belowTop + 210 < window.innerHeight ? belowTop : Math.max(16, aboveTop)

    return { left, top, width: popoverWidth }
  }, [rect])

  if (!open || !step || steps.length === 0) return null

  const goNext = () => {
    if (clampedIndex >= steps.length - 1) {
      onClose()
      return
    }
    setIndex((current) => current + 1)
  }

  const goPrev = () => setIndex((current) => Math.max(0, current - 1))

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      {rect && (
        <div
          className="fixed rounded-[22px] border-2 border-white bg-transparent shadow-[0_0_0_9999px_rgba(15,23,42,0.74)] transition-all duration-200"
          style={{
            top: Math.max(PADDING, rect.top - PADDING),
            left: Math.max(PADDING, rect.left - PADDING),
            width: Math.min(window.innerWidth - PADDING * 2, rect.width + PADDING * 2),
            height: Math.min(window.innerHeight - PADDING * 2, rect.height + PADDING * 2),
          }}
        />
      )}

      <div
        className="portal-dialog pointer-events-auto fixed rounded-2xl border border-[#D8D4CC] bg-[#FAF9F7] p-4 text-[#1A1A18] shadow-2xl"
        style={popoverStyle}
        role="dialog"
        aria-modal="true"
        aria-label="Panduan portal orang tua"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="whitespace-nowrap rounded-md bg-[#F2F0EC] px-2.5 py-1 text-[11px] font-semibold text-[#6B6B63]">
            {clampedIndex + 1}/{steps.length}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 whitespace-nowrap rounded-lg px-3 py-1 text-xs font-semibold text-[#6B6B63] hover:bg-[#F2F0EC] hover:text-[#1A1A18]"
          >
            Lewati
          </button>
        </div>
        <h2 className="line-clamp-2 text-base font-semibold leading-tight text-[#1A1A18]">{step.title}</h2>
        <p className="mt-2 text-sm leading-6 text-[#6B6B63]">{step.description}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={goPrev}
            disabled={clampedIndex === 0}
            className="h-11 whitespace-nowrap rounded-lg border border-[#D8D4CC] bg-white px-3 text-sm font-semibold text-[#1A1A18] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Sebelumnya
          </button>
          <button
            type="button"
            onClick={goNext}
            className="h-11 whitespace-nowrap rounded-lg bg-[#C2522D] px-4 text-sm font-semibold text-white hover:bg-[#A8421F]"
          >
            {clampedIndex >= steps.length - 1 ? 'Selesai' : 'Lanjut'}
          </button>
        </div>
      </div>
    </div>
  )
}
