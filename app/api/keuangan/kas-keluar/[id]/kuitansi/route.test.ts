import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import puppeteer from '@cloudflare/puppeteer'
import { GET } from './route'

const state = vi.hoisted(() => ({
  user: { id: 'u1' } as { id: string } | null,
  canRead: true,
  entry: {
    id: 'e1',
    direction: 'expense',
    category_id: 'expense-other',
    category_name: 'Operasional',
    transaction_date: '2026-11-12',
    amount: 659000,
    method: 'tunai',
    counterparty: 'PT PLN PERSERO',
    description: 'Pembayaran Token Listrik',
    proof_number: 'KK-202611-0014',
    is_void: 0,
    komite_pengajuan_id: null as string | null,
    recorder_name: 'Bendahara Pencatat',
  } as any,
  useAssets: true,
  assets: vi.fn(),
  render: vi.fn(),
}))

vi.mock('@cloudflare/puppeteer', () => ({ default: { launch: vi.fn() } }))
vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: async () => ({
    env: {
      STATIC_ASSETS: state.useAssets ? { fetch: state.assets } : undefined,
    },
  }),
}))
vi.mock('@/utils/auth/server', () => ({ getCurrentUser: async () => state.user }))
vi.mock('@/lib/features', () => ({ checkFeatureCrudAccess: async () => state.canRead }))
vi.mock('@/lib/komite-report-settings', () => ({
  getKomiteReportSettings: async () => ({
    openingBalanceMode: 'cumulative',
    proofNumberMode: 'automatic',
    signaturesEnabled: true,
    treasurerName: 'Hj. Siti Rahmawati',
    chairmanName: 'H. Ahmad Suryana',
    principalName: 'Kepala Madrasah',
  }),
}))
vi.mock('@/lib/komite-pengajuan', () => ({ komiteChairman: async () => ({ id: 'c1', name: 'Ketua Fallback' }) }))
vi.mock('@/lib/pdf-cache', () => ({ renderPdfWithCache: state.render }))
vi.mock('@/utils/db-server', () => ({
  getDB: async () => ({
    prepare(sql: string) {
      return {
        bind() { return this },
        async first() {
          if (sql.includes('FROM fin_cashflow_entries')) return state.entry
          return null
        },
        async all() {
          if (sql.includes('FROM fin_komite_allocations')) {
            return { results: [{ source: '2026', amount: 659000, account: '522111', label: 'Belanja Listrik' }] }
          }
          return { results: [] }
        },
      }
    },
  }),
}))

const letterheadPng = readFileSync(new URL('../../../../../../public/kopkomite.png', import.meta.url))
const callGet = (query = '') =>
  GET(new Request(`https://example.test/api/keuangan/kas-keluar/e1/kuitansi${query}`), {
    params: Promise.resolve({ id: 'e1' }),
  })

beforeEach(() => {
  state.user = { id: 'u1' }
  state.canRead = true
  state.entry = {
    id: 'e1',
    direction: 'expense',
    category_id: 'expense-other',
    category_name: 'Operasional',
    transaction_date: '2026-11-12',
    amount: 659000,
    method: 'tunai',
    counterparty: 'PT PLN PERSERO',
    description: 'Pembayaran Token Listrik',
    proof_number: 'KK-202611-0014',
    is_void: 0,
    komite_pengajuan_id: null,
    recorder_name: 'Bendahara Pencatat',
  }
  state.useAssets = true
  state.assets.mockReset().mockImplementation(async () => new Response(letterheadPng))
  state.render.mockReset().mockResolvedValue(new Uint8Array([37, 80, 68, 70]))
  vi.stubGlobal('fetch', vi.fn())
  vi.mocked(puppeteer.launch).mockReset()
})
afterEach(() => vi.unstubAllGlobals())

describe('GET /api/keuangan/kas-keluar/[id]/kuitansi', () => {
  it('enforces auth, permissions, not-found, expense-only, and active-only guards', async () => {
    state.user = null
    expect((await callGet()).status).toBe(401)

    state.user = { id: 'u1' }
    state.canRead = false
    expect((await callGet()).status).toBe(403)

    state.canRead = true
    state.entry = null
    expect((await callGet()).status).toBe(404)

    state.entry = { id: 'e1', direction: 'income', is_void: 0 }
    expect((await callGet()).status).toBe(409)

    state.entry = { id: 'e1', direction: 'expense', is_void: 1 }
    expect((await callGet()).status).toBe(409)
    expect(state.render).not.toHaveBeenCalled()
  })

  it('renders a valid inline PDF with embedded letterhead and respects dialog query options', async () => {
    const response = await callGet('?goodsReceipt=0&attachment=1')
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('application/pdf')
    expect(response.headers.get('Content-Disposition')).toContain('Kuitansi_KK-202611-0014.pdf')
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')

    const html = state.render.mock.calls[0][0].html as string
    expect(html).toContain(`data:image/png;base64,${letterheadPng.toString('base64')}`)
    expect(html).toContain('Angkatan 2026')
    expect(html).toContain('522111 · Belanja Listrik')
    expect(html).toContain('Hj. Siti Rahmawati')
    expect(html).toContain('H. Ahmad Suryana')
    expect(html).not.toContain('Barang/pekerjaan tersebut telah diterima')
    expect(html).toContain('Lampiran Kuitansi')
  })

  it('returns 503 and skips render/cache when letterhead cannot be loaded', async () => {
    state.assets.mockResolvedValue(new Response('Not Found', { status: 404 }))
    const response = await callGet()
    expect(response.status).toBe(503)
    expect(state.render).not.toHaveBeenCalled()
  })
})
