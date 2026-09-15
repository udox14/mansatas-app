// Lokasi: app/dashboard/pmb/actions.ts
'use server'

import { dbInsert, dbUpdate, dbDelete } from '@/utils/db'
import { getDB } from '@/utils/db-server'
import type { CrudAction } from '@/lib/features'
import { requireActionAccess } from '@/lib/action-security'
import { revalidatePath } from 'next/cache'
import { createActivityDiff, logActivity } from '@/lib/activity-log'
import { buildStudentFromPmb, isConvertiblePmb, pmbSlotSchema, samePmbIdentity } from '@/lib/pmb-contract'

async function verifyPmbAccess(action: CrudAction = 'update'): Promise<boolean> {
  try { await requireActionAccess('pmb', action); return true } catch { return false }
}

function dbFailure(result: { success: boolean; error: string | null }, fallback: string): string | null {
  return result.success ? null : (result.error || fallback)
}

// ── Verifikasi berkas ──────────────────────────────────────
export async function verifikasiBerkas(ids: string[], diterima: boolean | null, alasan?: string) {
  if (!(await verifyPmbAccess())) return { error: 'Akses ditolak' }
  const db = await getDB()
  const now = new Date().toISOString()
  for (const id of ids) {
    const update: Record<string, any> = {
      status_verifikasi: diterima === null ? null : (diterima ? 1 : 0),
      updated_at: now,
    }
    if (diterima === false) {
      const reason = String(alasan || '').trim()
      if (reason.length < 5) return { error: 'Alasan penolakan minimal 5 karakter.' }
      update.berkas_ditolak = JSON.stringify({ reason, files: [] })
    } else update.berkas_ditolak = null
    const result = await dbUpdate(db, 'pmb_pendaftar', update, { id })
    const failure = dbFailure(result, 'Gagal memperbarui verifikasi')
    if (failure) return { error: failure }
  }
  await logActivity({ db, module: 'pmb', action: 'verifikasi_berkas', summary: `${ids.length} pendaftar diperbarui`, metadata: { diterima, alasan } })
  revalidatePath('/dashboard/pmb')
  return { success: `${ids.length} pendaftar diperbarui` }
}

// ── Flag berkas bermasalah (JSON array of field keys) ─────
export async function setFlagBerkas(id: string, keys: string[]) {
  if (!(await verifyPmbAccess())) return { error: 'Akses ditolak' }
  const db = await getDB()
  const existing = await db.prepare('SELECT berkas_ditolak FROM pmb_pendaftar WHERE id=?').bind(id).first<{ berkas_ditolak: string | null }>()
  let reason = ''
  try { reason = JSON.parse(existing?.berkas_ditolak || '{}')?.reason || '' } catch { reason = existing?.berkas_ditolak || '' }
  const result = await dbUpdate(db, 'pmb_pendaftar', {
    berkas_ditolak: keys.length > 0 || reason ? JSON.stringify({ reason, files: keys }) : null,
    updated_at: new Date().toISOString(),
  }, { id })
  const failure = dbFailure(result, 'Gagal menyimpan flag berkas')
  if (failure) return { error: failure }
  await logActivity({ db, module: 'pmb', action: 'flag_berkas', summary: 'Memperbarui flag berkas pendaftar', entityType: 'pmb_pendaftar', entityId: id, metadata: { keys } })
  revalidatePath('/dashboard/pmb')
  return { success: 'Flag berkas disimpan' }
}

// ── Kelulusan ──────────────────────────────────────────────
export async function setKelulusan(ids: string[], status: 'DITERIMA' | 'TIDAK DITERIMA' | 'PENDING') {
  if (!(await verifyPmbAccess())) return { error: 'Akses ditolak' }
  if (!ids.length) return { error: 'Tidak ada pendaftar dipilih.' }
  const db = await getDB()
  const beforeRows = await db.prepare(`SELECT id, no_pendaftaran, nama_lengkap, status_kelulusan FROM pmb_pendaftar WHERE id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all<any>()
  const now = new Date().toISOString()
  for (const id of ids) {
    const result = await dbUpdate(db, 'pmb_pendaftar', { status_kelulusan: status, updated_at: now }, { id })
    const failure = dbFailure(result, 'Gagal memperbarui kelulusan')
    if (failure) return { error: failure }
  }
  await logActivity({
    db,
    module: 'pmb',
    action: 'set_kelulusan',
    severity: 'warning',
    summary: `Mengubah status kelulusan ${ids.length} pendaftar menjadi ${status}`,
    metadata: { status },
    targets: (beforeRows.results ?? []).map(row => ({
      type: 'pmb_pendaftar',
      id: row.id,
      label: row.nama_lengkap || row.no_pendaftaran,
      metadata: { before: row, after: { ...row, status_kelulusan: status } },
    })),
  })
  revalidatePath('/dashboard/pmb')
  return { success: `${ids.length} pendaftar diperbarui` }
}

// ── Plotting jadwal tes (per pendaftar) ────────────────────
export async function setJadwalPendaftar(id: string, data: { tanggal_tes: string; sesi_tes: string; ruang_tes: string }) {
  if (!(await verifyPmbAccess())) return { error: 'Akses ditolak' }
  const db = await getDB()
  const slot = await db.prepare(`SELECT s.*, (SELECT COUNT(*) FROM pmb_pendaftar p WHERE p.tanggal_tes=s.tanggal AND p.sesi_tes=s.sesi AND p.ruang_tes=s.ruang) AS occupied FROM pmb_jadwal_tes s WHERE tanggal=? AND sesi=? AND ruang=? LIMIT 1`)
    .bind(data.tanggal_tes, data.sesi_tes, data.ruang_tes).first<any>()
  if (!slot) return { error: 'Kombinasi jadwal tidak terdaftar sebagai slot.' }
  if (Number(slot.occupied) >= Number(slot.kapasitas || 36)) return { error: 'Slot jadwal sudah penuh.' }
  const result = await dbUpdate(db, 'pmb_pendaftar', { ...data, updated_at: new Date().toISOString() }, { id })
  const failure = dbFailure(result, 'Gagal menyimpan jadwal')
  if (failure) return { error: failure }
  revalidatePath('/dashboard/pmb')
  return { success: 'Jadwal disimpan' }
}

// Auto-plotting: distribusi pendaftar REGULER terverifikasi ke slot jadwal
export async function autoPlotting(jalur: 'REGULER' | 'PRESTASI' = 'REGULER') {
  if (!(await verifyPmbAccess())) return { error: 'Akses ditolak' }
  const db = await getDB()
  const { results: slots } = await db.prepare(
    `SELECT s.*, (SELECT COUNT(*) FROM pmb_pendaftar p WHERE p.tanggal_tes=s.tanggal AND p.sesi_tes=s.sesi AND p.ruang_tes=s.ruang) AS occupied
     FROM pmb_jadwal_tes s WHERE s.jalur IS NULL OR s.jalur = ? ORDER BY s.tanggal, s.sesi, s.ruang`,
  ).bind(jalur).all<any>()
  if (!slots.length) return { error: 'Belum ada slot jadwal tes' }

  const { results: pendaftar } = await db.prepare(
    "SELECT id FROM pmb_pendaftar WHERE status_verifikasi = 1 AND jalur = ? AND siswa_id IS NULL AND (tanggal_tes IS NULL OR tanggal_tes = '') ORDER BY no_pendaftaran",
  ).bind(jalur).all<{ id: string }>()

  let si = 0
  const cap: number[] = slots.map((s: any) => Math.max(0, Number(s.kapasitas || 36) - Number(s.occupied || 0)))
  let assigned = 0
  const statements: D1PreparedStatement[] = []
  for (const p of pendaftar) {
    // cari slot dgn sisa kapasitas
    while (si < slots.length && cap[si] <= 0) si++
    if (si >= slots.length) break
    const s = slots[si]
    statements.push(db.prepare(`UPDATE pmb_pendaftar SET tanggal_tes=?, sesi_tes=?, ruang_tes=?, updated_at=? WHERE id=? AND siswa_id IS NULL AND (tanggal_tes IS NULL OR tanggal_tes='')`)
      .bind(s.tanggal, s.sesi, s.ruang, new Date().toISOString(), p.id))
    cap[si]--
    assigned++
  }
  if (statements.length) await db.batch(statements)
  await logActivity({
    db,
    module: 'pmb',
    action: 'auto_plotting_jadwal',
    summary: `Auto-plotting jadwal tes untuk ${assigned} pendaftar`,
    metadata: { assigned, jalur },
    targets: pendaftar.slice(0, assigned).map(row => ({ type: 'pmb_pendaftar', id: row.id })),
  })
  revalidatePath('/dashboard/pmb')
  return { success: `${assigned} pendaftar terjadwal` }
}

// ── CRUD slot jadwal ───────────────────────────────────────
export async function tambahSlotJadwal(data: { tanggal: string; sesi: string; ruang: string; kapasitas: number; jalur?: string }) {
  if (!(await verifyPmbAccess('create'))) return { error: 'Akses ditolak' }
  const db = await getDB()
  const parsed = pmbSlotSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Slot tidak valid' }
  const duplicate = await db.prepare('SELECT id FROM pmb_jadwal_tes WHERE tanggal=? AND sesi=? AND ruang=? LIMIT 1').bind(parsed.data.tanggal, parsed.data.sesi, parsed.data.ruang).first()
  if (duplicate) return { error: 'Slot dengan tanggal, sesi, dan ruang tersebut sudah ada.' }
  const result = await dbInsert(db, 'pmb_jadwal_tes', parsed.data)
  const failure = dbFailure(result, 'Gagal menambahkan slot')
  if (failure) return { error: failure }
  await logActivity({ db, module: 'pmb', action: 'create_slot', summary: 'Menambahkan slot tes PMB', metadata: parsed.data })
  revalidatePath('/dashboard/pmb')
  return { success: 'Slot ditambahkan' }
}
export async function hapusSlotJadwal(id: string) {
  if (!(await verifyPmbAccess('delete'))) return { error: 'Akses ditolak' }
  const db = await getDB()
  const slot = await db.prepare(`SELECT s.*, (SELECT COUNT(*) FROM pmb_pendaftar p WHERE p.tanggal_tes=s.tanggal AND p.sesi_tes=s.sesi AND p.ruang_tes=s.ruang) AS occupied FROM pmb_jadwal_tes s WHERE id=?`).bind(id).first<any>()
  if (!slot) return { error: 'Slot tidak ditemukan.' }
  if (Number(slot.occupied) > 0) return { error: `Slot masih dipakai ${slot.occupied} pendaftar dan tidak dapat dihapus.` }
  const result = await dbDelete(db, 'pmb_jadwal_tes', { id })
  const failure = dbFailure(result, 'Gagal menghapus slot')
  if (failure) return { error: failure }
  await logActivity({ db, module: 'pmb', action: 'delete_slot', severity: 'warning', summary: 'Menghapus slot tes PMB', metadata: slot })
  revalidatePath('/dashboard/pmb')
  return { success: 'Slot dihapus' }
}

// ── Pengaturan PMB ─────────────────────────────────────────
export async function simpanPengaturan(items: Record<string, string>) {
  if (!(await verifyPmbAccess())) return { error: 'Akses ditolak' }
  const db = await getDB()
  const allowed = new Set([
    'tahun_pmb','pmb_dibuka','jalur_reguler_dibuka','jalur_prestasi_dibuka','tanggal_buka','tanggal_tutup','tanggal_pengumuman',
    'tanggal_pengumuman_reguler','tanggal_pengumuman_prestasi','kelulusan_aktif','cetak_kartu_aktif','teks_hero','link_grup_wa','kontak_wa',
    'link_berkas_pendukung','landing_popup_aktif','landing_popup_mode','landing_popup_judul','landing_popup_isi','landing_popup_tombol_text',
    'landing_popup_tombol_link','teks_batas_daftar_ulang','teks_daftar_reg','teks_tes_cbt','teks_pengumuman_reg','teks_lapor_reg',
    'teks_daftar_pres','teks_tes_pres','teks_pengumuman_pres','teks_lapor_pres','teks_rapat','jadwal_cetak_waktu','jadwal_cetak_tsk',
    'nama_ketua_pmb','nip_ketua_pmb','tanggal_rapat_komite','nama_kepala_madrasah','nip_kepala_madrasah',
  ])
  const entries = Object.entries(items).filter(([key]) => allowed.has(key)).map(([key, value]) => [key, String(value || '').trim().slice(0, 4000)] as const)
  if (!entries.length) return { error: 'Tidak ada pengaturan valid.' }
  for (const [key, value] of entries) if ((key.endsWith('_aktif') || key.endsWith('_dibuka')) && !['0','1'].includes(value)) return { error: `Nilai ${key} harus 0 atau 1.` }
  await db.batch(entries.map(([key, value]) => db.prepare(
    'INSERT INTO pmb_pengaturan (key, value, is_active) VALUES (?, ?, 1) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  ).bind(key, value)))
  await logActivity({ db, module: 'pmb', action: 'update_settings', summary: `Memperbarui ${entries.length} pengaturan PMB`, metadata: { keys: entries.map(([key]) => key) } })
  revalidatePath('/dashboard/pmb')
  return { success: 'Pengaturan disimpan' }
}

// ── Terima → buat record siswa ─────────────────────────────
async function convertPmbRecord(db: D1Database, p: Record<string, any>): Promise<{ studentId?: string; linkedExisting?: boolean; error?: string }> {
  const eligibilityError = isConvertiblePmb(p)
  if (eligibilityError) return { error: eligibilityError }

  const duplicate = await db.prepare('SELECT id, nisn, nik, nama_lengkap FROM siswa WHERE nisn = ? LIMIT 1').bind(p.nisn).first<any>()
  if (duplicate) {
    if (!samePmbIdentity(p, duplicate)) return { error: 'NISN sudah dipakai siswa lain dengan identitas yang tidak cocok.' }
    await db.prepare(`UPDATE pmb_pendaftar SET siswa_id=?, daftar_ulang_status=NULL, updated_at=? WHERE id=? AND siswa_id IS NULL`)
      .bind(duplicate.id, new Date().toISOString(), p.id).run()
    return { studentId: duplicate.id, linkedExisting: true }
  }

  const studentId = crypto.randomUUID()
  const payload = buildStudentFromPmb(p, studentId)
  const entries = Object.entries(payload).filter(([, value]) => value !== undefined)
  const columns = entries.map(([key]) => `"${key}"`).join(',')
  const placeholders = entries.map(() => '?').join(',')
  const values = entries.map(([, value]) => value ?? null)
  try {
    await db.batch([
      db.prepare(`INSERT INTO siswa (${columns}) VALUES (${placeholders})`).bind(...values),
      db.prepare(`UPDATE pmb_pendaftar SET siswa_id=?, daftar_ulang_status=NULL, updated_at=? WHERE id=? AND siswa_id IS NULL`)
        .bind(studentId, new Date().toISOString(), p.id),
    ])
    return { studentId }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Gagal membuat siswa.' }
  }
}

export async function terimaJadiSiswa(pendaftarId: string) {
  if (!(await verifyPmbAccess())) return { error: 'Akses ditolak' }
  const db = await getDB()
  const p = await db.prepare('SELECT * FROM pmb_pendaftar WHERE id = ?').bind(pendaftarId).first<any>()
  if (!p) return { error: 'Pendaftar tidak ditemukan' }
  const converted = await convertPmbRecord(db, p)
  if (converted.error || !converted.studentId) return { error: converted.error || 'Gagal membuat siswa' }
  await logActivity({
    db,
    module: 'pmb',
    action: 'accept_as_student',
    severity: 'warning',
    summary: `Menerima pendaftar ${p.nama_lengkap} menjadi siswa`,
    entityType: 'pmb_pendaftar',
    entityId: pendaftarId,
    entityLabel: p.nama_lengkap,
    before: p,
    after: { siswa_id: converted.studentId, daftar_ulang_status: null },
    targets: [
      { type: 'pmb_pendaftar', id: pendaftarId, label: p.nama_lengkap },
      { type: 'siswa', id: converted.studentId, label: p.nama_lengkap },
    ],
  })
  revalidatePath('/dashboard/pmb')
  revalidatePath('/dashboard/siswa')
  revalidatePath('/dashboard/keuangan/dspt')
  revalidatePath('/dashboard/keuangan/dspt/nonaktif')
  revalidatePath('/dashboard/keuangan/export')
  revalidatePath('/dashboard/keuangan/laporan')
  revalidatePath('/dashboard')
  return { success: `${p.nama_lengkap} berhasil menjadi siswa dan menunggu diproses Kasir Daftar Ulang` }
}

// ── Bulk terima jadi siswa ─────────────────────────────────
export async function bulkTerimaJadiSiswa(pendaftarIds: string[]) {
  if (!(await verifyPmbAccess())) return { error: 'Akses ditolak' }
  if (!pendaftarIds.length) return { error: 'Tidak ada ID' }
  const db = await getDB()

  const placeholders = pendaftarIds.map(() => '?').join(',')
  const { results: list } = await db.prepare(
    `SELECT * FROM pmb_pendaftar WHERE id IN (${placeholders})`,
  ).bind(...pendaftarIds).all<any>()

  let berhasil = 0; let dilewati = 0; const gagalNames: string[] = []

  for (const p of list) {
    const converted = await convertPmbRecord(db, p)
    if (converted.error) {
      if (p.siswa_id || p.status_kelulusan !== 'DITERIMA' || p.status_verifikasi !== 1 || p.konfirmasi_daftar_ulang !== 'BERSEDIA') dilewati++
      else gagalNames.push(`${p.nama_lengkap}: ${converted.error}`)
      continue
    }
    berhasil++
  }

  revalidatePath('/dashboard/pmb')
  revalidatePath('/dashboard/siswa')
  revalidatePath('/dashboard/keuangan/dspt')
  revalidatePath('/dashboard/keuangan/dspt/nonaktif')
  revalidatePath('/dashboard/keuangan/export')
  revalidatePath('/dashboard/keuangan/laporan')
  revalidatePath('/dashboard')
  await logActivity({
    db,
    module: 'pmb',
    action: 'bulk_accept_as_student',
    severity: 'warning',
    summary: `Menerima ${berhasil} pendaftar menjadi siswa`,
    metadata: { requested: pendaftarIds.length, berhasil, dilewati, gagalNames },
    targets: (list ?? []).map((p: any) => ({ type: 'pmb_pendaftar', id: p.id, label: p.nama_lengkap })),
  })
  const msg = `${berhasil} siswa berhasil dibuat`
  const detail = [
    dilewati > 0 && `${dilewati} dilewati (belum memenuhi syarat / sudah siswa)`,
    gagalNames.length > 0 && `gagal: ${gagalNames.join(', ')}`,
  ].filter(Boolean).join('; ')
  return { success: detail ? `${msg} · ${detail}` : msg }
}

// Detail lengkap 1 pendaftar + prestasi (utk modal)
export async function getDetailPendaftar(id: string) {
  if (!(await verifyPmbAccess('read'))) return { error: 'Akses ditolak', pendaftar: null, prestasi: [] }
  const db = await getDB()
  const pendaftar = await db.prepare(`SELECT p.*,d.id AS dspt_id,d.nominal_target AS dspt_target,d.total_dibayar AS dspt_dibayar,d.total_diskon AS dspt_diskon,d.status AS dspt_status FROM pmb_pendaftar p LEFT JOIN fin_dspt d ON d.siswa_id=p.siswa_id WHERE p.id=?`).bind(id).first<any>()
  const { results: prestasi } = await db.prepare('SELECT * FROM pmb_prestasi WHERE pendaftar_id = ?').bind(id).all<any>()
  return { pendaftar, prestasi }
}

// Data untuk export Excel (dipanggil dari client)
export async function getExportData(filters: { tahun?: string; jalur?: string; gender?: string; verifikasi?: string; kelulusan?: string; konversi?: string; daftarUlang?: string; dspt?: string; hardcopy?: string; jadwal?: string; ids?: string[] } = {}) {
  if (!(await verifyPmbAccess('read'))) return { error: 'Akses ditolak', data: [] }
  const db = await getDB()
  const where: string[] = []
  const binds: unknown[] = []
  if (filters.ids?.length) { if (filters.ids.length > 250) return { error: 'Maksimal 250 data terpilih per export.', data: [] }; where.push(`p.id IN (${filters.ids.map(() => '?').join(',')})`); binds.push(...filters.ids) }
  if (filters.tahun && filters.tahun !== 'all') { where.push('p.tahun_ajaran=?'); binds.push(filters.tahun) }
  if (filters.jalur && filters.jalur !== 'all') { where.push('p.jalur=?'); binds.push(filters.jalur) }
  if (filters.gender && filters.gender !== 'all') { where.push('p.jenis_kelamin=?'); binds.push(filters.gender) }
  if (filters.verifikasi && filters.verifikasi !== 'all') { where.push(filters.verifikasi === 'pending' ? 'p.status_verifikasi IS NULL' : 'p.status_verifikasi=?'); binds.push(...(filters.verifikasi === 'pending' ? [] : [filters.verifikasi === 'ok' ? 1 : 0])) }
  if (filters.kelulusan && filters.kelulusan !== 'all') { where.push('p.status_kelulusan=?'); binds.push(filters.kelulusan) }
  if (filters.konversi && filters.konversi !== 'all') where.push(filters.konversi === 'sudah' ? 'p.siswa_id IS NOT NULL' : 'p.siswa_id IS NULL')
  if (filters.daftarUlang && filters.daftarUlang !== 'all') {
    const stages: Record<string,string> = {
      belum_konfirmasi: "p.konfirmasi_daftar_ulang IS NOT 'BERSEDIA' AND d.id IS NULL",
      menunggu_konversi: "p.konfirmasi_daftar_ulang='BERSEDIA' AND p.siswa_id IS NULL AND d.id IS NULL",
      menunggu_kasir: "p.siswa_id IS NOT NULL AND d.id IS NULL",
      selesai: 'd.id IS NOT NULL',
    }
    if (stages[filters.daftarUlang]) where.push(stages[filters.daftarUlang])
  }
  if (filters.dspt && filters.dspt !== 'all') { if (filters.dspt === 'null') where.push('d.id IS NULL'); else { where.push('d.status=?'); binds.push(filters.dspt) } }
  if (filters.hardcopy && filters.hardcopy !== 'all') where.push(filters.hardcopy === 'sudah' ? "p.daftar_ulang_hardcopy_status='DITERIMA'" : "COALESCE(p.daftar_ulang_hardcopy_status,'')<>'DITERIMA'")
  if (filters.jadwal && filters.jadwal !== 'all') where.push(filters.jadwal === 'sudah' ? "COALESCE(p.tanggal_tes,'')<>''" : "COALESCE(p.tanggal_tes,'')=''" )
  const { results } = await db.prepare(`SELECT p.*,d.id AS dspt_id,d.nominal_target AS dspt_target,d.total_dibayar AS dspt_dibayar,d.total_diskon AS dspt_diskon,d.status AS dspt_status FROM pmb_pendaftar p LEFT JOIN fin_dspt d ON d.siswa_id=p.siswa_id ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY p.no_pendaftaran`).bind(...binds).all<any>()
  return { data: results }
}

// ── Bulk alih reguler (admin) ──────────────────────────────
export async function bulkAlihReguler(ids: string[]) {
  if (!(await verifyPmbAccess())) return { error: 'Akses ditolak' }
  const db = await getDB()
  const beforeRows = await db.prepare(`SELECT id, no_pendaftaran, nama_lengkap, jalur, status_kelulusan, status_verifikasi, siswa_id, ruang_tes, tanggal_tes, sesi_tes FROM pmb_pendaftar WHERE id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all<any>()
  const eligible = (beforeRows.results ?? []).filter(row => row.jalur === 'PRESTASI' && !row.siswa_id && ['PENDING', 'TIDAK DITERIMA'].includes(row.status_kelulusan || 'PENDING'))
  if (!eligible.length) return { error: 'Tidak ada pendaftar Prestasi yang memenuhi syarat untuk dialihkan.' }
  const now = new Date().toISOString()
  await db.batch(eligible.map(row => db.prepare(`UPDATE pmb_pendaftar SET jalur='REGULER',status_kelulusan='PENDING',status_verifikasi=NULL,ruang_tes=NULL,tanggal_tes=NULL,sesi_tes=NULL,updated_at=? WHERE id=? AND jalur='PRESTASI' AND siswa_id IS NULL`).bind(now, row.id)))
  await logActivity({
    db,
    module: 'pmb',
    action: 'bulk_alih_reguler',
    severity: 'warning',
    summary: `Mengalihkan ${eligible.length} pendaftar ke Reguler`,
    metadata: { requested: ids.length, eligible: eligible.length },
    targets: eligible.map(row => ({
      type: 'pmb_pendaftar',
      id: row.id,
      label: row.nama_lengkap || row.no_pendaftaran,
      metadata: { before: row },
    })),
  })
  revalidatePath('/dashboard/pmb')
  return { success: `${eligible.length} pendaftar dialihkan ke Reguler; ${ids.length - eligible.length} dilewati` }
}

// ── Edit data pendaftar (admin — field terbatas) ───────────
const ADMIN_EDITABLE = new Set([
  'nisn','nik','nama_lengkap','jenis_kelamin','tempat_lahir','tanggal_lahir',
  'ukuran_baju','agama','jumlah_saudara','anak_ke','status_anak',
  'provinsi','kabupaten_kota','kecamatan','desa_kelurahan','rt','rw','alamat_lengkap','kode_pos',
  'no_kk','no_telepon_ortu',
  'nama_ayah','nik_ayah','tempat_lahir_ayah','tanggal_lahir_ayah','status_ayah',
  'pendidikan_ayah','pekerjaan_ayah','penghasilan_ayah',
  'nama_ibu','nik_ibu','tempat_lahir_ibu','tanggal_lahir_ibu','status_ibu',
  'pendidikan_ibu','pekerjaan_ibu','penghasilan_ibu',
  'nama_wali','nik_wali','tempat_lahir_wali','tanggal_lahir_wali',
  'pendidikan_wali','pekerjaan_wali','penghasilan_wali','no_telepon_wali',
  'asal_sekolah','npsn_sekolah','status_sekolah','alamat_sekolah','pilihan_pesantren',
])
export async function editPendaftar(id: string, payload: Record<string, any>) {
  if (!(await verifyPmbAccess())) return { error: 'Akses ditolak' }
  const db = await getDB()
  const before = await db.prepare('SELECT * FROM pmb_pendaftar WHERE id = ?').bind(id).first<any>()
  const safe: Record<string, any> = {}
  for (const [k, v] of Object.entries(payload)) { if (ADMIN_EDITABLE.has(k)) safe[k] = v }
  if (!Object.keys(safe).length) return { error: 'Tidak ada field valid' }
  const result = await dbUpdate(db, 'pmb_pendaftar', { ...safe, updated_at: new Date().toISOString() }, { id })
  const failure = dbFailure(result, 'Gagal memperbarui pendaftar')
  if (failure) return { error: failure }
  await logActivity({
    db,
    module: 'pmb',
    action: 'edit_pendaftar',
    summary: `Mengubah data pendaftar ${before?.nama_lengkap || id}`,
    entityType: 'pmb_pendaftar',
    entityId: id,
    entityLabel: before?.nama_lengkap || before?.no_pendaftaran || id,
    before,
    after: { ...before, ...safe },
    diff: createActivityDiff(before, { ...before, ...safe }),
  })
  revalidatePath('/dashboard/pmb')
  return { success: 'Data pendaftar diperbarui' }
}

// ── Simpan manual plotting (bulk) ─────────────────────────
export async function saveManualPlotting(
  changes: { id: string; tanggal_tes: string; sesi_tes: string; ruang_tes: string }[],
) {
  if (!(await verifyPmbAccess())) return { error: 'Akses ditolak' }
  if (!changes.length) return { error: 'Tidak ada perubahan plotting.' }
  if (new Set(changes.map((c) => c.id)).size !== changes.length) return { error: 'Pendaftar duplikat dalam perubahan plotting.' }
  const db = await getDB()
  const beforeRows = await db.prepare(`SELECT id, no_pendaftaran, nama_lengkap, jalur, status_verifikasi, siswa_id, tanggal_tes, sesi_tes, ruang_tes FROM pmb_pendaftar WHERE id IN (${changes.map(() => '?').join(',')})`).bind(...changes.map(c => c.id)).all<any>()
  if ((beforeRows.results?.length ?? 0) !== changes.length) return { error: 'Ada pendaftar yang tidak ditemukan.' }
  const { results: slots } = await db.prepare(`SELECT s.*, (SELECT COUNT(*) FROM pmb_pendaftar p WHERE p.tanggal_tes=s.tanggal AND p.sesi_tes=s.sesi AND p.ruang_tes=s.ruang) AS occupied FROM pmb_jadwal_tes s`).all<any>()
  const keyOf = (tanggal: string, sesi: string, ruang: string) => `${tanggal}|${sesi}|${ruang}`
  const slotMap = new Map(slots.map((s: any) => [keyOf(s.tanggal, s.sesi, s.ruang), s]))
  const occupancy = new Map(slots.map((s: any) => [keyOf(s.tanggal, s.sesi, s.ruang), Number(s.occupied || 0)]))
  for (const row of beforeRows.results ?? []) {
    if (row.tanggal_tes && row.sesi_tes && row.ruang_tes) {
      const key = keyOf(row.tanggal_tes, row.sesi_tes, row.ruang_tes)
      occupancy.set(key, Math.max(0, (occupancy.get(key) || 0) - 1))
    }
  }
  for (const change of changes) {
    const row = beforeRows.results?.find((item: any) => item.id === change.id)
    if (row?.status_verifikasi !== 1 || row?.siswa_id) return { error: `${row?.nama_lengkap || change.id} tidak memenuhi syarat plotting.` }
    const values = [change.tanggal_tes, change.sesi_tes, change.ruang_tes].map((value) => String(value || '').trim())
    if (values.every((value) => !value)) continue // clear eksplisit
    if (values.some((value) => !value)) return { error: `Tanggal, sesi, dan ruang ${row.nama_lengkap} harus lengkap.` }
    const key = keyOf(values[0], values[1], values[2])
    const slot = slotMap.get(key)
    if (!slot) return { error: `Slot ${values.join(' / ')} tidak terdaftar.` }
    if (slot.jalur && slot.jalur !== row.jalur) return { error: `Slot tidak sesuai jalur ${row.nama_lengkap}.` }
    const next = (occupancy.get(key) || 0) + 1
    if (next > Number(slot.kapasitas || 36)) return { error: `Kapasitas slot ${values.join(' / ')} terlampaui.` }
    occupancy.set(key, next)
  }
  const now = new Date().toISOString()
  await db.batch(changes.map((c) => db.prepare(`UPDATE pmb_pendaftar SET tanggal_tes=?,sesi_tes=?,ruang_tes=?,updated_at=? WHERE id=? AND status_verifikasi=1 AND siswa_id IS NULL`)
    .bind(c.tanggal_tes || null, c.sesi_tes || null, c.ruang_tes || null, now, c.id)))
  await logActivity({
    db,
    module: 'pmb',
    action: 'manual_plotting_jadwal',
    summary: `Menyimpan manual plotting ${changes.length} pendaftar`,
    targets: changes.map(change => {
      const before = beforeRows.results?.find(row => row.id === change.id)
      return {
        type: 'pmb_pendaftar',
        id: change.id,
        label: before?.nama_lengkap || before?.no_pendaftaran || change.id,
        metadata: { before, after: change },
      }
    }),
  })
  revalidatePath('/dashboard/pmb')
  return { success: `${changes.length} plotting disimpan` }
}

export async function setHardcopyDaftarUlang(id: string, diterima: boolean) {
  if (!(await verifyPmbAccess())) return { error: 'Akses ditolak' }
  const db = await getDB()
  const before = await db.prepare('SELECT id,nama_lengkap,daftar_ulang_hardcopy_status,daftar_ulang_hardcopy_at FROM pmb_pendaftar WHERE id=?').bind(id).first<any>()
  if (!before) return { error: 'Pendaftar tidak ditemukan.' }
  const result = await dbUpdate(db, 'pmb_pendaftar', {
    daftar_ulang_hardcopy_status: diterima ? 'DITERIMA' : null,
    daftar_ulang_hardcopy_at: diterima ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }, { id })
  const failure = dbFailure(result, 'Gagal memperbarui status hardcopy')
  if (failure) return { error: failure }
  await logActivity({ db, module: 'pmb', action: 'set_hardcopy_daftar_ulang', summary: `${diterima ? 'Menerima' : 'Membatalkan'} hardcopy daftar ulang ${before.nama_lengkap}`, entityType: 'pmb_pendaftar', entityId: id, before, after: { ...before, daftar_ulang_hardcopy_status: diterima ? 'DITERIMA' : null } })
  revalidatePath('/dashboard/pmb')
  return { success: diterima ? 'Hardcopy daftar ulang diterima.' : 'Status hardcopy dibatalkan.' }
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
  const report: { row: number; no_pendaftaran: string; status: 'berhasil' | 'gagal'; message: string }[] = []
  for (const [index, row] of rows.entries()) {
    if (!valid.includes(row.status_kelulusan)) { report.push({ row: index + 2, no_pendaftaran: row.no_pendaftaran, status: 'gagal', message: 'Status kelulusan tidak valid' }); continue }
    const p = await db.prepare('SELECT id FROM pmb_pendaftar WHERE no_pendaftaran = ?').bind(row.no_pendaftaran).first<{ id: string }>()
    if (!p) { report.push({ row: index + 2, no_pendaftaran: row.no_pendaftaran, status: 'gagal', message: 'Nomor pendaftaran tidak ditemukan' }); continue }
    const result = await dbUpdate(db, 'pmb_pendaftar', { status_kelulusan: row.status_kelulusan, updated_at: now }, { id: p.id })
    if (!result.success) { report.push({ row: index + 2, no_pendaftaran: row.no_pendaftaran, status: 'gagal', message: result.error || 'Gagal memperbarui' }); continue }
    updated++
    report.push({ row: index + 2, no_pendaftaran: row.no_pendaftaran, status: 'berhasil', message: row.status_kelulusan })
  }
  await logActivity({
    db,
    module: 'pmb',
    action: 'import_kelulusan',
    severity: 'warning',
    summary: `Import kelulusan PMB: ${updated} data diperbarui`,
    metadata: { inputRows: rows.length, updated, report },
    targets: rows.map(row => ({ type: 'pmb_pendaftar', id: row.no_pendaftaran, label: row.no_pendaftaran, metadata: row })),
  })
  revalidatePath('/dashboard/pmb')
  const failed = report.length - updated
  return { success: `${updated} kelulusan diperbarui${failed ? `; ${failed} baris gagal` : ''}`, report }
}
