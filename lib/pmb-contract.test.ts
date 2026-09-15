import { describe, expect, it } from 'vitest'
import { calculateDsptStatus, isConvertiblePmb, normalizeGender, normalizeResidence, pmbRegistrationStage, resolveDsptNominal } from './pmb-contract'

describe('PMB contract', () => {
  it('normalizes legacy and canonical genders', () => {
    expect(normalizeGender('LAKI_LAKI')).toBe('L')
    expect(normalizeGender('Laki-laki')).toBe('L')
    expect(normalizeGender('PEREMPUAN')).toBe('P')
  })
  it('maps residence to supported siswa values', () => {
    expect(normalizeResidence('PP. Sukahideng')).toBe('Pesantren Sukahideng')
    expect(normalizeResidence('Komuter')).toBe('Non-Pesantren')
    expect(normalizeResidence('Mondok di Pesantren')).toBe('Pesantren')
  })
  it('derives the registration/cashier lifecycle', () => {
    expect(pmbRegistrationStage({})).toBe('BELUM_KONFIRMASI')
    expect(pmbRegistrationStage({ konfirmasi_daftar_ulang: 'BERSEDIA' })).toBe('MENUNGGU_KONVERSI')
    expect(pmbRegistrationStage({ konfirmasi_daftar_ulang: 'BERSEDIA', siswa_id: 's1' })).toBe('MENUNGGU_KASIR')
    expect(pmbRegistrationStage({ siswa_id: 's1', dspt_id: 'd1' })).toBe('SELESAI')
  })
  it('requires verification, acceptance and confirmation before conversion', () => {
    expect(isConvertiblePmb({ status_verifikasi: 1, status_kelulusan: 'DITERIMA', konfirmasi_daftar_ulang: 'BERSEDIA', jenis_kelamin: 'PEREMPUAN' })).toBeNull()
    expect(isConvertiblePmb({ status_verifikasi: 1, status_kelulusan: 'DITERIMA', jenis_kelamin: 'PEREMPUAN' })).toMatch(/mengonfirmasi/)
  })
  it('separates DSPT payment status from the registration milestone', () => {
    expect(calculateDsptStatus(5_000_000, 0, 0)).toBe('belum_bayar')
    expect(calculateDsptStatus(5_000_000, 1_000_000, 0)).toBe('nyicil')
    expect(calculateDsptStatus(5_000_000, 4_000_000, 1_000_000)).toBe('lunas')
  })
  it('resolves manual, default, package and audited overrides', () => {
    const packages = [{ id: 'full', label: 'Paket Penuh', amount: 5_000_000, isActive: true, sortOrder: 10 }]
    expect(resolveDsptNominal({ mode: 'manual', requested: 4_000_000, defaultAmount: 0, packages, allowOverride: true }).error).toBeNull()
    expect(resolveDsptNominal({ mode: 'default', requested: 5_000_000, defaultAmount: 5_000_000, packages, allowOverride: true }).overrideReason).toBeNull()
    expect(resolveDsptNominal({ mode: 'package', requested: 5_000_000, defaultAmount: 0, packages, packageId: 'full', allowOverride: true }).packageId).toBe('full')
    expect(resolveDsptNominal({ mode: 'default', requested: 4_000_000, defaultAmount: 5_000_000, packages, allowOverride: true, overrideReason: 'keringanan khusus' }).overrideReason).toBe('keringanan khusus')
    expect(resolveDsptNominal({ mode: 'default', requested: 4_000_000, defaultAmount: 5_000_000, packages, allowOverride: false }).error).toMatch(/dinonaktifkan/)
  })
})
