// Lokasi: app/dashboard/siswa/actions.ts
'use server'

import { getDB, dbInsert, dbUpdate, dbDelete, dbSelectOne, dbBatchInsert, serializeValue } from '@/utils/db'
import { uploadFotoSiswa, validateImageFile, deleteFromR2 } from '@/utils/r2'
import { getCurrentUser } from '@/utils/auth/server'
import { revalidatePath } from 'next/cache'
import { getUserRoles } from '@/lib/features'

const FK_FIELDS = ['kelas_id', 'wali_murid_id']

// Helper untuk otentikasi role CRUD siswa (Hanya Super Admin & Admin TU)
async function verifyAdminAccess() {
  const user = await getCurrentUser()
  if (!user) return false
  const db = await getDB()
  const roles = await getUserRoles(db, user.id)
  return roles.some(r => ['super_admin', 'admin_tu'].includes(r))
}

// ============================================================
// 1. TAMBAH SISWA MANUAL
// ============================================================
export async function tambahSiswa(prevState: any, formData: FormData) {
  if (!(await verifyAdminAccess())) return { error: 'Akses Ditolak: Hanya Super Admin / Admin TU.', success: null }
  const db = await getDB()
  const tahunMasukRaw = formData.get('tahun_masuk') as string
  const payload = {
    nisn: formData.get('nisn') as string,
    nis_lokal: (formData.get('nis_lokal') as string) || null,
    nama_lengkap: formData.get('nama_lengkap') as string,
    asal_sekolah: (formData.get('asal_sekolah') as string) || null,
    jenis_kelamin: formData.get('jenis_kelamin') as string,
    tempat_tinggal: formData.get('tempat_tinggal') as string,
    tahun_masuk: tahunMasukRaw ? parseInt(tahunMasukRaw) : null,
  }

  if (!payload.nisn || !payload.nama_lengkap) {
    return { error: 'NISN dan Nama wajib diisi', success: null }
  }

  const result = await dbInsert(db, 'siswa', payload)
  if (result.error) {
    if (result.error.includes('UNIQUE')) {
      // Bisa jadi bentrok dengan siswa yang ada di sampah (soft delete)
      const existing = await db
        .prepare('SELECT status FROM siswa WHERE nisn = ?')
        .bind(payload.nisn)
        .first<{ status: string }>()
      if (existing?.status === 'dihapus') {
        return { error: 'NISN ini milik siswa yang ada di sampah. Pulihkan siswa tersebut, jangan tambah baru.', success: null }
      }
      return { error: 'NISN sudah terdaftar', success: null }
    }
    return { error: result.error, success: null }
  }

  revalidatePath('/dashboard/siswa')
  return { error: null, success: 'Siswa berhasil ditambahkan' }
}

// ============================================================
// 2. HAPUS SISWA
// ============================================================
export async function hapusSiswa(id: string) {
  if (!(await verifyAdminAccess())) return { error: 'Akses Ditolak: Hanya Super Admin / Admin TU.' }
  const db = await getDB()

  // HARD DELETE permanen — untuk siswa salah input / data sampel, benar-benar dibuang
  // dari DB. fin_* punya FK ke siswa TANPA ON DELETE CASCADE → hapus manual dulu
  // (anak→induk), baru DELETE siswa (cascade ke akademik/tahfidz/parent/sp/absensi).
  // Foto R2 ikut dibuang. Catatan: "siswa keluar" beda mekanisme (status='keluar',
  // tetap tersimpan & bisa dikembalikan).
  const siswa = await db
    .prepare('SELECT foto_url FROM siswa WHERE id = ?')
    .bind(id)
    .first<{ foto_url: string | null }>()
  if (!siswa) return { error: 'Siswa tidak ditemukan.' }

  try {
    await db.batch([
      db.prepare('DELETE FROM fin_dspt_audit_log WHERE siswa_id = ?').bind(id),
      db.prepare('DELETE FROM fin_payment_submissions WHERE siswa_id = ?').bind(id),
      db.prepare('DELETE FROM fin_transaksi WHERE siswa_id = ?').bind(id),
      db.prepare('DELETE FROM fin_diskon WHERE siswa_id = ?').bind(id),
      db.prepare('DELETE FROM fin_janji_bayar WHERE siswa_id = ?').bind(id),
      db.prepare('DELETE FROM fin_spp_tagihan WHERE siswa_id = ?').bind(id),
      db.prepare('DELETE FROM fin_spp_mulai WHERE siswa_id = ?').bind(id),
      db.prepare('DELETE FROM fin_spp_saldo_awal WHERE siswa_id = ?').bind(id),
      db.prepare('DELETE FROM fin_dspt WHERE siswa_id = ?').bind(id),
      db.prepare('DELETE FROM siswa WHERE id = ?').bind(id),
    ])
  } catch (e: any) {
    return { error: `Gagal menghapus siswa: ${e?.message || String(e)}` }
  }

  if (siswa.foto_url) {
    try { await deleteFromR2(siswa.foto_url) } catch {}
  }

  revalidatePath('/dashboard/siswa')
  return { success: 'Data siswa berhasil dihapus permanen.' }
}

// ============================================================
// 3. EDIT SISWA (Basic)
// ============================================================
export async function editSiswa(id: string, payload: any) {
  if (!(await verifyAdminAccess())) return { error: 'Akses Ditolak: Hanya Super Admin / Admin TU.', success: null }
  const db = await getDB()

  // Bersihkan FK kosong agar tidak simpan string kosong
  for (const field of FK_FIELDS) {
    if (payload[field] === '' || payload[field] === 'none') {
      payload[field] = null
    }
  }

  const result = await dbUpdate(
    db,
    'siswa',
    { ...payload, updated_at: new Date().toISOString() },
    { id }
  )

  if (result.error) {
    return {
      error: result.error.includes('UNIQUE') ? 'NISN sudah terdaftar pada siswa lain.' : result.error,
      success: null,
    }
  }

  revalidatePath('/dashboard/siswa')
  revalidatePath(`/dashboard/siswa/${id}`)
  return { error: null, success: 'Data siswa berhasil diperbarui.' }
}

// ============================================================
// 4. EDIT DETAIL LENGKAP SISWA (Buku Induk)
// ============================================================
export async function editDetailSiswa(id: string, payload: any) {
  if (!(await verifyAdminAccess())) return { error: 'Akses Ditolak: Hanya Super Admin / Admin TU.', success: null }
  const db = await getDB()

  for (const field of FK_FIELDS) {
    if (payload[field] === '' || payload[field] === 'none') {
      payload[field] = null
    }
  }

  const result = await dbUpdate(
    db,
    'siswa',
    { ...payload, updated_at: new Date().toISOString() },
    { id }
  )

  if (result.error) return { error: result.error, success: null }

  revalidatePath(`/dashboard/siswa/${id}`)
  revalidatePath('/dashboard/siswa')
  return { error: null, success: 'Data lengkap siswa berhasil diperbarui.' }
}

// ============================================================
// 5. UBAH STATUS SISWA
// ============================================================
export async function ubahStatusSiswa(id: string, status: string) {
  if (!(await verifyAdminAccess())) return { error: 'Akses Ditolak: Hanya Super Admin / Admin TU.' }
  const db = await getDB()
  const result = await dbUpdate(
    db,
    'siswa',
    { status, updated_at: new Date().toISOString() },
    { id }
  )
  if (result.error) return { error: result.error }
  revalidatePath('/dashboard/siswa')
  return { success: `Status siswa berhasil diubah menjadi ${status}.` }
}

// Tandai siswa keluar — update status + simpan info keluar + lepas dari kelas
export async function tandaiSiswaKeluar(payload: {
  siswa_id: string
  tanggal_keluar: string
  alasan_keluar: string
  keterangan_keluar: string
}) {
  if (!(await verifyAdminAccess())) return { error: 'Akses Ditolak: Hanya Super Admin / Admin TU.' }
  const db = await getDB()
  const result = await dbUpdate(db, 'siswa', {
    status: 'keluar',
    kelas_id: null,
    tanggal_keluar: payload.tanggal_keluar,
    alasan_keluar: payload.alasan_keluar,
    keterangan_keluar: payload.keterangan_keluar || null,
    updated_at: new Date().toISOString(),
  }, { id: payload.siswa_id })
  if (result.error) return { error: result.error }
  revalidatePath('/dashboard/siswa')
  revalidatePath(`/dashboard/siswa/${payload.siswa_id}`)
  return { success: 'Siswa berhasil ditandai keluar.' }
}

// Batalkan status keluar — kembalikan ke aktif (tanpa kelas, admin assign manual)
export async function batalkanKeluarSiswa(siswa_id: string) {
  if (!(await verifyAdminAccess())) return { error: 'Akses Ditolak: Hanya Super Admin / Admin TU.' }
  const db = await getDB()
  const result = await dbUpdate(db, 'siswa', {
    status: 'aktif',
    tanggal_keluar: null,
    alasan_keluar: null,
    keterangan_keluar: null,
    updated_at: new Date().toISOString(),
  }, { id: siswa_id })
  if (result.error) return { error: result.error }
  revalidatePath('/dashboard/siswa')
  revalidatePath(`/dashboard/siswa/${siswa_id}`)
  return { success: 'Status keluar siswa berhasil dibatalkan.' }
}

// Ambil daftar siswa keluar — lazy load, dipanggil saat tab Keluar dibuka
export async function getSiswaKeluar(search?: string) {
  if (!(await verifyAdminAccess())) return []
  const db = await getDB()
  const params: any[] = []
  let whereExtra = ''
  if (search && search.trim().length >= 2) {
    whereExtra = `AND (LOWER(s.nama_lengkap) LIKE LOWER(?) OR s.nisn LIKE ?)`
    params.push(`%${search}%`, `%${search}%`)
  }

  const res = await db.prepare(`
    SELECT
      s.id, s.nisn, s.nama_lengkap, s.jenis_kelamin, s.foto_url,
      s.tanggal_keluar, s.alasan_keluar, s.keterangan_keluar,
      s.updated_at
    FROM siswa s
    WHERE s.status = 'keluar' ${whereExtra}
    ORDER BY s.tanggal_keluar DESC, s.nama_lengkap ASC
  `).bind(...params).all<any>()

  return res.results || []
}

// Ambil data lengkap untuk export XLSX.
// Hak akses mengikuti daftar siswa: pimpinan/TU dapat semua, guru terkait hanya kelas yang terhubung.
export async function getSiswaExportData() {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized', data: [] }

  const db = await getDB()
  const roles = await getUserRoles(db, user.id)
  const isFullListAccess = roles.some(r => [
    'super_admin', 'admin_tu', 'kepsek', 'wakamad', 'resepsionis', 'guru_piket', 'guru_ppl',
  ].includes(r))

  let where = ''
  let params: string[] = []

  if (!isFullListAccess) {
    const allowedKelasIds = new Set<string>()
    const [penugasan, wali, waliBk] = await Promise.all([
      db.prepare('SELECT DISTINCT kelas_id FROM penugasan_mengajar WHERE guru_id = ?').bind(user.id).all<{ kelas_id: string }>(),
      db.prepare('SELECT id FROM kelas WHERE wali_kelas_id = ?').bind(user.id).all<{ id: string }>(),
      db.prepare('SELECT DISTINCT kelas_id FROM kelas_binaan_bk WHERE guru_bk_id = ?').bind(user.id).all<{ kelas_id: string }>(),
    ])

    penugasan.results?.forEach(row => allowedKelasIds.add(row.kelas_id))
    wali.results?.forEach(row => allowedKelasIds.add(row.id))
    waliBk.results?.forEach(row => allowedKelasIds.add(row.kelas_id))

    if (allowedKelasIds.size === 0) return { error: null, data: [] }
    params = Array.from(allowedKelasIds)
    where = `WHERE s.kelas_id IN (${params.map(() => '?').join(',')})`
  }

  const res = await db.prepare(`
    SELECT
      s.id, s.nisn, s.nis_lokal, s.nama_lengkap, s.jenis_kelamin, s.status,
      s.tahun_masuk, s.tempat_tinggal, s.asrama, s.kamar, s.asal_sekolah,
      s.minat_jurusan, s.nik, s.tempat_lahir, s.tanggal_lahir, s.agama,
      s.jumlah_saudara, s.anak_ke, s.status_anak,
      s.alamat_lengkap, s.rt, s.rw, s.desa_kelurahan, s.kecamatan,
      s.kabupaten_kota, s.provinsi, s.kode_pos, s.nomor_whatsapp, s.nomor_kk,
      s.nama_ayah, s.nik_ayah, s.tempat_lahir_ayah, s.tanggal_lahir_ayah,
      s.status_ayah, s.pendidikan_ayah, s.pekerjaan_ayah, s.penghasilan_ayah,
      s.nama_ibu, s.nik_ibu, s.tempat_lahir_ibu, s.tanggal_lahir_ibu,
      s.status_ibu, s.pendidikan_ibu, s.pekerjaan_ibu, s.penghasilan_ibu,
      k.id AS kelas_id, k.tingkat, k.kelompok, k.nomor_kelas
    FROM siswa s
    LEFT JOIN kelas k ON s.kelas_id = k.id
    ${where}
    ORDER BY k.tingkat ASC, k.kelompok ASC, k.nomor_kelas ASC, s.nama_lengkap ASC
  `).bind(...params).all<any>()

  return { error: null, data: res.results || [] }
}

// ============================================================
// 6. UPLOAD FOTO SISWA KE R2
// Nama file tetap per siswa (overwrite otomatis), tidak perlu hapus lama
// ============================================================
export async function uploadFotoSiswaAction(siswaId: string, formData: FormData) {
  if (!(await verifyAdminAccess())) return { error: 'Akses Ditolak: Hanya Super Admin / Admin TU.' }
  const file = formData.get('foto') as File
  if (!file || file.size === 0) return { error: 'Tidak ada file.' }

  // Validasi sebelum upload
  const validationError = validateImageFile(file)
  if (validationError) return { error: validationError }

  const { url, error: uploadError } = await uploadFotoSiswa(siswaId, file)
  if (uploadError || !url) return { error: uploadError || 'Upload gagal' }
  const versionedUrl = `${url}?v=${Date.now()}`

  const db = await getDB()
  const result = await dbUpdate(
    db,
    'siswa',
    { foto_url: versionedUrl, updated_at: new Date().toISOString() },
    { id: siswaId }
  )
  if (result.error) return { error: result.error }

  revalidatePath('/dashboard/siswa')
  revalidatePath(`/dashboard/siswa/${siswaId}`)
  return { success: 'Foto berhasil diperbarui!', url: versionedUrl }
}

// ============================================================
// 7. IMPORT MASSAL SISWA
// Template dan proses import hanya menyimpan kolom yang memang ada di tabel siswa.
// Kolom tambahan dari format lama tetap aman dibaca, tapi diabaikan.
//
// ============================================================
export async function importSiswaMassal(dataSiswa: any[]) {
  if (!(await verifyAdminAccess())) return { error: 'Akses Ditolak: Hanya Super Admin / Admin TU.', success: null }
  const db = await getDB()
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  // Helper: ambil nilai string dari kolom, support multiple nama kolom (alias)
  const s = (row: any, ...keys: string[]): string | null => {
    for (const k of keys) {
      const v = row[k]
      if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim()
    }
    return null
  }
  // Helper: ambil nilai integer
  const n = (row: any, ...keys: string[]): number | null => {
    for (const k of keys) {
      const v = row[k]
      if (v !== undefined && v !== null && String(v).trim() !== '') {
        const num = parseInt(String(v))
        return isNaN(num) ? null : num
      }
    }
    return null
  }
  // Helper: cek apakah minimal satu kolom ada dan berisi nilai.
  const has = (row: any, ...keys: string[]): boolean => s(row, ...keys) !== null

  // -------------------------------------------------------
  // WHITELIST kolom tabel siswa
  // -------------------------------------------------------
  const SISWA_COLS = new Set([
    'id', 'nisn', 'nis_lokal', 'nama_lengkap', 'jenis_kelamin', 'tempat_tinggal',
    'kelas_id', 'wali_murid_id', 'status', 'foto_url', 'minat_jurusan',
    'nik', 'asal_sekolah', 'tempat_lahir', 'tanggal_lahir', 'agama',
    'asrama', 'kamar',
    'jumlah_saudara', 'anak_ke', 'status_anak',
    'alamat_lengkap', 'rt', 'rw', 'desa_kelurahan', 'kecamatan', 'kabupaten_kota',
    'provinsi', 'kode_pos', 'nomor_whatsapp', 'nomor_kk',
    'nama_ayah', 'nik_ayah', 'tempat_lahir_ayah', 'tanggal_lahir_ayah', 'status_ayah',
    'pendidikan_ayah', 'pekerjaan_ayah', 'penghasilan_ayah',
    'nama_ibu', 'nik_ibu', 'tempat_lahir_ibu', 'tanggal_lahir_ibu', 'status_ibu',
    'pendidikan_ibu', 'pekerjaan_ibu', 'penghasilan_ibu',
    'tahun_masuk', 'updated_at',
  ])

  // Ambil data kelas dan siswa existing
  const [kelasDb, existingDb] = await Promise.all([
    db.prepare('SELECT id, tingkat, kelompok, nomor_kelas FROM kelas').all<any>(),
    db.prepare('SELECT id, nisn, nama_lengkap FROM siswa').all<any>(),
  ])

  const kelasMap = new Map<string, string>()
  kelasDb.results.forEach((k: any) => {
    const key = `${k.tingkat}-${k.kelompok}-${k.nomor_kelas}`.toUpperCase()
    kelasMap.set(key, k.id)
  })

  const existingByNama = new Map<string, { id: string; nisn: string }[]>()
  const existingByNisn = new Map<string, { id: string; nama_lengkap: string }>()
  existingDb.results.forEach((s2: any) => {
    const namaKey = s2.nama_lengkap.toLowerCase().trim()
    const rows = existingByNama.get(namaKey) ?? []
    rows.push({ id: s2.id, nisn: s2.nisn })
    existingByNama.set(namaKey, rows)
    if (s2.nisn) existingByNisn.set(s2.nisn.trim(), { id: s2.id, nama_lengkap: s2.nama_lengkap })
  })

  const toInsert: Array<{ siswaData: any }> = []
  const toUpdate: Array<{ id: string; siswaData: any }> = []
  const errors: string[] = []

  const VALID_TEMPAT_TINGGAL = [
    'Non-Pesantren', 'Pesantren', 'Pesantren Sukahideng',
    'Pesantren Sukamanah', 'Pesantren Sukaguru', "Pesantren Al-Ma'mur",
  ]

  for (const row of dataSiswa) {
    // --- Identitas wajib ---
    const nisn = s(row, 'NISN', 'nisn') ?? ''
    const nama_lengkap = s(row, 'Nama Peserta', 'Nama Lengkap', 'NAMA_LENGKAP', 'nama_lengkap') ?? ''

    if (!nama_lengkap) { errors.push(`Baris tanpa nama dilewati`); continue }

    // --- Kelas (kolom khusus aplikasi) ---
    const tingkat = n(row, 'Tingkat Kelas', 'TINGKAT', 'tingkat')
    const kelompok = s(row, 'Kelompok Kelas', 'KELOMPOK', 'kelompok')?.toUpperCase() ?? 'UMUM'
    const nomor_kelas = s(row, 'Nomor Kelas', 'NOMOR_KELAS', 'nomor_kelas')
    const hasKelasInfo = has(row, 'Tingkat Kelas', 'TINGKAT', 'tingkat', 'Nomor Kelas', 'NOMOR_KELAS', 'nomor_kelas')
    const kelasKey = tingkat && nomor_kelas ? `${tingkat}-${kelompok}-${nomor_kelas}` : null
    const kelas_id = kelasKey ? (kelasMap.get(kelasKey) ?? null) : null
    if (hasKelasInfo && (!kelasKey || !kelas_id)) {
      errors.push(`Kelas tidak ditemukan untuk ${nama_lengkap}: ${tingkat ?? '-'}-${kelompok}-${nomor_kelas ?? '-'}`)
    }

    // --- Tempat tinggal (enum aplikasi) ---
    const pesantrenRaw = s(row, 'Tempat Tinggal', 'Pesantren', 'PESANTREN', 'TEMPAT_TINGGAL', 'tempat_tinggal') ?? ''
    const hasTempatTinggal = pesantrenRaw !== ''
    const tempat_tinggal = VALID_TEMPAT_TINGGAL.includes(pesantrenRaw) ? pesantrenRaw : null

    // --- JK ---
    const jkRaw = s(row, 'JK', 'JENIS_KELAMIN', 'jenis_kelamin') ?? ''
    const hasJenisKelamin = jkRaw !== ''
    const jkUpper = jkRaw.toUpperCase()
    const jenis_kelamin = jkUpper === 'P' || jkUpper === 'PEREMPUAN' ? 'P' : 'L'

    // --- Status siswa ---
    const statusInput = s(row, 'Status Siswa', 'Status', 'STATUS', 'status')
    const statusRaw = (statusInput ?? '').toLowerCase()
    const status = ['aktif', 'lulus', 'pindah', 'keluar'].includes(statusRaw) ? statusRaw : null

    // --- Build payload sesuai kolom tabel siswa ---
    const fullPayload: any = {
      nisn: nisn || null,
      nis_lokal: s(row, 'NIS Lokal', 'NIS_LOKAL', 'nis_lokal'),
      nama_lengkap,
      jenis_kelamin: hasJenisKelamin ? jenis_kelamin : null,
      tempat_tinggal: hasTempatTinggal ? tempat_tinggal : null,
      kelas_id: hasKelasInfo ? kelas_id : null,
      status,
      tahun_masuk:      n(row, 'Tahun Masuk', 'TAHUN_MASUK', 'tahun_masuk'),
      asal_sekolah:     s(row, 'Asal Sekolah', 'ASAL_SEKOLAH', 'asal_sekolah'),
      minat_jurusan:    s(row, 'Minat Jurusan', 'Jurusan Pilihan 1', 'MINAT_JURUSAN'),
      asrama:           s(row, 'Asrama', 'ASRAMA', 'asrama'),
      kamar:            s(row, 'Kamar', 'KAMAR', 'kamar'),
      tempat_lahir:     s(row, 'Tempat Lahir', 'TEMPAT_LAHIR'),
      tanggal_lahir:    s(row, 'Tanggal Lahir', 'TANGGAL_LAHIR'),
      agama:            s(row, 'Agama', 'AGAMA'),
      nik:              s(row, 'NIK', 'nik'),
      nomor_kk:         s(row, 'No KK', 'No. KK', 'NOMOR_KK'),
      nomor_whatsapp:   s(row, 'Nomor Whatsapp', 'Nomor WhatsApp', 'Nomor HP', 'NOMOR_WHATSAPP', 'nomor_whatsapp'),
      anak_ke:          n(row, 'Anak Ke', 'ANAK_KE'),
      jumlah_saudara:   n(row, 'Jumlah Saudara Kandung', 'JUMLAH_SAUDARA'),
      status_anak:      s(row, 'Status Anak', 'STATUS_ANAK'),
      alamat_lengkap:   s(row, 'Alamat Lengkap', 'Alamat', 'ALAMAT_LENGKAP'),
      rt:               s(row, 'RT'),
      rw:               s(row, 'RW'),
      desa_kelurahan:   s(row, 'Desa/Kelurahan', 'Kelurahan', 'DESA_KELURAHAN'),
      kecamatan:        s(row, 'Kecamatan', 'KECAMATAN'),
      kabupaten_kota:   s(row, 'Kabupaten/Kota', 'KABUPATEN_KOTA'),
      provinsi:         s(row, 'Provinsi', 'PROVINSI'),
      kode_pos:         s(row, 'Kode Pos', 'KODE_POS'),
      nama_ayah:        s(row, 'Nama Ayah', 'NAMA_AYAH'),
      nik_ayah:         s(row, 'NIK Ayah'),
      tempat_lahir_ayah: s(row, 'Tempat Lahir Ayah'),
      tanggal_lahir_ayah: s(row, 'Tanggal Lahir Ayah'),
      pendidikan_ayah:  s(row, 'Pendidikan Ayah', 'PENDIDIKAN_AYAH'),
      pekerjaan_ayah:   s(row, 'Pekerjaan Ayah', 'PEKERJAAN_AYAH'),
      status_ayah:      s(row, 'Status Ayah', 'STATUS_AYAH'),
      penghasilan_ayah: s(row, 'Penghasilan Ayah', 'Penghasilan Bulanan Ayah', 'PENGHASILAN_AYAH'),
      nama_ibu:         s(row, 'Nama Ibu', 'NAMA_IBU'),
      nik_ibu:          s(row, 'NIK Ibu'),
      tempat_lahir_ibu: s(row, 'Tempat Lahir Ibu'),
      tanggal_lahir_ibu: s(row, 'Tanggal Lahir Ibu'),
      pendidikan_ibu:   s(row, 'Pendidikan Ibu', 'PENDIDIKAN_IBU'),
      pekerjaan_ibu:    s(row, 'Pekerjaan Ibu', 'PEKERJAAN_IBU'),
      status_ibu:       s(row, 'Status Ibu', 'STATUS_IBU'),
      penghasilan_ibu:  s(row, 'Penghasilan Ibu', 'Penghasilan Bulanan Ibu', 'PENGHASILAN_IBU'),
    }

    // Hapus semua key null agar tidak overwrite data existing yang sudah terisi
    Object.keys(fullPayload).forEach(k => {
      if (fullPayload[k] === null) delete fullPayload[k]
    })

    // -----------------------------------------------------------
    // Simpan hanya kolom yang benar-benar ada di tabel siswa.
    // -----------------------------------------------------------
    const siswaPayload: any = {}

    for (const [k, v] of Object.entries(fullPayload)) {
      if (SISWA_COLS.has(k)) siswaPayload[k] = v
    }

    // Pastikan field wajib siswa selalu ada (termasuk setelah filter null di atas)
    siswaPayload.nama_lengkap  = nama_lengkap
    if (hasJenisKelamin) siswaPayload.jenis_kelamin = jenis_kelamin
    if (hasTempatTinggal && tempat_tinggal) siswaPayload.tempat_tinggal = tempat_tinggal
    if (hasKelasInfo && kelas_id) siswaPayload.kelas_id = kelas_id
    if (status) siswaPayload.status = status

    const existing = nisn ? existingByNisn.get(nisn) : null
    const sameNameRows = existingByNama.get(nama_lengkap.toLowerCase()) ?? []

    if (existing) {
      // UPDATE hanya berdasarkan NISN. Nama sama tidak boleh menimpa data siswa lama.
      if (nisn) siswaPayload.nisn = nisn
      toUpdate.push({ id: existing.id, siswaData: siswaPayload })
    } else {
      // INSERT: siswa baru — NISN wajib (NOT NULL UNIQUE constraint di DB)
      if (!nisn) {
        const suffix = sameNameRows.length > 0
          ? ` Nama ini sudah ada di database (${sameNameRows.map(row => row.nisn || 'NISN kosong').join(', ')}), jadi tidak diupdate otomatis.`
          : ''
        errors.push(`Dilewati (NISN kosong): ${nama_lengkap}.${suffix}`)
        continue
      }

      if (sameNameRows.length > 0) {
        errors.push(`Konflik nama, disimpan sebagai siswa baru karena NISN berbeda: ${nama_lengkap} (${nisn}). Data lama tidak ditimpa.`)
      }
      siswaPayload.nisn = nisn
      siswaPayload.jenis_kelamin = siswaPayload.jenis_kelamin ?? jenis_kelamin
      siswaPayload.tempat_tinggal = siswaPayload.tempat_tinggal ?? 'Non-Pesantren'
      siswaPayload.status = siswaPayload.status ?? 'aktif'
      // Pre-generate ID agar batch insert tetap bisa dipetakan dengan jelas.
      const newId = crypto.randomUUID().replace(/-/g, '')
      siswaPayload.id = newId
      toInsert.push({ siswaData: siswaPayload })
    }
  }

  let insertCount = 0
  let updateCount = 0

  // ---- INSERT siswa baru ----
  if (toInsert.length > 0) {
    const siswaRows = toInsert.map(r => r.siswaData)
    const { successCount, error: batchError } = await dbBatchInsert(db, 'siswa', siswaRows)
    insertCount = successCount
    // FIX: Propagate error dari dbBatchInsert — sebelumnya error ini diabaikan
    if (batchError) errors.push(`DB insert error: ${batchError}`)

  }

  // ---- UPDATE siswa existing ----
  if (toUpdate.length > 0) {
    const chunkSize = 50
    for (let i = 0; i < toUpdate.length; i += chunkSize) {
      const chunk = toUpdate.slice(i, i + chunkSize)
      const stmts = chunk.map((item: any) => {
        const keys = Object.keys(item.siswaData)
        const sets = keys.map((k) => `${k} = ?`).join(', ')
        const vals = keys.map((k) => serializeValue(item.siswaData[k]))
        return db.prepare(`UPDATE siswa SET ${sets}, updated_at = datetime('now') WHERE id = ?`).bind(...vals, item.id)
      })
      await db.batch(stmts)
      updateCount += chunk.length
    }
  }

  revalidatePath('/dashboard/siswa')
  return {
    error: errors.length > 0 ? errors.slice(0, 5).join('; ') : null,
    success: `Import selesai: ${insertCount} ditambahkan, ${updateCount} diperbarui.`,
  }
}

// ============================================================
// FUNGSI YANG DIBUTUHKAN OLEH CLIENT COMPONENTS
// (tetap ada dari versi original, tidak dihapus)
// ============================================================

// editSiswaLengkap — dipakai oleh edit-modal.tsx
export async function editSiswaLengkap(prevState: any, formData: FormData) {
  if (!(await verifyAdminAccess())) return { error: 'Akses Ditolak: Hanya Super Admin / Admin TU.', success: null }
  const db = await getDB()
  const id = formData.get('id') as string
  if (!id) return { error: 'ID siswa tidak ditemukan', success: null }

  const payload: any = Object.fromEntries(formData.entries())
  delete payload.id

  const existing = await dbSelectOne<any>(db, 'siswa', { id })
  if (!existing) return { error: 'Data siswa tidak ditemukan', success: null }

  // Sanitasi aman:
  // - Field kosong dari form edit tidak menimpa data lama.
  // - FK "none" hanya mengosongkan kelas jika data lama memang kosong atau user membuka detail lengkap
  //   dengan default yang benar. Ini mencegah kasus daftar siswa mengirim "none" palsu.
  Object.keys(payload).forEach(key => {
    const val = payload[key]
    if (FK_FIELDS.includes(key)) {
      if (!val || val === 'none' || val === 'null' || val === 'undefined') {
        if (existing[key]) {
          delete payload[key]
        } else {
          payload[key] = null
        }
      }
    } else {
      if (val === '' || val === 'undefined' || val === 'null') {
        delete payload[key]
      }
    }
  })

  // Konversi field numerik
  if (payload.anak_ke !== null) payload.anak_ke = payload.anak_ke ? parseInt(payload.anak_ke) : null
  if (payload.jumlah_saudara !== null) payload.jumlah_saudara = payload.jumlah_saudara ? parseInt(payload.jumlah_saudara) : null
  if (payload.tahun_masuk !== null) payload.tahun_masuk = payload.tahun_masuk ? parseInt(payload.tahun_masuk) : null

  payload.updated_at = new Date().toISOString()

  const result = await dbUpdate(db, 'siswa', payload, { id })
  if (result.error) {
    return {
      error: result.error.includes('FOREIGN KEY')
        ? 'Gagal: Kelas yang dipilih tidak valid. Coba pilih ulang atau pilih "Tanpa Kelas".'
        : result.error.includes('UNIQUE')
        ? 'NISN sudah terdaftar pada siswa lain.'
        : result.error,
      success: null,
    }
  }

  revalidatePath('/dashboard/siswa')
  revalidatePath(`/dashboard/siswa/${id}`)
  return { error: null, success: 'Biodata lengkap berhasil diperbarui!' }
}

// bulkSetTahunMasuk — update tahun_masuk massal berdasarkan filter kelas
// Dipakai oleh Admin TU untuk memperbaiki data angkatan yang di-backfill salah
export async function bulkSetTahunMasuk(kelasId: string, tahunMasuk: number) {
  if (!(await verifyAdminAccess())) return { error: 'Akses Ditolak: Hanya Super Admin / Admin TU.', success: null }
  if (!tahunMasuk || tahunMasuk < 2000 || tahunMasuk > 2099) return { error: 'Tahun masuk tidak valid', success: null }
  const db = await getDB()
  let result
  if (kelasId === 'semua') {
    result = await db.prepare(
      "UPDATE siswa SET tahun_masuk = ?, updated_at = datetime('now')"
    ).bind(tahunMasuk).run()
  } else {
    result = await db.prepare(
      "UPDATE siswa SET tahun_masuk = ?, updated_at = datetime('now') WHERE kelas_id = ?"
    ).bind(tahunMasuk, kelasId).run()
  }
  revalidatePath('/dashboard/siswa')
  return { error: null, success: `${result.meta.changes} data siswa berhasil diperbarui angkatannya` }
}

// getDetailSiswaLengkap — dipakai oleh siswa-client.tsx (lazy load detail)
export async function getDetailSiswaLengkap(id: string) {
  if (!(await verifyAdminAccess())) return { error: 'Akses Ditolak: Hanya Super Admin / Admin TU.', data: null }
  const db = await getDB()
  const data = await dbSelectOne<any>(db, 'siswa', { id })
  if (!data) return { error: 'Data tidak ditemukan', data: null }
  return { error: null, data }
}
