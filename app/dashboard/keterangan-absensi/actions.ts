// Lokasi: app/dashboard/keterangan-absensi/actions.ts
'use server'

import { getDB } from '@/utils/db'
import { getCurrentUser } from '@/utils/auth/server'
import { getUserRoles } from '@/lib/features'
import { revalidatePath } from 'next/cache'
import { formatNamaKelas } from '@/lib/utils'

export type SiswaKeterangan = {
  siswa_id: string
  nama_lengkap: string
  nisn: string
  status: 'SAKIT' | 'IZIN' | null
  keterangan: string
  keterangan_id: string | null
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

  // super_admin bisa lihat semua kelas, wali_kelas hanya kelasnya
  let rows: any[]
  if (roles.includes('super_admin') || roles.includes('admin_tu') || roles.includes('kepsek') || roles.includes('wakamad')) {
    rows = (await db.prepare(
      `SELECT id, tingkat, nomor_kelas, kelompok FROM kelas ORDER BY tingkat, nomor_kelas`
    ).all<any>()).results || []
  } else {
    rows = (await db.prepare(
      `SELECT id, tingkat, nomor_kelas, kelompok FROM kelas WHERE wali_kelas_id = ? ORDER BY tingkat, nomor_kelas`
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
}> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized', siswa: [] }

  const db = await getDB()
  const roles = await getUserRoles(db, user.id)

  // Validasi: wali_kelas hanya boleh akses kelas binaannya
  if (!roles.includes('super_admin') && !roles.includes('admin_tu') && !roles.includes('kepsek') && !roles.includes('wakamad')) {
    const kelas = await db.prepare(
      `SELECT id FROM kelas WHERE id = ? AND wali_kelas_id = ?`
    ).bind(kelasId, user.id).first<any>()
    if (!kelas) return { error: 'Anda tidak memiliki akses ke kelas ini', siswa: [] }
  }

  const [siswaRes, keteranganRes] = await Promise.all([
    db.prepare(
      `SELECT id, nama_lengkap, nisn FROM siswa WHERE kelas_id = ? AND status = 'aktif' ORDER BY nama_lengkap`
    ).bind(kelasId).all<any>(),
    db.prepare(
      `SELECT id, siswa_id, status, keterangan FROM keterangan_absensi_wali_kelas WHERE tanggal = ? AND siswa_id IN (SELECT id FROM siswa WHERE kelas_id = ? AND status = 'aktif')`
    ).bind(tanggal, kelasId).all<any>(),
  ])

  const ketMap = new Map<string, { id: string; status: string; keterangan: string }>()
  for (const k of keteranganRes.results || []) {
    ketMap.set(k.siswa_id, { id: k.id, status: k.status, keterangan: k.keterangan || '' })
  }

  return {
    error: null,
    siswa: (siswaRes.results || []).map((s: any) => {
      const ket = ketMap.get(s.id)
      return {
        siswa_id: s.id,
        nama_lengkap: s.nama_lengkap,
        nisn: s.nisn,
        status: (ket?.status as 'SAKIT' | 'IZIN') || null,
        keterangan: ket?.keterangan || '',
        keterangan_id: ket?.id || null,
      }
    }),
  }
}

// Simpan / update / hapus keterangan satu siswa
export async function simpanKeterangan(
  siswaId: string,
  tanggal: string,
  status: 'SAKIT' | 'IZIN' | null,
  keterangan: string
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  const db = await getDB()

  // Validasi wali kelas hanya boleh akses siswa di kelas binaannya
  const roles = await getUserRoles(db, user.id)
  if (!roles.includes('super_admin') && !roles.includes('admin_tu') && !roles.includes('kepsek') && !roles.includes('wakamad')) {
    const siswa = await db.prepare(
      `SELECT s.id FROM siswa s JOIN kelas k ON s.kelas_id = k.id WHERE s.id = ? AND k.wali_kelas_id = ?`
    ).bind(siswaId, user.id).first<any>()
    if (!siswa) return { error: 'Akses ditolak' }
  }

  try {
    if (status === null) {
      // Hapus keterangan jika status di-clear
      await db.prepare(
        `DELETE FROM keterangan_absensi_wali_kelas WHERE siswa_id = ? AND tanggal = ?`
      ).bind(siswaId, tanggal).run()
      revalidatePath('/dashboard/keterangan-absensi')
      return { success: 'Keterangan dihapus' }
    }

    // Upsert
    const id = crypto.randomUUID()
    await db.prepare(`
      INSERT INTO keterangan_absensi_wali_kelas (id, siswa_id, tanggal, status, keterangan, dibuat_oleh)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(siswa_id, tanggal) DO UPDATE SET
        status = excluded.status,
        keterangan = excluded.keterangan,
        dibuat_oleh = excluded.dibuat_oleh,
        updated_at = datetime('now')
    `).bind(id, siswaId, tanggal, status, keterangan || null, user.id).run()

    revalidatePath('/dashboard/keterangan-absensi')
    return { success: 'Keterangan disimpan' }
  } catch (e: any) {
    return { error: e.message }
  }
}

// Simpan batch keterangan (banyak siswa sekaligus)
export async function simpanKeteranganBatch(
  kelasId: string,
  tanggal: string,
  data: Array<{ siswa_id: string; status: 'SAKIT' | 'IZIN' | null; keterangan: string }>
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  const db = await getDB()
  const roles = await getUserRoles(db, user.id)

  if (!roles.includes('super_admin') && !roles.includes('admin_tu') && !roles.includes('kepsek') && !roles.includes('wakamad')) {
    const kelas = await db.prepare(
      `SELECT id FROM kelas WHERE id = ? AND wali_kelas_id = ?`
    ).bind(kelasId, user.id).first<any>()
    if (!kelas) return { error: 'Akses ditolak' }
  }

  const toDelete = data.filter(d => d.status === null).map(d => d.siswa_id)
  const toUpsert = data.filter(d => d.status !== null)

  try {
    const stmts: any[] = []

    if (toDelete.length > 0) {
      for (const siswaId of toDelete) {
        stmts.push(
          db.prepare(`DELETE FROM keterangan_absensi_wali_kelas WHERE siswa_id = ? AND tanggal = ?`)
            .bind(siswaId, tanggal)
        )
      }
    }

    for (const d of toUpsert) {
      const id = crypto.randomUUID()
      stmts.push(
        db.prepare(`
          INSERT INTO keterangan_absensi_wali_kelas (id, siswa_id, tanggal, status, keterangan, dibuat_oleh)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(siswa_id, tanggal) DO UPDATE SET
            status = excluded.status,
            keterangan = excluded.keterangan,
            dibuat_oleh = excluded.dibuat_oleh,
            updated_at = datetime('now')
        `).bind(id, d.siswa_id, tanggal, d.status, d.keterangan || null, user.id)
      )
    }

    for (let i = 0; i < stmts.length; i += 100) {
      await db.batch(stmts.slice(i, i + 100))
    }

    revalidatePath('/dashboard/keterangan-absensi')
    const jumlah = toUpsert.length
    return { success: jumlah > 0 ? `${jumlah} keterangan disimpan` : 'Keterangan dihapus' }
  } catch (e: any) {
    return { error: e.message }
  }
}
