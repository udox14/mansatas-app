import { beforeEach, describe, expect, it, vi } from 'vitest'
import { saveKomitePaymentSettings, uploadKomiteQrisAction } from './actions'
const state = vi.hoisted(() => ({
  access: true, update: true, write: vi.fn(), uploadWrite: vi.fn(), upload: vi.fn(), log: vi.fn(),
  settings: { byGrade: { 10: { accounts: [], qrisUrl: '', qrisEnabled: false }, 11: { accounts: [], qrisUrl: '/11.png', qrisEnabled: true }, 12: { accounts: [], qrisUrl: '', qrisEnabled: false } }, whatsapp: '628' },
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/utils/auth/server', () => ({ getSession: async () => ({ user: { id: 'treasurer' } }) }))
vi.mock('@/utils/db-server', () => ({ getDB: async () => ({}) }))
vi.mock('@/lib/features', () => ({ checkFeatureAccess: async () => state.access, checkFeatureCrudAccess: async () => state.update }))
vi.mock('@/lib/system-settings', () => ({ getSystemSettings: vi.fn(), setSystemSettings: state.write, setSystemSetting: state.uploadWrite }))
vi.mock('@/lib/komite-payment-settings', async importOriginal => ({ ...await importOriginal<object>(), getKomitePaymentSettings: async () => state.settings }))
vi.mock('@/utils/r2', () => ({ uploadKomiteQris: state.upload }))
vi.mock('@/lib/activity-log', () => ({ logActivity: state.log }))
function form(grade = '10') {
  const f = new FormData()
  f.set('tingkat', grade)
  f.set('accountId', 'a')
  f.set('bankLabel', 'Bank')
  f.set('rekening', '00123')
  f.set('atasNama', 'Komite')
  f.set('activeAccountIds', 'a')
  f.set('whatsapp', '628')
  return f
}
beforeEach(() => { vi.clearAllMocks(); state.access = true; state.update = true; state.upload.mockResolvedValue({ url: '/new.png', error: null }) })
describe('grade payment settings writes', () => {
  it.each(['10', '11', '12'])('saves only selected grade %s and shared WhatsApp', async grade => {
    expect((await saveKomitePaymentSettings(form(grade))).error).toBeNull()
    const write = state.write.mock.calls[0][0]
    expect(Object.keys(write).sort()).toEqual([`keuangan_komite_${grade}_accounts`, `keuangan_komite_${grade}_qris_enabled`, 'keuangan_komite_whatsapp'].sort())
    expect(JSON.parse(write[`keuangan_komite_${grade}_accounts`])[0].rekening).toBe('00123')
    expect(state.log).toHaveBeenCalled()
  })
  it('rejects invalid grade, partial account, duplicate IDs and missing QRIS', async () => {
    expect((await saveKomitePaymentSettings(form('13'))).error).toBeTruthy()
    const partial = form(); partial.delete('rekening')
    expect((await saveKomitePaymentSettings(partial)).error).toBeTruthy()
    const duplicate = form()
    for (const key of ['accountId', 'bankLabel', 'rekening', 'atasNama']) duplicate.append(key, String(duplicate.get(key)))
    expect((await saveKomitePaymentSettings(duplicate)).error).toBeTruthy()
    const qris = form(); qris.set('qrisEnabled', '1')
    expect((await saveKomitePaymentSettings(qris)).error).toContain('QRIS')
    expect(state.write).not.toHaveBeenCalled()
  })
  it('allows disabling all methods without falling back to another grade', async () => {
    const empty = new FormData(); empty.set('tingkat', '10')
    expect((await saveKomitePaymentSettings(empty)).error).toBeNull()
    expect(state.write.mock.calls[0][0].keuangan_komite_10_accounts).toBe('[]')
  })
  it('guards save and upload with update permission', async () => {
    state.update = false
    expect((await saveKomitePaymentSettings(form())).error).toBeTruthy()
    expect((await uploadKomiteQrisAction(form())).error).toBeTruthy()
    expect(state.write).not.toHaveBeenCalled(); expect(state.upload).not.toHaveBeenCalled()
    state.access = false
    await expect(saveKomitePaymentSettings(form())).rejects.toThrow('Forbidden')
  })
  it('leaves the previous QRIS intact when upload fails', async () => {
    state.upload.mockResolvedValue({ url: null, error: 'Gagal upload' })
    const f = form('11'); f.set('qris', new File(['image'], 'qris.png', { type: 'image/png' }))
    expect((await uploadKomiteQrisAction(f)).error).toBe('Gagal upload')
    expect(state.uploadWrite).not.toHaveBeenCalled()
    expect(state.log).not.toHaveBeenCalled()
  })
  it('uploads and updates only the requested grade QRIS', async () => {
    const f = form('11'); f.set('qris', new File(['image'], 'qris.png', { type: 'image/png' }))
    expect((await uploadKomiteQrisAction(f)).error).toBeNull()
    expect(state.upload).toHaveBeenCalledWith(expect.any(File), 11)
    expect(state.uploadWrite).toHaveBeenCalledWith('keuangan_komite_11_qris_url', '/new.png')
    expect(state.write).not.toHaveBeenCalled()
    expect(state.log).toHaveBeenCalled()
  })
})
