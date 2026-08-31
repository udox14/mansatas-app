// Lokasi: app/dashboard/kedisiplinan/actions.ts
'use server'

import { dbInsert, dbUpdate, dbDelete } from '@/utils/db'
import { getDB as getRawDB } from '@/utils/db-server'
import { requireActionAccess } from '@/lib/action-security'

async function getDB() {
  // Komponen input dan analitik juga dipakai dari halaman Monitoring
  // Kedisiplinan. Terima user yang memiliki akses baca ke salah satu modul;
  // pemeriksaan role khusus tetap dilakukan oleh setiap aksi mutasi.
  await requireActionAccess(['kedisiplinan', 'monitoring-kedisiplinan'], 'read')
  return getRawDB()
}
import { uploadBuktiFoto, deleteFromR2, validateImageFile } from '@/utils/r2'
import { getCurrentUser } from '@/utils/auth/server'
import { getUserRoles } from '@/lib/features'
import { currentTimeWIB, todayWIB } from '@/lib/time'
import {
  ensureSanksiTable,
  loadSanksiList,
  reorderSanksi,
  type SanksiConfig,
} from '@/lib/sanksi-service'
// import { formatNamaKelas } from '@/lib/utils'
import { revalidatePath } from 'next/cache'
import { emitConfiguredNotification, getStudentNotificationContext } from '@/lib/notification-engine'
import {
  canReviewDisciplineRecord,
  DISCIPLINE_CLARIFICATION_MAX_LENGTH,
  ensureParentDisciplineSchema,
  getParentDisciplineSettings,
  type DisciplineClarificationStatus,
  type DisciplinePublicationStatus,
} from '@/lib/parent-discipline'
import { logActivity } from '@/lib/activity-log'

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
  revalidatePath('/portal-ortu')
}

async function publishedDisciplineTotal(db: D1Database, siswaId: string) {
  const row = await db.prepare(`
    SELECT COALESCE(SUM(COALESCE(sp.poin_snapshot, mp.poin, 0)), 0) AS total
    FROM siswa_pelanggaran sp
    LEFT JOIN master_pelanggaran mp ON mp.id = sp.master_pelanggaran_id
    WHERE sp.siswa_id = ? AND sp.publication_status = 'published'
  `).bind(siswaId).first<{ total: number }>()
  return Number(row?.total || 0)
}

async function emitPublishedDisciplineNotification(db: D1Database, recordId: string) {
  const settings = await getParentDisciplineSettings()
  if (!settings.enabled) return
  const record = await db.prepare(`
    SELECT sp.id, sp.siswa_id, sp.tanggal, sp.keterangan,
      COALESCE(sp.nama_pelanggaran_snapshot, mp.nama_pelanggaran) AS nama_pelanggaran,
      COALESCE(sp.poin_snapshot, mp.poin, 0) AS poin
    FROM siswa_pelanggaran sp
    LEFT JOIN master_pelanggaran mp ON mp.id = sp.master_pelanggaran_id
    WHERE sp.id = ? AND sp.publication_status = 'published' LIMIT 1
  `).bind(recordId).first<any>()
  if (!record) return
  const student = await getStudentNotificationContext(db, record.siswa_id)
  if (!student) return
  await emitConfiguredNotification({
    eventKey: 'discipline_violation_created',
    sourceRef: `discipline:${record.id}`,
    context: {
      ...student,
      nama_pelanggaran: record.nama_pelanggaran,
      poin: Number(record.poin || 0),
      tanggal: record.tanggal,
      keterangan: record.keterangan || '-',
    },
    db,
    parentType: 'kedisiplinan',
  })
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

function formatValidDateParts(year: number, month: number, day: number) {
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return ''
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function isNotFutureDate(dateStr: string) {
  return !!dateStr && dateStr <= todayWIB()
}

function chooseNonFutureDate(year: number, month: number, day: number, swappedMonth?: number, swappedDay?: number) {
  const primary = formatValidDateParts(year, month, day)
  const swapped = swappedMonth && swappedDay ? formatValidDateParts(year, swappedMonth, swappedDay) : ''

  if (isNotFutureDate(primary)) return primary
  if (isNotFutureDate(swapped)) return swapped
  return ''
}

function normalizeImportedDate(raw: unknown) {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    const y = raw.getFullYear()
    const m = String(raw.getMonth() + 1).padStart(2, '0')
    const d = String(raw.getDate()).padStart(2, '0')
    const normalized = `${y}-${m}-${d}`
    return isNotFutureDate(normalized) ? normalized : ''
  }

  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const date = excelSerialToDate(raw)
    if (!Number.isNaN(date.getTime())) {
      const y = date.getUTCFullYear()
      const m = String(date.getUTCMonth() + 1).padStart(2, '0')
      const d = String(date.getUTCDate()).padStart(2, '0')
      const normalized = `${y}-${m}-${d}`
      return isNotFutureDate(normalized) ? normalized : ''
    }
  }

  const text = String(raw ?? '').trim()
  if (!text) return ''
  const dateOnly = text.split(/[ T]/)[0].trim()
  const iso = dateOnly.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) {
    const year = Number(iso[1])
    const middle = Number(iso[2])
    const last = Number(iso[3])
    return chooseNonFutureDate(year, middle, last, last, middle)
  }

  const slash = dateOnly.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/)
  if (slash) {
    return chooseNonFutureDate(Number(slash[3]), Number(slash[2]), Number(slash[1]), Number(slash[1]), Number(slash[2]))
  }

  const parsed = new Date(dateOnly)
  if (Number.isNaN(parsed.getTime())) return ''
  const y = parsed.getFullYear()
  const m = String(parsed.getMonth() + 1).padStart(2, '0')
  const d = String(parsed.getDate()).padStart(2, '0')
  const normalized = `${y}-${m}-${d}`
  return isNotFutureDate(normalized) ? normalized : ''
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
  await ensureParentDisciplineSchema(db)
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

  const [masterSnapshot, portalSettings] = await Promise.all([
    db.prepare('SELECT nama_pelanggaran, kategori, poin FROM master_pelanggaran WHERE id = ? LIMIT 1')
      .bind(master_pelanggaran_id).first<{ nama_pelanggaran: string; kategori: string; poin: number }>(),
    getParentDisciplineSettings(),
  ])
  if (!masterSnapshot) return { error: 'Jenis pelanggaran tidak ditemukan.', success: null }

  const publicationStatus: DisciplinePublicationStatus = portalSettings.publishMode === 'verified' ? 'pending' : 'published'
  const payload = {
    siswa_id,
    master_pelanggaran_id,
    tanggal,
    jam_input,
    keterangan,
    foto_url,
    tahun_ajaran_id: ta.id,
    diinput_oleh: user.id,
    nama_pelanggaran_snapshot: masterSnapshot.nama_pelanggaran,
    kategori_snapshot: masterSnapshot.kategori,
    poin_snapshot: Number(masterSnapshot.poin || 0),
    publication_status: publicationStatus,
    reviewed_by: null,
    reviewed_at: publicationStatus === 'published' ? new Date().toISOString() : null,
    review_note: null,
    updated_at: new Date().toISOString(),
  }

  let savedId = id || ''
  if (id) {
    const result = await dbUpdate(db, 'siswa_pelanggaran', payload, { id })
    if (result.error) return { error: 'Gagal mengedit: ' + result.error, success: null }
    await db.prepare(`
      UPDATE parent_notifications SET archived_at = COALESCE(archived_at, datetime('now'))
      WHERE siswa_id = ? AND source_ref = ?
    `).bind(siswa_id, `discipline:${id}`).run().catch(() => undefined)
  } else {
    const result = await dbInsert(db, 'siswa_pelanggaran', payload)
    if (result.error) return { error: 'Gagal merekam data: ' + result.error, success: null }
    savedId = String((result.data as any)?.id || '')
  }

  // Cek apakah siswa naik level sanksi (hanya saat tambah baru, bukan edit)
  let naik_sanksi: { nama: string; deskripsi: string | null; total_poin: number } | null = null
  if (!id) {
    const poinSesudah = await publishedDisciplineTotal(db, siswa_id)
    const poinSebelum = publicationStatus === 'published' ? poinSesudah - Number(masterSnapshot.poin || 0) : poinSesudah

    const sanksiList = await loadSanksiList(db)
    const getForPoin = (p: number) =>
      [...sanksiList].sort((a, b) => b.poin_minimal - a.poin_minimal).find(s => p >= s.poin_minimal) || null

    const sanksiSebelum = getForPoin(poinSebelum)
    const sanksiSesudah = getForPoin(poinSesudah)

    if (sanksiSesudah && sanksiSesudah.id !== sanksiSebelum?.id) {
      naik_sanksi = { nama: sanksiSesudah.nama, deskripsi: sanksiSesudah.deskripsi, total_poin: poinSesudah }
    }
  }

  if (!id && publicationStatus === 'published') {
    try {
      const student = await getStudentNotificationContext(db, siswa_id)
      await emitPublishedDisciplineNotification(db, savedId)
      if (student) {
        if (naik_sanksi && portalSettings.enabled) {
          await emitConfiguredNotification({
            eventKey: 'discipline_sanction_reached',
            sourceRef: `sanksi:${naik_sanksi.nama}`,
            context: {
              ...student,
              level_sanksi: naik_sanksi.nama,
              total_poin: naik_sanksi.total_poin,
              tanggal,
            },
            db,
            parentType: 'sanksi',
          })
        }
      }
    } catch (error) {
      console.error('[notification] discipline notification gagal:', error)
    }
  }

  revalidateKedisiplinanPaths()
  return {
    error: null,
    success: publicationStatus === 'pending'
      ? 'Data pelanggaran berhasil disimpan dan menunggu verifikasi.'
      : 'Data pelanggaran berhasil disimpan!',
    naik_sanksi,
  }
}

// ============================================================
// 2. HAPUS PELANGGARAN (+ hapus foto R2)
// ============================================================
export async function hapusPelanggaran(id: string) {
  const db = await getDB()
  await ensureParentDisciplineSchema(db)
  const user = await getCurrentUser()
  if (!user) return { error: 'Anda belum login' }

  // Ambil foto_url sebelum dihapus
  const record = await db
    .prepare('SELECT foto_url, diinput_oleh, siswa_id FROM siswa_pelanggaran WHERE id = ?')
    .bind(id)
    .first<{ foto_url: string | null; diinput_oleh: string | null; siswa_id: string }>()

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

  await db.prepare(`
    UPDATE parent_notifications SET archived_at = COALESCE(archived_at, datetime('now'))
    WHERE siswa_id = ? AND source_ref = ?
  `).bind(record.siswa_id, `discipline:${id}`).run().catch(() => undefined)

  revalidateKedisiplinanPaths()
  return { success: 'Catatan pelanggaran berhasil dihapus permanen.' }
}

export async function reviewPelanggaran(recordId: string, decision: 'published' | 'rejected', note = '') {
  const db = await getDB()
  await ensureParentDisciplineSchema(db)
  const user = await getCurrentUser()
  if (!user) return { error: 'Anda belum login.' }
  if (!['published', 'rejected'].includes(decision)) return { error: 'Keputusan tidak valid.' }

  const record = await db.prepare(`
    SELECT sp.id, sp.siswa_id, sp.publication_status, sp.tanggal,
           COALESCE(sp.poin_snapshot, mp.poin, 0) AS poin
    FROM siswa_pelanggaran sp LEFT JOIN master_pelanggaran mp ON mp.id = sp.master_pelanggaran_id
    WHERE sp.id = ? LIMIT 1
  `).bind(recordId).first<{ id: string; siswa_id: string; publication_status: DisciplinePublicationStatus; tanggal: string; poin: number }>()
  if (!record || !(await canReviewDisciplineRecord(db, user.id, record.siswa_id))) return { error: 'Akses verifikasi ditolak.' }
  const cleanNote = String(note || '').trim().slice(0, 2000)
  if (decision === 'rejected' && !cleanNote) return { error: 'Alasan penolakan wajib diisi.' }

  await db.prepare(`
    UPDATE siswa_pelanggaran
    SET publication_status = ?, reviewed_by = ?, reviewed_at = datetime('now'), review_note = ?, updated_at = datetime('now')
    WHERE id = ?
  `).bind(decision, user.id, cleanNote || null, recordId).run()

  if (decision === 'published' && record.publication_status !== 'published') {
    await emitPublishedDisciplineNotification(db, recordId)
    const totalAfter = await publishedDisciplineTotal(db, record.siswa_id)
    const totalBefore = Math.max(0, totalAfter - Number(record.poin || 0))
    const sanctionRows = await loadSanksiList(db)
    const findSanction = (total: number) => [...sanctionRows].sort((a, b) => b.poin_minimal - a.poin_minimal).find(row => total >= row.poin_minimal)
    const before = findSanction(totalBefore)
    const after = findSanction(totalAfter)
    const portalSettings = await getParentDisciplineSettings()
    if (portalSettings.enabled && after && after.id !== before?.id) {
      const student = await getStudentNotificationContext(db, record.siswa_id)
      if (student) await emitConfiguredNotification({
        eventKey: 'discipline_sanction_reached',
        sourceRef: `sanksi:${after.nama}`,
        context: { ...student, level_sanksi: after.nama, total_poin: totalAfter, tanggal: record.tanggal },
        db,
        parentType: 'sanksi',
      })
    }
  } else if (decision === 'rejected') {
    await db.prepare(`
      UPDATE parent_notifications SET archived_at = COALESCE(archived_at, datetime('now'))
      WHERE siswa_id = ? AND source_ref = ?
    `).bind(record.siswa_id, `discipline:${recordId}`).run().catch(() => undefined)
  }

  await logActivity({
    db,
    module: 'kedisiplinan',
    action: decision === 'published' ? 'publish' : 'reject',
    summary: decision === 'published' ? 'Menerbitkan catatan kedisiplinan ke portal orang tua' : 'Menolak publikasi catatan kedisiplinan',
    entityType: 'siswa_pelanggaran',
    entityId: recordId,
    metadata: { siswa_id: record.siswa_id, note: cleanNote || null },
  })
  revalidateKedisiplinanPaths()
  return { success: decision === 'published' ? 'Catatan diterbitkan ke portal orang tua.' : 'Publikasi catatan ditolak.' }
}

export async function updateDisciplineClarification(
  clarificationId: string,
  status: DisciplineClarificationStatus,
  responseMessage = '',
) {
  const db = await getDB()
  await ensureParentDisciplineSchema(db)
  const user = await getCurrentUser()
  if (!user) return { error: 'Anda belum login.' }
  if (!['diproses', 'selesai', 'ditolak'].includes(status)) return { error: 'Status tidak valid.' }
  const clarification = await db.prepare(`
    SELECT id, siswa_id, request_message FROM parent_discipline_clarifications WHERE id = ? LIMIT 1
  `).bind(clarificationId).first<{ id: string; siswa_id: string; request_message: string }>()
  if (!clarification || !(await canReviewDisciplineRecord(db, user.id, clarification.siswa_id))) return { error: 'Akses ditolak.' }
  const response = String(responseMessage || '').trim()
  if (['selesai', 'ditolak'].includes(status) && !response) return { error: 'Jawaban akhir wajib diisi.' }
  if (response.length > DISCIPLINE_CLARIFICATION_MAX_LENGTH) return { error: `Jawaban maksimal ${DISCIPLINE_CLARIFICATION_MAX_LENGTH} karakter.` }

  await db.prepare(`
    UPDATE parent_discipline_clarifications
    SET status = ?, response_message = ?, handled_by = ?,
        handled_at = CASE WHEN ? IN ('selesai','ditolak') THEN datetime('now') ELSE handled_at END,
        updated_at = datetime('now')
    WHERE id = ?
  `).bind(status, response || null, user.id, status, clarificationId).run()

  if (status === 'selesai' || status === 'ditolak') {
    await db.prepare(`
      INSERT INTO parent_notifications (siswa_id, type, title, message, source_ref, level)
      VALUES (?, 'klarifikasi_kedisiplinan', ?, ?, ?, 'info')
      ON CONFLICT(siswa_id, type, source_ref) DO UPDATE SET
        title = excluded.title, message = excluded.message, archived_at = NULL, is_read = 0, created_at = datetime('now')
    `).bind(
      clarification.siswa_id,
      status === 'selesai' ? 'Klarifikasi kedisiplinan selesai' : 'Klarifikasi kedisiplinan ditanggapi',
      response,
      `discipline-clarification:${clarificationId}`,
    ).run().catch(() => undefined)
  }
  await logActivity({
    db,
    module: 'kedisiplinan',
    action: 'handle_parent_clarification',
    summary: `Memperbarui klarifikasi orang tua menjadi ${status}`,
    entityType: 'parent_discipline_clarification',
    entityId: clarificationId,
    metadata: { siswa_id: clarification.siswa_id, status },
  })
  revalidateKedisiplinanPaths()
  return { success: status === 'diproses' ? 'Klarifikasi ditandai sedang diproses.' : 'Jawaban klarifikasi berhasil disimpan.' }
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
  await ensureParentDisciplineSchema(db)
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
  const portalSettings = await getParentDisciplineSettings()
  const importPublicationStatus: DisciplinePublicationStatus = portalSettings.publishMode === 'verified' ? 'pending' : 'published'
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
    const selectedMaster = masterList.find((m: any) => m.id === selectedMasterId)
    if (!siswaValid || !selectedMaster) {
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
          source_signature, keterangan, foto_url, diinput_oleh, created_at, updated_at,
          nama_pelanggaran_snapshot, kategori_snapshot, poin_snapshot, publication_status, reviewed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(source_signature) DO UPDATE SET
          siswa_id = excluded.siswa_id,
          master_pelanggaran_id = excluded.master_pelanggaran_id,
          tanggal = excluded.tanggal,
          jam_input = excluded.jam_input,
          keterangan = excluded.keterangan,
          nama_pelanggaran_snapshot = excluded.nama_pelanggaran_snapshot,
          kategori_snapshot = excluded.kategori_snapshot,
          poin_snapshot = excluded.poin_snapshot,
          publication_status = excluded.publication_status,
          reviewed_by = NULL,
          reviewed_at = excluded.reviewed_at,
          review_note = NULL,
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
        selectedMaster.nama_pelanggaran,
        selectedMaster.kategori,
        Number(selectedMaster.poin || 0),
        importPublicationStatus,
        importPublicationStatus === 'published' ? createdAt : null,
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
  await ensureParentDisciplineSchema(db)
  const PAGE_SIZE = 50

  const result = await db
    .prepare(
      `SELECT sp.id, sp.tanggal, sp.jam_input, sp.keterangan, sp.foto_url, sp.siswa_id, sp.master_pelanggaran_id, sp.diinput_oleh,
        s.nama_lengkap as siswa_nama, k.tingkat, k.nomor_kelas, k.kelompok,
        COALESCE(sp.nama_pelanggaran_snapshot, mp.nama_pelanggaran) AS nama_pelanggaran,
        COALESCE(sp.poin_snapshot, mp.poin) AS poin, sp.publication_status, u.nama_lengkap as pelapor_nama
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
    publication_status: p.publication_status || 'published',
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
  await ensureParentDisciplineSchema(db)

  const [
    totalKasusRes, perKategoriRes, perBulanRes, topPelanggaranRes,
    siswaRisikoRes, perKelasRes, sanksiListRes,
  ] = await Promise.all([
    db.prepare(`
      SELECT COUNT(*) as total_kasus, SUM(COALESCE(sp.poin_snapshot, mp.poin, 0)) as total_poin
      FROM siswa_pelanggaran sp
      JOIN master_pelanggaran mp ON sp.master_pelanggaran_id = mp.id
      WHERE sp.tahun_ajaran_id = ?
    `).bind(taAktifId).first<any>(),

    db.prepare(`
      SELECT COALESCE(sp.kategori_snapshot, mp.kategori) AS kategori, COUNT(*) as jumlah, SUM(COALESCE(sp.poin_snapshot, mp.poin, 0)) as total_poin
      FROM siswa_pelanggaran sp
      JOIN master_pelanggaran mp ON sp.master_pelanggaran_id = mp.id
      WHERE sp.tahun_ajaran_id = ?
      GROUP BY COALESCE(sp.kategori_snapshot, mp.kategori) ORDER BY total_poin DESC
    `).bind(taAktifId).all<any>(),

    db.prepare(`
      SELECT strftime('%Y-%m', sp.tanggal) as bulan, COUNT(*) as jumlah, SUM(COALESCE(sp.poin_snapshot, mp.poin, 0)) as total_poin
      FROM siswa_pelanggaran sp
      JOIN master_pelanggaran mp ON sp.master_pelanggaran_id = mp.id
      WHERE sp.tahun_ajaran_id = ? AND strftime('%Y-%m', sp.tanggal) IS NOT NULL
      GROUP BY bulan ORDER BY bulan ASC
    `).bind(taAktifId).all<any>(),

    db.prepare(`
      SELECT COALESCE(sp.nama_pelanggaran_snapshot, mp.nama_pelanggaran) AS nama_pelanggaran,
        COALESCE(sp.kategori_snapshot, mp.kategori) AS kategori,
        COALESCE(sp.poin_snapshot, mp.poin, 0) AS poin,
        COUNT(*) as frekuensi, SUM(COALESCE(sp.poin_snapshot, mp.poin, 0)) as total_beban
      FROM siswa_pelanggaran sp
      JOIN master_pelanggaran mp ON sp.master_pelanggaran_id = mp.id
      WHERE sp.tahun_ajaran_id = ?
      GROUP BY COALESCE(sp.nama_pelanggaran_snapshot, mp.nama_pelanggaran), COALESCE(sp.kategori_snapshot, mp.kategori), COALESCE(sp.poin_snapshot, mp.poin, 0) ORDER BY frekuensi DESC LIMIT 10
    `).bind(taAktifId).all<any>(),

    // Poin seumur hidup siswa (tidak difilter per TA)
    db.prepare(`
      SELECT s.id, s.nama_lengkap, k.tingkat, k.nomor_kelas, k.kelompok,
        COUNT(sp.id) as jumlah_kasus, SUM(COALESCE(sp.poin_snapshot, mp.poin, 0)) as total_poin
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
        SUM(COALESCE(sp.poin_snapshot, mp.poin, 0)) as total_poin
      FROM siswa_pelanggaran sp
      JOIN siswa s ON sp.siswa_id = s.id
      LEFT JOIN kelas k ON s.kelas_id = k.id
      JOIN master_pelanggaran mp ON sp.master_pelanggaran_id = mp.id
      WHERE sp.tahun_ajaran_id = ?
      GROUP BY s.kelas_id ORDER BY total_poin DESC
    `).bind(taAktifId).all<any>(),

    loadSanksiList(db),
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
    perBulan: (perBulanRes.results ?? []).filter((row: any) => typeof row.bulan === 'string' && row.bulan.includes('-')),
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
export async function getSanksiList(): Promise<SanksiConfig[]> {
  const db = await getDB()
  return loadSanksiList(db)
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
  const db = await getDB()
  const sanksiList = await loadSanksiList(db)
  return {
    threshold_perhatian:  sanksiList[0]?.poin_minimal ?? 25,
    threshold_peringatan: sanksiList[1]?.poin_minimal ?? 50,
    threshold_kritis:     sanksiList[2]?.poin_minimal ?? 75,
    credit_score_awal:    100,
  }
}
