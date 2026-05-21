'use server'

import { revalidatePath } from 'next/cache'
import { getUserRoles } from '@/lib/features'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'

type WaliStatus = 'HADIR' | 'SAKIT' | 'IZIN' | 'ALFA'

type KeputusanAbsensiInput = {
  siswa_id: string
  status: WaliStatus | null
  keterangan: string
}

function isAdminRole(roles: string[]) {
  return roles.some(role => ['super_admin', 'admin_tu', 'kepsek', 'wakamad'].includes(role))
}

async function canAccessKelas(db: D1Database, userId: string, kelasId: string, roles: string[]) {
  if (isAdminRole(roles)) return true

  const kelas = await db.prepare(
    `SELECT id FROM kelas WHERE id = ? AND wali_kelas_id = ? LIMIT 1`
  ).bind(kelasId, userId).first<{ id: string }>()

  return !!kelas
}

function revalidateAttendanceViews() {
  revalidatePath('/dashboard/kelas-binaan')
  revalidatePath('/dashboard/keterangan-absensi')
  revalidatePath('/dashboard/rekap-absensi')
  revalidatePath('/portal-ortu')
}

export async function simpanKeputusanAbsensiWaliBatch(
  kelasId: string,
  tanggal: string,
  data: KeputusanAbsensiInput[]
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  if (!kelasId || !tanggal) return { error: 'Kelas dan tanggal wajib dipilih.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) return { error: 'Format tanggal tidak valid.' }

  const db = await getDB()
  const roles = await getUserRoles(db, user.id)
  const allowed = await canAccessKelas(db, user.id, kelasId, roles)
  if (!allowed) return { error: 'Akses ditolak' }

  const siswaIds = data.map(item => item.siswa_id).filter(Boolean)
  if (siswaIds.length === 0) return { error: 'Tidak ada data siswa untuk disimpan.' }

  const placeholders = siswaIds.map(() => '?').join(',')
  const siswaRes = await db.prepare(`
    SELECT id
    FROM siswa
    WHERE kelas_id = ? AND status = 'aktif' AND id IN (${placeholders})
  `).bind(kelasId, ...siswaIds).all<{ id: string }>()

  const allowedSiswaIds = new Set((siswaRes.results || []).map(row => row.id))
  if (allowedSiswaIds.size !== new Set(siswaIds).size) {
    return { error: 'Ada siswa yang tidak termasuk kelas ini.' }
  }

  const toDelete = data.filter(item => item.status === null)
  const toUpsert = data.filter((item): item is KeputusanAbsensiInput & { status: WaliStatus } => item.status !== null)

  try {
    const stmts: D1PreparedStatement[] = []

    for (const item of toDelete) {
      stmts.push(
        db.prepare(`DELETE FROM keterangan_absensi_wali_kelas WHERE siswa_id = ? AND tanggal = ?`)
          .bind(item.siswa_id, tanggal)
      )
    }

    for (const item of toUpsert) {
      stmts.push(
        db.prepare(`
          INSERT INTO keterangan_absensi_wali_kelas (id, siswa_id, tanggal, status, keterangan, dibuat_oleh)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(siswa_id, tanggal) DO UPDATE SET
            status = excluded.status,
            keterangan = excluded.keterangan,
            dibuat_oleh = excluded.dibuat_oleh,
            updated_at = datetime('now')
        `).bind(crypto.randomUUID(), item.siswa_id, tanggal, item.status, item.keterangan || null, user.id)
      )
    }

    for (let i = 0; i < stmts.length; i += 100) {
      await db.batch(stmts.slice(i, i + 100))
    }

    revalidateAttendanceViews()

    const saved = toUpsert.length
    const removed = toDelete.length
    if (saved > 0 && removed > 0) return { success: `${saved} keputusan disimpan, status lainnya mengikuti input guru.` }
    if (saved > 0) return { success: `${saved} keputusan absensi disimpan.` }
    return { success: 'Keputusan absensi diperbarui.' }
  } catch (e: any) {
    return { error: e.message }
  }
}

export async function simpanKeputusanAbsensiWali(
  siswaId: string,
  tanggal: string,
  status: WaliStatus | null,
  keterangan: string
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  const db = await getDB()
  const siswa = await db.prepare(`
    SELECT s.kelas_id
    FROM siswa s
    WHERE s.id = ? AND s.status = 'aktif'
    LIMIT 1
  `).bind(siswaId).first<{ kelas_id: string }>()

  if (!siswa?.kelas_id) return { error: 'Siswa tidak valid.' }

  return simpanKeputusanAbsensiWaliBatch(siswa.kelas_id, tanggal, [
    { siswa_id: siswaId, status, keterangan },
  ])
}
