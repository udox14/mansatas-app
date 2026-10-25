import { readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MENU_ITEMS } from '@/config/menu'
import { buildDashboardGuideSteps, getDashboardGuide } from '@/lib/dashboard-guide'

function collectPageRoutes(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return collectPageRoutes(path)
    return entry.name === 'page.tsx' ? [path] : []
  })
}

describe('dashboard contextual guide', () => {
  it('provides a guide for the dashboard home', () => {
    expect(getDashboardGuide('/dashboard')).toMatchObject({
      id: 'dashboard',
      title: 'Dashboard',
    })
  })

  it('provides a guide for every staff menu feature', () => {
    const staffFeatures = MENU_ITEMS.filter(item => item.href.startsWith('/dashboard/'))

    for (const feature of staffFeatures) {
      expect(getDashboardGuide(feature.href).id).toBe(feature.id)
    }
  })

  it('resolves a non-empty guide for every current dashboard route', () => {
    const routeFiles = collectPageRoutes(join(process.cwd(), 'app', 'dashboard'))

    expect(routeFiles.length).toBeGreaterThan(0)
    for (const file of routeFiles) {
      const path = relative(join(process.cwd(), 'app', 'dashboard'), file)
        .replace(/\\/g, '/')
        .replace(/(^|\/)page\.tsx$/, '')
        .replace(/\[[^\]]+\]/g, 'sample-id')
      const route = `/dashboard${path ? `/${path}` : ''}`
      const guide = getDashboardGuide(route)

      expect(guide.title.trim(), route).not.toBe('')
      expect(guide.description.trim(), route).not.toBe('')
    }
  })

  it('resolves nested and dynamic pages to their nearest module', () => {
    expect(getDashboardGuide('/dashboard/siswa/123/full-report').id).toBe('siswa')
    expect(getDashboardGuide('/dashboard/kelas/kelas-12').id).toBe('kelas')
    expect(getDashboardGuide('/dashboard/keuangan/dspt/nonaktif').id).toBe('keuangan-dspt-nonaktif')
  })

  it('keeps a fallback guide for dashboard routes without a menu item', () => {
    expect(getDashboardGuide('/dashboard/keuangan').title).toBeTruthy()
    expect(getDashboardGuide('/dashboard/route-baru').description).toContain('Route Baru')
  })

  it('includes only steps with visible targets and uses the current page title', () => {
    const guide = getDashboardGuide('/dashboard/agenda')
    const steps = buildDashboardGuideSteps(guide, 'Agenda Mengajar', new Set(['page-title', 'tabs', 'results']))

    expect(steps.map(step => step.target)).toEqual(['page-title', 'tabs', 'results'])
    expect(steps[0]).toMatchObject({
      title: 'Agenda Mengajar',
      description: guide.description,
    })
  })

  it('falls back to the page content when no specific target is available', () => {
    const steps = buildDashboardGuideSteps(getDashboardGuide('/dashboard/agenda'), 'Agenda Mengajar', new Set())

    expect(steps).toHaveLength(1)
    expect(steps[0].target).toBe('page-content')
  })

  it('builds tab-specific steps that can activate the matching panel', () => {
    const guide = getDashboardGuide('/dashboard/agenda')
    const steps = buildDashboardGuideSteps(
      guide,
      'Agenda Mengajar',
      new Set(['page-title', 'tabs', 'tab-content']),
      [
        { target: 'tab-content', title: 'Tab Mengajar', description: 'Bagian mengajar.', activateTabControlsId: 'tab-mengajar' },
        { target: 'tab-content', title: 'Tab Riwayat', description: 'Bagian riwayat.', activateTabControlsId: 'tab-riwayat' },
      ],
    )

    expect(steps.map(step => step.title)).toEqual(['Agenda Mengajar', 'Bagian halaman', 'Tab Mengajar', 'Tab Riwayat', 'Isi bagian aktif'])
    expect(steps[2].activateTabControlsId).toBe('tab-mengajar')
  })
})
