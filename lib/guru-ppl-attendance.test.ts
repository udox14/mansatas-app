import { describe, expect, it } from 'vitest'
import { filterPplAttendanceStatus, summarizePplAttendance, type PplAttendanceItem } from './guru-ppl-attendance'

function item(status: PplAttendanceItem['status'], key: string = status): PplAttendanceItem {
  return {
    key,
    mapping_id: 'mapping',
    tanggal: '2026-09-15',
    ppl_user_id: 'ppl',
    ppl_nama: 'Praktikan',
    kampus_id: 'kampus',
    kampus_nama: 'Universitas Contoh',
    kampus_singkatan: 'UC',
    jenis: 'KBM',
    guru_utama_id: 'guru',
    guru_utama_nama: 'Guru Utama',
    tugas_label: 'Matematika · X-1',
    jadwal_label: 'Jam 1–2',
    jam_ke_mulai: 1,
    jam_ke_selesai: 2,
    waktu_submit: null,
    status,
    catatan: null,
    is_override: false,
    override_actor_name: null,
  }
}

describe('rekap kehadiran PPL', () => {
  it('menghitung telat sebagai hadir dan mengeluarkan tugas yang diambil guru dari denominator', () => {
    const [summary] = summarizePplAttendance([
      item('HADIR', '1'), item('TELAT', '2'), item('ALFA', '3'), item('DIAMBIL_GURU', '4'),
    ])
    expect(summary).toMatchObject({
      kewajiban: 3,
      hadir: 2,
      tepat_waktu: 1,
      telat: 1,
      alfa: 1,
      diambil_guru: 1,
      persentase: 66.67,
    })
  })

  it('memakai status hasil akhir yang sama untuk filter layar dan cetak', () => {
    const items = [item('HADIR', '1'), item('SAKIT', '2'), item('DIAMBIL_GURU', '3')]
    expect(filterPplAttendanceStatus(items, 'SAKIT').map(row => row.key)).toEqual(['2'])
    expect(filterPplAttendanceStatus(items, 'semua')).toEqual(items)
  })
})
