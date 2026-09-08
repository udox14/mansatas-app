import { describe, expect, it } from 'vitest'
import {
  getTeacherAttendanceMonthRange,
  normalizeTeacherAttendanceMonth,
  resolveTeacherAttendanceStatus,
  summarizeTeacherAttendance,
  toTeacherAttendancePublicResult,
  type TeacherAttendanceItem,
  type TeacherAttendanceStatus,
} from './teacher-attendance-core'

function item(status: TeacherAttendanceStatus, key: string): TeacherAttendanceItem {
  return {
    key,
    agendaId: null,
    tanggal: '2026-08-03',
    status,
    penugasanId: key,
    mapelNama: 'Matematika',
    kelasId: 'kelas-1',
    kelasLabel: 'X-1',
    jamKeMulai: 1,
    jamKeSelesai: 2,
    slotMulai: '07:00',
    slotSelesai: '08:20',
    materi: null,
    waktuInput: null,
    catatan: null,
  }
}

describe('resolveTeacherAttendanceStatus', () => {
  it.each([
    ['TEPAT_WAKTU', null, true, 'TEPAT_WAKTU'],
    ['TELAT', null, true, 'TELAT'],
    ['SAKIT', null, true, 'SAKIT'],
    ['IZIN', null, true, 'IZIN'],
    ['ALFA', null, true, 'ALFA'],
    [null, 'SAKIT', true, 'SAKIT'],
    [null, 'IZIN', true, 'IZIN'],
    [null, null, true, 'ALFA'],
    [null, null, false, null],
  ] as const)('agenda=%s delegasi=%s selesai=%s menghasilkan %s', (agendaStatus, delegationReason, blockEnded, expected) => {
    expect(resolveTeacherAttendanceStatus({ agendaStatus, delegationReason, blockEnded })).toBe(expected)
  })

  it('memprioritaskan agenda di atas delegasi', () => {
    expect(resolveTeacherAttendanceStatus({
      agendaStatus: 'TELAT',
      delegationReason: 'SAKIT',
      blockEnded: true,
    })).toBe('TELAT')
  })
})

describe('summarizeTeacherAttendance', () => {
  it('menghitung telat sebagai hadir sekaligus sebagai metrik telat', () => {
    const summary = summarizeTeacherAttendance([
      item('TEPAT_WAKTU', '1'),
      item('TELAT', '2'),
      item('SAKIT', '3'),
      item('IZIN', '4'),
      item('ALFA', '5'),
    ])

    expect(summary).toEqual({ total: 5, hadir: 2, telat: 1, sakit: 1, izin: 1, izinSekolah: 0, alfa: 1 })
  })

  it('menjaga kredit performa tanpa membocorkan kategori izin ke data guru', () => {
    const schoolLeave = { ...item('IZIN', '2'), alasan_izin_guru_id: 'rapat', alasan_izin_guru_nama: 'Rapat', kepentingan_sekolah: true }
    const items = [item('TEPAT_WAKTU', '1'), schoolLeave, item('IZIN', '3')]
    const result = toTeacherAttendancePublicResult({
      month: '2026-08',
      rangeStart: '2026-08-01',
      rangeEnd: '2026-08-31',
      summary: summarizeTeacherAttendance(items),
      items,
    })

    expect(result.summary).toEqual({ total: 3, hadir: 1, telat: 0, sakit: 0, izin: 2, alfa: 0, performa: 67 })
    expect(result.items[1]).not.toHaveProperty('alasan_izin_guru_id')
    expect(result.items[1]).not.toHaveProperty('alasan_izin_guru_nama')
    expect(result.items[1]).not.toHaveProperty('kepentingan_sekolah')
    expect(result.summary).not.toHaveProperty('izinSekolah')
  })
})

describe('periode riwayat kehadiran guru', () => {
  it('membatasi bulan sebelum penggunaan resmi ke Juli 2026', () => {
    expect(normalizeTeacherAttendanceMonth('2026-05', '2026-08-20')).toBe('2026-07')
    expect(getTeacherAttendanceMonthRange('2026-07', '2026-08-20')).toEqual({
      start: '2026-07-20',
      end: '2026-07-31',
    })
  })

  it('mengembalikan bulan berjalan untuk format salah atau bulan masa depan', () => {
    expect(normalizeTeacherAttendanceMonth('bukan-bulan', '2026-08-20')).toBe('2026-08')
    expect(normalizeTeacherAttendanceMonth('2026-12', '2026-08-20')).toBe('2026-08')
  })

  it('memotong akhir bulan berjalan sampai hari ini', () => {
    expect(getTeacherAttendanceMonthRange('2026-08', '2026-08-20')).toEqual({
      start: '2026-08-01',
      end: '2026-08-20',
    })
  })
})
