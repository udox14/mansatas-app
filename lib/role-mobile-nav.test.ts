import { describe, expect, it } from 'vitest'
import { moveRoleMobileNavItem, validateRoleMobileNav } from './role-mobile-nav'

const allowed = ['dashboard', 'agenda', 'siswa', 'kehadiran', 'ckh-generator']
const known = [...allowed, 'guru']

describe('role mobile navbar', () => {
  it('menerima maksimal empat menu yang diizinkan selain Home', () => {
    expect(validateRoleMobileNav(['agenda', 'siswa', 'kehadiran', 'ckh-generator'], allowed, known)).toBeNull()
  })

  it('menolak menu kelima, duplikat, Home, dan fitur di luar akses role', () => {
    expect(validateRoleMobileNav(['agenda', 'siswa', 'kehadiran', 'ckh-generator', 'guru'], [...allowed, 'guru'], known)).toContain('Maksimal 4')
    expect(validateRoleMobileNav(['agenda', 'agenda'], allowed, known)).toContain('duplikat')
    expect(validateRoleMobileNav(['dashboard'], allowed, known)).toContain('Home')
    expect(validateRoleMobileNav(['guru'], allowed, known)).toContain('tidak diizinkan')
  })

  it('mengubah urutan tanpa memodifikasi array awal', () => {
    const value = ['agenda', 'siswa', 'kehadiran']
    expect(moveRoleMobileNavItem(value, 1, -1)).toEqual(['siswa', 'agenda', 'kehadiran'])
    expect(value).toEqual(['agenda', 'siswa', 'kehadiran'])
    expect(moveRoleMobileNavItem(value, 0, -1)).toBe(value)
  })
})
