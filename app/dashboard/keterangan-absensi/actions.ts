// Lokasi: app/dashboard/keterangan-absensi/actions.ts
'use server'

import { getDB } from '@/utils/db'
import { getCurrentUser } from '@/utils/auth/server'
import { getUserRoles } from '@/lib/features'
import { formatNamaKelas } from '@/lib/utils'
import { getKalenderDateStatus } from '@/lib/kalender-pendidikan'
import { getFinalAttendanceForClass } from '@/lib/wali-kelas-attendance'
import {
  simpanKeputusanAbsensiWali,
  simpanKeputusanAbsensiWaliBatch,
} from '@/app/dashboard/kelas-binaan/attendance-actions'

export type SiswaKeterangan = {
  siswa_id: string
  nama_lengkap: string
  nisn: string
  status: 'SAKIT' | 'IZIN' | 'ALFA' | null
  keterangan: string
  keterangan_id: string | null
  guru_status: string
  status_akhir: string
  sumber_status: string
  detail_guru: Array<{
    status: string
    nama_mapel: string
    jam_ke_mulai: number
    jam_ke_selesai: number
    catatan: string
  }>
}

export type KelasWaliKelas = {
  kelas_id: string
  kelas_label: string
  tingkat: number
  nomor_kelas: string
  kelompok: string
}

// Ambil kelas binaan wali kelas yang sedang login
export async function getKelasBinaan(): Promise<{ error: string | null; kelas: KelasWaliKelas[] }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized', kelas: [] }

  const db = await getDB()
  const roles = await getUserRoles(db, user.id)

  const isAdmin = roles.includes('super_admin') || roles.includes('admin_tu') || roles.includes('kepsek') || roles.includes('wakamad')

  let rows: any[]
  if (isAdmin) {
    rows = (await db.prepare(
      `SELECT id, tingkat, nomor_kelas, kelompok FROM kelas ORDER BY tingkat, CAST(nomor_kelas AS INTEGER)`
    ).all<any>()).results || []
  } else {
    // Wali kelas hanya melihat kelas binaannya sendiri
    rows = (await db.prepare(
      `SELECT id, tingkat, nomor_kelas, kelompok FROM kelas WHERE wali_kelas_id = ? ORDER BY tingkat, CAST(nomor_kelas AS INTEGER)`
    ).bind(user.id).all<any>()).results || []
  }

  return {
    error: null,
    kelas: rows.map(r => ({
      kelas_id: r.id,
      kelas_label: formatNamaKelas(r.tingkat, r.nomor_kelas, r.kelompok),
      tingkat: r.tingkat,
      nomor_kelas: r.nomor_kelas,
      kelompok: r.kelompok,
    })),
  }
}

// Load daftar siswa + keterangan yang sudah ada untuk kelas & tanggal tertentu
export async function loadSiswaKeterangan(kelasId: string, tanggal: string): Promise<{
  error: string | null
  siswa: SiswaKeterangan[]
  calendarStatus?: { isEffective: boolean; reason: string | null; category: string | null }
}> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized', siswa: [] }

  const db = await getDB()
  const roles = await getUserRoles(db, user.id)
  const calendarStatus = await getKalenderDateStatus(db, tanggal)

  // Validasi: wali_kelas hanya boleh akses kelas binaannya
  if (!roles.includes('super_admin') && !roles.includes('admin_tu') && !roles.includes('kepsek') && !roles.includes('wakamad')) {
    const kelas = await db.prepare(
      `SELECT id FROM kelas WHERE id = ? AND wali_kelas_id = ?`
    ).bind(kelasId, user.id).first<any>()
    if (!kelas) return { error: 'Anda tidak memiliki akses ke kelas ini', siswa: [] }
  }

  const [snapshot, keteranganRes] = await Promise.all([
    getFinalAttendanceForClass(db, kelasId, tanggal, tanggal),
    db.prepare(
      `SELECT id, siswa_id FROM keterangan_absensi_wali_kelas WHERE tanggal = ? AND siswa_id IN (SELECT id FROM siswa WHERE kelas_id = ? AND status = 'aktif')`
    ).bind(tanggal, kelasId).all<any>(),
  ])

  const ketIdMap = new Map<string, string>()
  for (const k of keteranganRes.results || []) ketIdMap.set(k.siswa_id, k.id)

  return {
    error: null,
    calendarStatus: {
      isEffective: calendarStatus.isEffective,
      reason: calendarStatus.reason,
      category: calendarStatus.category,
    },
    siswa: (snapshot?.siswa || []).map((s: any) => {
      const detail = snapshot?.statusByStudent.get(s.id)?.find(item => item.tanggal === tanggal)
      return {
        siswa_id: s.id,
        nama_lengkap: s.nama_lengkap,
        nisn: s.nisn,
        status: detail?.wali_status || null,
        keterangan: detail?.keterangan_wali_kelas || '',
        keterangan_id: ketIdMap.get(s.id) || null,
        guru_status: detail?.guru_status || 'BELUM_ADA_DATA',
        status_akhir: detail?.status_akhir || 'BELUM_ADA_DATA',
        sumber_status: detail?.sumber_status || 'belum_ada_data',
        detail_guru: detail?.detail_guru || [],
      }
    }),
  }
}

// Simpan / update / hapus keterangan satu siswa
export async function simpanKeterangan(
  siswaId: string,
  tanggal: string,
  status: 'SAKIT' | 'IZIN' | 'ALFA' | null,
  keterangan: string
): Promise<{ error?: string; success?: string }> {
  return simpanKeputusanAbsensiWali(siswaId, tanggal, status, keterangan)
}

// Simpan batch keterangan (banyak siswa sekaligus)
export async function simpanKeteranganBatch(
  kelasId: string,
  tanggal: string,
  data: Array<{ siswa_id: string; status: 'SAKIT' | 'IZIN' | 'ALFA' | null; keterangan: string }>
): Promise<{ error?: string; success?: string }> {
  return simpanKeputusanAbsensiWaliBatch(kelasId, tanggal, data)
}
