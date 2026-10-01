'use client'

import { createElement, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'

const TPG_PRINT_PATHS = new Set([
  '/dashboard/tpg-dokumen/print-ckh',
  '/dashboard/tpg-dokumen/print-ceklis',
])

export function DashboardShell({ children, printContent }: { children?: ReactNode; printContent: ReactNode }) {
  const pathname = usePathname()

  // Keep the authenticated server layout, but omit dashboard navigation and
  // fixed-height scroll containers from both the preview and native print HTML.
  if (TPG_PRINT_PATHS.has(pathname.replace(/\/$/, ''))) {
    return createElement('div', { className: 'bg-white text-black' }, printContent)
  }

  return children
}
