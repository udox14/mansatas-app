import { describe, expect, it } from 'vitest'
import {
  isS36RequiredForRoles,
  monthLabel,
  monthName,
  previousMonthPeriod,
  safeFileSegment,
  isTpgProfileComplete,
  getTpgMissingProfileFields,
  TPG_CKH_ROLES,
  TPG_S36_REQUIRED_ROLES,
} from './tpg'

describe('TPG roles configuration', () => {
  it('only targets Guru Mata Pelajaran (guru)', () => {
    expect(TPG_CKH_ROLES).toEqual(['guru'])
    expect(TPG_S36_REQUIRED_ROLES).toEqual(['guru'])
  })

  it('validates S36 requirement only for guru role', () => {
    // Primary role guru
    expect(isS36RequiredForRoles('guru', null)).toBe(true)
    expect(isS36RequiredForRoles('guru', 'wali_kelas')).toBe(true)

    // Secondary role guru in multi-role
    expect(isS36RequiredForRoles('wali_kelas', 'guru,wali_kelas')).toBe(true)
    expect(isS36RequiredForRoles('admin_tu', 'admin_tu,guru')).toBe(true)

    // Non-guru roles must NOT require S36
    expect(isS36RequiredForRoles('admin_tu', null)).toBe(false)
    expect(isS36RequiredForRoles('kepsek', null)).toBe(false)
    expect(isS36RequiredForRoles('satpam', null)).toBe(false)
    expect(isS36RequiredForRoles('pramubakti', null)).toBe(false)
    expect(isS36RequiredForRoles('operator', null)).toBe(false)
    expect(isS36RequiredForRoles('guru_bk', null)).toBe(false)
    expect(isS36RequiredForRoles('guru_piket', null)).toBe(false)
    expect(isS36RequiredForRoles('guru_tahfidz', null)).toBe(false)
    expect(isS36RequiredForRoles('wali_kelas', 'wali_kelas')).toBe(false)
  })
})

describe('TPG utility helpers', () => {
  it('calculates previous month period', () => {
    const prev = previousMonthPeriod(new Date(2026, 7, 15))
    expect(prev).toEqual({ year: 2026, month: 7 })
  })

  it('formats month label in Indonesian', () => {
    expect(monthName(1)).toBe('Januari')
    expect(monthName(8)).toBe('Agustus')
    expect(monthName(12)).toBe('Desember')
    expect(monthLabel(2026, 8)).toBe('Agustus 2026')
  })

  it('sanitizes safe file segments', () => {
    expect(safeFileSegment('Dra. Hj. Siti Nurhaliza, M.Pd.')).toBe('Dra._Hj._Siti_Nurhaliza_M.Pd.')
    expect(safeFileSegment('')).toBe('file')
  })
})

describe('TPG Profile Completeness', () => {
  const completeProfile = {
    nama_lengkap: 'Asep Saepulloh, M.Pd.',
    nip: '197501012000031001',
    nrg: '123456789012',
    pangkat_golongan: 'Pembina, IV/a',
    nomor_whatsapp: '081234567890',
    no_urut: '40',
    nuptk: '9876543210987654',
  }

  it('returns true when all required fields are filled', () => {
    expect(isTpgProfileComplete(completeProfile)).toBe(true)
    expect(getTpgMissingProfileFields(completeProfile)).toEqual([])
  })

  it('considers profile complete even if NUPTK is null or empty', () => {
    const withoutNuptk = { ...completeProfile, nuptk: null }
    expect(isTpgProfileComplete(withoutNuptk)).toBe(true)
    expect(getTpgMissingProfileFields(withoutNuptk)).toEqual([])

    const withEmptyNuptk = { ...completeProfile, nuptk: '' }
    expect(isTpgProfileComplete(withEmptyNuptk)).toBe(true)
    expect(getTpgMissingProfileFields(withEmptyNuptk)).toEqual([])
  })

  it('returns false and lists missing fields when required fields are missing', () => {
    const incomplete = {
      nama_lengkap: 'Asep Saepulloh, M.Pd.',
      nip: '197501012000031001',
      nrg: '',
      pangkat_golongan: null,
      nomor_whatsapp: '081234567890',
      no_urut: '   ',
    }

    expect(isTpgProfileComplete(incomplete)).toBe(false)
    const missing = getTpgMissingProfileFields(incomplete)
    expect(missing).toContain('NRG')
    expect(missing).toContain('Pangkat/Gol')
    expect(missing).toContain('No. Urut')
    expect(missing).not.toContain('NUPTK')
  })
})

