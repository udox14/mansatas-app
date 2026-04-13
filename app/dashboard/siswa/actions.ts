// Lokasi: app/dashboard/siswa/actions.ts
'use server'

import { getDB, dbInsert, dbUpdate, dbDelete, dbSelectOne, dbBatchInsert, serializeValue } from '@/utils/db'
import { uploadFotoSiswa, deleteFromR2, validateImageFile } from '@/utils/r2'
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
  const payload = {
    nisn: formData.get('nisn') as string,
    nis_lokal: (formData.get('nis_lokal') as string) || null,
    nama_lengkap: formData.get('nama_lengkap') as string,
    jenis_kelamin: formData.get('jenis_kelamin') as string,
    tempat_tinggal: formData.get('tempat_tinggal') as string,
  }

  if (!payload.nisn || !payload.nama_lengkap) {
    return { error: 'NISN dan Nama wajib diisi', success: null }
  }

  const result = await dbInsert(db, 'siswa', payload)
  if (result.error) {
    return {
      error: result.error.includes('UNIQUE') ? 'NISN sudah terdaftar' : result.error,
      success: null,
    }
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

  // Hapus foto R2 jika ada sebelum hapus record
  const siswa = await db
    .prepare('SELECT foto_url FROM siswa WHERE id = ?')
    .bind(id)
    .first<{ foto_url: string | null }>()

  if (siswa?.foto_url) {
    await deleteFromR2(siswa.foto_url)
  }

  const result = await dbDelete(db, 'siswa', { id })
  if (result.error) return { error: result.error }

  revalidatePath('/dashboard/siswa')
  return { success: 'Data siswa berhasil dihapus permanen.' }
}

// ============================================================
// 3. EDIT SISWA (Basic)
// ============================================================
export async function editSiswa(id: string, payload: any) {
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

// ============================================================
// 6. UPLOAD FOTO SISWA KE R2
// Nama file tetap per siswa (overwrite otomatis), tidak perlu hapus lama
// ============================================================
export async function uploadFotoSiswaAction(siswaId: string, formData: FormData) {
  const file = formData.get('foto') as File
  if (!file || file.size === 0) return { error: 'Tidak ada file.' }

  // Validasi sebelum upload
  const validationError = validateImageFile(file)
  if (validationError) return { error: validationError }

  const { url, error: uploadError } = await uploadFotoSiswa(siswaId, file)
  if (uploadError || !url) return { error: uploadError || 'Upload gagal' }

  const db = await getDB()
  const result = await dbUpdate(
    db,
    'siswa',
    { foto_url: url, updated_at: new Date().toISOString() },
    { id: siswaId }
  )
  if (result.error) return { error: result.error }

  revalidatePath('/dashboard/siswa')
  revalidatePath(`/dashboard/siswa/${siswaId}`)
  return { success: 'Foto berhasil diperbarui!', url }
}

// ============================================================
// 7. IMPORT MASSAL SISWA
// Mendukung format export PPDB langsung (header nama panjang dengan spasi)
// maupun format lama (CAPS_WITH_UNDERSCORES) untuk backward compatibility
//
// FIX: Payload kini dipisah ke tabel siswa + siswa_ppdb.
//      Sebelumnya semua kolom PPDB dikirim ke tabel siswa → SQLite error
//      "no such column" → dbBatchInsert catch → successCount: 0 (silent fail).
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
  // Helper: ambil nilai float
  const f = (row: any, ...keys: string[]): number | null => {
    for (const k of keys) {
      const v = row[k]
      if (v !== undefined && v !== null && String(v).trim() !== '') {
        const num = parseFloat(String(v).replace(',', '.'))
        return isNaN(num) ? null : num
      }
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

  // -------------------------------------------------------
  // WHITELIST kolom tabel siswa (49 kolom inti, NO PPDB cols)
  // -------------------------------------------------------
  const SISWA_COLS = new Set([
    'id', 'nisn', 'nis_lokal', 'nama_lengkap', 'jenis_kelamin', 'tempat_tinggal',
    'kelas_id', 'wali_murid_id', 'status', 'foto_url', 'minat_jurusan',
    'nik', 'tempat_lahir', 'tanggal_lahir', 'agama',
    'jumlah_saudara', 'anak_ke', 'status_anak',
    'alamat_lengkap', 'rt', 'rw', 'desa_kelurahan', 'kecamatan', 'kabupaten_kota',
    'provinsi', 'kode_pos', 'nomor_whatsapp', 'nomor_kk',
    'nama_ayah', 'nik_ayah', 'tempat_lahir_ayah', 'tanggal_lahir_ayah', 'status_ayah',
    'pendidikan_ayah', 'pekerjaan_ayah', 'penghasilan_ayah',
    'nama_ibu', 'nik_ibu', 'tempat_lahir_ibu', 'tanggal_lahir_ibu', 'status_ibu',
    'pendidikan_ibu', 'pekerjaan_ibu', 'penghasilan_ibu',
    'updated_at',
  ])

  // -------------------------------------------------------
  // WHITELIST kolom tabel siswa_ppdb
  // -------------------------------------------------------
  const PPDB_COLS = new Set([
    'no_pendaftaran', 'tanggal_daftar', 'tahun_daftar',
    'no_akta_lahir', 'kewarganegaraan', 'berkebutuhan_khusus', 'hobi', 'email_siswa',
    'no_telepon_rumah', 'tinggi_badan', 'berat_badan', 'lingkar_kepala',
    'dusun', 'tempat_tinggal_ppdb', 'moda_transportasi',
    'no_kks', 'penerima_kps_pkh', 'no_kps_pkh', 'penerima_kip', 'no_kip',
    'nama_di_kip', 'terima_fisik_kip',
    'berkebutuhan_khusus_ayah', 'no_hp_ayah', 'berkebutuhan_khusus_ibu', 'no_hp_ibu',
    'nama_wali', 'nik_wali', 'tempat_lahir_wali', 'tanggal_lahir_wali',
    'pendidikan_wali', 'pekerjaan_wali', 'penghasilan_wali', 'no_hp_wali',
    'asal_sekolah', 'akreditasi_sekolah', 'no_un', 'no_seri_ijazah', 'no_seri_skhu', 'tahun_lulus',
    'sekolah_pilihan_2', 'jurusan_pilihan_1', 'jurusan_pilihan_2',
    'latitude', 'longitude', 'radius', 'rentang_jarak', 'waktu_tempuh',
    'jalur_masuk', 'nilai_rapor', 'nilai_us', 'nilai_un', 'nilai_rerata_rapor',
    'jumlah_nilai', 'nilai_jarak', 'nilai_prestasi', 'nilai_tes', 'nilai_wawancara', 'nilai_akhir',
    'status_hasil', 'status_daftar_ulang', 'catatan', 'keterangan',
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

  const existingByNama = new Map<string, { id: string; nisn: string }>()
  const existingByNisn = new Map<string, { id: string; nama_lengkap: string }>()
  existingDb.results.forEach((s2: any) => {
    existingByNama.set(s2.nama_lengkap.toLowerCase().trim(), { id: s2.id, nisn: s2.nisn })
    if (s2.nisn) existingByNisn.set(s2.nisn.trim(), { id: s2.id, nama_lengkap: s2.nama_lengkap })
  })

  const toInsert: Array<{ siswaData: any; ppdbData: any }> = []
  const toUpdate: Array<{ id: string; siswaData: any; ppdbData: any }> = []
  const errors: string[] = []

  const VALID_TEMPAT_TINGGAL = [
    'Non-Pesantren', 'Pesantren', 'Pesantren Sukahideng',
    'Pesantren Sukamanah', 'Pesantren Sukaguru', "Pesantren Al-Ma'mur",
  ]

  for (const row of dataSiswa) {
    // --- Identitas wajib ---
    const nisn = s(row, 'NISN', 'nisn') ?? ''
    const nama_lengkap = s(row, 'Nama Peserta', 'NAMA_LENGKAP', 'nama_lengkap') ?? ''

    if (!nama_lengkap) { errors.push(`Baris tanpa nama dilewati`); continue }

    // --- Kelas (kolom khusus aplikasi) ---
    const tingkat = n(row, 'Tingkat Kelas', 'TINGKAT', 'tingkat')
    const kelompok = s(row, 'Kelompok Kelas', 'KELOMPOK', 'kelompok')?.toUpperCase() ?? 'UMUM'
    const nomor_kelas = s(row, 'Nomor Kelas', 'NOMOR_KELAS', 'nomor_kelas')
    const kelasKey = tingkat && nomor_kelas ? `${tingkat}-${kelompok}-${nomor_kelas}` : null
    const kelas_id = kelasKey ? (kelasMap.get(kelasKey) ?? null) : null

    // --- Tempat tinggal (enum aplikasi) ---
    const pesantrenRaw = s(row, 'Pesantren', 'PESANTREN', 'TEMPAT_TINGGAL') ?? ''
    const tempat_tinggal = VALID_TEMPAT_TINGGAL.includes(pesantrenRaw) ? pesantrenRaw : 'Non-Pesantren'

    // --- JK ---
    const jkRaw = s(row, 'JK', 'JENIS_KELAMIN', 'jenis_kelamin') ?? ''
    const jenis_kelamin = jkRaw.toUpperCase() === 'P' ? 'P' : 'L'

    // --- Build full payload (semua kolom dari Excel) ---
    const fullPayload: any = {
      // Core
      nisn: nisn || null,
      nama_lengkap,
      jenis_kelamin,
      tempat_tinggal,
      kelas_id,
      status: 'aktif',

      // Identitas & Pendaftaran
      no_pendaftaran:   s(row, 'No Pendaftaran'),
      tanggal_daftar:   s(row, 'Tanggal Daftar'),
      tahun_daftar:     s(row, 'Tahun'),

      // Data diri
      tempat_lahir:     s(row, 'Tempat Lahir', 'TEMPAT_LAHIR'),
      tanggal_lahir:    s(row, 'Tanggal Lahir', 'TANGGAL_LAHIR'),
      agama:            s(row, 'Agama', 'AGAMA'),
      nik:              s(row, 'NIK', 'nik'),
      nomor_kk:         s(row, 'No KK', 'No. KK', 'NOMOR_KK'),
      no_akta_lahir:    s(row, 'No Registrasi Akta Lahir'),
      kewarganegaraan:  s(row, 'Kewarganegaraan'),
      berkebutuhan_khusus: s(row, 'Berkebutuhan Khusus'),
      hobi:             s(row, 'Hobi'),
      email_siswa:      s(row, 'Email'),
      nomor_whatsapp:   s(row, 'Nomor HP', 'NOMOR_WHATSAPP', 'nomor_whatsapp'),
      no_telepon_rumah: s(row, 'No Telepon Rumah'),
      tinggi_badan:     f(row, 'Tinggi Badan'),
      berat_badan:      f(row, 'Berat Badan'),
      lingkar_kepala:   f(row, 'Lingkar Kepala'),
      anak_ke:          n(row, 'Anak Ke', 'ANAK_KE'),
      jumlah_saudara:   n(row, 'Jumlah Saudara Kandung', 'JUMLAH_SAUDARA'),

      // Alamat
      alamat_lengkap:   s(row, 'Alamat', 'ALAMAT_LENGKAP'),
      rt:               s(row, 'RT'),
      rw:               s(row, 'RW'),
      dusun:            s(row, 'Dusun'),
      desa_kelurahan:   s(row, 'Kelurahan', 'DESA_KELURAHAN'),
      kecamatan:        s(row, 'Kecamatan', 'KECAMATAN'),
      kabupaten_kota:   s(row, 'Kabupaten/Kota', 'KABUPATEN_KOTA'),
      provinsi:         s(row, 'Provinsi', 'PROVINSI'),
      kode_pos:         s(row, 'Kode Pos', 'KODE_POS'),
      tempat_tinggal_ppdb: s(row, 'Tempat Tinggal'),
      moda_transportasi: s(row, 'Moda Transportasi'),

      // Bantuan sosial
      no_kks:           s(row, 'No KKS'),
      penerima_kps_pkh: s(row, 'Penerima KPS/PKH'),
      no_kps_pkh:       s(row, 'No KPS/PKH'),
      penerima_kip:     s(row, 'Penerima KIP'),
      no_kip:           s(row, 'No KIP'),
      nama_di_kip:      s(row, 'Nama Tertera Di KIP'),
      terima_fisik_kip: s(row, 'Terima Fisik Kartu KIP'),

      // Ayah
      nama_ayah:        s(row, 'Nama Ayah', 'NAMA_AYAH'),
      nik_ayah:         s(row, 'NIK Ayah'),
      tempat_lahir_ayah: s(row, 'Tempat Lahir Ayah'),
      tanggal_lahir_ayah: s(row, 'Tanggal Lahir Ayah'),
      pendidikan_ayah:  s(row, 'Pendidikan Ayah', 'PENDIDIKAN_AYAH'),
      pekerjaan_ayah:   s(row, 'Pekerjaan Ayah', 'PEKERJAAN_AYAH'),
      penghasilan_ayah: s(row, 'Penghasilan Bulanan Ayah', 'PENGHASILAN_AYAH'),
      berkebutuhan_khusus_ayah: s(row, 'Berkebutuhan Khusus Ayah'),
      no_hp_ayah:       s(row, 'No Hp Ayah'),

      // Ibu
      nama_ibu:         s(row, 'Nama Ibu', 'NAMA_IBU'),
      nik_ibu:          s(row, 'NIK Ibu'),
      tempat_lahir_ibu: s(row, 'Tempat Lahir Ibu'),
      tanggal_lahir_ibu: s(row, 'Tanggal Lahir Ibu'),
      pendidikan_ibu:   s(row, 'Pendidikan Ibu', 'PENDIDIKAN_IBU'),
      pekerjaan_ibu:    s(row, 'Pekerjaan Ibu', 'PEKERJAAN_IBU'),
      penghasilan_ibu:  s(row, 'Penghasilan Bulanan Ibu', 'PENGHASILAN_IBU'),
      berkebutuhan_khusus_ibu: s(row, 'Berkebutuhan Khusus Ibu'),
      no_hp_ibu:        s(row, 'No Hp Ibu'),

      // Wali
      nama_wali:        s(row, 'Nama Wali'),
      nik_wali:         s(row, 'NIK Wali'),
      tempat_lahir_wali: s(row, 'Tempat Lahir Wali'),
      tanggal_lahir_wali: s(row, 'Tanggal Lahir Wali'),
      pendidikan_wali:  s(row, 'Pendidikan Wali'),
      pekerjaan_wali:   s(row, 'Pekerjaan Wali'),
      penghasilan_wali: s(row, 'Penghasilan Bulanan Wali'),
      no_hp_wali:       s(row, 'No Hp Wali'),

      // Sekolah asal
      asal_sekolah:     s(row, 'Asal Sekolah'),
      akreditasi_sekolah: s(row, 'Akreditasi'),
      no_un:            s(row, 'No UN'),
      no_seri_ijazah:   s(row, 'No Seri Ijazah'),
      no_seri_skhu:     s(row, 'No Seri SKHU'),
      tahun_lulus:      s(row, 'Tahun Lulus'),

      // Pilihan
      sekolah_pilihan_2: s(row, 'Sekolah Pilihan 2'),
      jurusan_pilihan_1: s(row, 'Jurusan Pilihan 1'),
      jurusan_pilihan_2: s(row, 'Jurusan Pilihan 2'),
      minat_jurusan:    s(row, 'Jurusan Pilihan 1', 'MINAT_JURUSAN'),  // sync kolom lama di siswa

      // Geolokasi
      latitude:         s(row, 'Latitude'),
      longitude:        s(row, 'Longitude'),
      radius:           s(row, 'Radius'),
      rentang_jarak:    s(row, 'Rentang Jarak'),
      waktu_tempuh:     s(row, 'Waktu Tempuh'),

      // Penerimaan & Nilai
      jalur_masuk:      s(row, 'Jalur'),
      nilai_rapor:      f(row, 'Nilai Rapor'),
      nilai_us:         f(row, 'Nilai US'),
      nilai_un:         f(row, 'Nilai UN'),
      nilai_rerata_rapor: f(row, 'Nilai Rerata rapor semester'),
      jumlah_nilai:     f(row, 'Jumlah Nilai'),
      nilai_jarak:      f(row, 'Nilai Jarak'),
      nilai_prestasi:   f(row, 'Nilai Prestasi'),
      nilai_tes:        f(row, 'Nilai Tes'),
      nilai_wawancara:  f(row, 'Nilai Wawancara'),
      nilai_akhir:      f(row, 'Nilai Akhir'),

      // Status PPDB
      status_hasil:         s(row, 'Status Hasil'),
      status_daftar_ulang:  s(row, 'Status Daftar Ulang'),
      catatan:              s(row, 'Catatan'),
      keterangan:           s(row, 'Keterangan'),
    }

    // Hapus semua key null agar tidak overwrite data existing yang sudah terisi
    Object.keys(fullPayload).forEach(k => {
      if (fullPayload[k] === null) delete fullPayload[k]
    })

    // -----------------------------------------------------------
    // FIX: Pisahkan payload ke dua tabel: siswa vs siswa_ppdb
    // Sebelumnya seluruh payload (termasuk kolom PPDB) dikirim ke
    // tabel siswa → SQLite error → silent fail → 0 inserted.
    // -----------------------------------------------------------
    const siswaPayload: any = {}
    const ppdbPayload: any = {}

    for (const [k, v] of Object.entries(fullPayload)) {
      if (SISWA_COLS.has(k)) siswaPayload[k] = v
      else if (PPDB_COLS.has(k)) ppdbPayload[k] = v
      // field lain (asrama, kamar, dll.) yang belum ada di schema: diabaikan
    }

    // Pastikan field wajib siswa selalu ada (termasuk setelah filter null di atas)
    siswaPayload.nama_lengkap  = nama_lengkap
    siswaPayload.jenis_kelamin = jenis_kelamin
    siswaPayload.tempat_tinggal = tempat_tinggal
    siswaPayload.kelas_id      = kelas_id
    siswaPayload.status        = 'aktif'

    const existBySisn = nisn ? existingByNisn.get(nisn) : null
    const existByNama = existingByNama.get(nama_lengkap.toLowerCase())
    const existing = existBySisn || existByNama

    if (existing) {
      // UPDATE: siswa sudah ada — update saja, NISN tidak perlu diset ulang jika kosong
      if (nisn) siswaPayload.nisn = nisn
      toUpdate.push({ id: existing.id, siswaData: siswaPayload, ppdbData: ppdbPayload })
    } else {
      // INSERT: siswa baru — NISN wajib (NOT NULL UNIQUE constraint di DB)
      if (!nisn) {
        errors.push(`Dilewati (NISN kosong): ${nama_lengkap}`)
        continue
      }
      siswaPayload.nisn = nisn
      // Pre-generate ID agar bisa dipakai sebagai FK di siswa_ppdb
      const newId = crypto.randomUUID().replace(/-/g, '')
      siswaPayload.id = newId
      toInsert.push({ siswaData: siswaPayload, ppdbData: ppdbPayload })
    }
  }

  let insertCount = 0
  let updateCount = 0
  const ppdbUpserts: any[] = []

  // ---- INSERT siswa baru ----
  if (toInsert.length > 0) {
    const siswaRows = toInsert.map(r => r.siswaData)
    const { successCount, error: batchError } = await dbBatchInsert(db, 'siswa', siswaRows)
    insertCount = successCount
    // FIX: Propagate error dari dbBatchInsert — sebelumnya error ini diabaikan
    if (batchError) errors.push(`DB insert error: ${batchError}`)

    // Kumpulkan ppdb rows untuk semua siswa baru (gunakan ID yang sudah di-generate)
    toInsert.forEach(r => {
      if (Object.keys(r.ppdbData).length > 0) {
        ppdbUpserts.push({ siswa_id: r.siswaData.id, ...r.ppdbData })
      }
    })
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

    toUpdate.forEach(r => {
      if (Object.keys(r.ppdbData).length > 0) {
        ppdbUpserts.push({ siswa_id: r.id, ...r.ppdbData })
      }
    })
  }

  // ---- UPSERT siswa_ppdb (data PPDB lengkap) ----
  if (ppdbUpserts.length > 0) {
    try {
      // Kumpulkan semua keys unik dari seluruh baris ppdb
      const allPpdbKeys = [...new Set(ppdbUpserts.flatMap(r => Object.keys(r)))]
      const placeholders = allPpdbKeys.map(() => '?').join(', ')
      const updateSets = allPpdbKeys
        .filter(k => k !== 'siswa_id')
        .map(k => `${k} = excluded.${k}`)
        .join(', ')

      const sql = `INSERT INTO siswa_ppdb (${allPpdbKeys.join(', ')}) VALUES (${placeholders})
                   ON CONFLICT(siswa_id) DO UPDATE SET ${updateSets}, updated_at = datetime('now')`

      const stmts = ppdbUpserts.map(row => {
        const vals = allPpdbKeys.map(k => serializeValue(row[k] ?? null))
        return db.prepare(sql).bind(...vals)
      })

      const chunkSize = 100
      for (let i = 0; i < stmts.length; i += chunkSize) {
        await db.batch(stmts.slice(i, i + chunkSize))
      }
    } catch (e: any) {
      // Tabel siswa_ppdb mungkin belum ada (migration belum dijalankan)
      // Insert siswa tetap dihitung sukses, ppdb detail di-skip
      errors.push(`Data PPDB detail tidak tersimpan: ${e.message}`)
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

  // Sanitasi menyeluruh:
  // 1. Field FK (kelas_id, wali_murid_id): string kosong / "none" → null
  // 2. Semua field lain: string kosong / "undefined" / "null" → null
  // Ini mencegah FOREIGN KEY constraint failed karena string kosong dikirim sebagai value
  Object.keys(payload).forEach(key => {
    const val = payload[key]
    if (FK_FIELDS.includes(key)) {
      // FK field: hanya boleh null atau UUID valid — "none", "", dll → null
      if (!val || val === 'none' || val === 'null' || val === 'undefined') {
        payload[key] = null
      }
    } else {
      // Non-FK field: kosong → null agar tidak simpan string kosong
      if (val === '' || val === 'undefined' || val === 'null') {
        payload[key] = null
      }
    }
  })

  // Konversi field numerik
  if (payload.anak_ke !== null) payload.anak_ke = payload.anak_ke ? parseInt(payload.anak_ke) : null
  if (payload.jumlah_saudara !== null) payload.jumlah_saudara = payload.jumlah_saudara ? parseInt(payload.jumlah_saudara) : null

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

// getDetailSiswaLengkap — dipakai oleh siswa-client.tsx (lazy load detail)
export async function getDetailSiswaLengkap(id: string) {
  const db = await getDB()
  const data = await dbSelectOne<any>(db, 'siswa', { id })
  if (!data) return { error: 'Data tidak ditemukan', data: null }
  return { error: null, data }
}