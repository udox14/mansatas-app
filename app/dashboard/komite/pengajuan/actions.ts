'use server'

import { revalidatePath } from 'next/cache'
import { getDB } from '@/utils/db-server'
import { getSession } from '@/utils/auth/server'
import { checkFeatureAccess, getUserRoles } from '@/lib/features'
import {
  KOMITE_FEATURE_ID, KOMITE_STAGE_ROLE, KOMITE_VERIFIER_KEY, KOMITE_CHAIRMAN_KEY,
  komiteConfiguredUser, komiteChairman,
  canReviewKomite, canSubmitKomite, canViewKomitePengajuan, ensureKomitePengajuanSchema, stageForStatus,
  komiteReviewNotificationPlans,
  komiteNextReviewStatus,
  type KomiteReviewAction,
} from '@/lib/komite-pengajuan'
import { deleteKomiteObjects, uploadKomitePdfs } from '@/utils/r2'
import { logActivity } from '@/lib/activity-log'
import { emitConfiguredNotification, type NotificationContext, type NotificationQueueMessage } from '@/lib/notification-engine'
import { formatRupiah } from '@/lib/utils'

const PAGE_PATH = '/dashboard/komite/pengajuan'
const MAX_DETAIL_ROWS = 10

const KOMITE_STAGE_LABEL: Record<string, string> = {
  bendahara: 'Bendahara Komite',
  ketua: 'Verifikator',
  kepala: 'Kepala Madrasah',
}

function komiteNotificationContext(row: any, extra: NotificationContext = {}): NotificationContext {
  return {
    judul_pengajuan: row.judul || '',
    nominal: formatRupiah(Number(row.nominal || 0)),
    nama_pengaju: row.pengaju_name || '',
    nama_reviewer: '',
    tahap: '',
    catatan: '-',
    nomor_spb: row.nomor_spb || '-',
    ...extra,
  }
}

async function sendKomiteNotification(
  db: D1Database,
  input: {
    eventKey: string
    sourceRef: string
    context: NotificationContext
    targetOverride?: { kind: 'staff_users' }
    validation?: NotificationQueueMessage['validation']
  },
) {
  try {
    const result = await emitConfiguredNotification({ ...input, db })
    if (result.status === 'failed') {
      console.error(`[notification] ${input.eventKey} gagal:`, result.error)
    }
    return result
  } catch (error) {
    console.error(`[notification] ${input.eventKey} gagal:`, error)
    return null
  }
}

type RincianInput = {
  id: string
  urutan: number
  uraian: string
  penerima_penyedia: string
  jumlah: number
}

async function requireContext() {
  const session = await getSession()
  if (!session?.user) throw new Error('Unauthorized')
  const db = await getDB()
  await ensureKomitePengajuanSchema(db)
  if (!(await checkFeatureAccess(db, session.user.id, KOMITE_FEATURE_ID))) throw new Error('Forbidden')
  const roles = await getUserRoles(db, session.user.id)
  return { db, user: session.user, roles }
}

function cleanText(value: FormDataEntryValue | null, max: number) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max)
}

function cleanMultiline(value: FormDataEntryValue | null, max: number) {
  return String(value || '').trim().replace(/\r\n/g, '\n').slice(0, max)
}

function parseNominal(value: FormDataEntryValue | null) {
  const parsed = Number(String(value || '').replace(/[^0-9]/g, ''))
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0
}

function defaultTahunAnggaran() {
  const year = new Date().getFullYear()
  return `${year}/${year + 1}`
}

const BULAN_ROMAWI = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']

async function generateNextNomorSpb(db: D1Database, dateInput?: Date | string): Promise<string> {
  const d = dateInput ? new Date(dateInput) : new Date()
  const year = d.getFullYear()
  const monthIndex = d.getMonth() + 1
  const monthRomawi = BULAN_ROMAWI[monthIndex] || String(monthIndex)

  const existing = await db.prepare(
    `SELECT nomor_spb FROM komite_pengajuan WHERE nomor_spb IS NOT NULL AND nomor_spb <> ''`
  ).all<{ nomor_spb: string }>()

  let maxNum = 0
  const rows = existing.results || []
  for (const row of rows) {
    const raw = String(row.nomor_spb || '')
    const match = raw.match(/SPB\s*\/\s*(\d+)/i) || raw.match(/(\d+)/)
    if (match && match[1]) {
      const num = parseInt(match[1], 10)
      if (!isNaN(num) && num > maxNum) {
        maxNum = num
      }
    }
  }

  let nextSeq = Math.max(maxNum + 1, rows.length + 1, 3)
  while (true) {
    const seqPadded = String(nextSeq).padStart(3, '0')
    const candidate = `SPB / ${seqPadded} / KOMITE / ${monthRomawi} / ${year}`
    const duplicate = await db.prepare(
      `SELECT id FROM komite_pengajuan WHERE nomor_spb = ? COLLATE NOCASE LIMIT 1`
    ).bind(candidate).first()

    if (!duplicate) {
      return candidate
    }
    nextSeq++
  }
}

function formFiles(formData: FormData) {
  return formData.getAll('files').filter((entry): entry is File => entry instanceof File && entry.size > 0)
}

function parseRincian(formData: FormData, fallback: { uraian: string; penerima?: string | null; nominal?: number }) {
  const uraianRows = formData.getAll('detail_uraian')
  const penerimaRows = formData.getAll('detail_penerima_penyedia')
  const jumlahRows = formData.getAll('detail_jumlah')
  const rows: RincianInput[] = []

  for (let index = 0; index < Math.min(uraianRows.length, MAX_DETAIL_ROWS); index += 1) {
    const uraian = cleanText(uraianRows[index], 240)
    const penerima = cleanText(penerimaRows[index] || '', 180)
    const jumlah = parseNominal(jumlahRows[index] || null)
    if (!uraian && !penerima && !jumlah) continue
    if (!uraian || !penerima || !jumlah) return { error: 'Setiap baris rincian harus berisi uraian, penerima/penyedia, dan jumlah.' }
    rows.push({ id: crypto.randomUUID(), urutan: rows.length + 1, uraian, penerima_penyedia: penerima, jumlah })
  }

  if (!rows.length && fallback.nominal) {
    rows.push({
      id: crypto.randomUUID(),
      urutan: 1,
      uraian: fallback.uraian || 'Pembayaran/pengadaan',
      penerima_penyedia: fallback.penerima || '-',
      jumlah: fallback.nominal,
    })
  }
  if (!rows.length) return { error: 'Minimal satu rincian pembayaran wajib diisi.' }
  return { rows, total: rows.reduce((sum, row) => sum + row.jumlah, 0) }
}

function detailStatements(db: D1Database, pengajuanId: string, rows: RincianInput[], reviewId?: string) {
  const guard = reviewId ? ' AND EXISTS (SELECT 1 FROM komite_pengajuan_reviews WHERE id=?)' : ''
  return [
    db.prepare(`DELETE FROM komite_pengajuan_rincian WHERE pengajuan_id=?${guard}`).bind(pengajuanId, ...(reviewId ? [reviewId] : [])),
    ...rows.map(row => db.prepare(`INSERT INTO komite_pengajuan_rincian
      (id,pengajuan_id,urutan,uraian,penerima_penyedia,jumlah) SELECT ?,?,?,?,?,?${reviewId ? ' WHERE EXISTS (SELECT 1 FROM komite_pengajuan_reviews WHERE id=?)' : ''}`)
      .bind(row.id, pengajuanId, row.urutan, row.uraian, row.penerima_penyedia, row.jumlah, ...(reviewId ? [reviewId] : []))),
  ]
}

export async function getKomiteDashboardData() {
  const { db, user, roles } = await requireContext()
  const [rowsResult, reviewedResult] = await Promise.all([
    db.prepare(`
      SELECT p.*, COALESCE(u.nama_lengkap,u.name,u.email) AS pengaju_name,
        COALESCE(d.nama_lengkap,d.name,d.email) AS ketua_delegate_name
      FROM komite_pengajuan p
      JOIN "user" u ON u.id = p.pengaju_id
      LEFT JOIN "user" d ON d.id = p.ketua_delegate_id
      ORDER BY p.updated_at DESC, p.created_at DESC
    `).all<any>(),
    db.prepare('SELECT DISTINCT pengajuan_id FROM komite_pengajuan_reviews WHERE actor_id = ?').bind(user.id).all<{ pengajuan_id: string }>(),
  ])
  const reviewedIds = new Set((reviewedResult.results || []).map(row => row.pengajuan_id))
  const isSuper = roles.includes('super_admin')
  const isMember = roles.includes('anggota_komite')
  const verifier = await komiteConfiguredUser(db, KOMITE_VERIFIER_KEY, 'anggota_komite')
  const chairman = await komiteChairman(db)
  const visible = (rowsResult.results || []).filter(row => {
    if (isSuper || roles.includes('kepsek') || row.pengaju_id === user.id || reviewedIds.has(row.id)) return true
    if (isMember && row.status === 'disetujui') return true
    if (row.status === 'menunggu_ketua' && verifier?.id === user.id) return true
    const stage = stageForStatus(row.status)
    return stage === 'bendahara' && roles.includes('bendahara_komite')
  })

  const ids = visible.map(row => row.id)
  let versions: any[] = []
  let files: any[] = []
  let reviews: any[] = []
  let details: any[] = []
  if (ids.length) {
    const placeholders = ids.map(() => '?').join(',')
    const [versionRows, fileRows, reviewRows, detailRows] = await Promise.all([
      db.prepare(`SELECT * FROM komite_pengajuan_versions WHERE pengajuan_id IN (${placeholders}) ORDER BY version_number DESC`).bind(...ids).all<any>(),
      db.prepare(`SELECT f.id,f.version_id,f.original_filename,f.size_bytes,f.created_at,v.pengajuan_id,v.version_number
        FROM komite_pengajuan_files f JOIN komite_pengajuan_versions v ON v.id=f.version_id
        WHERE v.pengajuan_id IN (${placeholders}) ORDER BY v.version_number DESC,f.created_at`).bind(...ids).all<any>(),
      db.prepare(`SELECT * FROM komite_pengajuan_reviews WHERE pengajuan_id IN (${placeholders}) ORDER BY created_at DESC`).bind(...ids).all<any>(),
      db.prepare(`SELECT * FROM komite_pengajuan_rincian WHERE pengajuan_id IN (${placeholders}) ORDER BY pengajuan_id,urutan`).bind(...ids).all<any>(),
    ])
    versions = versionRows.results || []
    files = fileRows.results || []
    reviews = reviewRows.results || []
    details = detailRows.results || []
  }

  const items = visible.map(row => ({
    ...row,
    tahun_anggaran: row.tahun_anggaran || defaultTahunAnggaran(),
    kode_rkas_program: row.kode_rkas_program || '-',
    rincian: details.filter(detail => detail.pengajuan_id === row.id),
    versions: versions.filter(v => v.pengajuan_id === row.id).map(version => ({
      ...version,
      files: files.filter(file => file.version_id === version.id),
    })),
    reviews: reviews.filter(review => review.pengajuan_id === row.id),
  }))

  let users: any[] = []
  if (isSuper) {
    const userRows = await db.prepare(`
      SELECT u.id,COALESCE(u.nama_lengkap,u.name,u.email) AS name,u.email,u.role,
        GROUP_CONCAT(DISTINCT ur.role) AS roles,
        MAX(CASE WHEN o.action='grant' THEN 1 ELSE 0 END) AS is_named
      FROM "user" u
      LEFT JOIN user_roles ur ON ur.user_id=u.id
      LEFT JOIN user_feature_overrides o ON o.user_id=u.id AND o.feature_id=?
      WHERE COALESCE(u.role,'') != 'orang_tua'
      GROUP BY u.id,u.nama_lengkap,u.name,u.email,u.role
      ORDER BY name
    `).bind(KOMITE_FEATURE_ID).all<any>()
    users = (userRows.results || []).map(row => ({ ...row, roles: String(row.roles || row.role || '').split(',').filter(Boolean) }))
  }

  let committeeMembers: any[] = []
  if (isSuper) {
    const memberRows = await db.prepare(`
      SELECT u.id,COALESCE(u.nama_lengkap,u.name,u.email) AS name,u.email
      FROM "user" u
      LEFT JOIN user_roles ur ON ur.user_id=u.id
      WHERE COALESCE(u.banned,0)=0 AND (u.role='anggota_komite' OR ur.role='anggota_komite')
      GROUP BY u.id,u.nama_lengkap,u.name,u.email
      ORDER BY name
    `).all<any>()
    committeeMembers = memberRows.results || []
  }

  const reviewQueue = items.filter(item => item.status === 'menunggu_bendahara'
    ? isSuper || roles.includes('bendahara_komite')
    : item.status === 'menunggu_ketua' && Boolean(verifier) &&
      (isSuper || (verifier?.id === user.id && item.pengaju_id !== user.id)))
  const chairmanRows = isSuper ? await db.prepare(`SELECT u.id,COALESCE(u.nama_lengkap,u.name,u.email) AS name
    FROM "user" u WHERE COALESCE(u.banned,0)=0 AND (u.role='ketua_komite' OR EXISTS (
      SELECT 1 FROM user_roles ur WHERE ur.user_id=u.id AND ur.role='ketua_komite')) ORDER BY name`).all<any>() : { results: [] }

  const canApproveSpb = isSuper || roles.includes('bendahara_komite')
  const nextNomorSpb = canApproveSpb ? await generateNextNomorSpb(db) : undefined

  return {
    items,
    users,
    committeeMembers,
    currentUserId: user.id,
    roles,
    canCreate: await canSubmitKomite(db, user.id, roles),
    isSuper,
    reviewCount: reviewQueue.length,
    nextNomorSpb,
    verifier, chairman, chairmen: chairmanRows.results || [],
  }
}

export async function saveKomiteDraftAction(formData: FormData) {
  const { db, user, roles } = await requireContext()
  if (!(await canSubmitKomite(db, user.id, roles))) return { error: 'Anda tidak memiliki izin untuk mengajukan.' }
  const id = cleanText(formData.get('id'), 80)
  const judul = cleanText(formData.get('judul'), 180)
  const uraian = cleanMultiline(formData.get('uraian'), 4000)
  const tahunAnggaran = cleanText(formData.get('tahun_anggaran'), 30) || defaultTahunAnggaran()
  const kodeRkasProgram = cleanText(formData.get('kode_rkas_program'), 220) || '-'
  const parsedDetails = parseRincian(formData, { uraian, nominal: parseNominal(formData.get('nominal')) })
  if ('error' in parsedDetails) return { error: parsedDetails.error }
  const nominal = parsedDetails.total
  const files = formFiles(formData)
  if (!judul || !uraian || !nominal) return { error: 'Judul, uraian, dan rincian pembayaran wajib diisi.' }

  const existing = id ? await db.prepare('SELECT * FROM komite_pengajuan WHERE id=?').bind(id).first<any>() : null
  if (id && (!existing || existing.pengaju_id !== user.id || !['draft','perlu_revisi'].includes(existing.status))) {
    return { error: 'Draft tidak ditemukan atau tidak dapat diubah.' }
  }

  const pengajuanId = existing?.id || crypto.randomUUID()
  let versionNumber = Number(existing?.current_version || 1)
  let version = existing ? await db.prepare(`SELECT * FROM komite_pengajuan_versions WHERE pengajuan_id=? AND version_number=?`)
    .bind(pengajuanId, versionNumber).first<any>() : null
  if (existing?.status === 'perlu_revisi' && version?.submitted_at) {
    versionNumber += 1
    version = null
  }
  const versionId = version?.id || crypto.randomUUID()
  if (!existing && files.length === 0) return { error: 'Pilih minimal satu dokumen PDF.' }
  if (!version && files.length === 0) return { error: 'Versi revisi harus memiliki dokumen PDF.' }

  let uploaded: Awaited<ReturnType<typeof uploadKomitePdfs>> | null = null
  if (files.length) {
    uploaded = await uploadKomitePdfs(files, pengajuanId, versionId)
    if (uploaded.error) return { error: uploaded.error }
  }

  const oldFileRows = version && files.length
    ? await db.prepare('SELECT r2_key FROM komite_pengajuan_files WHERE version_id=?').bind(versionId).all<{ r2_key: string }>()
    : { results: [] as { r2_key: string }[] }

  try {
    const statements = []
    if (!existing) {
      statements.push(db.prepare(`INSERT INTO komite_pengajuan
        (id,judul,uraian,nominal,pengaju_id,status,current_version,tahun_anggaran,kode_rkas_program,workflow_version)
        VALUES (?,?,?,?,?,'draft',?,?,?,2)`)
        .bind(pengajuanId, judul, uraian, nominal, user.id, versionNumber, tahunAnggaran, kodeRkasProgram))
    } else {
      statements.push(db.prepare(`UPDATE komite_pengajuan
        SET judul=?,uraian=?,nominal=?,tahun_anggaran=?,kode_rkas_program=?,current_version=?,updated_at=datetime('now')
        WHERE id=?`)
        .bind(judul, uraian, nominal, tahunAnggaran, kodeRkasProgram, versionNumber, pengajuanId))
    }
    statements.push(...detailStatements(db, pengajuanId, parsedDetails.rows))
    if (!version) statements.push(db.prepare(`INSERT INTO komite_pengajuan_versions (id,pengajuan_id,version_number,created_by) VALUES (?,?,?,?)`)
      .bind(versionId, pengajuanId, versionNumber, user.id))
    if (uploaded?.files.length) {
      if (version) statements.push(db.prepare('DELETE FROM komite_pengajuan_files WHERE version_id=?').bind(versionId))
      for (const file of uploaded.files) statements.push(db.prepare(`INSERT INTO komite_pengajuan_files (id,version_id,original_filename,r2_key,size_bytes,mime_type) VALUES (?,?,?,?,?,?)`)
        .bind(file.id, versionId, file.originalFilename, file.r2Key, file.sizeBytes, file.mimeType))
    }
    await db.batch(statements)
  } catch (error: any) {
    if (uploaded?.files.length) await deleteKomiteObjects(uploaded.files.map(file => file.r2Key))
    return { error: error?.message || 'Gagal menyimpan draft.' }
  }
  await deleteKomiteObjects((oldFileRows.results || []).map(row => row.r2_key))
  await logActivity({ db, module: 'komite_pengajuan', action: existing ? 'update_draft' : 'create_draft', summary: `${existing ? 'Mengubah' : 'Membuat'} draft pengajuan ${judul}`, entityType: 'komite_pengajuan', entityId: pengajuanId, entityLabel: judul })
  revalidatePath(PAGE_PATH)
  return { success: 'Draft berhasil disimpan.', id: pengajuanId }
}

export async function submitKomiteAction(id: string) {
  const { db, user } = await requireContext()
  const row = await db.prepare(`
    SELECT p.*, COALESCE(up.nama_lengkap,up.name,up.email) AS pengaju_name
    FROM komite_pengajuan p
    JOIN "user" up ON up.id=p.pengaju_id
    WHERE p.id=?
  `).bind(id).first<any>()
  if (!row || row.pengaju_id !== user.id || !['draft','perlu_revisi'].includes(row.status)) return { error: 'Pengajuan tidak dapat dikirim.' }
  const version = await db.prepare(`SELECT v.id,(SELECT COUNT(*) FROM komite_pengajuan_files f WHERE f.version_id=v.id) AS file_count,
      (SELECT COUNT(*) FROM komite_pengajuan_rincian r WHERE r.pengajuan_id=?) AS detail_count
    FROM komite_pengajuan_versions v WHERE v.pengajuan_id=? AND v.version_number=?`).bind(id, id, row.current_version).first<any>()
  if (!version || Number(version.file_count) < 1) return { error: 'Dokumen versi aktif belum tersedia.' }
  if (Number(version.detail_count) < 1) return { error: 'Rincian pembayaran belum tersedia.' }
  await db.batch([
    db.prepare(`UPDATE komite_pengajuan SET status='menunggu_bendahara',submitted_at=COALESCE(submitted_at,datetime('now')),updated_at=datetime('now') WHERE id=?`).bind(id),
    db.prepare(`UPDATE komite_pengajuan_versions SET submitted_at=datetime('now') WHERE id=?`).bind(version.id),
  ])
  await logActivity({ db, module: 'komite_pengajuan', action: 'submit', summary: `Mengirim pengajuan ${row.judul} ke Bendahara Komite`, entityType: 'komite_pengajuan', entityId: id, entityLabel: row.judul })
  await sendKomiteNotification(db, {
    eventKey: 'komite_submission_received',
    sourceRef: `komite:${id}:submitted:${row.current_version}`,
    context: komiteNotificationContext(row, {
      nama_pengaju: user.nama_lengkap || user.name || '',
    }),
  })
  revalidatePath(PAGE_PATH)
  return { success: 'Pengajuan dikirim ke Bendahara Komite.' }
}

export async function deleteKomiteDraftAction(id: string) {
  const { db, user } = await requireContext()
  const row = await db.prepare('SELECT * FROM komite_pengajuan WHERE id=?').bind(id).first<any>()
  if (!row || row.pengaju_id !== user.id || (row.status !== 'draft' || row.submitted_at)) return { error: 'Hanya draft sendiri yang belum dikirim dapat dihapus.' }
  const keys = await db.prepare(`SELECT f.r2_key FROM komite_pengajuan_files f JOIN komite_pengajuan_versions v ON v.id=f.version_id WHERE v.pengajuan_id=?`).bind(id).all<{ r2_key: string }>()
  const deleted = await db.prepare(`DELETE FROM komite_pengajuan WHERE id=? AND status='draft' AND submitted_at IS NULL`).bind(id).run()
  if (!deleted.meta.changes) return { error: 'Draft sudah berubah; muat ulang halaman.' }
  await deleteKomiteObjects((keys.results || []).map(item => item.r2_key))
  await logActivity({ db, module: 'komite_pengajuan', action: 'delete_draft', severity: 'warning', summary: `Menghapus draft pengajuan ${row.judul}`, entityType: 'komite_pengajuan', entityId: id, entityLabel: row.judul })
  revalidatePath(PAGE_PATH)
  return { success: 'Draft dihapus.' }
}

export async function deleteKomiteAction(id: string) {
  const { db, roles } = await requireContext()
  if (!roles.includes('super_admin')) return { error: 'Hanya Super Admin yang dapat menghapus pengajuan.' }
  const row = await db.prepare('SELECT * FROM komite_pengajuan WHERE id=?').bind(id).first<any>()
  if (!row) return { error: 'Pengajuan tidak ditemukan.' }
  if (row.status !== 'draft' || row.submitted_at) return { error: 'Pengajuan yang sudah dikirim tidak dapat dihapus.' }
  const keys = await db.prepare(`SELECT f.r2_key FROM komite_pengajuan_files f
    JOIN komite_pengajuan_versions v ON v.id=f.version_id WHERE v.pengajuan_id=?`).bind(id).all<{ r2_key: string }>()
  try {
    const deleted = await db.prepare(`DELETE FROM komite_pengajuan WHERE id=? AND status='draft' AND submitted_at IS NULL`).bind(id).run()
    if (!deleted.meta.changes) return { error: 'Draft sudah berubah; muat ulang halaman.' }
    await deleteKomiteObjects((keys.results || []).map(item => item.r2_key))
  } catch (error: any) {
    return { error: error?.message || 'Gagal menghapus pengajuan.' }
  }
  await logActivity({ db, module: 'komite_pengajuan', action: 'delete_by_super_admin', severity: 'warning', summary: `Menghapus pengajuan ${row.judul}`, entityType: 'komite_pengajuan', entityId: id, entityLabel: row.judul, metadata: { status: row.status, nomorSpb: row.nomor_spb, testingCleanup: true } })
  revalidatePath(PAGE_PATH)
  return { success: 'Pengajuan dan seluruh dokumennya berhasil dihapus.' }
}

export async function reviewKomiteAction(formData: FormData) {
  const { db, user, roles } = await requireContext()
  const id = cleanText(formData.get('id'), 80)
  const action = cleanText(formData.get('action'), 30) as KomiteReviewAction
  const catatan = cleanMultiline(formData.get('catatan'), 3000)
  if (!['setujui','minta_revisi','tolak'].includes(action)) return { error: 'Aksi review tidak valid.' }
  if (action !== 'setujui' && !catatan) return { error: 'Catatan wajib diisi untuk revisi atau penolakan.' }
  if (action === 'tolak' && formData.get('reject_confirmation') !== 'TOLAK') return { error: 'Ketik TOLAK untuk mengonfirmasi penolakan.' }
  const row = await db.prepare(`
    SELECT p.*, COALESCE(up.nama_lengkap,up.name,up.email) AS pengaju_name
    FROM komite_pengajuan p
    JOIN "user" up ON up.id=p.pengaju_id
    WHERE p.id=?
  `).bind(id).first<any>()
  if (!row) return { error: 'Pengajuan tidak ditemukan.' }
  const permission = await canReviewKomite(db, user.id, row, roles)
  if (!permission.allowed || !permission.stage) return { error: 'Anda tidak berwenang memproses tahap ini.' }

  let nomorSpb = row.nomor_spb
  let penerima = row.penerima_pembayaran
  let tahunAnggaran = row.tahun_anggaran || defaultTahunAnggaran()
  let kodeRkasProgram = row.kode_rkas_program || '-'
  let detailRows: RincianInput[] | null = null
  let nominal = Number(row.nominal || 0)
  if (permission.stage === 'bendahara' && action === 'setujui') {
    nomorSpb = cleanText(formData.get('nomor_spb'), 100)
    if (!nomorSpb) {
      nomorSpb = await generateNextNomorSpb(db)
    }
    penerima = cleanText(formData.get('penerima_pembayaran'), 180)
    tahunAnggaran = cleanText(formData.get('tahun_anggaran'), 30) || defaultTahunAnggaran()
    kodeRkasProgram = cleanText(formData.get('kode_rkas_program'), 220) || '-'
    const parsedDetails = parseRincian(formData, { uraian: row.uraian, penerima, nominal: row.nominal })
    if ('error' in parsedDetails) return { error: parsedDetails.error }
    detailRows = parsedDetails.rows
    nominal = parsedDetails.total
    if (!nomorSpb || !penerima) return { error: 'Nomor SPB dan penerima pembayaran wajib diisi.' }
    const duplicate = await db.prepare('SELECT id FROM komite_pengajuan WHERE nomor_spb=? COLLATE NOCASE AND id<>? LIMIT 1').bind(nomorSpb, id).first()
    if (duplicate) return { error: 'Nomor SPB sudah digunakan pengajuan lain.' }
  }

  const actor = await db.prepare('SELECT COALESCE(nama_lengkap,name,email) AS name,signature_url FROM "user" WHERE id=?').bind(user.id).first<any>()
  const verifier = await komiteConfiguredUser(db, KOMITE_VERIFIER_KEY, 'anggota_komite')
  const chairman = permission.stage === 'ketua' && action === 'setujui' ? await komiteChairman(db) : null
  if (permission.stage === 'ketua' && (!verifier || (!permission.bypass && verifier.id !== user.id))) return { error: 'Verifikator belum diatur atau tidak aktif.' }
  if (permission.stage === 'ketua' && action === 'setujui' && !chairman) return { error: 'Ketua Komite untuk SPB belum ditentukan. Hubungi Super Admin.' }
  const nextStatus = komiteNextReviewStatus(permission.stage, action)
  const actorRole = permission.bypass
    ? 'super_admin'
    : permission.stage === 'ketua' ? 'anggota_komite' : KOMITE_STAGE_ROLE[permission.stage]
  const reviewId = crypto.randomUUID()
  try {
    const statements = [
      db.prepare(`INSERT INTO komite_pengajuan_reviews
        (id,pengajuan_id,version_number,stage,action,catatan,actor_id,actor_name,actor_role,actor_signature_url,is_super_admin_bypass,nomor_spb_snapshot,penerima_snapshot,workflow_version)
        SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,2 WHERE EXISTS (
          SELECT 1 FROM komite_pengajuan WHERE id=? AND status=? AND current_version=? AND updated_at=? AND ketua_delegate_id IS ? AND workflow_version=2)
          AND (?='bendahara' OR EXISTS (SELECT 1 FROM system_settings s JOIN "user" u ON u.id=s.value
            WHERE s.key=? AND s.value=? AND COALESCE(u.banned,0)=0 AND (u.role='anggota_komite' OR EXISTS (
              SELECT 1 FROM user_roles ur WHERE ur.user_id=u.id AND ur.role='anggota_komite'))))`)
        .bind(reviewId,id,row.current_version,permission.stage,action,catatan || null,user.id,actor?.name || user.name,actorRole,actor?.signature_url || null,permission.bypass ? 1 : 0,nomorSpb || null,penerima || null,
          id,row.status,row.current_version,row.updated_at,row.ketua_delegate_id || null,permission.stage,KOMITE_VERIFIER_KEY,verifier?.id || ''),
      db.prepare(`UPDATE komite_pengajuan SET status=?,nomor_spb=?,penerima_pembayaran=?,nominal=?,tahun_anggaran=?,kode_rkas_program=?,
        ketua_delegate_id=CASE WHEN ?='bendahara' AND ?='setujui' THEN NULL ELSE ketua_delegate_id END,
        ketua_delegated_by=CASE WHEN ?='bendahara' AND ?='setujui' THEN NULL ELSE ketua_delegated_by END,
        ketua_delegated_at=CASE WHEN ?='bendahara' AND ?='setujui' THEN NULL ELSE ketua_delegated_at END,
        approved_at=CASE WHEN ?='disetujui' THEN datetime('now') ELSE approved_at END,
        final_approval_stage=CASE WHEN ?='disetujui' THEN ? ELSE final_approval_stage END,
        rejected_at=CASE WHEN ?='ditolak' THEN datetime('now') ELSE rejected_at END,
        chairman_id_snapshot=COALESCE(?,chairman_id_snapshot),chairman_name_snapshot=COALESCE(?,chairman_name_snapshot),
        updated_at=datetime('now') WHERE id=? AND status=? AND EXISTS (SELECT 1 FROM komite_pengajuan_reviews WHERE id=?)`)
        .bind(nextStatus,nomorSpb || null,penerima || null,nominal,tahunAnggaran,kodeRkasProgram,
          permission.stage,action,permission.stage,action,permission.stage,action,nextStatus,nextStatus,permission.stage,nextStatus,chairman?.id || null,chairman?.name || null,id,row.status,reviewId),
    ]
    if (detailRows) statements.push(...detailStatements(db, id, detailRows, reviewId))
    const results = await db.batch(statements)
    if (!results[0].meta.changes || !results[1].meta.changes) return { error: 'Pengajuan sudah berubah atau tahap ini sudah diproses. Muat ulang halaman.' }
  } catch (error: any) {
    if (error?.message?.includes('UNIQUE')) {
      const latest = await db.prepare('SELECT status FROM komite_pengajuan WHERE id=?').bind(id).first<{ status: string }>()
      return { error: latest?.status !== row.status ? 'Tahap ini sudah diproses pengguna lain.' : 'Nomor SPB sudah digunakan atau tahap ini sudah pernah diproses.' }
    }
    return { error: error?.message || 'Gagal menyimpan review.' }
  }
  await logActivity({ db, module: 'komite_pengajuan', action: `review_${action}`, severity: action === 'tolak' ? 'warning' : 'info', summary: `${action === 'setujui' ? 'Menyetujui' : action === 'minta_revisi' ? 'Meminta revisi' : 'Menolak'} pengajuan ${row.judul} pada tahap ${KOMITE_STAGE_LABEL[permission.stage]}`, entityType: 'komite_pengajuan', entityId: id, entityLabel: row.judul, metadata: { stage: permission.stage, bypass: permission.bypass, version: row.current_version, workflowVersion: 2, effectiveStage: permission.stage === 'ketua' ? 'verifikator' : permission.stage, nextStatus } })

  const commonContext = komiteNotificationContext({ ...row, nomor_spb: nomorSpb, nominal }, {
    userId: row.pengaju_id,
    userIds: [row.pengaju_id],
    nama_reviewer: actor?.name || user.name || '',
    tahap: KOMITE_STAGE_LABEL[permission.stage] || permission.stage,
    catatan: catatan || '-',
    nomor_spb: nomorSpb || '-',
  })
  const notifyApplicant = (eventKey: string, suffix: string) => sendKomiteNotification(db, {
    eventKey,
    sourceRef: `komite:${id}:review:${row.current_version}:${permission.stage}:${suffix}:applicant`,
    context: commonContext,
  })
  const reviewerContext = { ...commonContext }
  delete reviewerContext.userId
  delete reviewerContext.userIds
  const notifyNextReviewer = async (eventKey: string, suffix: string) => sendKomiteNotification(db, {
    eventKey,
    sourceRef: `komite:${id}:review:${row.current_version}:${permission.stage}:${suffix}:reviewer`,
    context: { ...reviewerContext, userIds: verifier && verifier.id !== row.pengaju_id ? [verifier.id] : [] },
    targetOverride: { kind: 'staff_users' },
    validation: { kind: 'komite_review_request',pengajuanId:id,version:row.current_version,status:nextStatus,
      sourceUpdatedAt: (await db.prepare('SELECT updated_at FROM komite_pengajuan WHERE id=?').bind(id).first<{ updated_at: string }>())!.updated_at,
      delegateId:null,slot:'' },
  })

  for (const plan of komiteReviewNotificationPlans(permission.stage, action)) {
    if (plan.recipient === 'applicant') await notifyApplicant(plan.eventKey, plan.suffix)
    else await notifyNextReviewer(plan.eventKey, plan.suffix)
  }
  revalidatePath(PAGE_PATH)
  return { success: nextStatus === 'disetujui' ? 'Pengajuan disetujui dan SPB telah terbit.' : 'Review berhasil disimpan.' }
}

export async function setKomiteReviewerSettingAction(kind: 'verifier' | 'chairman', userId: string) {
  const { db, user, roles } = await requireContext()
  if (!roles.includes('super_admin')) return { error: 'Hanya Super Admin yang dapat mengubah pengaturan.' }
  if (!['verifier','chairman'].includes(kind) || typeof userId !== 'string') return { error: 'Pengaturan tidak valid.' }
  const role = kind === 'verifier' ? 'anggota_komite' : 'ketua_komite'
  const target = await db.prepare(`SELECT u.id,COALESCE(u.nama_lengkap,u.name,u.email) AS name FROM "user" u
    WHERE u.id=? AND COALESCE(u.banned,0)=0 AND (u.role=? OR EXISTS (
      SELECT 1 FROM user_roles ur WHERE ur.user_id=u.id AND ur.role=?))`).bind(userId,role,role).first<{ id: string; name: string }>()
  if (!target) return { error: 'Pilih akun aktif dengan peran yang sesuai.' }
  const key = kind === 'verifier' ? KOMITE_VERIFIER_KEY : KOMITE_CHAIRMAN_KEY
  await db.batch([
    db.prepare(`INSERT INTO activity_logs (id,actor_user_id,module,action,summary,entity_type,entity_id,before_json,after_json)
      VALUES (?,?,'komite_pengajuan','configure_reviewer',?,'system_setting',?,
        (SELECT json_object('user_id',value) FROM system_settings WHERE key=?),?)`)
      .bind(crypto.randomUUID(),user.id,`Mengatur ${kind === 'verifier' ? 'Verifikator' : 'Ketua SPB'}: ${target.name}`,key,key,JSON.stringify({ user_id: target.id, name: target.name })),
    db.prepare(`INSERT INTO system_settings (key,value,updated_at) VALUES (?,?,strftime('%Y-%m-%d %H:%M:%f','now'))
      ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at`).bind(key,target.id),
  ])
  revalidatePath(PAGE_PATH)
  return { success: 'Pengaturan berhasil disimpan.' }
}

export async function setKomiteActivityReportAction(id: string, received: boolean, revision: number) {
  const { db, user, roles } = await requireContext()
  if (!roles.some(role => ['super_admin','bendahara_komite'].includes(role))) return { error: 'Anda tidak berwenang menandai laporan.' }
  if (typeof received !== 'boolean' || !Number.isSafeInteger(revision) || revision < 0) return { error: 'Data laporan tidak valid.' }
  const row = await db.prepare('SELECT * FROM komite_pengajuan WHERE id=?').bind(id).first<any>()
  if (!row || row.status !== 'disetujui') return { error: 'Laporan hanya dapat ditandai pada pengajuan disetujui.' }
  if (!(await canViewKomitePengajuan(db,user.id,row,roles))) return { error: 'Anda tidak berhak melihat pengajuan ini.' }
  if (row.laporan_revision !== revision) return { error: 'Status laporan sudah berubah. Muat ulang halaman.' }
  if (Boolean(row.laporan_received_at) === received) return { success: 'Status laporan sudah sesuai.' }
  const actor = await db.prepare('SELECT COALESCE(nama_lengkap,name,email) AS name FROM "user" WHERE id=?').bind(user.id).first<{ name: string }>()
  const logId = crypto.randomUUID()
  const results = await db.batch([
    db.prepare(`INSERT INTO activity_logs (id,actor_user_id,actor_name,module,action,summary,entity_type,entity_id,before_json,after_json)
      SELECT ?,?,?,'komite_pengajuan','activity_report',?,'komite_pengajuan',id,
        json_object('received_at',laporan_received_at,'received_by',laporan_received_by),?
      FROM komite_pengajuan WHERE id=? AND status='disetujui' AND laporan_revision=?`)
      .bind(logId,user.id,actor?.name || user.name,received ? 'Menerima laporan kegiatan' : 'Membatalkan tanda laporan diterima',
        JSON.stringify({ received, actor: user.id }),id,revision),
    db.prepare(`UPDATE komite_pengajuan SET laporan_received_at=CASE WHEN ? THEN datetime('now') ELSE NULL END,
      laporan_received_by=?,laporan_received_name=?,laporan_revision=laporan_revision+1
      WHERE id=? AND status='disetujui' AND laporan_revision=? AND EXISTS (SELECT 1 FROM activity_logs WHERE id=?)`)
      .bind(received ? 1 : 0,received ? user.id : null,received ? actor?.name || user.name : null,id,revision,logId),
  ])
  if (!results[1].meta.changes) return { error: 'Status laporan sudah berubah. Muat ulang halaman.' }
  revalidatePath(PAGE_PATH)
  return { success: received ? 'Laporan kegiatan ditandai sudah diterima.' : 'Tanda laporan diterima dibatalkan.' }
}

export async function setNamedKomiteSubmitterAction(userId: string, enabled: boolean) {
  const { db, user, roles } = await requireContext()
  if (!roles.includes('super_admin')) return { error: 'Hanya Super Admin yang dapat mengubah pengaju khusus.' }
  const target = await db.prepare('SELECT id,COALESCE(nama_lengkap,name,email) AS name FROM "user" WHERE id=?').bind(userId).first<any>()
  if (!target) return { error: 'Pengguna tidak ditemukan.' }
  if (enabled) {
    await db.prepare(`INSERT INTO user_feature_overrides (user_id,feature_id,action) VALUES (?,?,'grant')
      ON CONFLICT(user_id,feature_id) DO UPDATE SET action='grant'`).bind(userId,KOMITE_FEATURE_ID).run()
  } else {
    await db.prepare(`DELETE FROM user_feature_overrides WHERE user_id=? AND feature_id=? AND action='grant'`).bind(userId,KOMITE_FEATURE_ID).run()
  }
  await logActivity({ db, module: 'komite_pengajuan', action: enabled ? 'grant_submitter' : 'revoke_submitter', summary: `${enabled ? 'Memberi' : 'Mencabut'} izin pengajuan khusus untuk ${target.name}`, entityType: 'user', entityId: userId, entityLabel: target.name, metadata: { changedBy: user.id } })
  revalidatePath(PAGE_PATH)
  return { success: enabled ? 'Pengguna ditambahkan sebagai pengaju.' : 'Izin pengaju khusus dicabut.' }
}
