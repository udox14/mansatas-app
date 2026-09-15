export type PplAttendanceStatus = 'HADIR' | 'TELAT' | 'SAKIT' | 'IZIN' | 'ALFA' | 'DIAMBIL_GURU'
export type PplDutyType = 'KBM' | 'PIKET'

export type PplCampus = {
  id: string
  nama: string
  singkatan: string | null
}

export type PplAssignmentPeriod = {
  id: string
  guru_ppl_id: string
  guru_utama_id: string
  guru_utama_nama: string
  jenis: PplDutyType
  tugas_id: string
  tugas_label: string
  jadwal_label: string
  berlaku_mulai: string
  berlaku_selesai: string | null
}

export type PplAttendanceOverride = {
  mapping_id: string
  tanggal: string
  status: Exclude<PplAttendanceStatus, 'DIAMBIL_GURU'>
  catatan: string | null
  diubah_oleh: string
  diubah_oleh_nama?: string | null
  updated_at?: string | null
}

export type PplAttendanceItem = {
  key: string
  mapping_id: string
  tanggal: string
  ppl_user_id: string
  ppl_nama: string
  kampus_id: string | null
  kampus_nama: string | null
  kampus_singkatan: string | null
  jenis: PplDutyType
  guru_utama_id: string
  guru_utama_nama: string
  tugas_label: string
  jadwal_label: string
  jam_ke_mulai: number
  jam_ke_selesai: number
  waktu_submit: string | null
  status: PplAttendanceStatus
  catatan: string | null
  is_override: boolean
  override_actor_name: string | null
}

export type PplAttendanceSummary = {
  ppl_user_id: string
  ppl_nama: string
  kampus_id: string | null
  kampus_nama: string | null
  kampus_singkatan: string | null
  kewajiban: number
  hadir: number
  tepat_waktu: number
  telat: number
  sakit: number
  izin: number
  alfa: number
  diambil_guru: number
  persentase: number
}

export function summarizePplAttendance(items: PplAttendanceItem[]): PplAttendanceSummary[] {
  const grouped = new Map<string, PplAttendanceSummary>()
  for (const item of items) {
    if (!grouped.has(item.ppl_user_id)) {
      grouped.set(item.ppl_user_id, {
        ppl_user_id: item.ppl_user_id,
        ppl_nama: item.ppl_nama,
        kampus_id: item.kampus_id,
        kampus_nama: item.kampus_nama,
        kampus_singkatan: item.kampus_singkatan,
        kewajiban: 0, hadir: 0, tepat_waktu: 0, telat: 0,
        sakit: 0, izin: 0, alfa: 0, diambil_guru: 0, persentase: 0,
      })
    }
    const row = grouped.get(item.ppl_user_id)!
    if (item.status === 'DIAMBIL_GURU') {
      row.diambil_guru++
      continue
    }
    row.kewajiban++
    if (item.status === 'HADIR') { row.hadir++; row.tepat_waktu++ }
    else if (item.status === 'TELAT') { row.hadir++; row.telat++ }
    else if (item.status === 'SAKIT') row.sakit++
    else if (item.status === 'IZIN') row.izin++
    else row.alfa++
  }
  return [...grouped.values()].map(row => ({
    ...row,
    persentase: row.kewajiban ? Math.round((row.hadir / row.kewajiban) * 10000) / 100 : 0,
  })).sort((a, b) => a.ppl_nama.localeCompare(b.ppl_nama, 'id-ID'))
}

export function filterPplAttendanceStatus(items: PplAttendanceItem[], status?: string) {
  return !status || status === 'semua' ? items : items.filter(item => item.status === status)
}
