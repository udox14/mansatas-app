// Lokasi: app/dashboard/ekstrakurikuler/master/actions.ts
'use server'

import { getDB, dbInsert, dbUpdate, dbDelete } from '@/utils/db'
import { getCurrentUser } from '@/utils/auth/server'
import { checkFeatureAccess } from '@/lib/features'
import { revalidatePath } from 'next/cache'

const FEATURE = 'ekstrakurikuler-master'
const MODE_NILAI = ['angka', 'huruf'] as const

// ============================================================
// TYPES
// ============================================================
export type EkskulMaster = {
  id: string
  nama: string
  deskripsi: string | null
  mode_nilai: 'angka' | 'huruf'
  status: string
  jml_anggota: number
  pembina_nama: string | null
  pembina_ids: string | null   // CSV pembina_id
}

export type GuruOption = { id: string; nama_lengkap: string; role: string }

export type MonitoringRow = {
  id: string
  nama: string
  jml_anggota: number
  jml_pertemuan: number
  pertemuan_terakhir: string | null
}

// ============================================================
// GUARD
// ============================================================
async function assertAdmin(): Promise<{ db: D1Database; userId: string } | { error: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }
  const db = await getDB()
  const allowed = await checkFeatureAccess(db, user.id, FEATURE)
  if (!allowed) return { error: 'Anda tidak punya akses kelola master ekstrakurikuler.' }
  return { db, userId: user.id }
}

// ============================================================
// 1. LIST EKSKUL (master table)
// ============================================================
export async function getEkskulList(): Promise<EkskulMaster[]> {
  const db = await getDB()
  const { results } = await db.prepare(`
    SELECT
      e.id, e.nama, e.deskripsi, e.mode_nilai, e.status,
      (SELECT COUNT(*) FROM ekstrakurikuler_anggota a
        WHERE a.ekstrakurikuler_id = e.id AND a.status = 'aktif') AS jml_anggota,
      (SELECT GROUP_CONCAT(u.nama_lengkap, ', ') FROM ekstrakurikuler_pembina p
        JOIN "user" u ON p.pembina_id = u.id WHERE p.ekstrakurikuler_id = e.id) AS pembina_nama,
      (SELECT GROUP_CONCAT(p.pembina_id) FROM ekstrakurikuler_pembina p
        WHERE p.ekstrakurikuler_id = e.id) AS pembina_ids
    FROM ekstrakurikuler e
    ORDER BY e.status ASC, e.nama ASC
  `).all<any>()
  return results || []
}

// ============================================================
// 2. KANDIDAT PEMBINA (guru/pegawai)
// ============================================================
export async function getGuruList(): Promise<GuruOption[]> {
  const db = await getDB()
  const ROLES = ['guru', 'wali_kelas', 'guru_bk', 'guru_piket', 'guru_ppl', 'guru_tahfidz', 'wakamad', 'kepsek']
  const ph = ROLES.map(() => '?').join(',')
  const { results } = await db.prepare(`
    SELECT DISTINCT u.id, u.nama_lengkap, u.role
    FROM "user" u
    WHERE u.role IN (${ph})
       OR u.id IN (SELECT user_id FROM user_roles WHERE role IN (${ph}))
    ORDER BY u.nama_lengkap ASC
  `).bind(...ROLES, ...ROLES).all<GuruOption>()
  return results || []
}

// ============================================================
// 3. CRUD MASTER
// ============================================================
export async function tambahEkskul(_prev: any, formData: FormData): Promise<{ error?: string | null; success?: string | null }> {
  const guard = await assertAdmin()
  if ('error' in guard) return { error: guard.error }
  const { db } = guard

  const nama = (formData.get('nama') as string)?.trim()
  const deskripsi = (formData.get('deskripsi') as string)?.trim() || null
  const mode_nilai = formData.get('mode_nilai') as string
  if (!nama) return { error: 'Nama ekstrakurikuler wajib diisi.' }
  if (!MODE_NILAI.includes(mode_nilai as any)) return { error: 'Mode nilai tidak valid.' }

  const res = await dbInsert(db, 'ekstrakurikuler', { nama, deskripsi, mode_nilai })
  if (res.error) return { error: res.error }

  revalidatePath('/dashboard/ekstrakurikuler/master')
  return { success: 'Ekstrakurikuler berhasil ditambahkan.' }
}

export async function editEkskul(_prev: any, formData: FormData): Promise<{ error?: string | null; success?: string | null }> {
  const guard = await assertAdmin()
  if ('error' in guard) return { error: guard.error }
  const { db } = guard

  const id = formData.get('id') as string
  const nama = (formData.get('nama') as string)?.trim()
  const deskripsi = (formData.get('deskripsi') as string)?.trim() || null
  const mode_nilai = formData.get('mode_nilai') as string
  const status = (formData.get('status') as string) || 'aktif'
  if (!id) return { error: 'ID tidak valid.' }
  if (!nama) return { error: 'Nama ekstrakurikuler wajib diisi.' }
  if (!MODE_NILAI.includes(mode_nilai as any)) return { error: 'Mode nilai tidak valid.' }

  const res = await dbUpdate(db, 'ekstrakurikuler', {
    nama, deskripsi, mode_nilai, status, updated_at: new Date().toISOString(),
  }, { id })
  if (res.error) return { error: res.error }

  revalidatePath('/dashboard/ekstrakurikuler/master')
  return { success: 'Ekstrakurikuler berhasil diperbarui.' }
}

export async function hapusEkskul(id: string): Promise<{ error?: string; success?: string }> {
  const guard = await assertAdmin()
  if ('error' in guard) return { error: guard.error }
  const { db } = guard

  // Hard delete — cascade ke pembina/anggota/pertemuan/absensi/nilai (ON DELETE CASCADE)
  const res = await dbDelete(db, 'ekstrakurikuler', { id })
  if (res.error) return { error: res.error }

  revalidatePath('/dashboard/ekstrakurikuler/master')
  return { success: 'Ekstrakurikuler beserta seluruh datanya berhasil dihapus.' }
}

// ============================================================
// 4. SET PEMBINA (sync junction)
// ============================================================
export async function setPembina(ekskulId: string, pembinaIds: string[]): Promise<{ error?: string; success?: string }> {
  const guard = await assertAdmin()
  if ('error' in guard) return { error: guard.error }
  const { db } = guard

  if (!ekskulId) return { error: 'Ekstrakurikuler tidak valid.' }
  const unique = [...new Set(pembinaIds.filter(Boolean))]

  const stmts = [
    db.prepare('DELETE FROM ekstrakurikuler_pembina WHERE ekstrakurikuler_id = ?').bind(ekskulId),
    ...unique.map(pid =>
      db.prepare('INSERT OR IGNORE INTO ekstrakurikuler_pembina (ekstrakurikuler_id, pembina_id) VALUES (?, ?)').bind(ekskulId, pid)
    ),
  ]

  try {
    await db.batch(stmts)
  } catch (e: any) {
    return { error: e.message }
  }

  revalidatePath('/dashboard/ekstrakurikuler/master')
  return { success: 'Pembina berhasil diperbarui.' }
}

// ============================================================
// 5. MONITORING (rekap pertemuan + anggota per ekskul, TA aktif)
// ============================================================
export async function getMonitoringEkskul(): Promise<MonitoringRow[]> {
  const db = await getDB()
  const ta = await db.prepare('SELECT id FROM tahun_ajaran WHERE is_active = 1 LIMIT 1').first<any>()
  const taId = ta?.id ?? '___none___'

  const { results } = await db.prepare(`
    SELECT
      e.id, e.nama,
      (SELECT COUNT(*) FROM ekstrakurikuler_anggota a
        WHERE a.ekstrakurikuler_id = e.id AND a.status = 'aktif') AS jml_anggota,
      (SELECT COUNT(*) FROM ekstrakurikuler_pertemuan pt
        WHERE pt.ekstrakurikuler_id = e.id AND pt.tahun_ajaran_id = ?) AS jml_pertemuan,
      (SELECT MAX(pt.tanggal) FROM ekstrakurikuler_pertemuan pt
        WHERE pt.ekstrakurikuler_id = e.id AND pt.tahun_ajaran_id = ?) AS pertemuan_terakhir
    FROM ekstrakurikuler e
    WHERE e.status = 'aktif'
    ORDER BY e.nama ASC
  `).bind(taId, taId).all<MonitoringRow>()

  return results || []
}
