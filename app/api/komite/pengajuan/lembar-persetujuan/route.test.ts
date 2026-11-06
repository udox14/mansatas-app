import { beforeEach, describe, expect, it, vi } from 'vitest'
import puppeteer from '@cloudflare/puppeteer'
import { DEFAULT_BOS_SIGNER } from '@/lib/komite-approval-sheet'
import { POST } from './route'

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  canSubmit: vi.fn(),
  prepare: vi.fn(),
  principal: vi.fn(),
  setContent: vi.fn(),
  pdf: vi.fn(),
  close: vi.fn(),
}))

vi.mock('@/utils/auth/server', () => ({ getCurrentUser: mocks.user }))
vi.mock('@/utils/db-server', () => ({ getDB: async () => ({ prepare: mocks.prepare }) }))
vi.mock('@/lib/komite-pengajuan', () => ({ canSubmitKomite: mocks.canSubmit }))
vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext: async () => ({ env: { BROWSER: {} } }) }))
vi.mock('@cloudflare/puppeteer', () => ({
  default: {
    launch: vi.fn(async () => ({
      newPage: async () => ({ setContent: mocks.setContent, pdf: mocks.pdf }),
      close: mocks.close,
    })),
  },
}))

const principal = { name: 'Kepala Madrasah & Rekan', nip: '197001012000121001' }
const request = (signer: unknown = DEFAULT_BOS_SIGNER) =>
  POST(new Request('https://example.test/api/komite/pengajuan/lembar-persetujuan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(signer),
  }))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.user.mockResolvedValue({ id: 'pengaju' })
  mocks.canSubmit.mockResolvedValue(true)
  mocks.prepare.mockReturnValue({ first: mocks.principal })
  mocks.principal.mockResolvedValue(principal)
  mocks.pdf.mockResolvedValue(new Uint8Array([37, 80, 68, 70]))
})

describe('Lembar persetujuan pengajuan anggaran Komite', () => {
  it('requires a session and existing permission to submit, even at the direct URL', async () => {
    mocks.user.mockResolvedValueOnce(null)
    expect((await request()).status).toBe(401)
    mocks.canSubmit.mockResolvedValueOnce(false)
    expect((await request()).status).toBe(403)
    expect(mocks.canSubmit).toHaveBeenCalledWith(expect.anything(), 'pengaju')
    expect(mocks.prepare).not.toHaveBeenCalled()
    expect(puppeteer.launch).not.toHaveBeenCalled()
  })

  it('renders the default letter without any proposal lookup', async () => {
    const response = await request()
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(response.headers.get('Content-Type')).toBe('application/pdf')
    expect(response.headers.get('Content-Disposition')).toMatch(/^inline;/)
    expect(mocks.prepare).toHaveBeenCalledTimes(1)
    expect(mocks.prepare).toHaveBeenCalledWith(expect.stringContaining("u.role = 'kepsek'"))
    const html = mocks.setContent.mock.calls[0][0]
    expect(html).toContain('size: A4 portrait')
    expect(html).toContain('LEMBAR PERSETUJUAN<br>PENGGUNAAN ANGGARAN KOMITE<br>MAN 1 TASIKMALAYA')
    expect(html).toContain('Ajuan telah diverifikasi<br>Bendahara BOS')
    expect(html).toContain('Ade Agus Sukmana, S.Pd.')
    expect(html).toContain('NIP. ................................')
    expect(html).toContain('Ajuan telah disetujui<br>Kepala Madrasah')
    expect(html).toContain('Kepala Madrasah &amp; Rekan')
    expect(html).toContain(principal.nip)
    expect(html.match(/<div class="note-line" aria-hidden="true">\.+<\/div>/g)).toHaveLength(5)
    expect(html).not.toContain('<img')
    expect(mocks.pdf).toHaveBeenCalledWith(expect.objectContaining({ format: 'A4', preferCSSPageSize: true }))
    expect(mocks.close).toHaveBeenCalledOnce()
  })

  it('escapes an overridden name and uses the overridden NIP', async () => {
    const response = await request({ name: 'Bendahara <BOS>', nip: '001234567890123456' })
    expect(response.status).toBe(200)
    const html = mocks.setContent.mock.calls[0][0]
    expect(html).toContain('Bendahara &lt;BOS&gt;')
    expect(html).toContain('001234567890123456')
    expect(html).not.toContain('Ade Agus Sukmana')
  })

  it.each([
    { name: ' ', nip: '' },
    { name: 'Bendahara', nip: 'abc123' },
    { name: 'Bendahara', nip: '1'.repeat(19) },
    { name: 'Bendahara', nip: 123 },
  ])('rejects invalid signer input before rendering', async signer => {
    expect((await request(signer)).status).toBe(400)
    expect(puppeteer.launch).not.toHaveBeenCalled()
  })

  it.each([null, { ...principal, name: null }, { ...principal, nip: '' }])('reports an incomplete principal profile', async signer => {
    mocks.principal.mockResolvedValueOnce(signer)
    const response = await request()
    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ error: expect.stringContaining('melengkapi profil Kepala Madrasah') })
    expect(puppeteer.launch).not.toHaveBeenCalled()
  })

  it('closes the browser and returns a retryable error on rendering failure', async () => {
    mocks.pdf.mockRejectedValueOnce(new Error('Browser failure'))
    const response = await request()
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: expect.stringContaining('coba cetak kembali') })
    expect(mocks.close).toHaveBeenCalledOnce()
  })
})
