import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { DashboardShell } from './dashboard-shell'

const navigation = vi.hoisted(() => ({ pathname: '/dashboard' }))
vi.mock('next/navigation', () => ({ usePathname: () => navigation.pathname }))

function renderShell(pathname: string) {
  navigation.pathname = pathname
  const document = createElement('article', null, 'Dokumen TPG')
  return renderToStaticMarkup(createElement(DashboardShell, {
    printContent: document,
  }, createElement('div', { className: 'h-[100dvh] overflow-hidden' },
      createElement('header', null, 'Header aplikasi'),
      createElement('aside', null, 'Sidebar aplikasi'),
      createElement('main', { className: 'overflow-y-auto' }, document),
      createElement('nav', null, 'Menu bawah aplikasi'),
    ),
  ))
}

describe('DashboardShell', () => {
  it.each([
    '/dashboard/tpg-dokumen/print-ckh',
    '/dashboard/tpg-dokumen/print-ceklis',
    '/dashboard/tpg-dokumen/print-ckh/',
  ])('renders %s without application chrome or constrained scrolling', pathname => {
    const html = renderShell(pathname)
    expect(html).toContain('Dokumen TPG')
    expect(html).not.toContain('aplikasi')
    expect(html).not.toContain('100dvh')
    expect(html).not.toContain('overflow-')
  })

  it.each(['/dashboard', '/dashboard/tpg-dokumen', '/dashboard/monitoring-agenda'])('keeps the existing dashboard for %s', pathname => {
    const html = renderShell(pathname)
    expect(html).toContain('Header aplikasi')
    expect(html).toContain('Sidebar aplikasi')
    expect(html).toContain('Menu bawah aplikasi')
    expect(html).toContain('Dokumen TPG')
    expect(html).toContain('overflow-y-auto')
  })
})
