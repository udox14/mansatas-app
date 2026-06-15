// Lokasi: app/dashboard/pmb/actions.ts
'use server'

import { getDB, dbInsert, dbUpdate, dbDelete } from '@/utils/db'
import { getCurrentUser } from '@/utils/auth/server'
import { getUserRoles } from '@/lib/features'
import { revalidatePath } from 'next/cache'

const PMB_ROLES = ['super_admin', 'admin_tu', 'kepsek', 'wakamad']

async function verifyPmbAccess(): Promise<boolean> {
  const user = await getCurrentUser()
  if (!user) return false
  const db = await getDB()
  const roles = await getUserRoles(db, user.id)
  return roles.some((r) => PMB_ROLES.includes(r))
}

// ── Verifikasi berkas ──────────────────────────────────────
export async function verifikasiBerkas(ids: string[], diterima: boolean | null, alasan?: string) {
  if (!(await verifyPmbAccess())) return { error: 'Akses ditolak' }
  const db = await getDB()
  const now = new Date().toISOString()
  for (const id of ids) {
    await dbUpdate(db, 'pmb_pendaftar', {
      status_verifikasi: diterima === null ? null : (diterima ? 1 : 0),
      berkas_ditolak: diterima === false ? (alasan || 'Berkas tidak valid') : null,
      updated_at: now,
    }, { id })
  }
  revalidatePath('/dashboard/pmb')
  return { success: `${ids.length} pendaftar diperbarui` }
}

// ── Kelulusan ──────────────────────────────────────────────
export async function setKelulusan(ids: string[], status: 'DITERIMA' | 'TIDAK DITERIMA' | 'PENDING') {
  if (!(await verifyPmbAccess())) return { error: 'Akses ditolak' }
  const db = await getDB()
  const now = new Date().toISOString()
  for (const id of ids) {
    await dbUpdate(db, 'pmb_pendaftar', { status_kelulusan: status, updated_at: now }, { id })
  }
  revalidatePath('/dashboard/pmb')
  return { success: `${ids.length} pendaftar diperbarui` }
}

// ── Plotting jadwal tes (per pendaftar) ────────────────────
export async function setJadwalPendaftar(id: string, data: { tanggal_tes: string; sesi_tes: string; ruang_tes: string }) {
  if (!(await verifyPmbAccess())) return { error: 'Akses ditolak' }
  const db = await getDB()
  await dbUpdate(db, 'pmb_pendaftar', { ...data, updated_at: new Date().toISOString() }, { id })
  revalidatePath('/dashboard/pmb')
  return { success: 'Jadwal disimpan' }
}

// Auto-plotting: distribusi pendaftar REGULER terverifikasi ke slot jadwal
export async function autoPlotting() {
  if (!(await verifyPmbAccess())) return { error: 'Akses ditolak' }
  const db = await getDB()
  const { results: slots } = await db.prepare(
    "SELECT * FROM pmb_jadwal_tes ORDER BY tanggal, sesi",
  ).all<any>()
  if (!slots.length) return { error: 'Belum ada slot jadwal tes' }

  const { results: pendaftar } = await db.prepare(
    "SELECT id FROM pmb_pendaftar WHERE status_verifikasi = 1 AND (tanggal_tes IS NULL OR tanggal_tes = '') ORDER BY no_pendaftaran",
  ).all<{ id: string }>()

  let si = 0
  const cap: number[] = slots.map((s: any) => s.kapasitas || 36)
  let assigned = 0
  for (const p of pendaftar) {
    // cari slot dgn sisa kapasitas
    while (si < slots.length && cap[si] <= 0) si++
    if (si >= slots.length) break
    const s = slots[si]
    await dbUpdate(db, 'pmb_pendaftar', {
      tanggal_tes: s.tanggal, sesi_tes: s.sesi, ruang_tes: s.ruang,
      updated_at: new Date().toISOString(),
    }, { id: p.id })
    cap[si]--
    assigned++
  }
  revalidatePath('/dashboard/pmb')
  return { success: `${assigned} pendaftar terjadwal` }
}

// ── CRUD slot jadwal ───────────────────────────────────────
export async function tambahSlotJadwal(data: { tanggal: string; sesi: string; ruang: string; kapasitas: number; jalur?: string }) {
  if (!(await verifyPmbAccess())) return { error: 'Akses ditolak' }
  const db = await getDB()
  await dbInsert(db, 'pmb_jadwal_tes', data)
  revalidatePath('/dashboard/pmb')
  return { success: 'Slot ditambahkan' }
}
export async function hapusSlotJadwal(id: string) {
  if (!(await verifyPmbAccess())) return { error: 'Akses ditolak' }
  const db = await getDB()
  await dbDelete(db, 'pmb_jadwal_tes', { id })
  revalidatePath('/dashboard/pmb')
  return { success: 'Slot dihapus' }
}

// ── Pengaturan PMB ─────────────────────────────────────────
export async function simpanPengaturan(items: Record<string, string>) {
  if (!(await verifyPmbAccess())) return { error: 'Akses ditolak' }
  const db = await getDB()
  for (const [key, value] of Object.entries(items)) {
    await db.prepare(
      'INSERT INTO pmb_pengaturan (key, value, is_active) VALUES (?, ?, 1) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    ).bind(key, value).run()
  }
  revalidatePath('/dashboard/pmb')
  return { success: 'Pengaturan disimpan' }
}

// ── Terima → buat record siswa ─────────────────────────────
const JK_MAP: Record<string, string> = { 'Laki-laki': 'L', 'Perempuan': 'P' }

export async function terimaJadiSiswa(pendaftarId: string) {
  if (!(await verifyPmbAccess())) return { error: 'Akses ditolak' }
  const db = await getDB()
  const p = await db.prepare('SELECT * FROM pmb_pendaftar WHERE id = ?').bind(pendaftarId).first<any>()
  if (!p) return { error: 'Pendaftar tidak ditemukan' }
  if (p.siswa_id) return { error: 'Pendaftar ini sudah menjadi siswa' }
  if (p.status_kelulusan !== 'DITERIMA') return { error: 'Hanya pendaftar berstatus DITERIMA' }

  // Cek NISN belum ada di siswa
  const dup = await db.prepare('SELECT id FROM siswa WHERE nisn = ?').bind(p.nisn).first<{ id: string }>()
  if (dup) {
    await dbUpdate(db, 'pmb_pendaftar', { siswa_id: dup.id }, { id: pendaftarId })
    return { error: 'NISN sudah ada di data siswa. Ditautkan ke siswa tersebut.' }
  }

  const tahunMasuk = parseInt((p.tahun_ajaran || '').split('/')[0]) || new Date().getFullYear()
  const payload = {
    nisn: p.nisn, nama_lengkap: p.nama_lengkap,
    jenis_kelamin: JK_MAP[p.jenis_kelamin] || null,
    status: 'aktif', tahun_masuk: tahunMasuk, foto_url: p.foto_url,
    nik: p.nik, tempat_lahir: p.tempat_lahir, tanggal_lahir: p.tanggal_lahir, agama: p.agama,
    jumlah_saudara: p.jumlah_saudara, anak_ke: p.anak_ke, status_anak: p.status_anak,
    alamat_lengkap: p.alamat_lengkap, rt: p.rt, rw: p.rw, desa_kelurahan: p.desa_kelurahan,
    kecamatan: p.kecamatan, kabupaten_kota: p.kabupaten_kota, provinsi: p.provinsi, kode_pos: p.kode_pos,
    nomor_whatsapp: p.no_telepon_ortu, nomor_kk: p.no_kk,
    nama_ayah: p.nama_ayah, nik_ayah: p.nik_ayah, pendidikan_ayah: p.pendidikan_ayah,
    pekerjaan_ayah: p.pekerjaan_ayah, penghasilan_ayah: p.penghasilan_ayah,
    nama_ibu: p.nama_ibu, nik_ibu: p.nik_ibu, pendidikan_ibu: p.pendidikan_ibu,
    pekerjaan_ibu: p.pekerjaan_ibu, penghasilan_ibu: p.penghasilan_ibu,
  }
  const res = await dbInsert<{ id: string }>(db, 'siswa', payload)
  if (res.error || !res.data) return { error: res.error || 'Gagal membuat siswa' }

  await dbUpdate(db, 'pmb_pendaftar', { siswa_id: res.data.id, daftar_ulang_status: 'SELESAI', updated_at: new Date().toISOString() }, { id: pendaftarId })
  revalidatePath('/dashboard/pmb')
  revalidatePath('/dashboard/siswa')
  return { success: `${p.nama_lengkap} berhasil menjadi siswa` }
}

// Detail lengkap 1 pendaftar + prestasi (utk modal)
export async function getDetailPendaftar(id: string) {
  if (!(await verifyPmbAccess())) return { error: 'Akses ditolak', pendaftar: null, prestasi: [] }
  const db = await getDB()
  const pendaftar = await db.prepare('SELECT * FROM pmb_pendaftar WHERE id = ?').bind(id).first<any>()
  const { results: prestasi } = await db.prepare('SELECT * FROM pmb_prestasi WHERE pendaftar_id = ?').bind(id).all<any>()
  return { pendaftar, prestasi }
}

// Data untuk export Excel (dipanggil dari client)
export async function getExportData() {
  if (!(await verifyPmbAccess())) return { error: 'Akses ditolak', data: [] }
  const db = await getDB()
  const { results } = await db.prepare('SELECT * FROM pmb_pendaftar ORDER BY no_pendaftaran').all<any>()
  return { data: results }
}

// ── Bulk alih reguler (admin) ──────────────────────────────
export async function bulkAlihReguler(ids: string[]) {
  if (!(await verifyPmbAccess())) return { error: 'Akses ditolak' }
  const db = await getDB()
  const now = new Date().toISOString()
  for (const id of ids) {
    await dbUpdate(db, 'pmb_pendaftar', {
      jalur: 'REGULER', status_kelulusan: 'PENDING',
      status_verifikasi: null, ruang_tes: null, tanggal_tes: null, sesi_tes: null,
      updated_at: now,
    }, { id })
  }
  revalidatePath('/dashboard/pmb')
  return { success: `${ids.length} pendaftar dialihkan ke Reguler` }
}

// ── Edit data pendaftar (admin — field terbatas) ───────────
const ADMIN_EDITABLE = new Set([
  'nisn','nik','nama_lengkap','jenis_kelamin','tempat_lahir','tanggal_lahir',
  'ukuran_baju','agama','jumlah_saudara','anak_ke','status_anak',
  'provinsi','kabupaten_kota','kecamatan','desa_kelurahan','rt','rw','alamat_lengkap','kode_pos',
  'no_kk','nama_ayah','nik_ayah','pendidikan_ayah','pekerjaan_ayah','penghasilan_ayah',
  'nama_ibu','nik_ibu','pendidikan_ibu','pekerjaan_ibu','penghasilan_ibu','no_telepon_ortu',
  'asal_sekolah','npsn_sekolah','status_sekolah','alamat_sekolah','pilihan_pesantren',
  'daftar_ulang_status',
])
export async function editPendaftar(id: string, payload: Record<string, any>) {
  if (!(await verifyPmbAccess())) return { error: 'Akses ditolak' }
  const db = await getDB()
  const safe: Record<string, any> = {}
  for (const [k, v] of Object.entries(payload)) { if (ADMIN_EDITABLE.has(k)) safe[k] = v }
  if (!Object.keys(safe).length) return { error: 'Tidak ada field valid' }
  await dbUpdate(db, 'pmb_pendaftar', { ...safe, updated_at: new Date().toISOString() }, { id })
  revalidatePath('/dashboard/pmb')
  return { success: 'Data pendaftar diperbarui' }
}

// ── Simpan manual plotting (bulk) ─────────────────────────
export async function saveManualPlotting(
  changes: { id: string; tanggal_tes: string; sesi_tes: string; ruang_tes: string }[],
) {
  if (!(await verifyPmbAccess())) return { error: 'Akses ditolak' }
  const db = await getDB()
  const now = new Date().toISOString()
  for (const c of changes) {
    await dbUpdate(db, 'pmb_pendaftar', {
      tanggal_tes: c.tanggal_tes || null,
      sesi_tes: c.sesi_tes || null,
      ruang_tes: c.ruang_tes || null,
      updated_at: now,
    }, { id: c.id })
  }
  revalidatePath('/dashboard/pmb')
  return { success: `${changes.length} plotting disimpan` }
}

// ── Import kelulusan bulk (dari Excel) ────────────────────
export async function importKelulusan(
  rows: { no_pendaftaran: string; status_kelulusan: string }[],
) {
  if (!(await verifyPmbAccess())) return { error: 'Akses ditolak' }
  const db = await getDB()
  const valid = ['DITERIMA', 'TIDAK DITERIMA', 'PENDING']
  const now = new Date().toISOString()
  let updated = 0
  for (const row of rows) {
    if (!valid.includes(row.status_kelulusan)) continue
    const p = await db.prepare('SELECT id FROM pmb_pendaftar WHERE no_pendaftaran = ?').bind(row.no_pendaftaran).first<{ id: string }>()
    if (!p) continue
    await dbUpdate(db, 'pmb_pendaftar', { status_kelulusan: row.status_kelulusan, updated_at: now }, { id: p.id })
    updated++
  }
  revalidatePath('/dashboard/pmb')
  return { success: `${updated} kelulusan diperbarui` }
}
