'use server'

import { getDB, dbInsert, dbUpdate } from '@/utils/db'
import { getCurrentUser } from '@/utils/auth/server'
import { revalidatePath } from 'next/cache'
import { formatNamaKelas } from '@/lib/utils'
import { getEffectiveUser } from '@/lib/act-as'

// ============================================================
// TYPES
// ============================================================
export type PenugasanGuru = {
  id: string
  mapel_nama: string
  kelas_id: string
  kelas_label: string
  kkm: number
}

export type NilaiHeader = {
  id: string
  penugasan_id: string
  judul: string
  tanggal: string
  keterangan: string | null
  kkm: number
  jumlah_siswa: number
  rata_rata: number | null
  created_at: string
}

export type NilaiDetail = {
  siswa_id: string
  nama_lengkap: string
  nisn: string
  nilai: number | null
  catatan: string | null
}

// ============================================================
// 1. GET PENUGASAN MILIK GURU (untuk dropdown pilih mapel+kelas)
// ============================================================
export async function getPenugasanGuru(guruIdOverride?: string): Promise<PenugasanGuru[]> {
  const user = await getCurrentUser()
  if (!user) return []

  let guruId = guruIdOverride || user.id
  if (!guruIdOverride) {
    const effective = await getEffectiveUser()
    if (effective?.isActingAs) guruId = effective.effectiveUserId
  }

  const db = await getDB()
  const ta = await db.prepare('SELECT id FROM tahun_ajaran WHERE is_active = 1 LIMIT 1').first<any>()
  if (!ta) return []

  const { results } = await db.prepare(`
    SELECT pm.id, mp.nama_mapel, k.id as kelas_id,
           k.tingkat, k.nomor_kelas, k.kelompok,
           COALESCE(nhk.kkm, 75) as kkm
    FROM penugasan_mengajar pm
    JOIN mata_pelajaran mp ON pm.mapel_id = mp.id
    JOIN kelas k ON pm.kelas_id = k.id
    LEFT JOIN nilai_harian_kkm nhk ON nhk.penugasan_id = pm.id
    WHERE (pm.guru_id = ? OR pm.id IN (
      SELECT DISTINCT jm.penugasan_id 
      FROM jadwal_mengajar jm 
      JOIN guru_ppl_mapping jpp ON jpp.jadwal_mengajar_id = jm.id 
      WHERE jpp.guru_ppl_id = ?
    )) AND pm.tahun_ajaran_id = ?
    ORDER BY k.tingkat ASC, k.nomor_kelas ASC, mp.nama_mapel ASC
  `).bind(guruId, guruId, ta.id).all<any>()

  return (results || []).map(r => ({
    id: r.id,
    mapel_nama: r.nama_mapel,
    kelas_id: r.kelas_id,
    kelas_label: formatNamaKelas(r.tingkat, r.nomor_kelas, r.kelompok),
    kkm: r.kkm,
  }))
}

// ============================================================
// 2. GET DAFTAR SESI NILAI UNTUK SATU PENUGASAN
// ============================================================
export async function getNilaiHeaders(penugasanId: string): Promise<NilaiHeader[]> {
  const user = await getCurrentUser()
  if (!user) return []

  const effective = await getEffectiveUser()
  const guruId = effective?.effectiveUserId || user.id

  const db = await getDB()
  const { results } = await db.prepare(`
    SELECT
      h.id, h.penugasan_id, h.judul, h.tanggal, h.keterangan, h.kkm, h.created_at,
      COUNT(d.id) as jumlah_siswa,
      ROUND(AVG(d.nilai), 1) as rata_rata
    FROM nilai_harian_header h
    LEFT JOIN nilai_harian_detail d ON d.header_id = h.id
    WHERE h.penugasan_id = ? AND h.created_by = ?
    GROUP BY h.id
    ORDER BY h.tanggal DESC, h.created_at DESC
  `).bind(penugasanId, guruId).all<any>()

  return results || []
}

// ============================================================
// 3. GET DETAIL NILAI (siswa + nilai) UNTUK SATU HEADER
// ============================================================
export async function getNilaiDetail(headerId: string, kelasId: string): Promise<NilaiDetail[]> {
  const user = await getCurrentUser()
  if (!user) return []

  const effective = await getEffectiveUser()
  const guruId = effective?.effectiveUserId || user.id

  const db = await getDB()
  // Verify ownership
  const header = await db.prepare(
    'SELECT id FROM nilai_harian_header WHERE id = ? AND created_by = ?'
  ).bind(headerId, guruId).first<any>()
  if (!header) return []

  const { results } = await db.prepare(`
    SELECT s.id as siswa_id, s.nama_lengkap, s.nisn,
           d.nilai, d.catatan
    FROM siswa s
    LEFT JOIN nilai_harian_detail d ON d.siswa_id = s.id AND d.header_id = ?
    WHERE s.kelas_id = ? AND s.status = 'aktif'
    ORDER BY s.nama_lengkap ASC
  `).bind(headerId, kelasId).all<any>()

  return results || []
}

// ============================================================
// 4. BUAT SESI PENILAIAN BARU
// ============================================================
export async function buatSesiNilai(data: {
  penugasan_id: string
  judul: string
  tanggal: string
  keterangan?: string
  kkm: number
}): Promise<{ error?: string; success?: string; id?: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  const effective = await getEffectiveUser()
  const guruId = effective?.effectiveUserId || user.id

  const db = await getDB()
  const ta = await db.prepare('SELECT id FROM tahun_ajaran WHERE is_active = 1 LIMIT 1').first<any>()
  if (!ta) return { error: 'Tahun ajaran aktif belum diatur.' }

  // Verify penugasan milik guru ini
  const pm = await db.prepare(
    'SELECT id FROM penugasan_mengajar WHERE id = ? AND guru_id = ?'
  ).bind(data.penugasan_id, guruId).first<any>()
  if (!pm) return { error: 'Penugasan tidak ditemukan.' }

  const res = await dbInsert(db, 'nilai_harian_header', {
    penugasan_id: data.penugasan_id,
    tahun_ajaran_id: ta.id,
    judul: data.judul.trim(),
    tanggal: data.tanggal,
    keterangan: data.keterangan?.trim() || null,
    kkm: data.kkm,
    created_by: guruId,
  })
  if (res.error) return { error: res.error }

  revalidatePath('/dashboard/nilai-harian')
  return { success: 'Sesi penilaian berhasil dibuat.', id: res.data?.id }
}

// ============================================================
// 5. EDIT SESI PENILAIAN
// ============================================================
export async function editSesiNilai(id: string, data: {
  judul: string; tanggal: string; keterangan?: string; kkm: number
}): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  const effective = await getEffectiveUser()
  const guruId = effective?.effectiveUserId || user.id

  const db = await getDB()
  const res = await dbUpdate(db, 'nilai_harian_header', {
    judul: data.judul.trim(),
    tanggal: data.tanggal,
    keterangan: data.keterangan?.trim() || null,
    kkm: data.kkm,
    updated_at: new Date().toISOString(),
  }, { id, created_by: guruId })
  if (res.error) return { error: res.error }

  revalidatePath('/dashboard/nilai-harian')
  return { success: 'Sesi berhasil diperbarui.' }
}

// ============================================================
// 6. HAPUS SESI PENILAIAN
// ============================================================
export async function hapusSesiNilai(id: string): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  const effective = await getEffectiveUser()
  const guruId = effective?.effectiveUserId || user.id

  const db = await getDB()
  const header = await db.prepare(
    'SELECT id FROM nilai_harian_header WHERE id = ? AND created_by = ?'
  ).bind(id, guruId).first<any>()
  if (!header) return { error: 'Sesi tidak ditemukan.' }

  await db.prepare('DELETE FROM nilai_harian_header WHERE id = ?').bind(id).run()
  revalidatePath('/dashboard/nilai-harian')
  return { success: 'Sesi berhasil dihapus.' }
}

// ============================================================
// 7. SIMPAN NILAI SISWA (batch upsert)
// ============================================================
export async function simpanNilaiSiswa(
  headerId: string,
  data: Array<{ siswa_id: string; nilai: number; catatan?: string }>
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  const effective = await getEffectiveUser()
  const guruId = effective?.effectiveUserId || user.id

  const db = await getDB()
  const header = await db.prepare(
    'SELECT id FROM nilai_harian_header WHERE id = ? AND created_by = ?'
  ).bind(headerId, guruId).first<any>()
  if (!header) return { error: 'Sesi tidak ditemukan atau anda bukan pemiliknya.' }

  if (data.length === 0) return { error: 'Tidak ada data nilai.' }

  const stmts = data.map(d =>
    db.prepare(`
      INSERT INTO nilai_harian_detail (id, header_id, siswa_id, nilai, catatan)
      VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?)
      ON CONFLICT(header_id, siswa_id) DO UPDATE SET nilai = excluded.nilai, catatan = excluded.catatan
    `).bind(headerId, d.siswa_id, d.nilai, d.catatan || null)
  )

  try {
    for (let i = 0; i < stmts.length; i += 100) {
      await db.batch(stmts.slice(i, i + 100))
    }
    await dbUpdate(db, 'nilai_harian_header', { updated_at: new Date().toISOString() }, { id: headerId })
  } catch (e: any) {
    return { error: e.message }
  }

  revalidatePath('/dashboard/nilai-harian')
  return { success: `${data.length} nilai berhasil disimpan.` }
}

// ============================================================
// 8. GET REKAP LENGKAP (semua sesi + semua siswa)
// ============================================================
export async function getRekapNilai(penugasanId: string): Promise<{
  headers: NilaiHeader[]
  rows: Array<{ siswa_id: string; nama_lengkap: string; nisn: string; nilai: Record<string, number | null>; rata_rata: number | null }>
  kkm: number
}> {
  const user = await getCurrentUser()
  if (!user) return { headers: [], rows: [], kkm: 75 }

  const effective = await getEffectiveUser()
  const guruId = effective?.effectiveUserId || user.id

  const db = await getDB()
  const pm = await db.prepare(`
    SELECT pm.id, k.id as kelas_id, COALESCE(nhk.kkm, 75) as kkm
    FROM penugasan_mengajar pm
    JOIN kelas k ON pm.kelas_id = k.id
    LEFT JOIN nilai_harian_kkm nhk ON nhk.penugasan_id = pm.id
    WHERE pm.id = ? AND pm.guru_id = ?
  `).bind(penugasanId, guruId).first<any>()
  if (!pm) return { headers: [], rows: [], kkm: 75 }

  const [headersRes, siswaRes, detailRes] = await Promise.all([
    db.prepare(`
      SELECT h.id, h.judul, h.tanggal, h.keterangan, h.kkm, h.created_at,
             COUNT(d.id) as jumlah_siswa, ROUND(AVG(d.nilai), 1) as rata_rata
      FROM nilai_harian_header h
      LEFT JOIN nilai_harian_detail d ON d.header_id = h.id
      WHERE h.penugasan_id = ? AND h.created_by = ?
      GROUP BY h.id ORDER BY h.tanggal ASC, h.created_at ASC
    `).bind(penugasanId, guruId).all<any>(),
    db.prepare(`SELECT id as siswa_id, nama_lengkap, nisn FROM siswa WHERE kelas_id = ? AND status = 'aktif' ORDER BY nama_lengkap ASC`).bind(pm.kelas_id).all<any>(),
    db.prepare(`
      SELECT d.header_id, d.siswa_id, d.nilai FROM nilai_harian_detail d
      JOIN nilai_harian_header h ON d.header_id = h.id
      WHERE h.penugasan_id = ? AND h.created_by = ?
    `).bind(penugasanId, guruId).all<any>(),
  ])

  const headers: NilaiHeader[] = headersRes.results || []
  const siswaList = siswaRes.results || []
  const detailList = detailRes.results || []

  // Build nilai map
  const nilaiMap = new Map<string, Record<string, number | null>>()
  for (const s of siswaList) nilaiMap.set(s.siswa_id, {})
  for (const d of detailList) {
    const obj = nilaiMap.get(d.siswa_id)
    if (obj) obj[d.header_id] = d.nilai
  }

  const rows = siswaList.map((s: any) => {
    const nilaiObj = nilaiMap.get(s.siswa_id) || {}
    const vals = headers.map(h => nilaiObj[h.id] ?? null).filter(v => v !== null) as number[]
    const rata_rata = vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10 : null
    return { ...s, nilai: nilaiObj, rata_rata }
  })

  return { headers, rows, kkm: pm.kkm }
}

// ============================================================
// 9. SIMPAN PENGATURAN KKM PER PENUGASAN
// ============================================================
export async function simpanKKM(penugasanId: string, kkm: number): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  const effective = await getEffectiveUser()
  const guruId = effective?.effectiveUserId || user.id

  const db = await getDB()
  const pm = await db.prepare('SELECT id FROM penugasan_mengajar WHERE id = ? AND guru_id = ?').bind(penugasanId, guruId).first<any>()
  if (!pm) return { error: 'Penugasan tidak ditemukan.' }

  await db.prepare(`
    INSERT INTO nilai_harian_kkm (penugasan_id, kkm, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(penugasan_id) DO UPDATE SET kkm = excluded.kkm, updated_at = excluded.updated_at
  `).bind(penugasanId, kkm).run()

  revalidatePath('/dashboard/nilai-harian')
  return { success: 'KKM berhasil disimpan.' }
}
