// Lokasi: app/dashboard/izin/actions.ts
'use server'

import { getDB, dbInsert, dbUpdate, dbDelete } from '@/utils/db'
import { getCurrentUser } from '@/utils/auth/server'
import { getUserRoles } from '@/lib/features'
import { revalidatePath } from 'next/cache'
import { nowWIBISO, todayWIB } from '@/lib/time'
import { formatNamaKelas } from '@/lib/utils'

const INPUT_IZIN_ROLES = ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'guru_bk', 'guru_piket', 'resepsionis', 'satpam']
const DELETE_IZIN_ROLES = ['super_admin', 'admin_tu']

function hasAnyRole(roles: string[], allowedRoles: string[]) {
  return roles.some(role => allowedRoles.includes(role))
}

function revalidateIzinViews() {
  revalidatePath('/dashboard/izin')
  revalidatePath('/dashboard/kehadiran')
  revalidatePath('/dashboard/keterangan-absensi')
  revalidatePath('/dashboard/kelas-binaan')
  revalidatePath('/dashboard/rekap-absensi')
  revalidatePath('/dashboard')
  revalidatePath('/portal-ortu')
}

function normalizeWIBDateTime(value: string | null | undefined) {
  const raw = value?.trim()
  if (!raw) return null
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) return `${raw}:00.000+07:00`
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(raw)) return `${raw}.000+07:00`
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}\+07:00$/.test(raw)) return raw
  return null
}

export type AlasanIzin = string

export type AlasanIzinRow = {
  id: string
  alasan: string
  urutan: number
  hitung_sebagai_hadir: boolean
}

async function validateAlasanIzin(db: D1Database, alasan: string): Promise<string | null> {
  const teks = alasan.trim()
  if (!teks) return 'Alasan wajib dipilih!'

  const row = await db.prepare(
    `SELECT id FROM alasan_izin_kelas WHERE alasan = ? LIMIT 1`
  ).bind(teks).first<{ id: string }>()

  return row ? null : 'Alasan tidak tersedia. Silakan pilih alasan dari daftar yang ada.'
}

// ============================================================
// ALASAN IZIN — CRUD (hanya super admin bisa tambah/hapus)
// ============================================================
export async function getAlasanIzin(): Promise<AlasanIzinRow[]> {
  const db = await getDB()
  const res = await db.prepare(
    `SELECT id, alasan, urutan, hitung_sebagai_hadir FROM alasan_izin_kelas ORDER BY urutan, alasan`
  ).all<any>()
  return (res.results || []).map(r => ({
    id: r.id,
    alasan: r.alasan,
    urutan: r.urutan,
    hitung_sebagai_hadir: Number(r.hitung_sebagai_hadir) === 1,
  }))
}

export async function tambahAlasanIzin(
  alasan: string,
  hitungSebagaiHadir = false
): Promise<{ error?: string; success?: string; item?: AlasanIzinRow }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }
  const db = await getDB()
  const roles = await getUserRoles(db, user.id)
  if (!roles.includes('super_admin')) return { error: 'Hanya super admin yang dapat mengelola alasan' }

  const teks = alasan.trim().toUpperCase()
  if (!teks) return { error: 'Alasan tidak boleh kosong' }

  try {
    const maxUrutan = await db.prepare(`SELECT COALESCE(MAX(urutan), 0) as m FROM alasan_izin_kelas`).first<any>()
    const id = crypto.randomUUID()
    const urutan = (maxUrutan?.m ?? 0) + 1
    await db.prepare(
      `INSERT INTO alasan_izin_kelas (id, alasan, urutan, hitung_sebagai_hadir) VALUES (?, ?, ?, ?)`
    ).bind(id, teks, urutan, hitungSebagaiHadir ? 1 : 0).run()
    revalidateIzinViews()
    return {
      success: 'Alasan berhasil ditambahkan',
      item: { id, alasan: teks, urutan, hitung_sebagai_hadir: hitungSebagaiHadir },
    }
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) return { error: 'Alasan sudah ada' }
    return { error: e.message }
  }
}

export async function ubahAlasanIzinHitungHadir(
  id: string,
  hitungSebagaiHadir: boolean
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }
  const db = await getDB()
  const roles = await getUserRoles(db, user.id)
  if (!roles.includes('super_admin')) return { error: 'Hanya super admin yang dapat mengelola alasan' }

  const result = await db.prepare(`
    UPDATE alasan_izin_kelas
    SET hitung_sebagai_hadir = ?
    WHERE id = ?
  `).bind(hitungSebagaiHadir ? 1 : 0, id).run()

  if (!result.meta.changes) return { error: 'Alasan izin tidak ditemukan' }
  revalidateIzinViews()
  return { success: 'Pengaturan kategori izin diperbarui' }
}

export async function hapusAlasanIzin(id: string): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }
  const db = await getDB()
  const roles = await getUserRoles(db, user.id)
  if (!roles.includes('super_admin')) return { error: 'Hanya super admin yang dapat mengelola alasan' }

  try {
    await db.prepare(`DELETE FROM alasan_izin_kelas WHERE id = ?`).bind(id).run()
    revalidateIzinViews()
    return { success: 'Alasan dihapus' }
  } catch (e: any) {
    return { error: e.message }
  }
}

export type SiswaIzinWaliKelas = {
  siswa_id: string
  nama_lengkap: string
  nisn: string
  foto_url: string | null
  izin_id: string | null
  alasan: AlasanIzin | null
  keterangan: string
}

export type KelasIzin = {
  kelas_id: string
  kelas_label: string
}

// Ambil kelas binaan untuk halaman izin (wali kelas & admin)
export async function getKelasBinaanForIzin(): Promise<{ error: string | null; kelas: KelasIzin[] }> {
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
    rows = (await db.prepare(
      `SELECT id, tingkat, nomor_kelas, kelompok FROM kelas WHERE wali_kelas_id = ? ORDER BY tingkat, CAST(nomor_kelas AS INTEGER)`
    ).bind(user.id).all<any>()).results || []
  }

  return {
    error: null,
    kelas: rows.map(r => ({
      kelas_id: r.id,
      kelas_label: formatNamaKelas(r.tingkat, r.nomor_kelas, r.kelompok),
    })),
  }
}

// Load daftar siswa + izin tidak masuk kelas yang sudah ada untuk kelas & tanggal
export async function loadSiswaUntukIzin(kelasId: string, tanggal: string): Promise<{
  error: string | null
  siswa: SiswaIzinWaliKelas[]
}> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized', siswa: [] }

  const db = await getDB()
  const roles = await getUserRoles(db, user.id)
  const isAdmin = roles.includes('super_admin') || roles.includes('admin_tu') || roles.includes('kepsek') || roles.includes('wakamad')

  if (!isAdmin) {
    const kelas = await db.prepare(
      `SELECT id FROM kelas WHERE id = ? AND wali_kelas_id = ?`
    ).bind(kelasId, user.id).first<any>()
    if (!kelas) return { error: 'Anda tidak memiliki akses ke kelas ini', siswa: [] }
  }

  const [siswaRes, izinRes] = await Promise.all([
    db.prepare(
      `SELECT id, nama_lengkap, nisn, foto_url FROM siswa WHERE kelas_id = ? AND status = 'aktif' ORDER BY nama_lengkap`
    ).bind(kelasId).all<any>(),
    db.prepare(
      `SELECT id, siswa_id, alasan, keterangan FROM izin_tidak_masuk_kelas WHERE tanggal = ? AND siswa_id IN (SELECT id FROM siswa WHERE kelas_id = ? AND status = 'aktif')`
    ).bind(tanggal, kelasId).all<any>(),
  ])

  // Ambil record izin pertama per siswa (per hari bisa >1 tapi wali kelas hanya kelola 1)
  const izinMap = new Map<string, { id: string; alasan: string; keterangan: string }>()
  for (const i of izinRes.results || []) {
    if (!izinMap.has(i.siswa_id)) {
      izinMap.set(i.siswa_id, { id: i.id, alasan: i.alasan, keterangan: i.keterangan || '' })
    }
  }

  return {
    error: null,
    siswa: (siswaRes.results || []).map((s: any) => {
      const iz = izinMap.get(s.id)
      return {
        siswa_id: s.id,
        nama_lengkap: s.nama_lengkap,
        nisn: s.nisn,
        foto_url: s.foto_url ?? null,
        izin_id: iz?.id || null,
        alasan: (iz?.alasan as AlasanIzin) || null,
        keterangan: iz?.keterangan || '',
      }
    }),
  }
}

// Simpan batch izin wali kelas (upsert per siswa per tanggal)
export async function simpanIzinWaliKelasBatch(
  kelasId: string,
  tanggal: string,
  data: Array<{ siswa_id: string; alasan: AlasanIzin | null; keterangan: string }>
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  const db = await getDB()
  const roles = await getUserRoles(db, user.id)
  const isAdmin = roles.includes('super_admin') || roles.includes('admin_tu') || roles.includes('kepsek') || roles.includes('wakamad')

  if (!isAdmin) {
    const kelas = await db.prepare(
      `SELECT id FROM kelas WHERE id = ? AND wali_kelas_id = ?`
    ).bind(kelasId, user.id).first<any>()
    if (!kelas) return { error: 'Akses ditolak' }
  }

  const siswaIds = data.map(d => d.siswa_id)
  const toHapus = data.filter(d => d.alasan === null).map(d => d.siswa_id)
  const toSimpan = data.filter(d => d.alasan !== null)

  try {
    const alasanDipakai = Array.from(new Set(toSimpan.map(d => d.alasan).filter(Boolean))) as string[]
    if (alasanDipakai.length > 0) {
      const placeholders = alasanDipakai.map(() => '?').join(', ')
      const res = await db.prepare(
        `SELECT alasan FROM alasan_izin_kelas WHERE alasan IN (${placeholders})`
      ).bind(...alasanDipakai).all<{ alasan: string }>()
      const valid = new Set((res.results || []).map(r => r.alasan))
      const invalid = alasanDipakai.find(a => !valid.has(a))
      if (invalid) return { error: `Alasan "${invalid}" tidak tersedia. Silakan pilih alasan dari daftar yang ada.` }
    }

    const stmts: any[] = []

    // Hapus semua record izin lama untuk siswa yang ada di list (per tanggal)
    for (const siswaId of siswaIds) {
      stmts.push(
        db.prepare(`DELETE FROM izin_tidak_masuk_kelas WHERE siswa_id = ? AND tanggal = ?`)
          .bind(siswaId, tanggal)
      )
    }

    // Insert record baru untuk yang ada izin
    for (const d of toSimpan) {
      const id = crypto.randomUUID()
      stmts.push(
        db.prepare(`
          INSERT INTO izin_tidak_masuk_kelas (id, siswa_id, tanggal, jam_pelajaran, alasan, keterangan, diinput_oleh)
          VALUES (?, ?, ?, NULL, ?, ?, ?)
        `).bind(id, d.siswa_id, tanggal, d.alasan, d.keterangan || null, user.id)
      )
    }

    for (let i = 0; i < stmts.length; i += 100) {
      await db.batch(stmts.slice(i, i + 100))
    }

    revalidateIzinViews()
    return { success: toSimpan.length > 0 ? `${toSimpan.length} izin disimpan` : 'Izin dihapus' }
  } catch (e: any) {
    return { error: e.message }
  }
}

// ============================================================
// SEARCH SISWA (lazy — dipanggil saat user mengetik, LIMIT 20)
// ============================================================
export async function searchSiswaIzin(query: string) {
  if (!query || query.trim().length < 2) return []

  const db = await getDB()
  const q = `%${query.trim()}%`

  const result = await db
    .prepare(
      `SELECT s.id, s.nama_lengkap, s.nisn, s.foto_url, k.tingkat, k.nomor_kelas
       FROM siswa s
       LEFT JOIN kelas k ON s.kelas_id = k.id
       WHERE s.status = 'aktif' AND (s.nama_lengkap LIKE ? OR s.nisn LIKE ?)
       ORDER BY s.nama_lengkap ASC
       LIMIT 20`
    )
    .bind(q, q)
    .all<any>()

  return (result.results ?? []).map((s: any) => ({
    id: s.id,
    nama_lengkap: s.nama_lengkap,
    nisn: s.nisn,
    foto_url: s.foto_url ?? null,
    kelas: s.tingkat ? { tingkat: s.tingkat, nomor_kelas: s.nomor_kelas } : null,
  }))
}

// ============================================================
// 1. IZIN KELUAR KOMPLEK
// ============================================================
export async function tambahIzinKeluar(prevState: any, formData: FormData) {
  const db = await getDB()
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized', success: null }
  const roles = await getUserRoles(db, user.id)
  if (!hasAnyRole(roles, INPUT_IZIN_ROLES)) return { error: 'Anda tidak memiliki hak untuk menginput perizinan.', success: null }

  const siswa_id = formData.get('siswa_id') as string
  const keterangan = formData.get('keterangan') as string

  if (!siswa_id) return { error: 'Siswa wajib dipilih!', success: null }

  const result = await dbInsert(db, 'izin_keluar_komplek', {
    siswa_id,
    keterangan,
    waktu_keluar: nowWIBISO(),
    diinput_oleh: user.id,
  })

  if (result.error) return { error: result.error, success: null }

  revalidateIzinViews()
  return { error: null, success: 'Berhasil mencatat izin keluar komplek!' }
}

export async function tandaiSudahKembali(id: string) {
  const db = await getDB()
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }
  const roles = await getUserRoles(db, user.id)
  if (!hasAnyRole(roles, INPUT_IZIN_ROLES)) return { error: 'Anda tidak memiliki hak untuk mengubah status perizinan.' }

  const result = await dbUpdate(
    db,
    'izin_keluar_komplek',
    {
      waktu_kembali: nowWIBISO(),
      status: 'SUDAH KEMBALI',
      updated_at: nowWIBISO(),
    },
    { id }
  )

  if (result.error) return { error: result.error }
  revalidateIzinViews()
  return { success: 'Status siswa diperbarui menjadi SUDAH KEMBALI.' }
}

export async function editIzinKeluar(
  id: string,
  data: { waktu_keluar: string; waktu_kembali?: string | null; status: string; keterangan?: string | null }
) {
  const db = await getDB()
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }
  const roles = await getUserRoles(db, user.id)
  if (!hasAnyRole(roles, INPUT_IZIN_ROLES)) return { error: 'Anda tidak memiliki hak untuk mengubah perizinan.' }

  const waktuKeluar = normalizeWIBDateTime(data.waktu_keluar)
  const waktuKembali = normalizeWIBDateTime(data.waktu_kembali)
  const status = data.status === 'SUDAH KEMBALI' ? 'SUDAH KEMBALI' : 'BELUM KEMBALI'

  if (!id) return { error: 'ID izin tidak valid.' }
  if (!waktuKeluar) return { error: 'Waktu keluar tidak valid.' }
  if (status === 'SUDAH KEMBALI' && !waktuKembali) return { error: 'Waktu kembali wajib diisi jika status sudah kembali.' }

  const result = await dbUpdate(
    db,
    'izin_keluar_komplek',
    {
      waktu_keluar: waktuKeluar,
      waktu_kembali: status === 'SUDAH KEMBALI' ? waktuKembali : null,
      status,
      keterangan: data.keterangan?.trim() || null,
      updated_at: nowWIBISO(),
    },
    { id }
  )

  if (result.error) return { error: result.error }
  revalidateIzinViews()
  return { success: 'Riwayat izin keluar berhasil diperbarui.' }
}

export async function hapusIzinKeluar(id: string) {
  const db = await getDB()
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }
  const roles = await getUserRoles(db, user.id)
  if (!hasAnyRole(roles, DELETE_IZIN_ROLES)) return { error: 'Hanya super admin dan admin TU yang dapat menghapus riwayat izin.' }

  const result = await dbDelete(db, 'izin_keluar_komplek', { id })
  if (result.error) return { error: result.error }
  revalidateIzinViews()
  return { success: 'Riwayat izin berhasil dihapus.' }
}

export async function hapusIzinKeluarBatch(ids: string[]) {
  const db = await getDB()
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }
  const roles = await getUserRoles(db, user.id)
  if (!hasAnyRole(roles, DELETE_IZIN_ROLES)) return { error: 'Hanya super admin dan admin TU yang dapat menghapus riwayat izin.' }

  const cleanIds = Array.from(new Set(ids.filter(id => typeof id === 'string' && id.trim()).map(id => id.trim())))
  if (cleanIds.length === 0) return { error: 'Pilih minimal satu riwayat izin keluar untuk dihapus.' }

  try {
    for (let i = 0; i < cleanIds.length; i += 50) {
      const chunk = cleanIds.slice(i, i + 50)
      const placeholders = chunk.map(() => '?').join(', ')
      await db.prepare(`DELETE FROM izin_keluar_komplek WHERE id IN (${placeholders})`).bind(...chunk).run()
    }
    revalidateIzinViews()
    return { success: `${cleanIds.length} riwayat izin keluar berhasil dihapus.` }
  } catch (e: any) {
    return { error: e.message }
  }
}

// ============================================================
// 2. IZIN TIDAK MASUK KELAS
// ============================================================
export async function tambahIzinTidakMasuk(prevState: any, formData: FormData) {
  const db = await getDB()
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized', success: null }
  const roles = await getUserRoles(db, user.id)
  if (!hasAnyRole(roles, INPUT_IZIN_ROLES)) return { error: 'Anda tidak memiliki hak untuk menginput perizinan.', success: null }

  const siswa_id = formData.get('siswa_id') as string
  const tanggal = formData.get('tanggal') as string
  const jam_pelajaran = formData.get('jam_pelajaran') as string
  const alasan = formData.get('alasan') as string
  const keterangan = formData.get('keterangan') as string

  if (!siswa_id || !alasan) return { error: 'Siswa dan alasan wajib diisi!', success: null }
  const invalidAlasan = await validateAlasanIzin(db, alasan)
  if (invalidAlasan) return { error: invalidAlasan, success: null }

  const result = await dbInsert(db, 'izin_tidak_masuk_kelas', {
    siswa_id,
    tanggal: tanggal || todayWIB(),
    jam_pelajaran: jam_pelajaran || null,
    alasan,
    keterangan: keterangan || null,
    diinput_oleh: user.id,
  })

  if (result.error) return { error: result.error, success: null }

  revalidateIzinViews()
  return { error: null, success: 'Izin tidak masuk kelas berhasil dicatat!' }
}

export async function hapusIzinTidakMasuk(id: string) {
  const db = await getDB()
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }
  const roles = await getUserRoles(db, user.id)
  if (!hasAnyRole(roles, DELETE_IZIN_ROLES)) return { error: 'Hanya super admin dan admin TU yang dapat menghapus riwayat izin.' }

  const result = await dbDelete(db, 'izin_tidak_masuk_kelas', { id })
  if (result.error) return { error: result.error }
  revalidateIzinViews()
  return { success: 'Data izin berhasil dihapus.' }
}

// ============================================================
// IZIN TIDAK MASUK KELAS — fungsi tambah & hapus
// (fungsi ini dipakai oleh izin-client.tsx yang sudah ada)
// ============================================================
export async function tambahIzinKelas(prevState: any, formData: FormData) {
  const db = await getDB()
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized', success: null }
  const roles = await getUserRoles(db, user.id)
  if (!hasAnyRole(roles, INPUT_IZIN_ROLES)) return { error: 'Anda tidak memiliki hak untuk menginput perizinan.', success: null }

  const siswa_id = formData.get('siswa_id') as string
  const alasan = formData.get('alasan') as string
  const keterangan = formData.get('keterangan') as string
  const jamRaw = formData.getAll('jam_pelajaran')
  const jam_pelajaran = jamRaw.map(j => parseInt(j as string)).sort((a, b) => a - b)

  if (!siswa_id) return { error: 'Siswa wajib dipilih!', success: null }
  if (jam_pelajaran.length === 0) return { error: 'Pilih minimal 1 jam pelajaran!', success: null }
  if (!alasan) return { error: 'Alasan wajib dipilih!', success: null }
  const invalidAlasan = await validateAlasanIzin(db, alasan)
  if (invalidAlasan) return { error: invalidAlasan, success: null }

  const result = await dbInsert(db, 'izin_tidak_masuk_kelas', {
    siswa_id,
    jam_pelajaran: JSON.stringify(jam_pelajaran),
    alasan,
    keterangan,
    diinput_oleh: user.id,
  })

  if (result.error) return { error: result.error, success: null }
  revalidateIzinViews()
  return { error: null, success: 'Berhasil mencatat izin tidak masuk kelas!' }
}

export async function hapusIzinKelas(id: string) {
  const db = await getDB()
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }
  const roles = await getUserRoles(db, user.id)
  if (!hasAnyRole(roles, DELETE_IZIN_ROLES)) return { error: 'Hanya super admin dan admin TU yang dapat menghapus riwayat izin.' }

  const result = await dbDelete(db, 'izin_tidak_masuk_kelas', { id })
  if (result.error) return { error: result.error }
  revalidateIzinViews()
  return { success: 'Riwayat izin kelas berhasil dihapus.' }
}

export async function editIzinKelas(
  id: string,
  data: { jam_pelajaran: number[]; alasan: string; keterangan?: string | null }
) {
  const db = await getDB()
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }
  const roles = await getUserRoles(db, user.id)
  if (!hasAnyRole(roles, INPUT_IZIN_ROLES)) return { error: 'Anda tidak memiliki hak untuk mengubah perizinan.' }

  const jamPelajaran = Array.from(new Set((data.jam_pelajaran || [])
    .map(jam => Number(jam))
    .filter(jam => Number.isInteger(jam) && jam >= 1 && jam <= 10)))
    .sort((a, b) => a - b)
  const alasan = data.alasan?.trim()

  if (!id) return { error: 'ID izin tidak valid.' }
  if (jamPelajaran.length === 0) return { error: 'Pilih minimal 1 jam pelajaran.' }
  if (!alasan) return { error: 'Alasan wajib dipilih.' }

  const invalidAlasan = await validateAlasanIzin(db, alasan)
  if (invalidAlasan) return { error: invalidAlasan }

  const result = await dbUpdate(
    db,
    'izin_tidak_masuk_kelas',
    {
      jam_pelajaran: JSON.stringify(jamPelajaran),
      alasan,
      keterangan: data.keterangan?.trim() || null,
      updated_at: nowWIBISO(),
    },
    { id }
  )

  if (result.error) return { error: result.error }
  revalidateIzinViews()
  return { success: 'Riwayat izin kelas berhasil diperbarui.' }
}

export async function hapusIzinKelasBatch(ids: string[]) {
  const db = await getDB()
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }
  const roles = await getUserRoles(db, user.id)
  if (!hasAnyRole(roles, DELETE_IZIN_ROLES)) return { error: 'Hanya super admin dan admin TU yang dapat menghapus riwayat izin.' }

  const cleanIds = Array.from(new Set(ids.filter(id => typeof id === 'string' && id.trim()).map(id => id.trim())))
  if (cleanIds.length === 0) return { error: 'Pilih minimal satu riwayat izin kelas untuk dihapus.' }

  try {
    for (let i = 0; i < cleanIds.length; i += 50) {
      const chunk = cleanIds.slice(i, i + 50)
      const placeholders = chunk.map(() => '?').join(', ')
      await db.prepare(`DELETE FROM izin_tidak_masuk_kelas WHERE id IN (${placeholders})`).bind(...chunk).run()
    }
    revalidateIzinViews()
    return { success: `${cleanIds.length} riwayat izin kelas berhasil dihapus.` }
  } catch (e: any) {
    return { error: e.message }
  }
}
