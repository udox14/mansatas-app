import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import puppeteer from '@cloudflare/puppeteer'
import { GET } from './route'

const state = vi.hoisted(() => ({
  user: { id: 'reader' } as { id: string } | null,
  canView: true,
  row: {
    id: 'p1',
    pengaju_id: 'applicant',
    current_version: 1,
    status: 'disetujui',
    komite_cancelled_at: null as string | null,
    chairman_name_snapshot: 'H. Ketua Snapshot',
    nominal: 1500000,
    nomor_spb: '042/SPB-KMT/XI/2026',
    tahun_anggaran: '2026',
    approved_at: '2026-11-10 02:00:00',
    judul: 'Classmeeting Semester Ganjil',
    uraian: 'Kegiatan lomba antar kelas',
    penerima_pembayaran: 'Panitia Classmeeting',
    realisasi_status: 'belum',
    realisasi_tanggal: null as string | null,
    realisasi_metode: null as string | null,
    realisasi_petugas: null as string | null,
  } as any,
  assets: vi.fn(),
  render: vi.fn(),
}))

vi.mock('@cloudflare/puppeteer', () => ({ default: { launch: vi.fn() } }))
vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: async () => ({
    env: { STATIC_ASSETS: { fetch: state.assets } },
  }),
}))
vi.mock('@/utils/auth/server', () => ({ getCurrentUser: async () => state.user }))
vi.mock('@/lib/features', () => ({ getUserRoles: async () => ['bendahara_komite'] }))
vi.mock('@/lib/komite-pengajuan', async importOriginal => ({
  ...await importOriginal<object>(),
  ensureKomitePengajuanSchema: async () => undefined,
  canViewKomitePengajuan: async () => state.canView,
  komiteChairman: async () => ({ id: 'c1', name: 'Ketua Fallback' }),
}))
vi.mock('@/lib/komite-report-settings', () => ({
  getKomiteReportSettings: async () => ({
    openingBalanceMode: 'cumulative',
    proofNumberMode: 'automatic',
    signaturesEnabled: true,
    treasurerName: 'Hj. Bendahara Komite',
    chairmanName: 'H. Ketua Pengaturan',
    principalName: 'Kepala Madrasah',
  }),
}))
vi.mock('@/lib/pdf-cache', () => ({ renderPdfWithCache: state.render }))
vi.mock('@/utils/db-server', () => ({
  getDB: async () => ({
    prepare(sql: string) {
      return {
        bind() { return this },
        async first() {
          if (sql.includes('FROM komite_pengajuan p')) return state.row
          return null
        },
        async all() {
          if (sql.includes('FROM komite_pengajuan_rincian')) {
            return {
              results: [
                { urutan: 1, uraian: 'Konsumsi panitia', penerima_penyedia: 'Catering A', jumlah: 900000 },
                { urutan: 2, uraian: 'Piala lomba', penerima_penyedia: 'Toko B', jumlah: 600000 },
              ],
            }
          }
          if (sql.includes('FROM fin_komite_allocations')) {
            return { results: [{ source: '2026', amount: 1500000, account: '521211', label: 'Belanja Bahan' }] }
          }
          return { results: [] }
        },
      }
    },
  }),
}))

const letterheadPng = readFileSync(new URL('../../../../../../public/kopkomite.png', import.meta.url))
const callGet = (query = '') =>
  GET(new Request(`https://example.test/api/komite/pengajuan/p1/kuitansi${query}`), {
    params: Promise.resolve({ id: 'p1' }),
  })

beforeEach(() => {
  state.user = { id: 'reader' }
  state.canView = true
  state.row = {
    id: 'p1',
    pengaju_id: 'applicant',
    current_version: 1,
    status: 'disetujui',
    komite_cancelled_at: null,
    chairman_name_snapshot: 'H. Ketua Snapshot',
    nominal: 1500000,
    nomor_spb: '042/SPB-KMT/XI/2026',
    tahun_anggaran: '2026',
    approved_at: '2026-11-10 02:00:00',
    judul: 'Classmeeting Semester Ganjil',
    uraian: 'Kegiatan lomba antar kelas',
    penerima_pembayaran: 'Panitia Classmeeting',
    realisasi_status: 'belum',
    realisasi_tanggal: null,
    realisasi_metode: null,
    realisasi_petugas: null,
  }
  state.assets.mockReset().mockImplementation(async () => new Response(letterheadPng))
  state.render.mockReset().mockResolvedValue(new Uint8Array([37, 80, 68, 70]))
  vi.stubGlobal('fetch', vi.fn())
  vi.mocked(puppeteer.launch).mockReset()
})
afterEach(() => vi.unstubAllGlobals())

describe('GET /api/komite/pengajuan/[id]/kuitansi', () => {
  it('blocks unauthorized, forbidden, missing, unapproved, and cancelled SPBs', async () => {
    state.user = null
    expect((await callGet()).status).toBe(401)

    state.user = { id: 'reader' }
    state.canView = false
    expect((await callGet()).status).toBe(403)

    state.canView = true
    state.row = null
    expect((await callGet()).status).toBe(404)

    state.row = { id: 'p1', status: 'menunggu_ketua', komite_cancelled_at: null }
    expect((await callGet()).status).toBe(409)

    state.row = { id: 'p1', status: 'disetujui', komite_cancelled_at: '2026-11-15' }
    expect((await callGet()).status).toBe(409)
  })

  it('defaults to 2 pages with Lampiran Kuitansi and renders approved SPB receipt cleanly', async () => {
    const response = await callGet()
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Disposition')).toContain('Kuitansi_SPB_042_SPB-KMT_XI_2026.pdf')

    const html = state.render.mock.calls[0][0].html as string
    expect(html.match(/<section class="page">/g)).toHaveLength(2)
    expect(html).toContain('042/SPB-KMT/XI/2026')
    expect(html).toContain('H. Ketua Snapshot')
    expect(html).toContain('Hj. Bendahara Komite')
    expect(html).toContain('Satu Juta Lima Ratus Ribu Rupiah')
    expect(html).toContain('Lampiran Kuitansi')
    expect(html).toContain('Konsumsi panitia')
    expect(html).toContain('Piala lomba')
    expect(html).toContain('Lunas dibayar, ................................')
  })

  it('uses realized payment date and method once SPB is disbursed', async () => {
    state.row.realisasi_status = 'sudah'
    state.row.realisasi_tanggal = '2026-11-18'
    state.row.realisasi_metode = 'Transfer'
    const response = await callGet('?goodsReceipt=0')
    expect(response.status).toBe(200)

    const html = state.render.mock.calls[0][0].html as string
    expect(html).toContain('Lunas dibayar, 18 November 2026')
    expect(html).toContain('Transfer')
    expect(html).not.toContain('Barang/pekerjaan tersebut telah diterima')
  })
})
