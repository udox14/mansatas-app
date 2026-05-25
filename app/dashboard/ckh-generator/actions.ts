'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { checkFeatureAccess, getUserRoles } from '@/lib/features'
import {
  CKH_DEFAULT_SATUAN,
  CKH_DEFAULT_VOL,
  CKH_TEACHING_ACTIVITY,
  CKH_OTHER_DUTY_ACTIVITY,
  buildTeachingRows,
  countCkhItems,
  getCkhEffectiveDates,
  monthRange,
  normalizeCkhText,
  normalizeCkhSatuan,
  type CkhGeneratedRow,
  type CkhTemplate,
  type CkhTemplateNote,
} from '@/lib/ckh'
import { findTeachingBlockException, getKbmExceptionsForRange } from '@/lib/kalender-pendidikan'

type CkhUser = {
  id: string
  nama_lengkap: string
  role: string
  signature_url: string | null
  nip: string | null
  pangkat_golongan: string | null
  jabatan_cetak: string | null
}

type CkhDocument = {
  id: string
  user_id: string
  year: number
  month: number
  status: string
  signature_enabled: number
  signature_x_mm: number
  signature_y_mm: number
  signature_width_mm: number
}

type CkhRow = {
  id: string
  document_id: string
  tanggal: string
  row_order: number
  kegiatan_bulanan: string
  catatan_harian: string
  vol: number
  satuan: string
  source: string
  source_key: string | null
  is_manual: number
  has_conflict: number
  suggested_kegiatan_bulanan: string | null
  suggested_catatan_harian: string | null
}

type CkhKepsek = {
  id: string
  nama_lengkap: string
  nip: string | null
  jabatan_cetak: string | null
}

type CkhSigner = CkhKepsek

function assertMonth(year: number, month: number) {
  if (!Number.isInteger(year) || year < 2020 || year > 2100) throw new Error('Tahun tidak valid.')
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new Error('Bulan tidak valid.')
}

function cleanNullable(value: FormDataEntryValue | null) {
  const text = normalizeCkhText(String(value || ''))
  return text || null
}

function cleanCkhMultiline(value: string | null | undefined) {
  return String(value || '')
    .split(/\r?\n/)
    .map(item => normalizeCkhText(item))
    .filter(Boolean)
    .join('\n')
}

function cleanCkhVolume(value: unknown, fallbackText: string) {
  const vol = Number(value)
  if (Number.isFinite(vol) && vol > 0) return Math.floor(vol)
  return countCkhItems(fallbackText)
}

function getPrimaryRoleFromRows(userRoleRows: string[], fallback: string) {
  return userRoleRows[0] || fallback || 'guru'
}

async function requireCkhAccess(db: D1Database, userId: string) {
  const allowed = await checkFeatureAccess(db, userId, 'ckh-generator')
  if (!allowed) throw new Error('Anda tidak memiliki akses CKH Generator.')
}

async function getFreshUser(db: D1Database, userId: string): Promise<CkhUser> {
  const user = await db.prepare(`
    SELECT id, COALESCE(nama_lengkap, name) as nama_lengkap, role, signature_url, nip, pangkat_golongan, jabatan_cetak
    FROM "user"
    WHERE id = ?
  `).bind(userId).first<CkhUser>()
  if (!user) throw new Error('Data user tidak ditemukan.')
  return user
}

async function getOrCreateDocument(db: D1Database, userId: string, year: number, month: number) {
  let doc = await db.prepare(`
    SELECT id, user_id, year, month, status
         , signature_enabled, signature_x_mm, signature_y_mm, signature_width_mm
    FROM ckh_documents
    WHERE user_id = ? AND year = ? AND month = ?
  `).bind(userId, year, month).first<CkhDocument>()

  if (!doc) {
    doc = await db.prepare(`
      INSERT INTO ckh_documents (user_id, year, month)
      VALUES (?, ?, ?)
      RETURNING id, user_id, year, month, status, signature_enabled, signature_x_mm, signature_y_mm, signature_width_mm
    `).bind(userId, year, month).first<CkhDocument>()
  }

  if (!doc) throw new Error('Gagal membuat dokumen CKH.')
  return doc
}

async function getRows(db: D1Database, documentId: string) {
  const result = await db.prepare(`
    SELECT *
    FROM ckh_rows
    WHERE document_id = ?
    ORDER BY tanggal ASC, row_order ASC, created_at ASC
  `).bind(documentId).all<CkhRow>()
  return result.results || []
}

async function markCkhDocumentDraft(db: D1Database, documentId: string) {
  await db.prepare(`
    UPDATE ckh_documents
    SET status = 'DRAFT', updated_at = datetime('now')
    WHERE id = ?
  `).bind(documentId).run()
}

async function getTemplatesForUser(db: D1Database, userId: string, roles: string[], jabatanCetak: string | null) {
  const roleList = roles.length > 0 ? roles : ['guru']
  const placeholders = roleList.map(() => '?').join(',')
  const params: unknown[] = [userId, ...roleList]
  let jabatanClause = 'jabatan_cetak IS NULL'
  if (jabatanCetak) {
    jabatanClause = '(jabatan_cetak IS NULL OR LOWER(jabatan_cetak) = LOWER(?))'
    params.push(jabatanCetak)
  }

  const templatesRes = await db.prepare(`
    SELECT id, user_id, role, jabatan_cetak, title, sort_order, is_active
    FROM ckh_templates
    WHERE is_active = 1
      AND (
        user_id = ?
        OR (user_id IS NULL AND role IN (${placeholders}) AND ${jabatanClause})
      )
    ORDER BY CASE WHEN user_id IS NULL THEN 1 ELSE 0 END ASC,
             CASE WHEN jabatan_cetak IS NULL THEN 0 ELSE 1 END DESC,
             role ASC, sort_order ASC, title ASC
  `).bind(...params).all<Omit<CkhTemplate, 'notes'>>()

  const templates = templatesRes.results || []
  if (templates.length === 0) return []

  const notesRes = await db.prepare(`
    SELECT id, template_id, note, sort_order, is_active
    FROM ckh_template_notes
    WHERE template_id IN (${templates.map(() => '?').join(',')}) AND is_active = 1
    ORDER BY sort_order ASC, note ASC
  `).bind(...templates.map(t => t.id)).all<CkhTemplateNote>()

  const notesByTemplate = new Map<string, CkhTemplateNote[]>()
  for (const note of notesRes.results || []) {
    if (!notesByTemplate.has(note.template_id)) notesByTemplate.set(note.template_id, [])
    notesByTemplate.get(note.template_id)!.push(note)
  }

  const byTitle = new Map<string, CkhTemplate>()
  for (const template of templates) {
    const key = template.title.toLowerCase()
    if (!byTitle.has(key) || template.user_id || template.jabatan_cetak) {
      byTitle.set(key, {
        ...template,
        notes: notesByTemplate.get(template.id) || [],
      })
    }
  }

  return Array.from(byTitle.values())
}

async function buildGeneratedRows(db: D1Database, userId: string, year: number, month: number) {
  const effectiveDates = await getCkhEffectiveDates(db, year, month)
  const effectiveSet = new Set(effectiveDates)
  if (effectiveDates.length === 0) return []

  const { startDate, endDate } = monthRange(year, month)
  const ta = await db.prepare('SELECT id FROM tahun_ajaran WHERE is_active = 1 LIMIT 1').first<{ id: string }>()

  const generated: CkhGeneratedRow[] = []

  if (ta) {
    const agendaRes = await db.prepare(`
      SELECT ag.tanggal, ag.materi, mp.nama_mapel, k.tingkat, k.nomor_kelas, k.kelompok
      FROM agenda_guru ag
      JOIN penugasan_mengajar pm ON ag.penugasan_id = pm.id
      JOIN mata_pelajaran mp ON pm.mapel_id = mp.id
      JOIN kelas k ON pm.kelas_id = k.id
      WHERE ag.guru_id = ?
        AND ag.tanggal BETWEEN ? AND ?
        AND pm.tahun_ajaran_id = ?
        AND ag.materi IS NOT NULL
        AND TRIM(ag.materi) <> ''
      ORDER BY ag.tanggal ASC, mp.nama_mapel ASC, k.tingkat ASC, k.nomor_kelas ASC
    `).bind(userId, startDate, endDate, ta.id).all<any>()

    generated.push(...buildTeachingRows((agendaRes.results || []).filter(row => effectiveSet.has(row.tanggal))))

    const jadwalRes = await db.prepare(`
      SELECT DISTINCT jm.penugasan_id, jm.hari, jm.jam_ke, k.id as kelas_id, k.tingkat, k.kbm_nonaktif_mulai
      FROM jadwal_mengajar jm
      JOIN penugasan_mengajar pm ON jm.penugasan_id = pm.id
      JOIN kelas k ON pm.kelas_id = k.id
      WHERE pm.guru_id = ? AND jm.tahun_ajaran_id = ?
    `).bind(userId, ta.id).all<{ penugasan_id: string; hari: number; jam_ke: number; kelas_id: string; tingkat: number; kbm_nonaktif_mulai: string | null }>()
    const teachingDates = new Set(generated.filter(row => row.source === 'autofill').map(row => row.tanggal))
    const teachingSchedules = new Map<string, { hari: number; jamSet: Set<number>; kelasId: string; tingkat: number; kbmNonaktifMulai: string | null }>()
    for (const row of jadwalRes.results || []) {
      if (!teachingSchedules.has(row.penugasan_id)) {
        teachingSchedules.set(row.penugasan_id, {
          hari: Number(row.hari),
          jamSet: new Set(),
          kelasId: row.kelas_id,
          tingkat: Number(row.tingkat),
          kbmNonaktifMulai: row.kbm_nonaktif_mulai || null,
        })
      }
      teachingSchedules.get(row.penugasan_id)!.jamSet.add(Number(row.jam_ke))
    }
    const exceptionsByDate = new Map<string, Awaited<ReturnType<typeof getKbmExceptionsForRange>>>()
    for (const exception of await getKbmExceptionsForRange(db, startDate, endDate)) {
      if (!exceptionsByDate.has(exception.tanggal)) exceptionsByDate.set(exception.tanggal, [])
      exceptionsByDate.get(exception.tanggal)!.push(exception)
    }
    for (const tanggal of effectiveDates) {
      const day = new Date(tanggal + 'T00:00:00').getDay()
      const hari = day === 0 ? 7 : day
      const hasActiveTeaching = Array.from(teachingSchedules.values()).some(row => {
        if (row.hari !== hari) return false
        if (row.kbmNonaktifMulai && row.kbmNonaktifMulai <= tanggal) return false
        const jamList = Array.from(row.jamSet).sort((a, b) => a - b)
        return !findTeachingBlockException(exceptionsByDate.get(tanggal) || [], { id: row.kelasId, tingkat: row.tingkat }, jamList[0], jamList[jamList.length - 1])
      })
      if (hasActiveTeaching && !teachingDates.has(tanggal)) {
        generated.push({
          tanggal,
          kegiatan_bulanan: CKH_TEACHING_ACTIVITY,
          catatan_harian: '',
          source: 'autofill',
          source_key: `schedule:${tanggal}`,
        })
      }
    }
  }

  const calendarRes = await db.prepare(`
    SELECT id, start_date, end_date, title
    FROM kalender_pendidikan_events
    WHERE source = 'manual'
      AND category IN ('RAPAT','KEGIATAN_MADRASAH','LAINNYA')
      AND start_date <= ?
      AND end_date >= ?
    ORDER BY start_date ASC, title ASC
  `).bind(endDate, startDate).all<any>()

  for (const event of calendarRes.results || []) {
    const eventDates = effectiveDates.filter(date => date >= event.start_date && date <= event.end_date)
    for (const tanggal of eventDates) {
      generated.push({
        tanggal,
        kegiatan_bulanan: CKH_OTHER_DUTY_ACTIVITY,
        catatan_harian: event.title,
        source: 'calendar',
        source_key: `calendar:${event.id}:${tanggal}`,
      })
    }
  }

  generated.sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.catatan_harian.localeCompare(b.catatan_harian, 'id-ID'))
  return generated
}

async function insertInitialRows(db: D1Database, documentId: string, generated: CkhGeneratedRow[], year: number, month: number) {
  const existing = await getRows(db, documentId)
  if (existing.length > 0) return

  const effectiveDates = await getCkhEffectiveDates(db, year, month)
  const generatedDates = new Set(generated.map(row => row.tanggal))
  const rows = [
    ...generated,
    ...effectiveDates
      .filter(tanggal => !generatedDates.has(tanggal))
      .map((tanggal, index) => ({
        tanggal,
        kegiatan_bulanan: '',
        catatan_harian: '',
        vol: CKH_DEFAULT_VOL,
        source: 'manual' as const,
        source_key: `blank:${tanggal}:${index}`,
      })),
  ].sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.catatan_harian.localeCompare(b.catatan_harian, 'id-ID'))

  const statements = rows.map((row, index) => db.prepare(`
    INSERT OR IGNORE INTO ckh_rows
      (document_id, tanggal, row_order, kegiatan_bulanan, catatan_harian, vol, satuan, source, source_key, is_manual)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    documentId,
    row.tanggal,
    index + 1,
    row.kegiatan_bulanan,
    row.catatan_harian,
    row.vol || countCkhItems(row.catatan_harian) || CKH_DEFAULT_VOL,
    CKH_DEFAULT_SATUAN,
    row.source,
    row.source_key,
    row.source === 'manual' ? 1 : 0,
  ))

  for (let i = 0; i < statements.length; i += 50) {
    await db.batch(statements.slice(i, i + 50))
  }
}

export async function getCkhPageData(year: number, month: number) {
  assertMonth(year, month)
  const authUser = await getCurrentUser()
  if (!authUser) throw new Error('Unauthorized')

  const db = await getDB()
  await requireCkhAccess(db, authUser.id)

  const [freshUser, roles] = await Promise.all([
    getFreshUser(db, authUser.id),
    getUserRoles(db, authUser.id),
  ])
  const doc = await getOrCreateDocument(db, authUser.id, year, month)
  const generated = await buildGeneratedRows(db, authUser.id, year, month)
  await insertInitialRows(db, doc.id, generated, year, month)

  const [rows, templates, allTemplatesRes, kepsek, kepalaTu] = await Promise.all([
    getRows(db, doc.id),
    getTemplatesForUser(db, authUser.id, roles, freshUser.jabatan_cetak),
    db.prepare(`
      SELECT t.id, t.user_id, t.role, t.jabatan_cetak, t.title, t.sort_order, t.is_active,
             n.id as note_id, n.note, n.sort_order as note_sort_order, n.is_active as note_active
      FROM ckh_templates t
      LEFT JOIN ckh_template_notes n ON n.template_id = t.id
      WHERE t.user_id IS NULL OR t.user_id = ?
      ORDER BY t.role ASC, t.jabatan_cetak ASC, t.sort_order ASC, t.title ASC, n.sort_order ASC, n.note ASC
    `).bind(authUser.id).all<any>(),
    db.prepare(`
      SELECT u.id, COALESCE(u.nama_lengkap, u.name) as nama_lengkap, u.nip, COALESCE(u.jabatan_cetak, 'Kepala Madrasah') as jabatan_cetak
      FROM "user" u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      WHERE u.role = 'kepsek' OR ur.role = 'kepsek'
      ORDER BY u.nama_lengkap ASC
      LIMIT 1
    `).first<CkhKepsek>(),
    db.prepare(`
      SELECT u.id, COALESCE(u.nama_lengkap, u.name) as nama_lengkap, u.nip, COALESCE(u.jabatan_cetak, 'Kepala TU') as jabatan_cetak
      FROM "user" u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN master_jabatan_struktural mjs ON u.jabatan_struktural_id = mjs.id
      WHERE LOWER(COALESCE(mjs.nama, u.jabatan_cetak, '')) LIKE '%kepala tu%'
         OR LOWER(COALESCE(mjs.nama, u.jabatan_cetak, '')) LIKE '%kepala tata usaha%'
         OR u.role = 'admin_tu'
         OR ur.role = 'admin_tu'
      ORDER BY
        CASE
          WHEN LOWER(COALESCE(mjs.nama, u.jabatan_cetak, '')) LIKE '%kepala tu%' THEN 0
          WHEN LOWER(COALESCE(mjs.nama, u.jabatan_cetak, '')) LIKE '%kepala tata usaha%' THEN 0
          ELSE 1
        END,
        u.nama_lengkap ASC
      LIMIT 1
    `).first<CkhSigner>(),
  ])

  const templateMap = new Map<string, CkhTemplate>()
  for (const item of allTemplatesRes.results || []) {
    if (!templateMap.has(item.id)) {
      templateMap.set(item.id, {
        id: item.id,
        user_id: item.user_id || null,
        role: item.role,
        jabatan_cetak: item.jabatan_cetak,
        title: item.title,
        sort_order: item.sort_order,
        is_active: item.is_active,
        notes: [],
      })
    }
    if (item.note_id) {
      templateMap.get(item.id)!.notes.push({
        id: item.note_id,
        template_id: item.id,
        note: item.note,
        sort_order: item.note_sort_order,
        is_active: item.note_active,
      })
    }
  }

  return {
    user: freshUser,
    userRoles: roles,
    primaryRole: getPrimaryRoleFromRows(roles, freshUser.role),
    document: doc,
    rows,
    templates,
    allTemplates: Array.from(templateMap.values()),
    kepsek: kepsek || null,
    kepalaTu: kepalaTu || null,
    generatedCount: generated.length,
  }
}

export async function saveCkhRow(rowId: string, payload: {
  kegiatan_bulanan: string
  catatan_harian: string
  tanggal: string
  vol?: number
  satuan?: string
}) {
  const authUser = await getCurrentUser()
  if (!authUser) return { error: 'Unauthorized' }

  const kegiatan = cleanCkhMultiline(payload.kegiatan_bulanan)
  const catatan = cleanCkhMultiline(payload.catatan_harian)
  const vol = cleanCkhVolume(payload.vol, catatan)
  const satuan = normalizeCkhSatuan(payload.satuan)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.tanggal)) return { error: 'Tanggal tidak valid.' }

  const db = await getDB()
  await requireCkhAccess(db, authUser.id)
  const row = await db.prepare(`
    SELECT r.id, d.id as document_id, d.user_id
    FROM ckh_rows r
    JOIN ckh_documents d ON r.document_id = d.id
    WHERE r.id = ?
  `).bind(rowId).first<{ id: string; document_id: string; user_id: string }>()
  if (!row || row.user_id !== authUser.id) return { error: 'Baris CKH tidak ditemukan.' }

  await markCkhDocumentDraft(db, row.document_id)
  await db.prepare(`
    UPDATE ckh_rows
    SET tanggal = ?, kegiatan_bulanan = ?, catatan_harian = ?, vol = ?, satuan = ?, is_manual = 1,
        has_conflict = 0, suggested_kegiatan_bulanan = NULL, suggested_catatan_harian = NULL,
        updated_at = datetime('now')
    WHERE id = ?
  `).bind(payload.tanggal, kegiatan, catatan, vol, satuan, rowId).run()

  revalidatePath('/dashboard/ckh-generator')
  revalidatePath('/dashboard/tpg-dokumen')
  return { success: true, row: { id: rowId, tanggal: payload.tanggal, kegiatan_bulanan: kegiatan, catatan_harian: catatan, vol, satuan } }
}

export async function finalizeCkhDocument(documentId: string) {
  const authUser = await getCurrentUser()
  if (!authUser) return { error: 'Unauthorized' }

  const db = await getDB()
  await requireCkhAccess(db, authUser.id)
  const doc = await db.prepare('SELECT id, user_id FROM ckh_documents WHERE id = ?').bind(documentId).first<{ id: string; user_id: string }>()
  if (!doc || doc.user_id !== authUser.id) return { error: 'Dokumen CKH tidak ditemukan.' }

  const rowCount = await db.prepare(`
    SELECT COUNT(*) as count
    FROM ckh_rows
    WHERE document_id = ?
      AND (TRIM(kegiatan_bulanan) <> '' OR TRIM(catatan_harian) <> '')
  `).bind(documentId).first<{ count: number }>()
  if (!rowCount || Number(rowCount.count) === 0) return { error: 'Isi CKH dulu sebelum dikirim.' }

  await db.prepare(`
    UPDATE ckh_documents
    SET status = 'FINAL', updated_at = datetime('now')
    WHERE id = ?
  `).bind(documentId).run()

  revalidatePath('/dashboard/ckh-generator')
  revalidatePath('/dashboard/tpg-dokumen')
  return { success: true, status: 'FINAL' }
}

export async function saveCkhSignatureSettings(documentId: string, payload: {
  enabled: boolean
  xMm: number
  yMm: number
  widthMm: number
}) {
  const authUser = await getCurrentUser()
  if (!authUser) return { error: 'Unauthorized' }

  const xMm = Math.max(-20, Math.min(80, Number(payload.xMm) || 0))
  const yMm = Math.max(-20, Math.min(80, Number(payload.yMm) || 0))
  const widthMm = Math.max(15, Math.min(120, Number(payload.widthMm) || 38))

  const db = await getDB()
  await requireCkhAccess(db, authUser.id)
  const doc = await db.prepare('SELECT id, user_id FROM ckh_documents WHERE id = ?').bind(documentId).first<{ id: string; user_id: string }>()
  if (!doc || doc.user_id !== authUser.id) return { error: 'Dokumen CKH tidak ditemukan.' }

  await markCkhDocumentDraft(db, documentId)
  await db.prepare(`
    UPDATE ckh_documents
    SET signature_enabled = ?, signature_x_mm = ?, signature_y_mm = ?, signature_width_mm = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).bind(payload.enabled ? 1 : 0, xMm, yMm, widthMm, documentId).run()

  revalidatePath('/dashboard/ckh-generator')
  revalidatePath('/dashboard/tpg-dokumen')
  return {
    success: true,
    settings: {
      signature_enabled: payload.enabled ? 1 : 0,
      signature_x_mm: xMm,
      signature_y_mm: yMm,
      signature_width_mm: widthMm,
    },
  }
}

export async function addCkhRow(documentId: string, tanggal: string) {
  const authUser = await getCurrentUser()
  if (!authUser) return { error: 'Unauthorized' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) return { error: 'Tanggal tidak valid.' }

  const db = await getDB()
  await requireCkhAccess(db, authUser.id)
  const doc = await db.prepare('SELECT id, user_id FROM ckh_documents WHERE id = ?').bind(documentId).first<{ id: string; user_id: string }>()
  if (!doc || doc.user_id !== authUser.id) return { error: 'Dokumen CKH tidak ditemukan.' }

  const maxRow = await db.prepare('SELECT COALESCE(MAX(row_order), 0) as max_order FROM ckh_rows WHERE document_id = ? AND tanggal = ?')
    .bind(documentId, tanggal).first<{ max_order: number }>()

  await markCkhDocumentDraft(db, documentId)
  const inserted = await db.prepare(`
    INSERT INTO ckh_rows
      (document_id, tanggal, row_order, kegiatan_bulanan, catatan_harian, vol, satuan, source, source_key, is_manual)
    VALUES (?, ?, ?, '', '', ?, ?, 'manual', ?, 1)
    RETURNING *
  `).bind(documentId, tanggal, (maxRow?.max_order || 0) + 1, CKH_DEFAULT_VOL, CKH_DEFAULT_SATUAN, `manual:${tanggal}:${Date.now()}`).first<CkhRow>()

  revalidatePath('/dashboard/ckh-generator')
  revalidatePath('/dashboard/tpg-dokumen')
  return { success: true, row: inserted }
}

export async function copyCkhRowsFromPreviousMonth(documentId: string) {
  const authUser = await getCurrentUser()
  if (!authUser) return { error: 'Unauthorized' }

  const db = await getDB()
  await requireCkhAccess(db, authUser.id)
  const doc = await db.prepare('SELECT id, user_id, year, month FROM ckh_documents WHERE id = ?')
    .bind(documentId).first<CkhDocument>()
  if (!doc || doc.user_id !== authUser.id) return { error: 'Dokumen CKH tidak ditemukan.' }

  const previous = new Date(doc.year, doc.month - 2, 1)
  const previousDoc = await db.prepare(`
    SELECT id FROM ckh_documents
    WHERE user_id = ? AND year = ? AND month = ?
  `).bind(authUser.id, previous.getFullYear(), previous.getMonth() + 1).first<{ id: string }>()
  if (!previousDoc) return { error: 'Belum ada CKH bulan lalu untuk disalin.' }

  const sourceRows = (await db.prepare(`
    SELECT *
    FROM ckh_rows
    WHERE document_id = ?
      AND (TRIM(kegiatan_bulanan) <> '' OR TRIM(catatan_harian) <> '')
    ORDER BY tanggal ASC, row_order ASC, created_at ASC
  `).bind(previousDoc.id).all<CkhRow>()).results || []
  if (sourceRows.length === 0) return { error: 'CKH bulan lalu belum berisi data.' }

  const targetRows = await getRows(db, documentId)
  const targetByDate = new Map<string, CkhRow[]>()
  for (const row of targetRows) {
    if (!targetByDate.has(row.tanggal)) targetByDate.set(row.tanggal, [])
    targetByDate.get(row.tanggal)!.push(row)
  }

  const effectiveDates = new Set(await getCkhEffectiveDates(db, doc.year, doc.month))
  const lastDay = new Date(doc.year, doc.month, 0).getDate()
  const statements: D1PreparedStatement[] = []
  let copied = 0
  const maxOrderByDate = new Map<string, number>()
  for (const row of targetRows) {
    maxOrderByDate.set(row.tanggal, Math.max(maxOrderByDate.get(row.tanggal) || 0, Number(row.row_order || 0)))
  }

  for (const source of sourceRows) {
    const day = Number(source.tanggal.slice(8, 10))
    if (!Number.isInteger(day) || day < 1 || day > lastDay) continue

    const targetDate = `${doc.year}-${String(doc.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    if (!effectiveDates.has(targetDate)) continue

    const sameDateRows = targetByDate.get(targetDate) || []
    const hasContent = sameDateRows.some(row => row.catatan_harian.trim() || (row.kegiatan_bulanan.trim() && row.source !== 'autofill'))
    if (hasContent) continue

    const blankRow = sameDateRows.find(row => !row.kegiatan_bulanan.trim() && !row.catatan_harian.trim())
    const kegiatan = cleanCkhMultiline(source.kegiatan_bulanan)
    const catatan = cleanCkhMultiline(source.catatan_harian)
    const vol = cleanCkhVolume(source.vol, catatan)

    if (blankRow) {
      statements.push(db.prepare(`
        UPDATE ckh_rows
        SET kegiatan_bulanan = ?, catatan_harian = ?, vol = ?, is_manual = 1,
            source = 'manual', source_key = ?, updated_at = datetime('now')
        WHERE id = ?
      `).bind(kegiatan, catatan, vol, `copy:${previousDoc.id}:${source.id}:${targetDate}`, blankRow.id))
      targetByDate.set(targetDate, sameDateRows.filter(row => row.id !== blankRow.id))
    } else {
      const nextOrder = (maxOrderByDate.get(targetDate) || 0) + 1
      maxOrderByDate.set(targetDate, nextOrder)
      statements.push(db.prepare(`
        INSERT INTO ckh_rows
          (document_id, tanggal, row_order, kegiatan_bulanan, catatan_harian, vol, satuan, source, source_key, is_manual)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', ?, 1)
      `).bind(documentId, targetDate, nextOrder, kegiatan, catatan, vol, source.satuan || CKH_DEFAULT_SATUAN, `copy:${previousDoc.id}:${source.id}:${targetDate}`))
    }
    copied += 1
  }

  if (copied === 0) return { error: 'Tidak ada baris bulan lalu yang bisa disalin ke bulan ini.' }

  await markCkhDocumentDraft(db, documentId)
  for (let i = 0; i < statements.length; i += 50) {
    await db.batch(statements.slice(i, i + 50))
  }

  const rows = await getRows(db, documentId)
  revalidatePath('/dashboard/ckh-generator')
  revalidatePath('/dashboard/tpg-dokumen')
  return { success: `${copied} baris berhasil disalin dari bulan lalu.`, rows }
}

export async function deleteCkhRow(rowId: string) {
  const authUser = await getCurrentUser()
  if (!authUser) return { error: 'Unauthorized' }

  const db = await getDB()
  await requireCkhAccess(db, authUser.id)
  const row = await db.prepare(`
    SELECT r.id, d.id as document_id, d.user_id
    FROM ckh_rows r
    JOIN ckh_documents d ON r.document_id = d.id
    WHERE r.id = ?
  `).bind(rowId).first<{ id: string; document_id: string; user_id: string }>()
  if (!row || row.user_id !== authUser.id) return { error: 'Baris CKH tidak ditemukan.' }

  await markCkhDocumentDraft(db, row.document_id)
  await db.prepare('DELETE FROM ckh_rows WHERE id = ?').bind(rowId).run()
  revalidatePath('/dashboard/ckh-generator')
  revalidatePath('/dashboard/tpg-dokumen')
  return { success: true }
}

export async function refreshCkhDraft(documentId: string) {
  const authUser = await getCurrentUser()
  if (!authUser) return { error: 'Unauthorized' }

  const db = await getDB()
  await requireCkhAccess(db, authUser.id)
  const doc = await db.prepare('SELECT id, user_id, year, month FROM ckh_documents WHERE id = ?')
    .bind(documentId).first<CkhDocument>()
  if (!doc || doc.user_id !== authUser.id) return { error: 'Dokumen CKH tidak ditemukan.' }

  await markCkhDocumentDraft(db, documentId)
  const generated = await buildGeneratedRows(db, authUser.id, doc.year, doc.month)
  const existing = await getRows(db, documentId)
  const existingBySource = new Map(existing.filter(row => row.source_key).map(row => [row.source_key!, row]))
  const existingDates = new Set(existing.map(row => row.tanggal))
  const generatedDates = new Set(generated.map(row => row.tanggal))
  const statements: D1PreparedStatement[] = []

  generated.forEach((row, index) => {
    const current = existingBySource.get(row.source_key)
    if (!current) {
      statements.push(db.prepare(`
        INSERT OR IGNORE INTO ckh_rows
          (document_id, tanggal, row_order, kegiatan_bulanan, catatan_harian, vol, satuan, source, source_key, is_manual)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      `).bind(documentId, row.tanggal, index + 1, row.kegiatan_bulanan, row.catatan_harian, row.vol || countCkhItems(row.catatan_harian) || CKH_DEFAULT_VOL, CKH_DEFAULT_SATUAN, row.source, row.source_key))
      return
    }

    if (Number(current.is_manual) === 1) {
      const changed = current.kegiatan_bulanan !== row.kegiatan_bulanan || current.catatan_harian !== row.catatan_harian
      if (changed) {
        statements.push(db.prepare(`
          UPDATE ckh_rows
          SET has_conflict = 1, suggested_kegiatan_bulanan = ?, suggested_catatan_harian = ?, updated_at = datetime('now')
          WHERE id = ?
        `).bind(row.kegiatan_bulanan, row.catatan_harian, current.id))
      }
    } else {
      statements.push(db.prepare(`
        UPDATE ckh_rows
        SET tanggal = ?, row_order = ?, kegiatan_bulanan = ?, catatan_harian = ?, vol = ?,
            has_conflict = 0, suggested_kegiatan_bulanan = NULL, suggested_catatan_harian = NULL,
            updated_at = datetime('now')
        WHERE id = ?
      `).bind(row.tanggal, index + 1, row.kegiatan_bulanan, row.catatan_harian, row.vol || countCkhItems(row.catatan_harian) || CKH_DEFAULT_VOL, current.id))
    }
  })

  const effectiveDates = await getCkhEffectiveDates(db, doc.year, doc.month)
  effectiveDates
    .filter(tanggal => !existingDates.has(tanggal) && !generatedDates.has(tanggal))
    .forEach((tanggal, index) => {
      statements.push(db.prepare(`
        INSERT OR IGNORE INTO ckh_rows
          (document_id, tanggal, row_order, kegiatan_bulanan, catatan_harian, vol, satuan, source, source_key, is_manual)
        VALUES (?, ?, ?, '', '', ?, ?, 'manual', ?, 1)
      `).bind(documentId, tanggal, index + 1, CKH_DEFAULT_VOL, CKH_DEFAULT_SATUAN, `blank:${tanggal}:${Date.now()}:${index}`))
    })

  for (let i = 0; i < statements.length; i += 50) {
    await db.batch(statements.slice(i, i + 50))
  }

  const rows = await getRows(db, documentId)

  revalidatePath('/dashboard/ckh-generator')
  revalidatePath('/dashboard/tpg-dokumen')
  return { success: `Sinkron selesai. ${generated.length} baris sumber dicek.`, rows }
}

export async function acceptCkhSuggestion(rowId: string) {
  const authUser = await getCurrentUser()
  if (!authUser) return { error: 'Unauthorized' }

  const db = await getDB()
  await requireCkhAccess(db, authUser.id)
  const row = await db.prepare(`
    SELECT r.*, d.id as document_id, d.user_id
    FROM ckh_rows r
    JOIN ckh_documents d ON r.document_id = d.id
    WHERE r.id = ?
  `).bind(rowId).first<CkhRow & { document_id: string; user_id: string }>()
  if (!row || row.user_id !== authUser.id) return { error: 'Baris CKH tidak ditemukan.' }

  await markCkhDocumentDraft(db, row.document_id)
  await db.prepare(`
    UPDATE ckh_rows
    SET kegiatan_bulanan = COALESCE(suggested_kegiatan_bulanan, kegiatan_bulanan),
        catatan_harian = COALESCE(suggested_catatan_harian, catatan_harian),
        is_manual = 0, has_conflict = 0,
        suggested_kegiatan_bulanan = NULL, suggested_catatan_harian = NULL,
        updated_at = datetime('now')
    WHERE id = ?
  `).bind(rowId).run()

  revalidatePath('/dashboard/ckh-generator')
  revalidatePath('/dashboard/tpg-dokumen')
  return { success: true, rowId }
}

export async function saveCkhTemplate(formData: FormData) {
  const authUser = await getCurrentUser()
  if (!authUser) return { error: 'Unauthorized' }

  const db = await getDB()
  const roles = await getUserRoles(db, authUser.id)
  const canManageGlobal = roles.includes('super_admin') || roles.includes('admin_tu')

  const id = cleanNullable(formData.get('id'))
  const role = canManageGlobal
    ? normalizeCkhText(String(formData.get('role') || 'guru'))
    : getPrimaryRoleFromRows(roles, (await getFreshUser(db, authUser.id)).role)
  const jabatan = canManageGlobal ? cleanNullable(formData.get('jabatan_cetak')) : null
  const title = normalizeCkhText(String(formData.get('title') || ''))
  const sortOrder = Number(formData.get('sort_order')) || 0
  if (!role || !title) return { error: 'Role dan kegiatan bulanan wajib diisi.' }

  if (id) {
    const existing = await db.prepare('SELECT id, user_id FROM ckh_templates WHERE id = ?').bind(id).first<{ id: string; user_id: string | null }>()
    if (!existing) return { error: 'Template CKH tidak ditemukan.' }
    if (!canManageGlobal && existing.user_id !== authUser.id) return { error: 'Template ini bukan milik Anda.' }
    await db.prepare(`
      UPDATE ckh_templates
      SET role = ?, jabatan_cetak = ?, title = ?, sort_order = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(role, jabatan, title, sortOrder, id).run()
  } else {
    await db.prepare(`
      INSERT INTO ckh_templates (user_id, role, jabatan_cetak, title, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `).bind(canManageGlobal ? null : authUser.id, role, jabatan, title, sortOrder).run()
  }

  const saved = id
    ? await db.prepare('SELECT id, user_id, role, jabatan_cetak, title, sort_order, is_active FROM ckh_templates WHERE id = ?').bind(id).first<Omit<CkhTemplate, 'notes'>>()
    : await db.prepare(`
        SELECT id, user_id, role, jabatan_cetak, title, sort_order, is_active
        FROM ckh_templates
        WHERE COALESCE(user_id, '') = COALESCE(?, '')
          AND role = ? AND COALESCE(jabatan_cetak, '') = COALESCE(?, '') AND title = ?
        ORDER BY created_at DESC
        LIMIT 1
      `).bind(canManageGlobal ? null : authUser.id, role, jabatan, title).first<Omit<CkhTemplate, 'notes'>>()

  revalidatePath('/dashboard/ckh-generator')
  return { success: 'Template CKH disimpan.', template: saved ? { ...saved, notes: [] } : null }
}

export async function deleteCkhTemplate(id: string) {
  const authUser = await getCurrentUser()
  if (!authUser) return { error: 'Unauthorized' }

  const db = await getDB()
  const roles = await getUserRoles(db, authUser.id)
  const canManageGlobal = roles.includes('super_admin') || roles.includes('admin_tu')
  const existing = await db.prepare('SELECT id, user_id FROM ckh_templates WHERE id = ?').bind(id).first<{ id: string; user_id: string | null }>()
  if (!existing) return { error: 'Template CKH tidak ditemukan.' }
  if (!canManageGlobal && existing.user_id !== authUser.id) return { error: 'Template ini bukan milik Anda.' }

  await db.prepare('DELETE FROM ckh_templates WHERE id = ?').bind(id).run()
  revalidatePath('/dashboard/ckh-generator')
  return { success: true, id }
}

export async function saveCkhTemplateNote(formData: FormData) {
  const authUser = await getCurrentUser()
  if (!authUser) return { error: 'Unauthorized' }

  const db = await getDB()
  const roles = await getUserRoles(db, authUser.id)
  const canManageGlobal = roles.includes('super_admin') || roles.includes('admin_tu')

  const id = cleanNullable(formData.get('id'))
  const templateId = normalizeCkhText(String(formData.get('template_id') || ''))
  const note = normalizeCkhText(String(formData.get('note') || ''))
  const sortOrder = Number(formData.get('sort_order')) || 0
  if (!templateId || !note) return { error: 'Template dan catatan wajib diisi.' }
  const template = await db.prepare('SELECT id, user_id FROM ckh_templates WHERE id = ?').bind(templateId).first<{ id: string; user_id: string | null }>()
  if (!template) return { error: 'Template CKH tidak ditemukan.' }
  if (!canManageGlobal && template.user_id !== authUser.id) return { error: 'Template ini bukan milik Anda.' }

  if (id) {
    const existing = await db.prepare(`
      SELECT n.id, t.user_id
      FROM ckh_template_notes n
      JOIN ckh_templates t ON t.id = n.template_id
      WHERE n.id = ?
    `).bind(id).first<{ id: string; user_id: string | null }>()
    if (!existing) return { error: 'Catatan template tidak ditemukan.' }
    if (!canManageGlobal && existing.user_id !== authUser.id) return { error: 'Catatan template ini bukan milik Anda.' }
    await db.prepare(`
      UPDATE ckh_template_notes
      SET template_id = ?, note = ?, sort_order = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(templateId, note, sortOrder, id).run()
  } else {
    await db.prepare(`
      INSERT INTO ckh_template_notes (template_id, note, sort_order)
      VALUES (?, ?, ?)
    `).bind(templateId, note, sortOrder).run()
  }

  const saved = id
    ? await db.prepare('SELECT id, template_id, note, sort_order, is_active FROM ckh_template_notes WHERE id = ?').bind(id).first<CkhTemplateNote>()
    : await db.prepare(`
        SELECT id, template_id, note, sort_order, is_active
        FROM ckh_template_notes
        WHERE template_id = ? AND note = ?
        ORDER BY created_at DESC
        LIMIT 1
      `).bind(templateId, note).first<CkhTemplateNote>()

  revalidatePath('/dashboard/ckh-generator')
  return { success: 'Catatan template disimpan.', note: saved || null }
}

export async function deleteCkhTemplateNote(id: string) {
  const authUser = await getCurrentUser()
  if (!authUser) return { error: 'Unauthorized' }

  const db = await getDB()
  const roles = await getUserRoles(db, authUser.id)
  const canManageGlobal = roles.includes('super_admin') || roles.includes('admin_tu')
  const existing = await db.prepare(`
    SELECT n.id, t.user_id
    FROM ckh_template_notes n
    JOIN ckh_templates t ON t.id = n.template_id
    WHERE n.id = ?
  `).bind(id).first<{ id: string; user_id: string | null }>()
  if (!existing) return { error: 'Catatan template tidak ditemukan.' }
  if (!canManageGlobal && existing.user_id !== authUser.id) return { error: 'Catatan template ini bukan milik Anda.' }

  await db.prepare('DELETE FROM ckh_template_notes WHERE id = ?').bind(id).run()
  revalidatePath('/dashboard/ckh-generator')
  return { success: true, id }
}
