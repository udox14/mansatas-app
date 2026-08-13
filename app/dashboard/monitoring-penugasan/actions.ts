'use server'

import { getDB } from '@/utils/db'
import { getCurrentUser } from '@/utils/auth/server'
import { checkFeatureAccess } from '@/lib/features'
import { formatNamaKelas } from '@/lib/utils'

export type MonitoringDelegasi = {
  delegasi_id: string
  dari_nama: string
  kepada_nama: string
  status: string
  alasan_ketidakhadiran: 'SAKIT' | 'IZIN'
  deskripsi_ketidakhadiran: string
  tanggal: string
  created_at: string
  items: Array<{
    kelas_label: string
    mapel_nama: string
    tugas: string
    absen_selesai: boolean
    pelaksana_nama: string | null
  }>
}

export type MonitoringPetugasPiket = {
  id: string
  nama: string
  shift_nama: string
}

function getHariFromDate(dateStr: string): number {
  const day = new Date(dateStr + 'T00:00:00').getDay()
  return day === 0 ? 7 : day
}

export async function getPetugasPiketMonitoring(tanggal: string): Promise<MonitoringPetugasPiket[]> {
  const user = await getCurrentUser()
  if (!user) return []

  const db = await getDB()
  if (!(await checkFeatureAccess(db, user.id, 'monitoring-penugasan'))) return []

  const hari = getHariFromDate(tanggal)
  const [regular, ppl] = await Promise.all([
    db.prepare(`
      SELECT u.id, u.nama_lengkap, sp.nama_shift, sp.jam_mulai
      FROM "user" u
      JOIN jadwal_guru_piket j ON j.user_id = u.id
      JOIN pengaturan_shift_piket sp ON sp.id = j.shift_id
      WHERE j.hari = ? AND u.banned = 0
      ORDER BY sp.jam_mulai, u.nama_lengkap
    `).bind(hari).all<any>(),
    db.prepare(`
      SELECT u.id, u.nama_lengkap || ' (PPL)' AS nama_lengkap, sp.nama_shift, sp.jam_mulai
      FROM "user" u
      JOIN guru_ppl_mapping jpp ON jpp.guru_ppl_id = u.id
      JOIN jadwal_guru_piket j ON j.id = jpp.jadwal_piket_id
      JOIN pengaturan_shift_piket sp ON sp.id = j.shift_id
      WHERE j.hari = ? AND u.banned = 0
      ORDER BY sp.jam_mulai, u.nama_lengkap
    `).bind(hari).all<any>(),
  ])

  const seen = new Set<string>()
  const petugas: MonitoringPetugasPiket[] = []
  for (const row of [...(regular.results || []), ...(ppl.results || [])]) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    petugas.push({
      id: row.id,
      nama: row.nama_lengkap || 'Tanpa Nama',
      shift_nama: row.nama_shift || 'Tanpa shift',
    })
  }
  return petugas
}

export async function getMonitoringData(tanggal: string): Promise<{ error: string | null; data: MonitoringDelegasi[] }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized', data: [] }

  const db = await getDB()
  if (!(await checkFeatureAccess(db, user.id, 'monitoring-penugasan'))) {
    return { error: 'Tidak memiliki akses.', data: [] }
  }

  const rows = await db.prepare(`
    SELECT 
      dt.id as delegasi_id, dt.status, dt.tanggal, dt.created_at,
      dt.alasan_ketidakhadiran, dt.deskripsi_ketidakhadiran,
      u1.nama_lengkap as dari_nama,
      u2.nama_lengkap as kepada_nama,
      dtk.id as dtk_id, dtk.tugas, dtk.absen_selesai,
      u_pelaksana.nama_lengkap as pelaksana_nama,
      k.tingkat, k.nomor_kelas, k.kelompok,
      mp.nama_mapel
    FROM delegasi_tugas dt
    JOIN "user" u1 ON dt.dari_user_id = u1.id
    LEFT JOIN "user" u2 ON dt.kepada_user_id = u2.id
    JOIN delegasi_tugas_kelas dtk ON dt.id = dtk.delegasi_id
    LEFT JOIN "user" u_pelaksana ON dtk.pelaksana_user_id = u_pelaksana.id
    JOIN penugasan_mengajar pm ON dtk.penugasan_mengajar_id = pm.id
    JOIN mata_pelajaran mp ON pm.mapel_id = mp.id
    JOIN kelas k ON dtk.kelas_id = k.id
    WHERE dt.tanggal = ?
    ORDER BY dt.created_at DESC, k.tingkat, k.kelompok
  `).bind(tanggal).all<any>()

  const grouped = new Map<string, MonitoringDelegasi>()

  for (const r of rows.results || []) {
    if (!grouped.has(r.delegasi_id)) {
      grouped.set(r.delegasi_id, {
        delegasi_id: r.delegasi_id,
        dari_nama: r.dari_nama || 'Tanpa Nama',
        kepada_nama: r.kepada_nama || 'Semua guru piket hari itu',
        status: r.status,
        alasan_ketidakhadiran: r.alasan_ketidakhadiran,
        deskripsi_ketidakhadiran: r.deskripsi_ketidakhadiran,
        tanggal: r.tanggal,
        created_at: r.created_at,
        items: []
      })
    }
    grouped.get(r.delegasi_id)!.items.push({
      kelas_label: formatNamaKelas(r.tingkat, r.nomor_kelas, r.kelompok),
      mapel_nama: r.nama_mapel,
      tugas: r.tugas,
      absen_selesai: !!r.absen_selesai,
      pelaksana_nama: r.pelaksana_nama || null
    })
  }

  return { error: null, data: Array.from(grouped.values()) }
}
