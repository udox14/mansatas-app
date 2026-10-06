import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './route'

const state = vi.hoisted(() => ({ finalStage: null as string | null, status: 'disetujui',
  stages: ['bendahara', 'ketua', 'kepala'], render: vi.fn() }))
vi.mock('@cloudflare/puppeteer', () => ({ default: { launch: vi.fn() } }))
vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext: async () => ({ env: {} }) }))
vi.mock('@/utils/auth/server', () => ({ getCurrentUser: async () => ({ id: 'reader' }) }))
vi.mock('@/lib/features', () => ({ getUserRoles: async () => ['super_admin'] }))
vi.mock('@/lib/komite-pengajuan', async importOriginal => ({ ...await importOriginal<object>(),
  ensureKomitePengajuanSchema: async () => undefined, canViewKomitePengajuan: async () => true }))
vi.mock('@/lib/pdf-cache', () => ({ renderPdfWithCache: state.render }))
vi.mock('@/utils/db-server', () => ({ getDB: async () => ({ prepare(sql: string) {
  return { bind() { return this }, async first() { return { id: 'p1', pengaju_id: 'applicant', current_version: 1,
    status: state.status, final_approval_stage: state.finalStage, nominal: 100000, nomor_spb: '001/SPB',
    approved_at: '2026-10-06 02:00:00' } },
  async all() { return { results: sql.includes('komite_pengajuan_reviews') ? state.stages.map(stage => ({
    stage, actor_name: stage, actor_role: stage, created_at: '2026-10-06 02:00:00', is_super_admin_bypass: 0,
  })) : [{ urutan: 1, uraian: 'Kegiatan', penerima_penyedia: 'Penyedia', jumlah: 100000 }] } } }
} }) }))

beforeEach(() => {
  state.finalStage = null; state.status = 'disetujui'; state.stages = ['bendahara', 'ketua', 'kepala']
  state.render.mockReset().mockResolvedValue(new Uint8Array([37, 80, 68, 70]))
})
const request = () => GET(new Request('https://example.test/api/komite/pengajuan/p1/spb'), { params: Promise.resolve({ id: 'p1' }) })

describe('Komite SPB approval requirements and signatories', () => {
  it('issues a two-party SPB after chairman approval without requiring a principal review', async () => {
    state.finalStage = 'ketua'; state.stages = ['bendahara', 'ketua']
    expect((await request()).status).toBe(200)
    const html = state.render.mock.calls[0][0].html
    expect(html).toContain('grid-template-columns:repeat(2,1fr)')
    expect(html).toContain('Ketua Komite Sekolah')
    expect(html).toContain('Bendahara Komite')
    expect(html).not.toContain('Kepala Madrasah')
  })
  it.each(['kepala', null])('keeps the three-party SPB for final stage %s', async finalStage => {
    state.finalStage = finalStage
    expect((await request()).status).toBe(200)
    expect(state.render.mock.calls[0][0].html).toContain('grid-template-columns:repeat(3,1fr)')
    expect(state.render.mock.calls[0][0].html).toContain('Kepala Madrasah')
  })
  it.each(['kepala', null])('does not bypass missing principal approval for final stage %s', async finalStage => {
    state.finalStage = finalStage; state.stages = ['bendahara', 'ketua']
    expect((await request()).status).toBe(409)
    expect(state.render).not.toHaveBeenCalled()
  })
  it('requires both mandatory reviews even in the two-stage workflow', async () => {
    state.finalStage = 'ketua'; state.stages = ['ketua']
    expect((await request()).status).toBe(409)
  })
  it('does not expose the SPB before final approval', async () => {
    state.status = 'menunggu_kepala'
    expect((await request()).status).toBe(409)
  })
})
