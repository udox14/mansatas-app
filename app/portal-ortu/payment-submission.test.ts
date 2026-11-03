import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createParentDsptPaymentSubmission, uploadParentPaymentProof } from './actions'
const state = vi.hoisted(() => ({ grade: 10 as number | null, insert: vi.fn(), update: vi.fn(), proof: vi.fn(),
  settings: {} as Record<string, string>, session: { kind: 'parent', user: { siswa_id: 'student' } } as unknown,
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/utils/auth/server', () => ({ getAppSession: async () => state.session }))
vi.mock('@/utils/auth', () => ({ createAuth: vi.fn() }))
vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext: vi.fn() }))
vi.mock('@/lib/system-settings', () => ({ getSystemSettings: async (defaults: object) => ({ ...defaults, ...state.settings }) }))
vi.mock('@/utils/r2', () => ({ uploadPaymentProof: state.proof }))
vi.mock('@/lib/notification-engine', () => ({ emitConfiguredNotification: vi.fn(), getStudentNotificationContext: async () => null }))
vi.mock('@/utils/db-server', () => ({ getDB: async () => ({ prepare(sql: string) {
  let args: unknown[] = []
  return { bind(...values: unknown[]) { args = values; return this }, async run() {
    if (sql.includes('INSERT INTO fin_payment_submissions')) state.insert(...args)
    if (sql.includes('UPDATE fin_payment_submissions')) state.update(...args)
  }, async first() {
    if (sql.includes('SELECT k.tingkat')) { expect(args).toEqual(['student']); return { tingkat: state.grade } }
    if (sql.includes('FROM fin_dspt')) return { id: 'dspt', nominal_target: 1000000, total_dibayar: 0, total_diskon: 0, tahun_masuk: 2026 }
    if (sql.includes('FROM fin_payment_submissions')) return { id: 'old', siswa_id: 'student', status: 'belum_upload', jumlah: 10000, metode_bayar: 'transfer' }
    return null
  } }
} }) }))
beforeEach(() => {
  vi.clearAllMocks(); state.grade = 10
  state.session = { kind: 'parent', user: { siswa_id: 'student' } }
  state.settings = {}
  for (const grade of [10, 11, 12]) {
    state.settings[`keuangan_komite_${grade}_accounts`] = JSON.stringify([
      { id: `bank-${grade}`, bankLabel: `Bank ${grade}`, rekening: `00${grade}`, atasNama: 'Komite', isActive: true },
      { id: 'inactive', bankLabel: 'Bank', rekening: '000', atasNama: 'Komite', isActive: false },
    ])
    state.settings[`keuangan_komite_${grade}_qris_url`] = `/qris-${grade}.png`
    state.settings[`keuangan_komite_${grade}_qris_enabled`] = '1'
  }
})
describe('parent grade payment authorization', () => {
  it.each([10, 11, 12])('snapshots only the current grade %i bank from the server', async grade => {
    state.grade = grade
    expect(await createParentDsptPaymentSubmission({ amount: 10000, method: 'transfer', bankAccountId: `bank-${grade}` })).toHaveProperty('submissionId')
    expect(state.insert.mock.calls[0].at(-1)).toBe(`Bank ${grade} - 00${grade} a.n. Komite`)
  })
  it('rejects cross-grade and inactive bank IDs and ignores client-supplied grade', async () => {
    for (const bankAccountId of ['bank-11', 'inactive']) {
      expect(await createParentDsptPaymentSubmission({ amount: 10000, method: 'transfer', bankAccountId, tingkat: 11 } as never)).toHaveProperty('error')
    }
    expect(state.insert).not.toHaveBeenCalled()
  })
  it('changes destination on promotion without editing previous snapshots', async () => {
    await createParentDsptPaymentSubmission({ amount: 10000, method: 'transfer' })
    state.grade = 11
    await createParentDsptPaymentSubmission({ amount: 10000, method: 'transfer' })
    expect(state.insert.mock.calls.map(args => args.at(-1))).toEqual(['Bank 10 - 0010 a.n. Komite', 'Bank 11 - 0011 a.n. Komite'])
    expect(state.update).not.toHaveBeenCalled()
  })
  it('blocks absent or invalid grade and unavailable payment methods', async () => {
    for (const grade of [null, 9]) {
      state.grade = grade
      expect(await createParentDsptPaymentSubmission({ amount: 10000, method: 'transfer' })).toHaveProperty('error')
    }
    state.grade = 10
    state.settings.keuangan_komite_10_accounts = '[]'
    state.settings.keuangan_komite_10_qris_enabled = '0'
    expect(await createParentDsptPaymentSubmission({ amount: 10000, method: 'transfer' })).toHaveProperty('error')
    expect(await createParentDsptPaymentSubmission({ amount: 10000, method: 'qris' })).toHaveProperty('error')
    state.settings.keuangan_komite_10_qris_enabled = '1'; state.settings.keuangan_komite_10_qris_url = ''
    expect(await createParentDsptPaymentSubmission({ amount: 10000, method: 'qris' })).toHaveProperty('error')
    expect(state.insert).not.toHaveBeenCalled()
  })
  it('allows proofs for old submissions even without a current grade or configuration', async () => {
    state.grade = null; state.settings = {}
    state.proof.mockResolvedValue({ url: '/proof.png', error: null })
    const f = new FormData(); f.set('submissionId', 'old'); f.set('bukti', new File(['proof'], 'proof.png', { type: 'image/png' }))
    expect(await uploadParentPaymentProof(f)).toHaveProperty('success')
    expect(state.update).toHaveBeenCalled()
  })
  it('accepts available QRIS and rejects a bank disabled after the page was loaded', async () => {
    expect(await createParentDsptPaymentSubmission({ amount: 10000, method: 'qris' })).toHaveProperty('submissionId')
    expect(state.insert.mock.calls[0].at(-1)).toBeNull()
    state.insert.mockClear()
    state.settings.keuangan_komite_10_accounts = '[]'
    expect(await createParentDsptPaymentSubmission({ amount: 10000, method: 'transfer', bankAccountId: 'bank-10' })).toHaveProperty('error')
    expect(state.insert).not.toHaveBeenCalled()
  })
  it('requires a parent session', async () => {
    state.session = null
    await expect(createParentDsptPaymentSubmission({ amount: 10000, method: 'transfer' })).rejects.toThrow('Unauthorized')
  })
})
