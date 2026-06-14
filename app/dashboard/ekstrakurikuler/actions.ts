// Lokasi: app/dashboard/ekstrakurikuler/actions.ts
'use server'

import { getDB, dbInsert } from '@/utils/db'
import { getCurrentUser } from '@/utils/auth/server'
import { getEffectiveUser } from '@/lib/act-as'
import { checkFeatureAccess } from '@/lib/features'
import { uploadToR2 } from '@/utils/r2'
import { revalidatePath } from 'next/cache'
import { nowWIBISO } from '@/lib/time'
import { formatNamaKelas } from '@/lib/utils'

// ============================================================
// TYPES
// ============================================================
export type EkskulSaya = {
  id: string
  nama: string
  deskripsi: string | null
  mode_nilai: 'angka' | 'huruf'
  jml_anggota: number
}

export type AnggotaRow = {
  anggota_id: string
  siswa_id: string
  nama_lengkap: string
  nisn: string
  foto_url: string | null
  kelas_label: string
}

export type SiswaPilih = {
  siswa_id: string
  nama_lengkap: string
  nisn: string
  kelas_label: string
  sudah_anggota: boolean
}

export type KelasOption = { id: string; label: string }

export type PertemuanRow = {
  id: string
  tanggal: string
  judul: string | null
  catatan: string | null
  foto_url: string | null
  jml_tidak_hadir: number
}

export type AbsensiSiswa = {
  siswa_id: string
  nama_lengkap: string
  nisn: string
  status: 'HADIR' | 'SAKIT' | 'IZIN' | 'ALFA'
  catatan: string
}

export type NilaiRow = {
  siswa_id: string
  nama_lengkap: string
  nisn: string
  kelas_label: string
  nilai: string | null
  catatan: string | null
}

// ============================================================
// HELPERS
// ============================================================
async function getCtx() {
  const user = await getCurrentUser()
  if (!user) return null
  const effective = await getEffectiveUser()
  return {
    db: await getDB(),
    realUserId: user.id,
    effectiveUserId: effective?.effectiveUserId || user.id,
  }
}

async function isAdmin(db: D1Database, userId: string): Promise<boolean> {
  return checkFeatureAccess(db, userId, 'ekstrakurikuler-master')
}

// Pembina ekskul ini, ATAU admin (punya akses master)
async function canManage(db: D1Database, ekskulId: string, effectiveUserId: string, realUserId: string): Promise<boolean> {
  const row = await db.prepare(
    'SELECT 1 FROM ekstrakurikuler_pembina WHERE ekstrakurikuler_id = ? AND pembina_id = ? LIMIT 1'
  ).bind(ekskulId, effectiveUserId).first()
  if (row) return true
  return isAdmin(db, realUserId)
}

async function getActiveTaId(db: D1Database): Promise<string | null> {
  const ta = await db.prepare('SELECT id FROM tahun_ajaran WHERE is_active = 1 LIMIT 1').first<any>()
  return ta?.id ?? null
}

// ============================================================
// 1. EKSKUL YANG DIBINA (atau semua, jika admin)
// ============================================================
export async function getEkskulSaya(): Promise<EkskulSaya[]> {
  const ctx = await getCtx()
  if (!ctx) return []
  const { db, effectiveUserId, realUserId } = ctx

  const admin = await isAdmin(db, realUserId)

  const sql = admin
    ? `SELECT e.id, e.nama, e.deskripsi, e.mode_nilai,
         (SELECT COUNT(*) FROM ekstrakurikuler_anggota a WHERE a.ekstrakurikuler_id = e.id AND a.status='aktif') AS jml_anggota
       FROM ekstrakurikuler e
       WHERE e.status = 'aktif'
       ORDER BY e.nama ASC`
    : `SELECT e.id, e.nama, e.deskripsi, e.mode_nilai,
         (SELECT COUNT(*) FROM ekstrakurikuler_anggota a WHERE a.ekstrakurikuler_id = e.id AND a.status='aktif') AS jml_anggota
       FROM ekstrakurikuler e
       JOIN ekstrakurikuler_pembina p ON p.ekstrakurikuler_id = e.id AND p.pembina_id = ?
       WHERE e.status = 'aktif'
       ORDER BY e.nama ASC`

  const stmt = admin ? db.prepare(sql) : db.prepare(sql).bind(effectiveUserId)
  const { results } = await stmt.all<EkskulSaya>()
  return results || []
}

// ============================================================
// 2. ANGGOTA
// ============================================================
export async function getAnggota(ekskulId: string): Promise<AnggotaRow[]> {
  const db = await getDB()
  const { results } = await db.prepare(`
    SELECT a.id AS anggota_id, s.id AS siswa_id, s.nama_lengkap, s.nisn, s.foto_url,
           k.tingkat, k.nomor_kelas, k.kelompok
    FROM ekstrakurikuler_anggota a
    JOIN siswa s ON a.siswa_id = s.id
    LEFT JOIN kelas k ON s.kelas_id = k.id
    WHERE a.ekstrakurikuler_id = ? AND a.status = 'aktif' AND s.status = 'aktif'
    ORDER BY s.nama_lengkap ASC
  `).bind(ekskulId).all<any>()
  return (results || []).map(r => ({
    anggota_id: r.anggota_id,
    siswa_id: r.siswa_id,
    nama_lengkap: r.nama_lengkap,
    nisn: r.nisn,
    foto_url: r.foto_url ?? null,
    kelas_label: r.tingkat ? formatNamaKelas(r.tingkat, r.nomor_kelas, r.kelompok) : '-',
  }))
}

export async function getKelasList(): Promise<KelasOption[]> {
  const db = await getDB()
  const { results } = await db.prepare(
    'SELECT id, tingkat, nomor_kelas, kelompok FROM kelas ORDER BY tingkat ASC, nomor_kelas ASC'
  ).all<any>()
  return (results || []).map(k => ({ id: k.id, label: formatNamaKelas(k.tingkat, k.nomor_kelas, k.kelompok) }))
}

// Siswa aktif untuk picker — tandai yang sudah anggota
export async function getSiswaUntukPilih(ekskulId: string, kelasId?: string, q?: string): Promise<SiswaPilih[]> {
  const db = await getDB()
  const params: unknown[] = [ekskulId]
  let sql = `
    SELECT s.id AS siswa_id, s.nama_lengkap, s.nisn,
           k.tingkat, k.nomor_kelas, k.kelompok,
           (SELECT 1 FROM ekstrakurikuler_anggota a
              WHERE a.ekstrakurikuler_id = ? AND a.siswa_id = s.id AND a.status='aktif') AS sudah
    FROM siswa s
    LEFT JOIN kelas k ON s.kelas_id = k.id
    WHERE s.status = 'aktif'`
  if (kelasId) { sql += ' AND s.kelas_id = ?'; params.push(kelasId) }
  if (q && q.trim()) {
    sql += ' AND (s.nama_lengkap LIKE ? OR s.nisn LIKE ?)'
    const like = `%${q.trim()}%`
    params.push(like, like)
  }
  sql += ' ORDER BY s.nama_lengkap ASC LIMIT 300'

  const { results } = await db.prepare(sql).bind(...params).all<any>()
  return (results || []).map(r => ({
    siswa_id: r.siswa_id,
    nama_lengkap: r.nama_lengkap,
    nisn: r.nisn,
    kelas_label: r.tingkat ? formatNamaKelas(r.tingkat, r.nomor_kelas, r.kelompok) : '-',
    sudah_anggota: !!r.sudah,
  }))
}

export async function addAnggota(ekskulId: string, siswaIds: string[]): Promise<{ error?: string; success?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Unauthorized' }
  const { db, effectiveUserId, realUserId } = ctx
  if (!(await canManage(db, ekskulId, effectiveUserId, realUserId))) return { error: 'Anda bukan pembina ekstrakurikuler ini.' }

  const unique = [...new Set(siswaIds.filter(Boolean))]
  if (unique.length === 0) return { error: 'Tidak ada siswa dipilih.' }

  const stmts = unique.map(sid =>
    db.prepare(`
      INSERT INTO ekstrakurikuler_anggota (ekstrakurikuler_id, siswa_id, status)
      VALUES (?, ?, 'aktif')
      ON CONFLICT(ekstrakurikuler_id, siswa_id) DO UPDATE SET status='aktif'
    `).bind(ekskulId, sid)
  )
  try {
    for (let i = 0; i < stmts.length; i += 100) await db.batch(stmts.slice(i, i + 100))
  } catch (e: any) { return { error: e.message } }

  revalidatePath('/dashboard/ekstrakurikuler')
  return { success: `${unique.length} siswa ditambahkan.` }
}

export async function removeAnggota(ekskulId: string, siswaId: string): Promise<{ error?: string; success?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Unauthorized' }
  const { db, effectiveUserId, realUserId } = ctx
  if (!(await canManage(db, ekskulId, effectiveUserId, realUserId))) return { error: 'Anda bukan pembina ekstrakurikuler ini.' }

  try {
    await db.prepare('DELETE FROM ekstrakurikuler_anggota WHERE ekstrakurikuler_id = ? AND siswa_id = ?')
      .bind(ekskulId, siswaId).run()
  } catch (e: any) { return { error: e.message } }

  revalidatePath('/dashboard/ekstrakurikuler')
  return { success: 'Siswa dikeluarkan dari ekstrakurikuler.' }
}

// ============================================================
// 3. PERTEMUAN (presensi pembina) + ABSENSI SISWA (wizard)
// ============================================================
export async function getPertemuan(ekskulId: string): Promise<PertemuanRow[]> {
  const db = await getDB()
  const taId = await getActiveTaId(db)
  const { results } = await db.prepare(`
    SELECT pt.id, pt.tanggal, pt.judul, pt.catatan, pt.foto_url,
      (SELECT COUNT(*) FROM ekstrakurikuler_absensi ab WHERE ab.pertemuan_id = pt.id) AS jml_tidak_hadir
    FROM ekstrakurikuler_pertemuan pt
    WHERE pt.ekstrakurikuler_id = ?
      AND (pt.tahun_ajaran_id = ? OR pt.tahun_ajaran_id IS NULL)
    ORDER BY pt.tanggal DESC, pt.created_at DESC
  `).bind(ekskulId, taId ?? '___none___').all<PertemuanRow>()
  return results || []
}

export async function buatPertemuan(formData: FormData): Promise<{ error?: string; success?: string; id?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Unauthorized' }
  const { db, effectiveUserId, realUserId } = ctx

  const ekskulId = formData.get('ekstrakurikuler_id') as string
  const tanggal = formData.get('tanggal') as string
  const judul = (formData.get('judul') as string)?.trim() || null
  const catatan = (formData.get('catatan') as string)?.trim() || null
  const foto = formData.get('foto') as File | null

  if (!ekskulId || !tanggal) return { error: 'Tanggal pertemuan wajib diisi.' }
  if (!(await canManage(db, ekskulId, effectiveUserId, realUserId))) return { error: 'Anda bukan pembina ekstrakurikuler ini.' }

  // Upload foto (opsional)
  let fotoUrl: string | null = null
  if (foto && foto.size > 0) {
    const up = await uploadToR2(foto, 'ekskul')
    if (up.error) return { error: `Gagal upload foto: ${up.error}` }
    fotoUrl = up.url
  }

  const taId = await getActiveTaId(db)
  const res = await dbInsert(db, 'ekstrakurikuler_pertemuan', {
    ekstrakurikuler_id: ekskulId,
    tahun_ajaran_id: taId,
    tanggal,
    judul,
    catatan,
    foto_url: fotoUrl,
    status_pembina: 'HADIR',
    diinput_oleh: realUserId,
    pembina_id: effectiveUserId,
    waktu_input: nowWIBISO(),
  })
  if (res.error) return { error: res.error }

  revalidatePath('/dashboard/ekstrakurikuler')
  return { success: 'Pertemuan dibuat.', id: res.data?.id }
}

// Anggota + absensi existing (default HADIR)
export async function loadAbsensi(pertemuanId: string, ekskulId: string): Promise<{ error: string | null; siswa: AbsensiSiswa[] }> {
  const db = await getDB()
  const [anggotaRes, absenRes] = await Promise.all([
    db.prepare(`
      SELECT s.id AS siswa_id, s.nama_lengkap, s.nisn
      FROM ekstrakurikuler_anggota a
      JOIN siswa s ON a.siswa_id = s.id
      WHERE a.ekstrakurikuler_id = ? AND a.status='aktif' AND s.status='aktif'
      ORDER BY s.nama_lengkap ASC
    `).bind(ekskulId).all<any>(),
    db.prepare('SELECT siswa_id, status, catatan FROM ekstrakurikuler_absensi WHERE pertemuan_id = ?').bind(pertemuanId).all<any>(),
  ])

  const absenMap = new Map<string, { status: string; catatan: string }>()
  for (const a of absenRes.results || []) absenMap.set(a.siswa_id, { status: a.status, catatan: a.catatan || '' })

  return {
    error: null,
    siswa: (anggotaRes.results || []).map((s: any) => {
      const ab = absenMap.get(s.siswa_id)
      return {
        siswa_id: s.siswa_id,
        nama_lengkap: s.nama_lengkap,
        nisn: s.nisn,
        status: (ab?.status as any) || 'HADIR',
        catatan: ab?.catatan || '',
      }
    }),
  }
}

// Simpan absensi sparse (hanya non-HADIR)
export async function simpanAbsensi(
  pertemuanId: string,
  ekskulId: string,
  dataAbsen: Array<{ siswa_id: string; status: string; catatan: string }>
): Promise<{ error?: string; success?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Unauthorized' }
  const { db, effectiveUserId, realUserId } = ctx
  if (!(await canManage(db, ekskulId, effectiveUserId, realUserId))) return { error: 'Anda bukan pembina ekstrakurikuler ini.' }

  const toSave = dataAbsen.filter(d => d.status && d.status !== 'HADIR')
  const delStmt = db.prepare('DELETE FROM ekstrakurikuler_absensi WHERE pertemuan_id = ?').bind(pertemuanId)

  if (toSave.length === 0) {
    try { await delStmt.run() } catch (e: any) { return { error: e.message } }
    revalidatePath('/dashboard/ekstrakurikuler')
    return { success: 'Absensi disimpan. Semua anggota HADIR.' }
  }

  const insStmts = toSave.map(d =>
    db.prepare('INSERT INTO ekstrakurikuler_absensi (pertemuan_id, siswa_id, status, catatan) VALUES (?, ?, ?, ?)')
      .bind(pertemuanId, d.siswa_id, d.status, d.catatan || null)
  )

  try {
    const all = [delStmt, ...insStmts]
    for (let i = 0; i < all.length; i += 100) await db.batch(all.slice(i, i + 100))
  } catch (e: any) { return { error: e.message } }

  revalidatePath('/dashboard/ekstrakurikuler')
  return { success: `Absensi disimpan. ${toSave.length} anggota tidak hadir.` }
}

// ============================================================
// 4. NILAI (per semester / TA aktif)
// ============================================================
export async function getNilai(ekskulId: string): Promise<{ mode_nilai: 'angka' | 'huruf'; rows: NilaiRow[] }> {
  const db = await getDB()
  const taId = await getActiveTaId(db)
  const ek = await db.prepare('SELECT mode_nilai FROM ekstrakurikuler WHERE id = ?').bind(ekskulId).first<any>()
  const mode_nilai = (ek?.mode_nilai as 'angka' | 'huruf') || 'angka'

  const { results } = await db.prepare(`
    SELECT s.id AS siswa_id, s.nama_lengkap, s.nisn,
           k.tingkat, k.nomor_kelas, k.kelompok,
           n.nilai, n.catatan
    FROM ekstrakurikuler_anggota a
    JOIN siswa s ON a.siswa_id = s.id
    LEFT JOIN kelas k ON s.kelas_id = k.id
    LEFT JOIN ekstrakurikuler_nilai n
      ON n.ekstrakurikuler_id = a.ekstrakurikuler_id AND n.siswa_id = s.id AND n.tahun_ajaran_id = ?
    WHERE a.ekstrakurikuler_id = ? AND a.status='aktif' AND s.status='aktif'
    ORDER BY s.nama_lengkap ASC
  `).bind(taId ?? '___none___', ekskulId).all<any>()

  return {
    mode_nilai,
    rows: (results || []).map(r => ({
      siswa_id: r.siswa_id,
      nama_lengkap: r.nama_lengkap,
      nisn: r.nisn,
      kelas_label: r.tingkat ? formatNamaKelas(r.tingkat, r.nomor_kelas, r.kelompok) : '-',
      nilai: r.nilai ?? null,
      catatan: r.catatan ?? null,
    })),
  }
}

const HURUF_VALID = ['A', 'B', 'C', 'D']

export async function simpanNilai(
  ekskulId: string,
  dataNilai: Array<{ siswa_id: string; nilai: string; catatan: string }>
): Promise<{ error?: string; success?: string }> {
  const ctx = await getCtx()
  if (!ctx) return { error: 'Unauthorized' }
  const { db, effectiveUserId, realUserId } = ctx
  if (!(await canManage(db, ekskulId, effectiveUserId, realUserId))) return { error: 'Anda bukan pembina ekstrakurikuler ini.' }

  const taId = await getActiveTaId(db)
  if (!taId) return { error: 'Tahun ajaran aktif belum diatur.' }

  const ek = await db.prepare('SELECT mode_nilai FROM ekstrakurikuler WHERE id = ?').bind(ekskulId).first<any>()
  if (!ek) return { error: 'Ekstrakurikuler tidak ditemukan.' }
  const mode = ek.mode_nilai as 'angka' | 'huruf'

  // Validasi + normalisasi
  const clean: Array<{ siswa_id: string; nilai: string | null; catatan: string | null }> = []
  for (const d of dataNilai) {
    const raw = (d.nilai ?? '').trim()
    let nilai: string | null = null
    if (raw !== '') {
      if (mode === 'angka') {
        const n = Number(raw)
        if (!Number.isFinite(n) || n < 0 || n > 100) return { error: `Nilai angka harus 0-100 (nilai "${raw}" tidak valid).` }
        nilai = String(n)
      } else {
        const up = raw.toUpperCase()
        if (!HURUF_VALID.includes(up)) return { error: `Nilai huruf harus A/B/C/D (nilai "${raw}" tidak valid).` }
        nilai = up
      }
    }
    const catatan = (d.catatan ?? '').trim() || null
    if (nilai === null && catatan === null) continue  // skip baris kosong
    clean.push({ siswa_id: d.siswa_id, nilai, catatan })
  }

  if (clean.length === 0) return { error: 'Tidak ada nilai untuk disimpan.' }

  const stmts = clean.map(d =>
    db.prepare(`
      INSERT INTO ekstrakurikuler_nilai (ekstrakurikuler_id, siswa_id, tahun_ajaran_id, nilai, catatan, dinilai_oleh, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(ekstrakurikuler_id, siswa_id, tahun_ajaran_id)
      DO UPDATE SET nilai=excluded.nilai, catatan=excluded.catatan, dinilai_oleh=excluded.dinilai_oleh, updated_at=excluded.updated_at
    `).bind(ekskulId, d.siswa_id, taId, d.nilai, d.catatan, realUserId)
  )

  try {
    for (let i = 0; i < stmts.length; i += 100) await db.batch(stmts.slice(i, i + 100))
  } catch (e: any) { return { error: e.message } }

  revalidatePath('/dashboard/ekstrakurikuler')
  return { success: `${clean.length} nilai berhasil disimpan.` }
}
