import { describe, expect, it } from 'vitest'
import { buildAssignmentTeachingRows } from './ckh'

describe('buildAssignmentTeachingRows', () => {
  it('membentuk catatan CKH penugasan tanpa alasan ketidakhadiran', () => {
    const rows = buildAssignmentTeachingRows([
      {
        tanggal: '2026-08-20',
        tugas: 'Kerjakan latihan bab 2',
        nama_mapel: 'Matematika',
        tingkat: 10,
        nomor_kelas: '1',
        kelompok: 'A',
      },
    ])

    expect(rows).toEqual([{
      tanggal: '2026-08-20',
      kegiatan_bulanan: 'Melaksanakan proses pembelajaran',
      catatan_harian: 'Mengajar Matematika: "Kerjakan latihan bab 2" di kelas 10-1 A',
      vol: 1,
      source: 'assignment',
      source_key: 'assignment:2026-08-20:Matematika:Kerjakan latihan bab 2',
    }])
    expect(rows[0].catatan_harian).not.toMatch(/sakit|izin/i)
  })

  it('menggabungkan kelas yang menerima tugas dan materi yang sama', () => {
    const rows = buildAssignmentTeachingRows([
      { tanggal: '2026-08-20', tugas: 'LKPD 1', nama_mapel: 'Biologi', tingkat: 10, nomor_kelas: '2', kelompok: 'B' },
      { tanggal: '2026-08-20', tugas: 'LKPD 1', nama_mapel: 'Biologi', tingkat: 10, nomor_kelas: '1', kelompok: 'A' },
    ])

    expect(rows).toHaveLength(1)
    expect(rows[0].vol).toBe(2)
    expect(rows[0].catatan_harian).toContain('kelas 10-1 A dan 10-2 B')
  })
})
