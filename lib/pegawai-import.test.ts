import { describe, expect, it } from 'vitest'
import { normalizePegawaiImportRow, resolveImportedRoles } from './pegawai-import'

const roles = [
  { value: 'guru', label: 'Guru Mata Pelajaran' },
  { value: 'guru_ppl', label: 'Guru PPL' },
  { value: 'pramubakti', label: 'Pramubakti' },
  { value: 'admin_tu', label: 'Staff Tata Usaha' },
  { value: 'custom_role', label: 'Role Khusus' },
]

describe('import akun pegawai', () => {
  it('menerima header ROLE dengan kapitalisasi bebas', () => {
    expect(normalizePegawaiImportRow({ Role: 'pramubakti', 'Nama Lengkap': 'A' }))
      .toEqual({ ROLE: 'pramubakti', NAMA_LENGKAP: 'A' })
  })

  it.each([
    ['pramubakti', ['pramubakti']],
    ['Guru PPL', ['guru_ppl']],
    ['guru_ppl', ['guru_ppl']],
    ['Staff Tata Usaha', ['admin_tu']],
    ['Role Khusus', ['custom_role']],
  ])('memetakan %s ke role resmi', (input, expected) => {
    expect(resolveImportedRoles(input, roles)).toEqual({ roles: expected, invalid: [] })
  })

  it('mendukung beberapa role dan menolak nilai yang tidak dikenal', () => {
    expect(resolveImportedRoles('Guru PPL, Pramubakti', roles)).toEqual({
      roles: ['guru_ppl', 'pramubakti'],
      invalid: [],
    })
    expect(resolveImportedRoles('role ngawur', roles)).toEqual({ roles: [], invalid: ['role ngawur'] })
  })
})
