import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ roles: ['admin_tu'], access: true, getSignature: vi.fn(), queries: [] as string[] }))
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`) } }))
vi.mock('@/utils/auth/server', () => ({ getCurrentUser: async () => ({ id: 'tu' }) }))
vi.mock('@/lib/features', () => ({ getUserRoles: async () => state.roles, checkFeatureAccess: async () => state.access }))
vi.mock('@/lib/tpg-schema', () => ({ ensureTpgSchema: vi.fn() }))
vi.mock('@/lib/system-settings', () => ({
  SYSTEM_SETTING_KEYS: { ckhKepalaSignatureUrl: 'ckh_kepala_signature_url' },
  getSystemSetting: state.getSignature,
}))
vi.mock('./print-toolbar', () => ({ PrintToolbar: () => null }))
vi.mock('@/utils/db-server', () => ({ getDB: async () => ({
  prepare: (sql: string) => {
    state.queries.push(sql)
    const statement = {
      bind: () => statement,
      first: async () => ({ nama_lengkap: 'Kepala', nip: '123', jabatan_cetak: 'Kepala Madrasah' }),
      all: async () => ({ results: sql.includes('FROM ckh_documents d') ? [{
        id: 'guru', nama_lengkap: 'Guru', role: 'guru', roles: 'guru', nip: '456',
        jabatan_cetak: 'Guru Mata Pelajaran', pangkat_golongan: 'III/a', document_id: 'doc',
        signature_url: '/guru.png', signature_enabled: 1,
        signature_x_mm: 14, signature_y_mm: 12, signature_width_mm: 38,
      }] : [{
        id: 'row', document_id: 'doc', tanggal: '2026-09-01', kegiatan_bulanan: 'Mengajar',
        catatan_harian: 'Matematika', vol: 1, satuan: 'Kegiatan',
      }] }),
    }
    return statement
  },
}) }))

import PrintCkhPage from './page'

async function print(params: Record<string, string> = {}) {
  return renderToStaticMarkup(await PrintCkhPage({
    searchParams: Promise.resolve({ year: '2026', month: '9', users: 'guru', ...params }),
  }))
}

beforeEach(() => {
  vi.stubGlobal('React', React)
  state.roles = ['admin_tu']
  state.access = true
  state.queries = []
  state.getSignature.mockReset().mockResolvedValue('/kepala.png')
})

describe('Dokumen TPG kepala signature printing', () => {
  it('keeps kepala signature off by default and retains the teacher signature', async () => {
    const html = await print()
    expect(html).not.toContain('src="/kepala.png"')
    expect(html).toContain('src="/guru.png"')
    expect(state.getSignature).not.toHaveBeenCalled()
  })

  it.each(['admin_tu', 'super_admin'])('prints the shared signature with position and size for %s', async role => {
    state.roles = [role]
    const html = await print({ kepalaSignature: '1', kepalaX: '20', kepalaY: '15', kepalaWidth: '45' })
    expect(html).toContain('src="/kepala.png"')
    expect(html).toContain('left:20mm;top:15mm;width:45mm')
    expect(state.queries.find(sql => sql.includes('FROM ckh_documents d'))).toContain("d.status = 'FINAL'")
    expect(state.queries.some(sql => /UPDATE|INSERT|DELETE/.test(sql))).toBe(false)
  })

  it('does not render an image when the shared file is missing', async () => {
    state.getSignature.mockResolvedValue('')
    expect(await print({ kepalaSignature: '1' })).not.toContain('src="/kepala.png"')
  })

  it('respects an explicit disabled choice', async () => {
    expect(await print({ kepalaSignature: '0' })).not.toContain('src="/kepala.png"')
    expect(state.getSignature).not.toHaveBeenCalled()
  })

  it('denies printing when Dokumen TPG access is revoked', async () => {
    state.access = false
    await expect(print({ kepalaSignature: '1' })).rejects.toThrow('redirect:/dashboard')
    expect(state.getSignature).not.toHaveBeenCalled()
  })

  it('bounds print values on the server', async () => {
    const html = await print({ kepalaSignature: '1', kepalaX: '9999', kepalaY: '-9999', kepalaWidth: 'Infinity' })
    expect(html).toContain('left:80mm;top:-20mm;width:38mm')
  })

  it.each(['guru', 'kepsek', 'operator'])('rejects %s even with signature parameters', async role => {
    state.roles = [role]
    await expect(print({ kepalaSignature: '1' })).rejects.toThrow('redirect:/dashboard')
    expect(state.getSignature).not.toHaveBeenCalled()
    expect(state.queries).toHaveLength(0)
  })
})
