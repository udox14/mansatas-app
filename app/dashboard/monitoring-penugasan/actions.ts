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
  tanggal: string
  created_at: string
  items: Array<{
    kelas_label: string
    mapel_nama: string
    tugas: string
    absen_selesai: boolean
  }>
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
      u1.nama_lengkap as dari_nama,
      u2.nama_lengkap as kepada_nama,
      dtk.id as dtk_id, dtk.tugas, dtk.absen_selesai,
      k.tingkat, k.nomor_kelas, k.kelompok,
      mp.nama_mapel
    FROM delegasi_tugas dt
    JOIN "user" u1 ON dt.dari_user_id = u1.id
    JOIN "user" u2 ON dt.kepada_user_id = u2.id
    JOIN delegasi_tugas_kelas dtk ON dt.id = dtk.delegasi_id
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
        kepada_nama: r.kepada_nama || 'Tanpa Nama',
        status: r.status,
        tanggal: r.tanggal,
        created_at: r.created_at,
        items: []
      })
    }
    grouped.get(r.delegasi_id)!.items.push({
      kelas_label: formatNamaKelas(r.tingkat, r.nomor_kelas, r.kelompok),
      mapel_nama: r.nama_mapel,
      tugas: r.tugas,
      absen_selesai: !!r.absen_selesai
    })
  }

  return { error: null, data: Array.from(grouped.values()) }
}
