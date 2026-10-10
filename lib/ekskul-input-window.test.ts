import { describe, expect, it } from 'vitest'
import { getEkskulInputWindow, parseHariLatihan } from './ekskul-input-window'

describe('waktu input kegiatan ekstrakurikuler (WIB)', () => {
  // Senin, 12 Oktober 2026. Batas akhir mencakup menit 14.30.
  it.each([
    ['12:59:59', false],
    ['13:00:00', true],
    ['14:00:00', true],
    ['14:30:00', true],
    ['14:30:59', true],
    ['14:31:00', false],
  ])('pukul %s: allowed=%s', (time, allowed) => {
    expect(getEkskulInputWindow('[1,3]', new Date(`2026-10-12T${time}+07:00`)).allowed).toBe(allowed)
  })

  it('menolak hari tanpa jadwal walaupun dalam jam input', () => {
    const result = getEkskulInputWindow('[2,4]', new Date('2026-10-12T13:15:00+07:00'))
    expect(result.allowed).toBe(false)
    expect(result.error).toContain('Hari ini bukan jadwal latihan')
    expect(result.error).toContain('Selasa, Kamis')
  })

  it('menolak jadwal kosong atau tidak valid dengan penjelasan', () => {
    for (const schedule of [null, '', '[]', '[0,8,1.5]', 'invalid']) {
      expect(getEkskulInputWindow(schedule).error).toContain('belum diatur oleh admin')
    }
  })

  it('menggunakan hari WIB saat tanggal UTC masih hari sebelumnya', () => {
    const result = getEkskulInputWindow('[1]', new Date('2026-10-11T18:30:00Z'))
    expect(result.tanggal).toBe('2026-10-12')
    expect(result.error).toContain('Input kegiatan ditutup')
  })

  it('mendukung Minggu serta format jadwal tunggal lama', () => {
    expect(parseHariLatihan(7)).toEqual([7])
    expect(parseHariLatihan('7')).toEqual([7])
    expect(getEkskulInputWindow('7', new Date('2026-10-11T13:00:00+07:00')).allowed).toBe(true)
  })
})
