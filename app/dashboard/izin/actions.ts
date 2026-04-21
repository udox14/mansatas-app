// Lokasi: app/dashboard/izin/actions.ts
'use server'

import { getDB, dbInsert, dbUpdate, dbDelete } from '@/utils/db'
import { getCurrentUser } from '@/utils/auth/server'
import { getUserRoles } from '@/lib/features'
import { revalidatePath } from 'next/cache'
import { nowWIBISO, todayWIB } from '@/lib/time'
import { formatNamaKelas } from '@/lib/utils'

export const ALASAN_IZIN = [
  'KELUAR KOMPLEK BERSAMA ORANG TUA',
  'SAKIT DI UKS',
  'SAKIT (PULANG)',
  'BIMBINGAN LOMBA',
  'KEGIATAN DI DALAM',
  'KEGIATAN DI LUAR',
] as const

export type AlasanIzin = typeof ALASAN_IZIN[number]

export type SiswaIzinWaliKelas = {
  siswa_id: string
  nama_lengkap: string
  nisn: string
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
      `SELECT id, nama_lengkap, nisn FROM siswa WHERE kelas_id = ? AND status = 'aktif' ORDER BY nama_lengkap`
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

    revalidatePath('/dashboard/izin')
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
      `SELECT s.id, s.nama_lengkap, s.nisn, k.tingkat, k.nomor_kelas
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

  const siswa_id = formData.get('siswa_id') as string
  const keterangan = formData.get('keterangan') as string

  if (!siswa_id) return { error: 'Siswa wajib dipilih!', success: null }

  const result = await dbInsert(db, 'izin_keluar_komplek', {
    siswa_id,
    keterangan,
    diinput_oleh: user.id,
  })

  if (result.error) return { error: result.error, success: null }

  revalidatePath('/dashboard/izin')
  return { error: null, success: 'Berhasil mencatat izin keluar komplek!' }
}

export async function tandaiSudahKembali(id: string) {
  const db = await getDB()
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
  revalidatePath('/dashboard/izin')
  return { success: 'Status siswa diperbarui menjadi SUDAH KEMBALI.' }
}

export async function hapusIzinKeluar(id: string) {
  const db = await getDB()
  const result = await dbDelete(db, 'izin_keluar_komplek', { id })
  if (result.error) return { error: result.error }
  revalidatePath('/dashboard/izin')
  return { success: 'Riwayat izin berhasil dihapus.' }
}

// ============================================================
// 2. IZIN TIDAK MASUK KELAS
// ============================================================
export async function tambahIzinTidakMasuk(prevState: any, formData: FormData) {
  const db = await getDB()
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized', success: null }

  const siswa_id = formData.get('siswa_id') as string
  const tanggal = formData.get('tanggal') as string
  const jam_pelajaran = formData.get('jam_pelajaran') as string
  const alasan = formData.get('alasan') as string
  const keterangan = formData.get('keterangan') as string

  if (!siswa_id || !alasan) return { error: 'Siswa dan alasan wajib diisi!', success: null }

  const result = await dbInsert(db, 'izin_tidak_masuk_kelas', {
    siswa_id,
    tanggal: tanggal || todayWIB(),
    jam_pelajaran: jam_pelajaran || null,
    alasan,
    keterangan: keterangan || null,
    diinput_oleh: user.id,
  })

  if (result.error) return { error: result.error, success: null }

  revalidatePath('/dashboard/izin')
  return { error: null, success: 'Izin tidak masuk kelas berhasil dicatat!' }
}

export async function hapusIzinTidakMasuk(id: string) {
  const db = await getDB()
  const result = await dbDelete(db, 'izin_tidak_masuk_kelas', { id })
  if (result.error) return { error: result.error }
  revalidatePath('/dashboard/izin')
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

  const siswa_id = formData.get('siswa_id') as string
  const alasan = formData.get('alasan') as string
  const keterangan = formData.get('keterangan') as string
  const jamRaw = formData.getAll('jam_pelajaran')
  const jam_pelajaran = jamRaw.map(j => parseInt(j as string)).sort((a, b) => a - b)

  if (!siswa_id) return { error: 'Siswa wajib dipilih!', success: null }
  if (jam_pelajaran.length === 0) return { error: 'Pilih minimal 1 jam pelajaran!', success: null }
  if (!alasan) return { error: 'Alasan wajib dipilih!', success: null }

  const result = await dbInsert(db, 'izin_tidak_masuk_kelas', {
    siswa_id,
    jam_pelajaran: JSON.stringify(jam_pelajaran),
    alasan,
    keterangan,
    diinput_oleh: user.id,
  })

  if (result.error) return { error: result.error, success: null }
  revalidatePath('/dashboard/izin')
  return { error: null, success: 'Berhasil mencatat izin tidak masuk kelas!' }
}

export async function hapusIzinKelas(id: string) {
  const db = await getDB()
  const result = await dbDelete(db, 'izin_tidak_masuk_kelas', { id })
  if (result.error) return { error: result.error }
  revalidatePath('/dashboard/izin')
  return { success: 'Riwayat izin kelas berhasil dihapus.' }
}
