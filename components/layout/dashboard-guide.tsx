'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { CircleHelp } from 'lucide-react'
import {
  buildDashboardGuideSteps,
  getDashboardGuide,
  type DashboardGuide,
  type DashboardGuideStep,
  type DashboardGuideTarget,
} from '@/lib/dashboard-guide'

type TargetRect = { top: number; left: number; width: number; height: number }

const PADDING = 8
const GuideContext = createContext<(() => void) | null>(null)

function isVisible(element: HTMLElement | null): element is HTMLElement {
  if (!element || element.closest('[hidden], [aria-hidden="true"]')) return false
  const rect = element.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return false
  const style = window.getComputedStyle(element)
  return style.display !== 'none' && style.visibility !== 'hidden'
}

function getGuideScope() {
  const dashboardMain = document.getElementById('dashboard-main')
  if (dashboardMain) return dashboardMain
  return document.querySelector('main')?.parentElement as HTMLElement | null || document.body
}

function findFirstVisible(scope: HTMLElement, selectors: string[]) {
  for (const selector of selectors) {
    const element = Array.from(scope.querySelectorAll<HTMLElement>(selector)).find(isVisible)
    if (element) return element
  }
  return null
}

function findFilterTarget(scope: HTMLElement) {
  const marked = findFirstVisible(scope, ['[data-dashboard-guide-target="filters"]'])
  if (marked) return marked

  const controls = Array.from(scope.querySelectorAll<HTMLElement>('input, select, [role="combobox"]'))
  for (const control of controls) {
    if (!isVisible(control) || control instanceof HTMLInputElement && control.type === 'hidden') continue
    const input = control as HTMLInputElement
    const labelText = input.labels ? Array.from(input.labels).map(label => label.textContent || '').join(' ') : ''
    const hint = [input.placeholder, input.getAttribute('aria-label'), input.getAttribute('name'), labelText]
      .filter(Boolean)
      .join(' ')
    const looksLikeFilter = control.tagName === 'SELECT'
      || control.getAttribute('role') === 'combobox'
      || input.type === 'search'
      || /cari|filter|kelas|siswa|tanggal|periode|status|kategori|tahun ajaran/i.test(hint)
    if (!looksLikeFilter) continue
    return control.closest('label') || control.parentElement || control
  }
  return null
}

function findGuideTarget(scope: HTMLElement, target: DashboardGuideTarget) {
  const targets: Record<DashboardGuideTarget, string[]> = {
    'page-title': ['[data-dashboard-guide-target="page-title"]', 'h1'],
    'page-content': ['[data-dashboard-guide-target="page-content"]', '.dashboard-page-content > *', '#dashboard-main > *'],
    tabs: ['[data-dashboard-guide-target="tabs"]', '[role="tablist"]'],
    'tab-content': ['[data-dashboard-guide-target="tab-content"]', '[role="tabpanel"]'],
    filters: [],
    results: [
      '[data-dashboard-guide-target="results"]',
      'table',
      '[role="grid"]',
      '[role="table"]',
      '.recharts-wrapper',
      'canvas',
      'section[aria-label]',
      'main section',
    ],
    actions: ['[data-dashboard-guide-target="actions"]'],
    'dashboard-favorites': ['[data-dashboard-guide-target="dashboard-favorites"]'],
    'dashboard-widgets': ['[data-dashboard-guide-target="dashboard-widgets"]'],
  }

  if (target === 'filters') return findFilterTarget(scope)
  return findFirstVisible(scope, targets[target])
}

function getPageTitle(scope: HTMLElement, guide: DashboardGuide) {
  const titleTarget = findGuideTarget(scope, 'page-title')
  const heading = titleTarget?.querySelector('h1, h2')
  const text = heading?.textContent?.trim() || titleTarget?.dataset.dashboardGuideTitle?.trim()
  return text || guide.title
}

function measure(element: HTMLElement): TargetRect {
  const rect = element.getBoundingClientRect()
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
}

function getPopoverStyle(rect: TargetRect | null): CSSProperties {
  if (typeof window === 'undefined' || !rect) return { left: 16, top: 88, width: 'calc(100vw - 32px)' }

  const popoverWidth = Math.min(360, window.innerWidth - 32)
  const left = Math.min(
    Math.max(16, rect.left + rect.width / 2 - popoverWidth / 2),
    window.innerWidth - popoverWidth - 16,
  )
  const belowTop = rect.top + rect.height + PADDING + 14
  const aboveTop = rect.top - 220
  const top = belowTop + 210 < window.innerHeight ? belowTop : Math.max(16, aboveTop)
  return { left, top, width: popoverWidth }
}

function DashboardGuideOverlay({
  open,
  guide,
  onClose,
}: {
  open: boolean
  guide: DashboardGuide
  onClose: () => void
}) {
  const [steps, setSteps] = useState<DashboardGuideStep[]>([])
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<TargetRect | null>(null)
  const step = steps[index]
  const clampedIndex = Math.min(index, Math.max(steps.length - 1, 0))

  useEffect(() => {
    if (!open) return

    let canceled = false
    const timer = window.setTimeout(() => {
      if (canceled) return
      const scope = getGuideScope()
      if (!scope) return
      const availableTargets = new Set<DashboardGuideTarget>()
      const candidates: DashboardGuideTarget[] = [
        'page-title', 'page-content', 'tabs', 'filters', 'tab-content', 'results', 'actions',
        'dashboard-favorites', 'dashboard-widgets',
      ]
      for (const target of candidates) {
        if (findGuideTarget(scope, target)) availableTargets.add(target)
      }

      const tabSteps: DashboardGuideStep[] = Array.from(
        scope.querySelectorAll<HTMLElement>('[role="tab"][aria-controls]'),
      )
        .filter(tab => isVisible(tab) && tab.getAttribute('aria-disabled') !== 'true')
        .map(tab => {
          const label = tab.textContent?.trim() || 'Bagian halaman'
          return {
            target: 'tab-content',
            title: `Tab ${label}`,
            description: `Bagian ini menampilkan informasi dan alur pada tab ${label}. Tour memilih tab ini agar isi terkait dapat Anda kenali.`,
            activateTabControlsId: tab.getAttribute('aria-controls') || undefined,
          }
        })

      const nextSteps = buildDashboardGuideSteps(guide, getPageTitle(scope, guide), availableTargets, tabSteps)
      setSteps(nextSteps)
      setIndex(0)
    }, 0)
    return () => {
      canceled = true
      window.clearTimeout(timer)
    }
  }, [guide, open])

  useEffect(() => {
    if (!open || !step) return
    let canceled = false
    let attempts = 0
    let timeoutId = 0

    const refresh = (scrollIntoView = false) => {
      if (canceled) return
      const scope = getGuideScope()
      if (step.activateTabControlsId && scope) {
        const tab = Array.from(scope.querySelectorAll<HTMLElement>('[role="tab"][aria-controls]'))
          .find(item => item.getAttribute('aria-controls') === step.activateTabControlsId)
        if (tab && tab.getAttribute('aria-selected') !== 'true') {
          tab.click()
          timeoutId = window.setTimeout(() => refresh(true), 80)
          return
        }
      }
      const target = scope ? findGuideTarget(scope, step.target) : null
      if (!target) {
        attempts += 1
        if (attempts < 6) timeoutId = window.setTimeout(() => refresh(false), 90)
        else if (index < steps.length - 1) setIndex(current => current + 1)
        else onClose()
        return
      }
      if (scrollIntoView) target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
      window.setTimeout(() => {
        if (!canceled) setRect(measure(target))
      }, scrollIntoView ? 180 : 0)
    }

    refresh(true)
    const scope = getGuideScope()
    const refreshPosition = () => refresh(false)
    window.addEventListener('resize', refreshPosition)
    window.addEventListener('scroll', refreshPosition, true)
    scope?.addEventListener('scroll', refreshPosition, true)
    const observer = scope ? new MutationObserver(refreshPosition) : null
    if (scope && observer) observer.observe(scope, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'aria-hidden'] })
    return () => {
      canceled = true
      window.clearTimeout(timeoutId)
      window.removeEventListener('resize', refreshPosition)
      window.removeEventListener('scroll', refreshPosition, true)
      scope?.removeEventListener('scroll', refreshPosition, true)
      observer?.disconnect()
    }
  }, [index, onClose, open, step, steps.length])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, open])

  if (!open || !step || steps.length === 0) return null

  const goNext = () => {
    if (clampedIndex >= steps.length - 1) onClose()
    else setIndex(current => current + 1)
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[100] print:hidden">
      {rect && (
        <div
          className="fixed rounded-xl border-2 border-white bg-transparent shadow-[0_0_0_9999px_rgba(15,23,42,0.72)] transition-all duration-200"
          style={{
            top: Math.max(PADDING, rect.top - PADDING),
            left: Math.max(PADDING, rect.left - PADDING),
            width: Math.min(window.innerWidth - PADDING * 2, rect.width + PADDING * 2),
            height: Math.min(window.innerHeight - PADDING * 2, rect.height + PADDING * 2),
          }}
        />
      )}

      <div
        className="pointer-events-auto fixed rounded-xl border border-slate-200 bg-white p-4 text-slate-900 shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        style={getPopoverStyle(rect)}
        role="dialog"
        aria-modal="true"
        aria-label={`Panduan ${guide.title}`}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
            {clampedIndex + 1}/{steps.length}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 rounded-lg px-3 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            Lewati
          </button>
        </div>
        <h2 className="text-base font-semibold leading-tight">{step.title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{step.description}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setIndex(current => Math.max(0, current - 1))}
            disabled={clampedIndex === 0}
            className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-200"
          >
            Sebelumnya
          </button>
          <button
            type="button"
            onClick={goNext}
            className="min-h-10 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            {clampedIndex >= steps.length - 1 ? 'Selesai' : 'Lanjut'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function DashboardGuideProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '/dashboard'
  const guide = useMemo(() => getDashboardGuide(pathname), [pathname])
  const [openPath, setOpenPath] = useState<string | null>(null)
  const [openNonce, setOpenNonce] = useState(0)
  const open = openPath === pathname
  const closeGuide = useCallback(() => setOpenPath(null), [])
  const openGuide = useCallback(() => {
    setOpenPath(pathname)
    setOpenNonce(current => current + 1)
  }, [pathname])

  useEffect(() => {
    if (!openPath || openPath === pathname) return
    const timer = window.setTimeout(() => setOpenPath(null), 0)
    return () => window.clearTimeout(timer)
  }, [openPath, pathname])

  return (
    <GuideContext.Provider value={openGuide}>
      {children}
      <DashboardGuideOverlay key={`${pathname}:${openNonce}`} open={open} guide={guide} onClose={closeGuide} />
    </GuideContext.Provider>
  )
}

export function DashboardGuideButton({ variant = 'header' }: { variant?: 'header' | 'hero' }) {
  const openGuide = useContext(GuideContext)
  const className = variant === 'hero'
    ? 'dashboard-icon-button drop-shadow-md'
    : 'flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'

  return (
    <button
      type="button"
      onClick={() => openGuide?.()}
      className={className}
      aria-label="Buka panduan halaman"
      title="Panduan halaman"
    >
      <CircleHelp className={variant === 'hero' ? 'h-5 w-5' : 'h-4 w-4'} />
    </button>
  )
}
