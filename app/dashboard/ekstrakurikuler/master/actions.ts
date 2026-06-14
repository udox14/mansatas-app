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
  foto_terakhir: string | null
  judul_terakhir: string | null
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
        WHERE pt.ekstrakurikuler_id = e.id AND pt.tahun_ajaran_id = ?) AS pertemuan_terakhir,
      (SELECT pt.foto_url FROM ekstrakurikuler_pertemuan pt
        WHERE pt.ekstrakurikuler_id = e.id AND pt.tahun_ajaran_id = ?
        ORDER BY pt.tanggal DESC, pt.created_at DESC LIMIT 1) AS foto_terakhir,
      (SELECT pt.judul FROM ekstrakurikuler_pertemuan pt
        WHERE pt.ekstrakurikuler_id = e.id AND pt.tahun_ajaran_id = ?
        ORDER BY pt.tanggal DESC, pt.created_at DESC LIMIT 1) AS judul_terakhir
    FROM ekstrakurikuler e
    WHERE e.status = 'aktif'
    ORDER BY e.nama ASC
  `).bind(taId, taId, taId, taId).all<MonitoringRow>()

  return results || []
}

// ============================================================
// 6. IMPORT MASSAL MASTER EKSKUL (Excel)
// ============================================================
export async function importEkskulMassal(rows: any[]): Promise<{ error?: string; success?: string }> {
  const guard = await assertAdmin()
  if ('error' in guard) return { error: guard.error }
  const { db } = guard

  if (!Array.isArray(rows) || rows.length === 0) return { error: 'File Excel kosong atau format salah.' }

  const stmts: D1PreparedStatement[] = []
  let skipped = 0
  for (const r of rows) {
    const nama = String(r.NAMA ?? r.nama ?? '').trim()
    if (!nama) { skipped++; continue }
    const rawMode = String(r.MODE_NILAI ?? r.mode_nilai ?? 'angka').trim().toLowerCase()
    const mode_nilai = MODE_NILAI.includes(rawMode as any) ? rawMode : 'angka'
    const deskripsi = String(r.DESKRIPSI ?? r.deskripsi ?? '').trim() || null
    stmts.push(
      db.prepare('INSERT INTO ekstrakurikuler (nama, deskripsi, mode_nilai) VALUES (?, ?, ?)')
        .bind(nama, deskripsi, mode_nilai)
    )
  }

  if (stmts.length === 0) return { error: 'Tidak ada baris valid (kolom NAMA wajib).' }

  try {
    for (let i = 0; i < stmts.length; i += 100) await db.batch(stmts.slice(i, i + 100))
  } catch (e: any) {
    return { error: e.message }
  }

  revalidatePath('/dashboard/ekstrakurikuler/master')
  return { success: `${stmts.length} ekstrakurikuler diimport.${skipped ? ` ${skipped} baris dilewati (NAMA kosong).` : ''}` }
}

// ============================================================
// 7. DATA LAPORAN KEHADIRAN PER BULAN (untuk PDF)
// ============================================================
export type LaporanKehadiran = {
  ekskul_nama: string
  bulan: string                 // 'YYYY-MM'
  pertemuan: Array<{ id: string; tanggal: string; judul: string | null }>
  rows: Array<{
    nama_lengkap: string
    nisn: string
    kelas_label: string
    // status per pertemuan_id: 'H'|'S'|'I'|'A'
    status: Record<string, 'H' | 'S' | 'I' | 'A'>
    rekap: { H: number; S: number; I: number; A: number }
  }>
}

export async function getLaporanKehadiran(ekskulId: string, bulan: string): Promise<LaporanKehadiran | null> {
  const db = await getDB()
  if (!/^\d{4}-\d{2}$/.test(bulan)) return null

  const ek = await db.prepare('SELECT nama FROM ekstrakurikuler WHERE id = ?').bind(ekskulId).first<any>()
  if (!ek) return null

  const { formatNamaKelas } = await import('@/lib/utils')

  const [ptRes, anggotaRes] = await Promise.all([
    db.prepare(`
      SELECT id, tanggal, judul FROM ekstrakurikuler_pertemuan
      WHERE ekstrakurikuler_id = ? AND substr(tanggal,1,7) = ?
      ORDER BY tanggal ASC, created_at ASC
    `).bind(ekskulId, bulan).all<any>(),
    db.prepare(`
      SELECT s.id AS siswa_id, s.nama_lengkap, s.nisn, k.tingkat, k.nomor_kelas, k.kelompok
      FROM ekstrakurikuler_anggota a
      JOIN siswa s ON a.siswa_id = s.id
      LEFT JOIN kelas k ON s.kelas_id = k.id
      WHERE a.ekstrakurikuler_id = ? AND a.status='aktif' AND s.status='aktif'
      ORDER BY s.nama_lengkap ASC
    `).bind(ekskulId).all<any>(),
  ])

  const pertemuan = (ptRes.results || []).map((p: any) => ({ id: p.id, tanggal: p.tanggal, judul: p.judul ?? null }))
  const ptIds = pertemuan.map(p => p.id)

  // Absensi (non-HADIR) untuk pertemuan bulan ini
  const absenMap = new Map<string, string>() // key `${pertemuanId}|${siswaId}` -> status huruf
  if (ptIds.length > 0) {
    const ph = ptIds.map(() => '?').join(',')
    const absRes = await db.prepare(
      `SELECT pertemuan_id, siswa_id, status FROM ekstrakurikuler_absensi WHERE pertemuan_id IN (${ph})`
    ).bind(...ptIds).all<any>()
    for (const a of absRes.results || []) {
      const huruf = a.status === 'SAKIT' ? 'S' : a.status === 'IZIN' ? 'I' : 'A'
      absenMap.set(`${a.pertemuan_id}|${a.siswa_id}`, huruf)
    }
  }

  const rows = (anggotaRes.results || []).map((s: any) => {
    const status: Record<string, 'H' | 'S' | 'I' | 'A'> = {}
    const rekap = { H: 0, S: 0, I: 0, A: 0 }
    for (const p of pertemuan) {
      const v = (absenMap.get(`${p.id}|${s.siswa_id}`) as 'S' | 'I' | 'A') || 'H'
      status[p.id] = v
      rekap[v]++
    }
    return {
      nama_lengkap: s.nama_lengkap,
      nisn: s.nisn,
      kelas_label: s.tingkat ? formatNamaKelas(s.tingkat, s.nomor_kelas, s.kelompok) : '-',
      status,
      rekap,
    }
  })

  return { ekskul_nama: ek.nama, bulan, pertemuan, rows }
}
