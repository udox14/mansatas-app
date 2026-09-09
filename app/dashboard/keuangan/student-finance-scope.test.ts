import { describe, expect, it } from 'vitest'
import { isStudentInFinanceScope, studentFinanceScopeSql } from './student-finance-scope'

describe('scope keuangan siswa', () => {
  it('memisahkan siswa aktif secara ketat', () => {
    expect(isStudentInFinanceScope('aktif', 'active')).toBe(true)
    for (const status of ['lulus', 'pindah', 'keluar', 'cuti', 'status_baru', 'dihapus']) {
      expect(isStudentInFinanceScope(status, 'active')).toBe(false)
    }
  })

  it('memasukkan seluruh status nonaktif masa kini dan masa depan kecuali sampah', () => {
    for (const status of ['lulus', 'pindah', 'keluar', 'cuti', 'status_baru']) {
      expect(isStudentInFinanceScope(status, 'inactive')).toBe(true)
    }
    expect(isStudentInFinanceScope('aktif', 'inactive')).toBe(false)
    expect(isStudentInFinanceScope('dihapus', 'inactive')).toBe(false)
  })

  it('menghasilkan predikat query yang tidak dapat mencampurkan kedua scope', () => {
    expect(studentFinanceScopeSql('active', 'murid')).toBe("murid.status = 'aktif'")
    expect(studentFinanceScopeSql('inactive', 'murid')).toBe("murid.status <> 'aktif' AND murid.status <> 'dihapus'")
  })
})
