// Lokasi: app/dashboard/kedisiplinan/actions.ts
'use server'

import { getDB, dbInsert, dbUpdate, dbDelete } from '@/utils/db'
import { uploadBuktiFoto, deleteFromR2, validateImageFile } from '@/utils/r2'
import { getCurrentUser } from '@/utils/auth/server'
import { getUserRoles } from '@/lib/features'
import { currentTimeWIB } from '@/lib/time'
// import { formatNamaKelas } from '@/lib/utils'
import { revalidatePath } from 'next/cache'

const INPUT_PELANGGARAN_ROLES = ['super_admin', 'admin_tu', 'wakamad', 'guru_bk', 'guru_piket', 'resepsionis', 'satpam', 'guru']
const MANAGE_KEDISIPLINAN_ROLES = ['super_admin', 'wakamad', 'guru_bk']

type ImportPelanggaranRowInput = {
  rowNumber?: number
  tanggal_input?: string
  jam_input?: string
  nama?: string
  pelanggaran?: string
  keterangan?: string
}

type ImportPelanggaranOption = {
  id: string
  label: string
  sublabel?: string
  isNonaktif?: boolean
}

export type ImportPelanggaranPreviewRow = {
  rowNumber: number
  tanggal_input: string
  jam_input: string
  nama: string
  pelanggaran: string
  keterangan: string
  siswaOptions: ImportPelanggaranOption[]
  masterOptions: ImportPelanggaranOption[]
  selectedSiswaId: string
  selectedMasterId: string
  blockingReasons: string[]
  notices: string[]
}

export type ImportPelanggaranPreviewResult = {
  reviewRows: ImportPelanggaranPreviewRow[]
  summary: {
    total: number
    ready: number
    need_review: number
    blocked: number
  }
}

export type ImportPelanggaranCommitPayload = {
  rows: ImportPelanggaranRowInput[]
  overrides?: Array<{
    rowNumber: number
    selectedSiswaId?: string
    selectedMasterId?: string
  }>
}

function revalidateKedisiplinanPaths() {
  revalidatePath('/dashboard/kedisiplinan')
  revalidatePath('/dashboard/monitoring-kedisiplinan')
}

async function hasAnyRole(db: D1Database, userId: string, allowedRoles: string[]) {
  const roles = await getUserRoles(db, userId)
  return roles.some(role => allowedRoles.includes(role))
}

function normalizeImportText(value: string | null | undefined) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function formatKelasLabel(row: { tingkat?: string | number | null; nomor_kelas?: string | null; kelompok?: string | null }) {
  if (!row?.tingkat) return 'Tanpa kelas'
  return `${row.tingkat}-${row.nomor_kelas ?? ''}${row.kelompok ? ` ${row.kelompok}` : ''}`.trim()
}

function excelSerialToDate(serial: number) {
  const utcDays = Math.floor(serial - 25569)
  const utcValue = utcDays * 86400
  return new Date(utcValue * 1000)
}

function normalizeImportedDate(raw: unknown) {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    const y = raw.getFullYear()
    const m = String(raw.getMonth() + 1).padStart(2, '0')
    const d = String(raw.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const date = excelSerialToDate(raw)
    if (!Number.isNaN(date.getTime())) {
      const y = date.getUTCFullYear()
      const m = String(date.getUTCMonth() + 1).padStart(2, '0')
      const d = String(date.getUTCDate()).padStart(2, '0')
      return `${y}-${m}-${d}`
    }
  }

  const text = String(raw ?? '').trim()
  if (!text) return ''
  const dateOnly = text.split(/[ T]/)[0].trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return dateOnly

  const slash = dateOnly.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/)
  if (slash) {
    const day = slash[1].padStart(2, '0')
    const month = slash[2].padStart(2, '0')
    return `${slash[3]}-${month}-${day}`
  }

  const parsed = new Date(dateOnly)
  if (Number.isNaN(parsed.getTime())) return ''
  const y = parsed.getFullYear()
  const m = String(parsed.getMonth() + 1).padStart(2, '0')
  const d = String(parsed.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function normalizeImportedTime(raw: unknown) {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const totalMinutes = Math.round(raw * 24 * 60)
    const hours = Math.floor(totalMinutes / 60) % 24
    const minutes = totalMinutes % 60
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  }

  const text = String(raw ?? '').trim()
  if (!text) return ''
  const match = text.match(/(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?/)
  if (!match) return ''
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return ''
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function buildImportSummary(rows: ImportPelanggaranPreviewRow[]) {
  const ready = rows.filter(row => row.blockingReasons.length === 0 && row.selectedSiswaId && row.selectedMasterId).length
  const blocked = rows.filter(row => row.blockingReasons.length > 0).length
  return {
    total: rows.length,
    ready,
    blocked,
    need_review: rows.length - ready - blocked,
  }
}

function buildImportSourceSignature(input: {
  tahunAjaranId: string
  siswaId: string
  masterId: string
  tanggal: string
  jam: string
  keterangan: string
}) {
  return [
    'imp-pelanggaran',
    input.tahunAjaranId,
    input.siswaId,
    input.masterId,
    input.tanggal,
    input.jam,
    normalizeImportText(input.keterangan),
  ].join('|')
}

function buildPreviewRow(
  item: ImportPelanggaranRowInput,
  index: number,
  siswaByExact: Map<string, any[]>,
  masterByExact: Map<string, any[]>,
  siswaIndexed: any[],
  masterIndexed: any[]
): ImportPelanggaranPreviewRow {
  const rowNumber = Number(item.rowNumber) || index + 2
  const tanggal_input = normalizeImportedDate((item as any).TANGGAL_INPUT ?? (item as any).TANGGAL ?? item.tanggal_input)
  const jam_input = normalizeImportedTime((item as any).JAM_INPUT ?? (item as any).JAM ?? item.jam_input)
  const nama = String((item as any).NAMA ?? (item as any).NAMA_SISWA ?? item.nama ?? '').trim()
  const pelanggaran = String((item as any).PELANGGARAN ?? (item as any).JENIS_PELANGGARAN ?? item.pelanggaran ?? '').trim()
  const keterangan = String((item as any).KETERANGAN ?? item.keterangan ?? '').trim()

  const blockingReasons: string[] = []
  const notices: string[] = []

  if (!tanggal_input) blockingReasons.push('Tanggal tidak valid.')
  if (!jam_input) blockingReasons.push('Jam tidak valid.')
  if (!nama) blockingReasons.push('Nama siswa kosong.')
  if (!pelanggaran) blockingReasons.push('Jenis pelanggaran kosong.')

  const normalizedNama = normalizeImportText(nama)
  const normalizedPelanggaran = normalizeImportText(pelanggaran)
  const siswaExactMatches = nama ? (siswaByExact.get(normalizedNama) ?? []) : []
  let siswaOptions: ImportPelanggaranOption[] = siswaExactMatches.map((siswa: any) => ({
    id: siswa.id,
    label: siswa.nama_lengkap,
    sublabel: `${siswa.nisn} • ${formatKelasLabel(siswa)}${siswa.status !== 'aktif' ? ' • nonaktif' : ''}`,
    isNonaktif: siswa.status !== 'aktif',
  }))

  if (siswaOptions.length === 0 && nama) {
    siswaOptions = siswaIndexed
      .filter((siswa: any) => siswa.normalizedNama.includes(normalizedNama))
      .slice(0, 5)
      .map((siswa: any) => ({
        id: siswa.id,
        label: siswa.nama_lengkap,
        sublabel: `${siswa.nisn} • ${formatKelasLabel(siswa)}${siswa.status !== 'aktif' ? ' • nonaktif' : ''}`,
        isNonaktif: siswa.status !== 'aktif',
      }))
  }

  const masterExactMatches = pelanggaran ? (masterByExact.get(normalizedPelanggaran) ?? []) : []
  let masterOptions: ImportPelanggaranOption[] = masterExactMatches.map((master: any) => ({
    id: master.id,
    label: master.nama_pelanggaran,
    sublabel: `${master.kategori} • ${master.poin} poin`,
  }))

  if (masterOptions.length === 0 && pelanggaran) {
    masterOptions = masterIndexed
      .filter((master: any) => master.normalizedNama.includes(normalizedPelanggaran))
      .slice(0, 5)
      .map((master: any) => ({
        id: master.id,
        label: master.nama_pelanggaran,
        sublabel: `${master.kategori} • ${master.poin} poin`,
      }))
  }

  let selectedSiswaId = ''
  if (siswaExactMatches.length === 1) {
    selectedSiswaId = siswaExactMatches[0].id
    siswaOptions = [siswaOptions[0]]
    if (siswaExactMatches[0].status !== 'aktif') notices.push('Siswa cocok, tetapi statusnya nonaktif/sudah keluar.')
  } else if (siswaExactMatches.length > 1) {
    notices.push('Nama siswa ganda. Pilih siswa yang benar.')
  } else if (nama) {
    notices.push('Siswa belum cocok otomatis. Periksa kandidat atau lewati baris ini.')
  }

  let selectedMasterId = ''
  if (masterExactMatches.length === 1) {
    selectedMasterId = masterExactMatches[0].id
    masterOptions = [masterOptions[0]]
  } else if (masterExactMatches.length > 1) {
    notices.push('Jenis pelanggaran ganda. Pilih kamus yang benar.')
  } else if (pelanggaran) {
    notices.push('Jenis pelanggaran belum cocok otomatis. Pilih dari kamus.')
  }

  return {
    rowNumber,
    tanggal_input,
    jam_input,
    nama,
    pelanggaran,
    keterangan,
    siswaOptions,
    masterOptions,
    selectedSiswaId,
    selectedMasterId,
    blockingReasons,
    notices,
  }
}

// ============================================================
// SEARCH SISWA (lazy — dipanggil saat user mengetik di form)
// Menggantikan pre-load semua siswa saat halaman dibuka
// ============================================================
export async function searchSiswa(query: string) {
  if (!query || query.trim().length < 2) return []

  const db = await getDB()
  const q = `%${query.trim()}%`

  const result = await db
    .prepare(
      `SELECT s.id, s.nama_lengkap, s.nisn, s.foto_url, k.tingkat, k.nomor_kelas, k.kelompok
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
    kelas: s.tingkat
      ? `${s.tingkat}-${s.nomor_kelas}`
      : 'Tanpa Kelas',
  }))
}

// ============================================================
// 1. SIMPAN / EDIT PELANGGARAN
// ============================================================
export async function simpanPelanggaran(prevState: any, formData: FormData) {
  const db = await getDB()
  const user = await getCurrentUser()
  if (!user) return { error: 'Anda belum login', success: null }
  const canInput = await hasAnyRole(db, user.id, INPUT_PELANGGARAN_ROLES)
  if (!canInput) return { error: 'Anda tidak memiliki hak untuk menginput pelanggaran.', success: null }

  const ta = await db
    .prepare('SELECT id FROM tahun_ajaran WHERE is_active = 1 LIMIT 1')
    .first<any>()
  if (!ta) return { error: 'Tahun Ajaran aktif belum diatur sistem.', success: null }

  const id = formData.get('id') as string | null
  const siswa_id = formData.get('siswa_id') as string
  const master_pelanggaran_id = formData.get('master_pelanggaran_id') as string
  const tanggal = normalizeImportedDate(formData.get('tanggal'))
  const jam_input_raw = (formData.get('jam_input') as string | null)?.trim() || ''
  const keterangan = formData.get('keterangan') as string
  const jam_input = /^\d{2}:\d{2}$/.test(jam_input_raw) ? jam_input_raw : currentTimeWIB().hhmm

  if (!siswa_id || !master_pelanggaran_id) {
    return {
      error: 'Siswa dan Jenis Pelanggaran wajib dipilih dari daftar pencarian.',
      success: null,
    }
  }

  if (!tanggal) {
    return { error: 'Tanggal pelanggaran tidak valid.', success: null }
  }

  const file = formData.get('foto') as File | null
  let foto_url = formData.get('existing_foto_url') as string | null

  if (file && file.size > 0) {
    // Validasi sebelum upload
    const validationError = validateImageFile(file)
    if (validationError) return { error: validationError, success: null }

    // Hapus foto lama dari R2 jika ada (edit mode)
    if (id && foto_url) {
      await deleteFromR2(foto_url)
    }

    const { url, error: uploadError } = await uploadBuktiFoto(file)
    if (uploadError || !url) return { error: 'Gagal mengunggah foto bukti: ' + uploadError, success: null }
    foto_url = url
  }

  const payload = {
    siswa_id,
    master_pelanggaran_id,
    tanggal,
    jam_input,
    keterangan,
    foto_url,
    tahun_ajaran_id: ta.id,
    diinput_oleh: user.id,
    updated_at: new Date().toISOString(),
  }

  if (id) {
    const result = await dbUpdate(db, 'siswa_pelanggaran', payload, { id })
    if (result.error) return { error: 'Gagal mengedit: ' + result.error, success: null }
  } else {
    const result = await dbInsert(db, 'siswa_pelanggaran', payload)
    if (result.error) return { error: 'Gagal merekam data: ' + result.error, success: null }
  }

  // Cek apakah siswa naik level sanksi (hanya saat tambah baru, bukan edit)
  let naik_sanksi: { nama: string; deskripsi: string | null; total_poin: number } | null = null
  if (!id) {
    const totalRes = await db.prepare(`
      SELECT SUM(mp.poin) as total FROM siswa_pelanggaran sp
      JOIN master_pelanggaran mp ON sp.master_pelanggaran_id = mp.id
      WHERE sp.siswa_id = ?
    `).bind(siswa_id).first<{ total: number }>()

    const masterData = await db.prepare(`SELECT poin FROM master_pelanggaran WHERE id = ?`)
      .bind(master_pelanggaran_id).first<{ poin: number }>()

    const poinSesudah = totalRes?.total || 0
    const poinSebelum = poinSesudah - (masterData?.poin || 0)

    const sanksiList = await getSanksiList()
    const getForPoin = (p: number) =>
      [...sanksiList].sort((a, b) => b.poin_minimal - a.poin_minimal).find(s => p >= s.poin_minimal) || null

    const sanksiSebelum = getForPoin(poinSebelum)
    const sanksiSesudah = getForPoin(poinSesudah)

    if (sanksiSesudah && sanksiSesudah.id !== sanksiSebelum?.id) {
      naik_sanksi = { nama: sanksiSesudah.nama, deskripsi: sanksiSesudah.deskripsi, total_poin: poinSesudah }
    }
  }

  revalidateKedisiplinanPaths()
  return { error: null, success: 'Data pelanggaran berhasil disimpan!', naik_sanksi }
}

// ============================================================
// 2. HAPUS PELANGGARAN (+ hapus foto R2)
// ============================================================
export async function hapusPelanggaran(id: string) {
  const db = await getDB()
  const user = await getCurrentUser()
  if (!user) return { error: 'Anda belum login' }

  // Ambil foto_url sebelum dihapus
  const record = await db
    .prepare('SELECT foto_url, diinput_oleh FROM siswa_pelanggaran WHERE id = ?')
    .bind(id)
    .first<{ foto_url: string | null; diinput_oleh: string | null }>()

  const isSuperAdmin = await hasAnyRole(db, user.id, ['super_admin'])
  if (!record || (!isSuperAdmin && record.diinput_oleh !== user.id)) {
    return { error: 'Akses ditolak.' }
  }

  // Hapus foto dari R2 jika ada
  if (record?.foto_url) {
    await deleteFromR2(record.foto_url)
  }

  const result = await dbDelete(db, 'siswa_pelanggaran', { id })
  if (result.error) return { error: 'Akses ditolak atau gagal menghapus: ' + result.error }

  revalidateKedisiplinanPaths()
  return { success: 'Catatan pelanggaran berhasil dihapus permanen.' }
}

// ============================================================
// 3. MASTER PELANGGARAN
// ============================================================
export async function simpanMasterPelanggaran(prevState: any, formData: FormData) {
  const db = await getDB()
  const user = await getCurrentUser()
  if (!user) return { error: 'Tidak terautentikasi', success: null }
  const canManage = await hasAnyRole(db, user.id, MANAGE_KEDISIPLINAN_ROLES)
  if (!canManage) return { error: 'Anda tidak memiliki hak mengelola master pelanggaran.', success: null }

  const id = formData.get('id') as string | null
  const kategori = formData.get('kategori') as string
  const nama_pelanggaran = formData.get('nama_pelanggaran') as string
  const poin = parseInt(formData.get('poin') as string)

  if (!kategori || !nama_pelanggaran || isNaN(poin)) {
    return { error: 'Semua field wajib diisi dengan benar.', success: null }
  }

  if (id) {
    const result = await dbUpdate(db, 'master_pelanggaran', { kategori, nama_pelanggaran, poin }, { id })
    if (result.error) return { error: result.error, success: null }
  } else {
    const result = await dbInsert(db, 'master_pelanggaran', { kategori, nama_pelanggaran, poin })
    if (result.error) return { error: result.error, success: null }
  }

  revalidateKedisiplinanPaths()
  return { error: null, success: 'Master pelanggaran berhasil disimpan.' }
}

export async function hapusMasterPelanggaran(id: string) {
  const db = await getDB()
  const user = await getCurrentUser()
  if (!user) return { error: 'Tidak terautentikasi' }
  const canManage = await hasAnyRole(db, user.id, MANAGE_KEDISIPLINAN_ROLES)
  if (!canManage) return { error: 'Anda tidak memiliki hak mengelola master pelanggaran.' }

  const existing = await db
    .prepare('SELECT id FROM siswa_pelanggaran WHERE master_pelanggaran_id = ? LIMIT 1')
    .bind(id)
    .first<any>()

  if (existing) {
    return {
      error:
        'Tidak bisa menghapus: Jenis pelanggaran ini sudah memiliki riwayat pada data siswa. Silakan edit saja namanya.',
    }
  }

  const result = await dbDelete(db, 'master_pelanggaran', { id })
  if (result.error) return { error: 'Gagal menghapus: ' + result.error }

  revalidateKedisiplinanPaths()
  return { success: 'Master pelanggaran berhasil dihapus.' }
}

export async function importMasterPelanggaranMassal(dataExcel: any[]) {
  const db = await getDB()
  const user = await getCurrentUser()
  if (!user) return { error: 'Tidak terautentikasi' }
  const canManage = await hasAnyRole(db, user.id, MANAGE_KEDISIPLINAN_ROLES)
  if (!canManage) return { error: 'Anda tidak memiliki hak mengelola master pelanggaran.' }

  const sanitizedData = dataExcel
    .map((item) => ({
      nama_pelanggaran: String(item.NAMA_PELANGGARAN || '').trim(),
      kategori: String(item.KATEGORI || 'Ringan').trim(),
      poin: parseInt(item.POIN) || 0,
    }))
    .filter((item) => item.nama_pelanggaran && item.poin > 0)

  if (sanitizedData.length === 0) {
    return { error: 'Tidak ada data valid yang bisa diimport. Pastikan kolom sesuai format.' }
  }

  const { successCount, error } = await (await import('@/utils/db')).dbBatchInsert(
    db,
    'master_pelanggaran',
    sanitizedData
  )

  if (error) return { error }

  revalidateKedisiplinanPaths()
  return { success: `Berhasil mengimport ${successCount} jenis pelanggaran.` }
}

export async function previewImportPelanggaranMassal(dataExcel: ImportPelanggaranRowInput[]): Promise<ImportPelanggaranPreviewResult | { error: string }> {
  const db = await getDB()
  const user = await getCurrentUser()
  if (!user) return { error: 'Anda belum login.' }
  const canInput = await hasAnyRole(db, user.id, INPUT_PELANGGARAN_ROLES)
  if (!canInput) return { error: 'Anda tidak memiliki hak untuk import pelanggaran.' }
  if (!Array.isArray(dataExcel) || dataExcel.length === 0) return { error: 'File Excel kosong atau tidak terbaca.' }
  if (dataExcel.length > 1000) return { error: 'Maksimal 1000 baris per import agar proses review tetap ringan.' }

  const [siswaRes, masterRes] = await Promise.all([
    db.prepare(`
      SELECT s.id, s.nama_lengkap, s.status, s.nisn, k.tingkat, k.nomor_kelas, k.kelompok
      FROM siswa s
      LEFT JOIN kelas k ON s.kelas_id = k.id
      ORDER BY s.nama_lengkap ASC
    `).all<any>(),
    db.prepare(`
      SELECT id, nama_pelanggaran, kategori, poin
      FROM master_pelanggaran
      ORDER BY nama_pelanggaran ASC
    `).all<any>(),
  ])

  const siswaByExact = new Map<string, any[]>()
  const masterByExact = new Map<string, any[]>()
  const siswaList = siswaRes.results ?? []
  const masterList = masterRes.results ?? []
  const siswaIndexed = siswaList.map((siswa: any) => ({
    ...siswa,
    normalizedNama: normalizeImportText(siswa.nama_lengkap),
  }))
  const masterIndexed = masterList.map((master: any) => ({
    ...master,
    normalizedNama: normalizeImportText(master.nama_pelanggaran),
  }))

  for (const siswa of siswaIndexed) {
    const key = siswa.normalizedNama
    const current = siswaByExact.get(key) ?? []
    current.push(siswa)
    siswaByExact.set(key, current)
  }

  for (const master of masterIndexed) {
    const key = master.normalizedNama
    const current = masterByExact.get(key) ?? []
    current.push(master)
    masterByExact.set(key, current)
  }

  const allRows = dataExcel.map((item, index) =>
    buildPreviewRow(item, index, siswaByExact, masterByExact, siswaIndexed, masterIndexed)
  )
  const summary = buildImportSummary(allRows)
  const reviewRows = allRows.filter(row =>
    row.blockingReasons.length > 0 || !row.selectedSiswaId || !row.selectedMasterId
  )

  return { reviewRows, summary }
}

export async function commitImportPelanggaranMassal(payload: ImportPelanggaranCommitPayload) {
  const db = await getDB()
  const user = await getCurrentUser()
  if (!user) return { error: 'Anda belum login.' }
  const canInput = await hasAnyRole(db, user.id, INPUT_PELANGGARAN_ROLES)
  if (!canInput) return { error: 'Anda tidak memiliki hak untuk import pelanggaran.' }
  const rows = Array.isArray(payload?.rows) ? payload.rows : []
  if (!rows.length) return { error: 'Tidak ada data siap import.' }

  const ta = await db.prepare('SELECT id FROM tahun_ajaran WHERE is_active = 1 LIMIT 1').first<any>()
  if (!ta) return { error: 'Tahun Ajaran aktif belum diatur sistem.' }

  const [siswaRes, masterRes] = await Promise.all([
    db.prepare(`
      SELECT s.id, s.nama_lengkap, s.status, s.nisn, k.tingkat, k.nomor_kelas, k.kelompok
      FROM siswa s
      LEFT JOIN kelas k ON s.kelas_id = k.id
      ORDER BY s.nama_lengkap ASC
    `).all<any>(),
    db.prepare(`
      SELECT id, nama_pelanggaran, kategori, poin
      FROM master_pelanggaran
      ORDER BY nama_pelanggaran ASC
    `).all<any>(),
  ])

  const siswaByExact = new Map<string, any[]>()
  const masterByExact = new Map<string, any[]>()
  const siswaList = (siswaRes.results ?? []).map((siswa: any) => ({
    ...siswa,
    normalizedNama: normalizeImportText(siswa.nama_lengkap),
  }))
  const masterList = (masterRes.results ?? []).map((master: any) => ({
    ...master,
    normalizedNama: normalizeImportText(master.nama_pelanggaran),
  }))

  for (const siswa of siswaList) {
    const key = siswa.normalizedNama
    const current = siswaByExact.get(key) ?? []
    current.push(siswa)
    siswaByExact.set(key, current)
  }
  for (const master of masterList) {
    const key = master.normalizedNama
    const current = masterByExact.get(key) ?? []
    current.push(master)
    masterByExact.set(key, current)
  }

  const overrideMap = new Map<number, { selectedSiswaId?: string; selectedMasterId?: string }>()
  for (const override of payload.overrides ?? []) {
    if (typeof override?.rowNumber === 'number') {
      overrideMap.set(override.rowNumber, {
        selectedSiswaId: override.selectedSiswaId,
        selectedMasterId: override.selectedMasterId,
      })
    }
  }

  const stmts: D1PreparedStatement[] = []
  let successCount = 0
  const skipped: string[] = []

  for (let index = 0; index < rows.length; index++) {
    const previewRow = buildPreviewRow(rows[index], index, siswaByExact, masterByExact, siswaList, masterList)
    const override = overrideMap.get(previewRow.rowNumber)
    const selectedSiswaId = override?.selectedSiswaId ?? previewRow.selectedSiswaId
    const selectedMasterId = override?.selectedMasterId ?? previewRow.selectedMasterId
    const tanggal = normalizeImportedDate(previewRow.tanggal_input)
    const jam = normalizeImportedTime(previewRow.jam_input)
    if (previewRow.blockingReasons.length > 0 || !tanggal || !jam || !selectedSiswaId || !selectedMasterId) {
      skipped.push(`baris ${previewRow.rowNumber}`)
      continue
    }
    const siswaValid = siswaList.some((s: any) => s.id === selectedSiswaId)
    const masterValid = masterList.some((m: any) => m.id === selectedMasterId)
    if (!siswaValid || !masterValid) {
      skipped.push(`baris ${previewRow.rowNumber}`)
      continue
    }

    const createdAt = `${tanggal} ${jam}:00`
    const sourceSignature = buildImportSourceSignature({
      tahunAjaranId: ta.id,
      siswaId: selectedSiswaId,
      masterId: selectedMasterId,
      tanggal,
      jam,
      keterangan: previewRow.keterangan || '',
    })
    stmts.push(
      db.prepare(`
        INSERT INTO siswa_pelanggaran (
          id, siswa_id, master_pelanggaran_id, tahun_ajaran_id, tanggal, jam_input,
          source_signature, keterangan, foto_url, diinput_oleh, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(source_signature) DO UPDATE SET
          siswa_id = excluded.siswa_id,
          master_pelanggaran_id = excluded.master_pelanggaran_id,
          tanggal = excluded.tanggal,
          jam_input = excluded.jam_input,
          keterangan = excluded.keterangan,
          diinput_oleh = excluded.diinput_oleh,
          updated_at = excluded.updated_at
      `).bind(
        crypto.randomUUID().replace(/-/g, ''),
        selectedSiswaId,
        selectedMasterId,
        ta.id,
        tanggal,
        jam,
        sourceSignature,
        previewRow.keterangan || null,
        null,
        user.id,
        createdAt,
        createdAt,
      )
    )
    successCount++
  }

  if (!stmts.length) return { error: 'Tidak ada baris valid yang bisa diimport.' }
  for (let i = 0; i < stmts.length; i += 100) await db.batch(stmts.slice(i, i + 100))

  revalidateKedisiplinanPaths()
  return {
    error: skipped.length ? `${skipped.length} baris dilewati: ${skipped.slice(0, 8).join(', ')}` : null,
    success: `${successCount} catatan pelanggaran berhasil diimport.`,
    successCount,
    skippedCount: skipped.length,
  }
}

// ============================================================
// 4. LOAD MORE KASUS (pagination client-side request)
// ============================================================
export async function loadMoreKasus(taAktifId: string, offset: number) {
  const db = await getDB()
  const PAGE_SIZE = 50

  const result = await db
    .prepare(
      `SELECT sp.id, sp.tanggal, sp.jam_input, sp.keterangan, sp.foto_url, sp.siswa_id, sp.master_pelanggaran_id, sp.diinput_oleh,
        s.nama_lengkap as siswa_nama, k.tingkat, k.nomor_kelas, k.kelompok,
        mp.nama_pelanggaran, mp.poin, u.nama_lengkap as pelapor_nama
      FROM siswa_pelanggaran sp
      JOIN siswa s ON sp.siswa_id = s.id
      LEFT JOIN kelas k ON s.kelas_id = k.id
      JOIN master_pelanggaran mp ON sp.master_pelanggaran_id = mp.id
      LEFT JOIN "user" u ON sp.diinput_oleh = u.id
      WHERE sp.tahun_ajaran_id = ?
      ORDER BY sp.tanggal DESC, sp.created_at DESC
      LIMIT ${PAGE_SIZE} OFFSET ?`
    )
    .bind(taAktifId, offset)
    .all<any>()

  return (result.results ?? []).map((p: any) => ({
    id: p.id,
    tanggal: p.tanggal,
    jam_input: p.jam_input ?? '',
    keterangan: p.keterangan,
    foto_url: p.foto_url,
    siswa_id: p.siswa_id,
    master_pelanggaran_id: p.master_pelanggaran_id,
    diinput_oleh: p.diinput_oleh,
    siswa: {
      nama_lengkap: p.siswa_nama,
      kelas: p.tingkat
        ? { tingkat: p.tingkat, nomor_kelas: p.nomor_kelas, kelompok: p.kelompok }
        : null,
    },
    master_pelanggaran: { nama_pelanggaran: p.nama_pelanggaran, poin: p.poin },
    pelapor: { nama_lengkap: p.pelapor_nama },
  }))
}

// ============================================================
// 5. AMBIL DATA ANALITIK KEDISIPLINAN
// ============================================================
export async function getAnalitikKedisiplinan(taAktifId: string) {
  const db = await getDB()

  const [
    totalKasusRes, perKategoriRes, perBulanRes, topPelanggaranRes,
    siswaRisikoRes, perKelasRes, sanksiListRes,
  ] = await Promise.all([
    db.prepare(`
      SELECT COUNT(*) as total_kasus, SUM(mp.poin) as total_poin
      FROM siswa_pelanggaran sp
      JOIN master_pelanggaran mp ON sp.master_pelanggaran_id = mp.id
      WHERE sp.tahun_ajaran_id = ?
    `).bind(taAktifId).first<any>(),

    db.prepare(`
      SELECT mp.kategori, COUNT(*) as jumlah, SUM(mp.poin) as total_poin
      FROM siswa_pelanggaran sp
      JOIN master_pelanggaran mp ON sp.master_pelanggaran_id = mp.id
      WHERE sp.tahun_ajaran_id = ?
      GROUP BY mp.kategori ORDER BY total_poin DESC
    `).bind(taAktifId).all<any>(),

    db.prepare(`
      SELECT strftime('%Y-%m', sp.tanggal) as bulan, COUNT(*) as jumlah, SUM(mp.poin) as total_poin
      FROM siswa_pelanggaran sp
      JOIN master_pelanggaran mp ON sp.master_pelanggaran_id = mp.id
      WHERE sp.tahun_ajaran_id = ?
      GROUP BY bulan ORDER BY bulan ASC
    `).bind(taAktifId).all<any>(),

    db.prepare(`
      SELECT mp.nama_pelanggaran, mp.kategori, mp.poin, COUNT(*) as frekuensi, COUNT(*)*mp.poin as total_beban
      FROM siswa_pelanggaran sp
      JOIN master_pelanggaran mp ON sp.master_pelanggaran_id = mp.id
      WHERE sp.tahun_ajaran_id = ?
      GROUP BY sp.master_pelanggaran_id ORDER BY frekuensi DESC LIMIT 10
    `).bind(taAktifId).all<any>(),

    // Poin seumur hidup siswa (tidak difilter per TA)
    db.prepare(`
      SELECT s.id, s.nama_lengkap, k.tingkat, k.nomor_kelas, k.kelompok,
        COUNT(sp.id) as jumlah_kasus, SUM(mp.poin) as total_poin
      FROM siswa_pelanggaran sp
      JOIN siswa s ON sp.siswa_id = s.id
      LEFT JOIN kelas k ON s.kelas_id = k.id
      JOIN master_pelanggaran mp ON sp.master_pelanggaran_id = mp.id
      GROUP BY sp.siswa_id ORDER BY total_poin DESC LIMIT 20
    `).all<any>(),

    db.prepare(`
      SELECT k.tingkat, k.nomor_kelas, k.kelompok,
        COUNT(DISTINCT sp.siswa_id) as siswa_terlibat,
        COUNT(sp.id) as total_kasus,
        SUM(mp.poin) as total_poin
      FROM siswa_pelanggaran sp
      JOIN siswa s ON sp.siswa_id = s.id
      LEFT JOIN kelas k ON s.kelas_id = k.id
      JOIN master_pelanggaran mp ON sp.master_pelanggaran_id = mp.id
      WHERE sp.tahun_ajaran_id = ?
      GROUP BY s.kelas_id ORDER BY total_poin DESC
    `).bind(taAktifId).all<any>(),

    getSanksiList(),
  ])

  const sanksiList: SanksiConfig[] = sanksiListRes

  const getForPoin = (p: number) =>
    [...sanksiList].sort((a, b) => b.poin_minimal - a.poin_minimal).find(s => p >= s.poin_minimal) || null

  return {
    ringkasan: {
      total_kasus: totalKasusRes?.total_kasus ?? 0,
      total_poin: totalKasusRes?.total_poin ?? 0,
    },
    perKategori: perKategoriRes.results ?? [],
    perBulan: perBulanRes.results ?? [],
    topPelanggaran: topPelanggaranRes.results ?? [],
    siswaBerisiko: (siswaRisikoRes.results ?? []).map((s: any) => ({
      ...s,
      sanksi: getForPoin(s.total_poin ?? 0),
    })),
    perKelas: perKelasRes.results ?? [],
    sanksiList,
  }
}

// ============================================================
// 6. SANKSI CONFIG (CRUD)
// ============================================================
export type SanksiConfig = {
  id: string
  nama: string
  deskripsi: string | null
  poin_minimal: number
  urutan: number
}

async function ensureSanksiTable(db: any) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS sanksi_config (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      nama TEXT NOT NULL,
      deskripsi TEXT,
      poin_minimal INTEGER NOT NULL DEFAULT 0,
      urutan INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `).run()
}

async function reorderSanksi(db: any) {
  const all = await db.prepare(`SELECT id FROM sanksi_config ORDER BY poin_minimal ASC`).all()
  for (let i = 0; i < (all.results?.length || 0); i++) {
    await db.prepare(`UPDATE sanksi_config SET urutan = ? WHERE id = ?`).bind(i + 1, all.results![i].id).run()
  }
}

export async function getSanksiList(): Promise<SanksiConfig[]> {
  const db = await getDB()
  try {
    await ensureSanksiTable(db)
    const res = await db.prepare(`SELECT * FROM sanksi_config ORDER BY poin_minimal ASC`).all<any>()
    let list: SanksiConfig[] = res.results || []

    if (list.length === 0) {
      const defaults = [
        { nama: 'SP1', deskripsi: 'Surat Peringatan 1', poin_minimal: 100, urutan: 1 },
        { nama: 'SP2', deskripsi: 'Surat Peringatan 2', poin_minimal: 150, urutan: 2 },
        { nama: 'SP3', deskripsi: 'Surat Peringatan 3', poin_minimal: 200, urutan: 3 },
      ]
      for (const d of defaults) {
        await db.prepare(`INSERT INTO sanksi_config (nama, deskripsi, poin_minimal, urutan) VALUES (?, ?, ?, ?)`)
          .bind(d.nama, d.deskripsi, d.poin_minimal, d.urutan).run()
      }
      const res2 = await db.prepare(`SELECT * FROM sanksi_config ORDER BY poin_minimal ASC`).all<any>()
      list = res2.results || []
    }
    return list
  } catch {
    return [
      { id: 'default-1', nama: 'SP1', deskripsi: 'Surat Peringatan 1', poin_minimal: 100, urutan: 1 },
      { id: 'default-2', nama: 'SP2', deskripsi: 'Surat Peringatan 2', poin_minimal: 150, urutan: 2 },
      { id: 'default-3', nama: 'SP3', deskripsi: 'Surat Peringatan 3', poin_minimal: 200, urutan: 3 },
    ]
  }
}

export async function simpanSanksiItem(prevState: any, formData: FormData) {
  const db = await getDB()
  const user = await getCurrentUser()
  if (!user) return { error: 'Tidak terautentikasi', success: null }
  const canManage = await hasAnyRole(db, user.id, MANAGE_KEDISIPLINAN_ROLES)
  if (!canManage) return { error: 'Anda tidak memiliki hak mengelola konfigurasi sanksi.', success: null }

  try {
    await ensureSanksiTable(db)
    const id = formData.get('id') as string | null
    const nama = (formData.get('nama') as string)?.trim()
    const deskripsi = (formData.get('deskripsi') as string)?.trim() || null
    const poin_minimal = parseInt(formData.get('poin_minimal') as string)

    if (!nama) return { error: 'Nama sanksi wajib diisi.', success: null }
    if (isNaN(poin_minimal) || poin_minimal < 1) return { error: 'Poin minimal harus angka positif.', success: null }

    if (id) {
      await db.prepare(`UPDATE sanksi_config SET nama=?, deskripsi=?, poin_minimal=?, updated_at=datetime('now') WHERE id=?`)
        .bind(nama, deskripsi, poin_minimal, id).run()
    } else {
      await db.prepare(`INSERT INTO sanksi_config (nama, deskripsi, poin_minimal, urutan) VALUES (?, ?, ?, 0)`)
        .bind(nama, deskripsi, poin_minimal).run()
    }
    await reorderSanksi(db)
    revalidateKedisiplinanPaths()
    return { error: null, success: 'Sanksi berhasil disimpan.' }
  } catch (e: any) {
    return { error: 'Gagal: ' + (e?.message || ''), success: null }
  }
}

export async function hapusSanksiItem(id: string) {
  const db = await getDB()
  const user = await getCurrentUser()
  if (!user) return { error: 'Tidak terautentikasi' }
  const canManage = await hasAnyRole(db, user.id, MANAGE_KEDISIPLINAN_ROLES)
  if (!canManage) return { error: 'Anda tidak memiliki hak mengelola konfigurasi sanksi.' }
  try {
    await db.prepare(`DELETE FROM sanksi_config WHERE id = ?`).bind(id).run()
    await reorderSanksi(db)
    revalidateKedisiplinanPaths()
    return { success: 'Sanksi berhasil dihapus.' }
  } catch (e: any) {
    return { error: 'Gagal menghapus: ' + (e?.message || '') }
  }
}

// ============================================================
// 7. SIMPAN KONFIGURASI KEDISIPLINAN (LAMA — kept for compat)
// ============================================================
export async function simpanKedisiplinanConfig(prevState: any, formData: FormData) {
  const db = await getDB()
  const user = await getCurrentUser()
  if (!user) return { error: 'Tidak terautentikasi', success: null }
  const canManage = await hasAnyRole(db, user.id, MANAGE_KEDISIPLINAN_ROLES)
  if (!canManage) return { error: 'Anda tidak memiliki hak mengelola konfigurasi kedisiplinan.', success: null }

  const keys = ['threshold_perhatian', 'threshold_peringatan', 'threshold_kritis', 'credit_score_awal']
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS kedisiplinan_config (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        key TEXT NOT NULL UNIQUE, value TEXT NOT NULL,
        label TEXT, keterangan TEXT,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run()

    for (const key of keys) {
      const val = formData.get(key) as string
      if (val === null || val === '') continue
      const num = parseInt(val)
      if (isNaN(num) || num < 0) return { error: `Nilai untuk ${key} tidak valid.`, success: null }
      await db.prepare(`
        INSERT INTO kedisiplinan_config (key, value, updated_at)
        VALUES (?, ?, datetime('now'))
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `).bind(key, String(num)).run()
    }

    revalidateKedisiplinanPaths()
    return { error: null, success: 'Konfigurasi berhasil disimpan.' }
  } catch (e: any) {
    return { error: 'Gagal menyimpan: ' + (e?.message || ''), success: null }
  }
}

// ============================================================
// 8. AMBIL KONFIGURASI (kept for backward compat — sekarang delegate ke sanksi)
// ============================================================
export async function getKedisiplinanConfig() {
  const sanksiList = await getSanksiList()
  return {
    threshold_perhatian:  sanksiList[0]?.poin_minimal ?? 25,
    threshold_peringatan: sanksiList[1]?.poin_minimal ?? 50,
    threshold_kritis:     sanksiList[2]?.poin_minimal ?? 75,
    credit_score_awal:    100,
  }
}
