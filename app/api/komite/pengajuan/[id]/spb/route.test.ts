import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import puppeteer from '@cloudflare/puppeteer'
import { GET } from './route'

const state = vi.hoisted(() => ({ finalStage: null as string | null, status: 'disetujui', flow: 1, chairman: 'Ketua Snapshot',
  realized: false, approvedAt: '2026-10-06 02:00:00', useAssets: true, assets: vi.fn(),
  stages: ['bendahara', 'ketua', 'kepala'], render: vi.fn() }))
vi.mock('@cloudflare/puppeteer', () => ({ default: { launch: vi.fn() } }))
vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext: async () => ({ env: {
  STATIC_ASSETS: state.useAssets ? { fetch: state.assets } : undefined,
} }) }))
vi.mock('@/utils/auth/server', () => ({ getCurrentUser: async () => ({ id: 'reader' }) }))
vi.mock('@/lib/features', () => ({ getUserRoles: async () => ['super_admin'] }))
vi.mock('@/lib/komite-pengajuan', async importOriginal => ({ ...await importOriginal<object>(),
  ensureKomitePengajuanSchema: async () => undefined, canViewKomitePengajuan: async () => true }))
vi.mock('@/lib/pdf-cache', () => ({ renderPdfWithCache: state.render }))
vi.mock('@/utils/db-server', () => ({ getDB: async () => ({ prepare(sql: string) {
  return { bind() { return this }, async first() { return { id: 'p1', pengaju_id: 'applicant', current_version: 1,
    status: state.status, workflow_version: state.flow, chairman_name_snapshot: state.chairman, final_approval_stage: state.finalStage, nominal: 100000, nomor_spb: '001/SPB',
    approved_at: state.approvedAt, judul: 'Kegiatan', penerima_pembayaran: 'Penyedia',
    realisasi_status: state.realized ? 'sudah' : 'belum', realisasi_tanggal: state.realized ? '2026-11-03' : null,
    realisasi_metode: state.realized ? 'Transfer' : null, realisasi_petugas: state.realized ? 'Bendahara Pembayar' : null } },
  async all() { return { results: sql.includes('komite_pengajuan_reviews') ? state.stages.map(stage => ({
    stage, workflow_version: state.flow, actor_name: stage, actor_role: stage, created_at: state.approvedAt, is_super_admin_bypass: 0,
  })) : [{ urutan: 1, uraian: 'Kegiatan', penerima_penyedia: 'Penyedia', jumlah: 100000 }] } } }
} }) }))

beforeEach(() => {
  state.realized=false; state.flow=1; state.chairman='Ketua Snapshot'; state.finalStage = null; state.status = 'disetujui'; state.stages = ['bendahara', 'ketua', 'kepala']
  state.approvedAt = '2026-10-06 02:00:00'; state.useAssets = true
  state.assets.mockReset().mockImplementation(async () => new Response(letterheadPng))
  state.render.mockReset().mockResolvedValue(new Uint8Array([37, 80, 68, 70]))
  vi.stubGlobal('fetch', vi.fn())
  vi.mocked(puppeteer.launch).mockReset()
})
afterEach(() => vi.unstubAllGlobals())
const letterheadPng = readFileSync(new URL('../../../../../../public/kopkomite.png', import.meta.url))
const request = () => GET(new Request('https://example.test/api/komite/pengajuan/p1/spb'), { params: Promise.resolve({ id: 'p1' }) })

describe('Komite SPB approval requirements and signatories', () => {
  it('prints new SPB signatories in verifier, chairman, treasurer order with an unlabeled receipt page', async () => {
    state.flow=2; state.finalStage='ketua'; state.stages=['bendahara','ketua']
    expect((await request()).status).toBe(200)
    const html=state.render.mock.calls[0][0].html as string
    const approval=html.slice(html.indexOf('<div class="approval">'))
    expect(approval.indexOf('Verifikator')).toBeLessThan(approval.indexOf('Ketua Snapshot'))
    expect(approval.indexOf('Ketua Snapshot')).toBeLessThan(approval.indexOf('Lunas Bayar'))
    expect(html).toContain('Mengetahui,')
    expect(html).toContain('Menyetujui,')
    expect(html).toContain('Bukti Tanda Terima/Realisasi')
    expect(html).not.toContain('DRAFT')
    expect(html).toContain('Tunai / Transfer: ................................')
    expect(html).not.toContain('BELUM DIREALISASIKAN')
    expect(html.match(/<section class="page">/g)).toHaveLength(2)
    expect(html).not.toContain('break-after:page')
  })
  it('prints recorded realization data without changing approval requirements', async () => {
    state.realized=true
    expect((await request()).status).toBe(200)
    const html=state.render.mock.calls[0][0].html as string
    expect(html).toContain('Telah diterima dana Transfer')
    expect(html).toContain('3 November 2026')
    expect(html).toContain('Bendahara Pembayar')
    expect(html).not.toContain('DRAFT')
    expect(html).not.toContain('BELUM DIREALISASIKAN')
    expect(html).toContain('.page + .page{break-before:page;page-break-before:always}')
  })
  it('does not print new SPB without the chairman snapshot', async () => {
    state.flow=2; state.chairman=''; state.finalStage='ketua'; state.stages=['bendahara','ketua']
    expect((await request()).status).toBe(409)
  })
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

describe('Komite SPB letterhead', () => {
  it.each(['2026-01-06', '2026-07-06', '2026-09-30', '2026-10-06'])(
    'embeds the actual PNG on both SPB pages for approval date %s', async date => {
      state.approvedAt = `${date} 02:00:00`
      expect((await request()).status).toBe(200)
      const html = state.render.mock.calls[0][0].html as string
      const images = [...html.matchAll(/<img class="kop" src="([^"]+)"/g)]
      expect(images).toHaveLength(2)
      for (const [, src] of images) {
        expect(src).toBe(`data:image/png;base64,${letterheadPng.toString('base64')}`)
      }
      // HTML baru memiliki hash cache berbeda dari versi lama yang memakai URL publik.
      expect(html).not.toContain('https://example.test/kopkomite.png')
      expect(html).toContain('001/SPB')
      expect(html).toContain('100.000')
      expect(state.assets.mock.calls[0][0].url).toBe('https://example.test/kopkomite.png')
      expect(fetch).not.toHaveBeenCalled()
    },
  )

  it('uses HTTP for local Next.js without an asset binding', async () => {
    state.useAssets = false
    vi.mocked(fetch).mockResolvedValue(new Response(letterheadPng))
    expect((await request()).status).toBe(200)
    expect(state.assets).not.toHaveBeenCalled()
    expect(vi.mocked(fetch).mock.calls[0][0].toString()).toBe('https://example.test/kopkomite.png')
  })

  it.each(['missing', 'html', 'network'])(
    'does not serve or cache a PDF when the letterhead is %s', async failure => {
      if (failure === 'network') state.assets.mockRejectedValue(new Error('Unavailable'))
      else state.assets.mockResolvedValue(failure === 'missing'
        ? new Response('Not Found', { status: 404 }) : new Response('<html>Access denied</html>'))
      const response = await request()
      expect(response.status).toBe(503)
      expect(response.headers.get('Cache-Control')).toBe('private, no-store')
      expect(await response.text()).toContain('Kop Komite tidak dapat dimuat')
      expect(state.render).not.toHaveBeenCalled()
      expect(puppeteer.launch).not.toHaveBeenCalled()
    },
  )

  it.each([true, false])('only renders a PDF when image decoding succeeds: %s', async succeeds => {
    const decode = vi.fn(async () => { if (!succeeds) throw new Error('Invalid image') })
    vi.stubGlobal('document', { fonts: { ready: Promise.resolve() }, images: [{ decode }, { decode }] })
    const page = { setContent: vi.fn(), evaluate: vi.fn(async callback => callback()),
      pdf: vi.fn(async () => new Uint8Array([37, 80, 68, 70])) }
    const browser = { newPage: vi.fn(async () => page), close: vi.fn() }
    vi.mocked(puppeteer.launch).mockResolvedValue(browser as unknown as Awaited<ReturnType<typeof puppeteer.launch>>)
    state.render.mockImplementation(async ({ render }) => render())
    if (succeeds) {
      expect((await request()).status).toBe(200)
      expect(page.pdf).toHaveBeenCalledOnce()
    } else {
      await expect(request()).rejects.toThrow('Invalid image')
      expect(page.pdf).not.toHaveBeenCalled()
    }
    expect(decode).toHaveBeenCalledTimes(2)
    expect(browser.close).toHaveBeenCalledOnce()
  })
})
