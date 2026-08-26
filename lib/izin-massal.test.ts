import { describe, expect, it } from 'vitest'
import {
  buildTanggalRange,
  gabungKeterangan,
  isValidTanggal,
  normalisasiJamPelajaran,
  rencanaIzinMassal,
  toDateString,
} from './izin-massal'

describe('isValidTanggal', () => {
  it.each([
    ['2026-08-26', true],
    ['2026-8-26', false],
    ['26-08-2026', false],
    ['', false],
    [undefined, false],
    [null, false],
  ] as const)('memvalidasi format tanggal %j', (value, expected) => {
    expect(isValidTanggal(value as any)).toBe(expected)
  })
})

describe('buildTanggalRange', () => {
  it('menghasilkan satu tanggal untuk rentang satu hari', () => {
    expect(buildTanggalRange('2026-08-26', '2026-08-26')).toEqual(['2026-08-26'])
  })

  it('menghasilkan semua tanggal untuk rentang multi hari', () => {
    expect(buildTanggalRange('2026-08-26', '2026-08-29')).toEqual([
      '2026-08-26',
      '2026-08-27',
      '2026-08-28',
      '2026-08-29',
    ])
  })

  it('melewati pergantian bulan dan tahun', () => {
    expect(buildTanggalRange('2026-02-28', '2026-03-02')).toEqual([
      '2026-02-28',
      '2026-03-01',
      '2026-03-02',
    ])
  })

  it('mengembalikan array kosong saat mulai lebih besar dari selesai', () => {
    expect(buildTanggalRange('2026-08-29', '2026-08-26')).toEqual([])
  })

  it('mengembalikan array kosong untuk tanggal tidak valid', () => {
    expect(buildTanggalRange('2026-13-01', '2026-08-26')).toEqual([])
    expect(buildTanggalRange('', '2026-08-26')).toEqual([])
  })
})

describe('toDateString', () => {
  it('memformat tanggal lokal menjadi YYYY-MM-DD', () => {
    expect(toDateString(new Date(2026, 7, 26))).toBe('2026-08-26')
  })
})

describe('rencanaIzinMassal', () => {
  it('membuat pasangan siswa × tanggal untuk semua kombinasi', () => {
    const result = rencanaIzinMassal({
      siswaIds: ['s1', 's2'],
      tanggalList: ['2026-08-26', '2026-08-27'],
      existingPairs: [],
    })
    expect(result.dibuat).toEqual([
      { siswaId: 's1', tanggal: '2026-08-26' },
      { siswaId: 's1', tanggal: '2026-08-27' },
      { siswaId: 's2', tanggal: '2026-08-26' },
      { siswaId: 's2', tanggal: '2026-08-27' },
    ])
    expect(result.dilewati).toBe(0)
  })

  it('melewati pasangan siswa+tanggal yang sudah ada izin', () => {
    const result = rencanaIzinMassal({
      siswaIds: ['s1', 's2'],
      tanggalList: ['2026-08-26', '2026-08-27'],
      existingPairs: ['s1|2026-08-26', 's2|2026-08-27'],
    })
    expect(result.dibuat).toEqual([
      { siswaId: 's1', tanggal: '2026-08-27' },
      { siswaId: 's2', tanggal: '2026-08-26' },
    ])
    expect(result.dilewati).toBe(2)
  })
})

describe('gabungKeterangan', () => {
  it('mengembalikan nama kegiatan saja tanpa detail', () => {
    expect(gabungKeterangan('Bimbingan Olimpiade', '')).toBe('Bimbingan Olimpiade')
    expect(gabungKeterangan('Bimbingan Olimpiade', null)).toBe('Bimbingan Olimpiade')
  })

  it('menggabungkan nama kegiatan dengan detail', () => {
    expect(gabungKeterangan('Bimbingan Olimpiade', 'Ruang lab biologi')).toBe('Bimbingan Olimpiade — Ruang lab biologi')
  })
})

describe('normalisasiJamPelajaran', () => {
  it('mengembalikan null untuk input kosong (sehari penuh)', () => {
    expect(normalisasiJamPelajaran(null)).toBeNull()
    expect(normalisasiJamPelajaran([])).toBeNull()
  })

  it('mengurutkan dan membuang duplikat jam', () => {
    expect(normalisasiJamPelajaran([3, 1, 3, 2])).toEqual([1, 2, 3])
  })

  it('membuang jam di luar rentang 1-10', () => {
    expect(normalisasiJamPelajaran([1, 11, 0])).toEqual([1])
    expect(normalisasiJamPelajaran([99, -1])).toBeNull()
  })
})
