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
  getCkhEffectiveDates,
  monthRange,
  normalizeCkhText,
  type CkhGeneratedRow,
  type CkhTemplate,
  type CkhTemplateNote,
} from '@/lib/ckh'

type CkhUser = {
  id: string
  nama_lengkap: string
  role: string
  nip: string | null
  jabatan_cetak: string | null
}

type CkhDocument = {
  id: string
  user_id: string
  year: number
  month: number
  status: string
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

function assertMonth(year: number, month: number) {
  if (!Number.isInteger(year) || year < 2020 || year > 2100) throw new Error('Tahun tidak valid.')
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new Error('Bulan tidak valid.')
}

function cleanNullable(value: FormDataEntryValue | null) {
  const text = normalizeCkhText(String(value || ''))
  return text || null
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
    SELECT id, COALESCE(nama_lengkap, name) as nama_lengkap, role, nip, jabatan_cetak
    FROM "user"
    WHERE id = ?
  `).bind(userId).first<CkhUser>()
  if (!user) throw new Error('Data user tidak ditemukan.')
  return user
}

async function getOrCreateDocument(db: D1Database, userId: string, year: number, month: number) {
  let doc = await db.prepare(`
    SELECT id, user_id, year, month, status
    FROM ckh_documents
    WHERE user_id = ? AND year = ? AND month = ?
  `).bind(userId, year, month).first<CkhDocument>()

  if (!doc) {
    doc = await db.prepare(`
      INSERT INTO ckh_documents (user_id, year, month)
      VALUES (?, ?, ?)
      RETURNING id, user_id, year, month, status
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

async function getTemplatesForUser(db: D1Database, roles: string[], jabatanCetak: string | null) {
  const roleList = roles.length > 0 ? roles : ['guru']
  const placeholders = roleList.map(() => '?').join(',')
  const params: unknown[] = [...roleList]
  let jabatanClause = 'jabatan_cetak IS NULL'
  if (jabatanCetak) {
    jabatanClause = '(jabatan_cetak IS NULL OR LOWER(jabatan_cetak) = LOWER(?))'
    params.push(jabatanCetak)
  }

  const templatesRes = await db.prepare(`
    SELECT id, role, jabatan_cetak, title, sort_order, is_active
    FROM ckh_templates
    WHERE role IN (${placeholders}) AND ${jabatanClause} AND is_active = 1
    ORDER BY CASE WHEN jabatan_cetak IS NULL THEN 0 ELSE 1 END DESC, role ASC, sort_order ASC, title ASC
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
    if (!byTitle.has(key) || template.jabatan_cetak) {
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
      SELECT DISTINCT jm.hari
      FROM jadwal_mengajar jm
      JOIN penugasan_mengajar pm ON jm.penugasan_id = pm.id
      WHERE pm.guru_id = ? AND jm.tahun_ajaran_id = ?
    `).bind(userId, ta.id).all<{ hari: number }>()
    const teachingDates = new Set(generated.filter(row => row.source === 'autofill').map(row => row.tanggal))
    const teachingDays = new Set((jadwalRes.results || []).map(row => row.hari))
    for (const tanggal of effectiveDates) {
      const day = new Date(tanggal + 'T00:00:00').getDay()
      const hari = day === 0 ? 7 : day
      if (teachingDays.has(hari) && !teachingDates.has(tanggal)) {
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
    CKH_DEFAULT_VOL,
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

  const [rows, templates, allTemplatesRes, kepsek] = await Promise.all([
    getRows(db, doc.id),
    getTemplatesForUser(db, roles, freshUser.jabatan_cetak),
    db.prepare(`
      SELECT t.id, t.role, t.jabatan_cetak, t.title, t.sort_order, t.is_active,
             n.id as note_id, n.note, n.sort_order as note_sort_order, n.is_active as note_active
      FROM ckh_templates t
      LEFT JOIN ckh_template_notes n ON n.template_id = t.id
      ORDER BY t.role ASC, t.jabatan_cetak ASC, t.sort_order ASC, t.title ASC, n.sort_order ASC, n.note ASC
    `).all<any>(),
    db.prepare(`
      SELECT u.id, COALESCE(u.nama_lengkap, u.name) as nama_lengkap, u.nip, COALESCE(u.jabatan_cetak, 'Kepala Madrasah') as jabatan_cetak
      FROM "user" u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      WHERE u.role = 'kepsek' OR ur.role = 'kepsek'
      ORDER BY u.nama_lengkap ASC
      LIMIT 1
    `).first<CkhKepsek>(),
  ])

  const templateMap = new Map<string, CkhTemplate>()
  for (const item of allTemplatesRes.results || []) {
    if (!templateMap.has(item.id)) {
      templateMap.set(item.id, {
        id: item.id,
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
    generatedCount: generated.length,
  }
}

export async function saveCkhRow(rowId: string, payload: {
  kegiatan_bulanan: string
  catatan_harian: string
  tanggal: string
}) {
  const authUser = await getCurrentUser()
  if (!authUser) return { error: 'Unauthorized' }

  const kegiatan = normalizeCkhText(payload.kegiatan_bulanan)
  const catatan = normalizeCkhText(payload.catatan_harian)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.tanggal)) return { error: 'Tanggal tidak valid.' }

  const db = await getDB()
  await requireCkhAccess(db, authUser.id)
  const row = await db.prepare(`
    SELECT r.id, d.user_id
    FROM ckh_rows r
    JOIN ckh_documents d ON r.document_id = d.id
    WHERE r.id = ?
  `).bind(rowId).first<{ id: string; user_id: string }>()
  if (!row || row.user_id !== authUser.id) return { error: 'Baris CKH tidak ditemukan.' }

  await db.prepare(`
    UPDATE ckh_rows
    SET tanggal = ?, kegiatan_bulanan = ?, catatan_harian = ?, is_manual = 1,
        has_conflict = 0, suggested_kegiatan_bulanan = NULL, suggested_catatan_harian = NULL,
        updated_at = datetime('now')
    WHERE id = ?
  `).bind(payload.tanggal, kegiatan, catatan, rowId).run()

  revalidatePath('/dashboard/ckh-generator')
  return { success: true }
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

  await db.prepare(`
    INSERT INTO ckh_rows
      (document_id, tanggal, row_order, kegiatan_bulanan, catatan_harian, vol, satuan, source, source_key, is_manual)
    VALUES (?, ?, ?, '', '', ?, ?, 'manual', ?, 1)
  `).bind(documentId, tanggal, (maxRow?.max_order || 0) + 1, CKH_DEFAULT_VOL, CKH_DEFAULT_SATUAN, `manual:${tanggal}:${Date.now()}`).run()

  revalidatePath('/dashboard/ckh-generator')
  return { success: true }
}

export async function deleteCkhRow(rowId: string) {
  const authUser = await getCurrentUser()
  if (!authUser) return { error: 'Unauthorized' }

  const db = await getDB()
  await requireCkhAccess(db, authUser.id)
  const row = await db.prepare(`
    SELECT r.id, d.user_id
    FROM ckh_rows r
    JOIN ckh_documents d ON r.document_id = d.id
    WHERE r.id = ?
  `).bind(rowId).first<{ id: string; user_id: string }>()
  if (!row || row.user_id !== authUser.id) return { error: 'Baris CKH tidak ditemukan.' }

  await db.prepare('DELETE FROM ckh_rows WHERE id = ?').bind(rowId).run()
  revalidatePath('/dashboard/ckh-generator')
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
      `).bind(documentId, row.tanggal, index + 1, row.kegiatan_bulanan, row.catatan_harian, CKH_DEFAULT_VOL, CKH_DEFAULT_SATUAN, row.source, row.source_key))
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
        SET tanggal = ?, row_order = ?, kegiatan_bulanan = ?, catatan_harian = ?,
            has_conflict = 0, suggested_kegiatan_bulanan = NULL, suggested_catatan_harian = NULL,
            updated_at = datetime('now')
        WHERE id = ?
      `).bind(row.tanggal, index + 1, row.kegiatan_bulanan, row.catatan_harian, current.id))
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

  revalidatePath('/dashboard/ckh-generator')
  return { success: `Refresh selesai. ${generated.length} baris sumber dicek.` }
}

export async function acceptCkhSuggestion(rowId: string) {
  const authUser = await getCurrentUser()
  if (!authUser) return { error: 'Unauthorized' }

  const db = await getDB()
  await requireCkhAccess(db, authUser.id)
  const row = await db.prepare(`
    SELECT r.*, d.user_id
    FROM ckh_rows r
    JOIN ckh_documents d ON r.document_id = d.id
    WHERE r.id = ?
  `).bind(rowId).first<CkhRow & { user_id: string }>()
  if (!row || row.user_id !== authUser.id) return { error: 'Baris CKH tidak ditemukan.' }

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
  return { success: true }
}

export async function saveCkhTemplate(formData: FormData) {
  const authUser = await getCurrentUser()
  if (!authUser) return { error: 'Unauthorized' }

  const db = await getDB()
  const roles = await getUserRoles(db, authUser.id)
  if (!roles.includes('super_admin') && !roles.includes('admin_tu')) return { error: 'Hanya admin yang bisa mengelola template CKH.' }

  const id = cleanNullable(formData.get('id'))
  const role = normalizeCkhText(String(formData.get('role') || 'guru'))
  const jabatan = cleanNullable(formData.get('jabatan_cetak'))
  const title = normalizeCkhText(String(formData.get('title') || ''))
  const sortOrder = Number(formData.get('sort_order')) || 0
  if (!role || !title) return { error: 'Role dan kegiatan bulanan wajib diisi.' }

  if (id) {
    await db.prepare(`
      UPDATE ckh_templates
      SET role = ?, jabatan_cetak = ?, title = ?, sort_order = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(role, jabatan, title, sortOrder, id).run()
  } else {
    await db.prepare(`
      INSERT INTO ckh_templates (role, jabatan_cetak, title, sort_order)
      VALUES (?, ?, ?, ?)
    `).bind(role, jabatan, title, sortOrder).run()
  }

  revalidatePath('/dashboard/ckh-generator')
  return { success: 'Template CKH disimpan.' }
}

export async function deleteCkhTemplate(id: string) {
  const authUser = await getCurrentUser()
  if (!authUser) return { error: 'Unauthorized' }

  const db = await getDB()
  const roles = await getUserRoles(db, authUser.id)
  if (!roles.includes('super_admin') && !roles.includes('admin_tu')) return { error: 'Hanya admin yang bisa mengelola template CKH.' }

  await db.prepare('DELETE FROM ckh_templates WHERE id = ?').bind(id).run()
  revalidatePath('/dashboard/ckh-generator')
  return { success: true }
}

export async function saveCkhTemplateNote(formData: FormData) {
  const authUser = await getCurrentUser()
  if (!authUser) return { error: 'Unauthorized' }

  const db = await getDB()
  const roles = await getUserRoles(db, authUser.id)
  if (!roles.includes('super_admin') && !roles.includes('admin_tu')) return { error: 'Hanya admin yang bisa mengelola template CKH.' }

  const id = cleanNullable(formData.get('id'))
  const templateId = normalizeCkhText(String(formData.get('template_id') || ''))
  const note = normalizeCkhText(String(formData.get('note') || ''))
  const sortOrder = Number(formData.get('sort_order')) || 0
  if (!templateId || !note) return { error: 'Template dan catatan wajib diisi.' }

  if (id) {
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

  revalidatePath('/dashboard/ckh-generator')
  return { success: 'Catatan template disimpan.' }
}

export async function deleteCkhTemplateNote(id: string) {
  const authUser = await getCurrentUser()
  if (!authUser) return { error: 'Unauthorized' }

  const db = await getDB()
  const roles = await getUserRoles(db, authUser.id)
  if (!roles.includes('super_admin') && !roles.includes('admin_tu')) return { error: 'Hanya admin yang bisa mengelola template CKH.' }

  await db.prepare('DELETE FROM ckh_template_notes WHERE id = ?').bind(id).run()
  revalidatePath('/dashboard/ckh-generator')
  return { success: true }
}
