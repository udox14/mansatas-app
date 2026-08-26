import { describe, expect, it } from 'vitest'
import {
  fingerprintParentTkaSelection,
  isParentTkaSelectionComplete,
  normalizeParentTkaSelection,
  resolveParentTkaApprovalStatus,
} from './parent-tka'

const complete = normalizeParentTkaSelection({
  mapelPilihan1: 'Fisika',
  mapelPilihan2: 'Kimia',
  rencanaKategori: 'KULIAH',
  pilihan1KampusId: 'pt-1',
  pilihan1KampusNama: 'Kampus Satu',
  pilihan1Prodi: 'Teknik',
  pilihan2KampusId: 'pt-2',
  pilihan2KampusNama: 'Kampus Dua',
  pilihan2Prodi: 'Sains',
})

describe('parent TKA selection', () => {
  it('requires both subjects and both university choices for college plans', () => {
    expect(isParentTkaSelectionComplete(complete)).toBe(true)
    expect(isParentTkaSelectionComplete({ ...complete, pilihan2Prodi: null })).toBe(false)
    expect(isParentTkaSelectionComplete({ ...complete, mapelPilihan1: null })).toBe(false)
  })

  it('only requires both subjects for non-college plans', () => {
    expect(isParentTkaSelectionComplete({
      ...complete,
      rencanaKategori: 'BEKERJA',
      pilihan1KampusId: null,
      pilihan1KampusNama: null,
      pilihan1Prodi: null,
      pilihan2KampusId: null,
      pilihan2KampusNama: null,
      pilihan2Prodi: null,
    })).toBe(true)
  })

  it('produces a stable fingerprint and changes it with the selection', async () => {
    await expect(fingerprintParentTkaSelection(complete)).resolves.toBe(await fingerprintParentTkaSelection({ ...complete }))
    expect(await fingerprintParentTkaSelection(complete)).not.toBe(
      await fingerprintParentTkaSelection({ ...complete, mapelPilihan2: 'Biologi' }),
    )
  })

  it('distinguishes approval monitoring states', () => {
    expect(resolveParentTkaApprovalStatus(false, null, null)).toBe('belum_lengkap')
    expect(resolveParentTkaApprovalStatus(true, 'current', null)).toBe('belum_disetujui')
    expect(resolveParentTkaApprovalStatus(true, 'current', 'old')).toBe('perlu_persetujuan_ulang')
    expect(resolveParentTkaApprovalStatus(true, 'current', 'current')).toBe('disetujui')
  })
})
