'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { checkFeatureAccess } from '@/lib/features'
import {
  DEFAULT_RPPM_PRINT_SETTINGS,
  RPPM_TEMPLATE_TYPES,
  getRppmTemplate,
  normalizePrintSettings,
  normalizeRppmContent,
  type RppmContent,
  type RppmPrintSettings,
  type RppmSpec,
  type RppmTemplateType,
} from '@/lib/rppm'

export type RppmSavedDocument = {
  id: string
  template_type: RppmTemplateType
  title: string
  mapel: string
  kelas_semester: string
  alokasi_waktu: string
  status: 'DRAFT' | 'FINAL'
  content: RppmContent
  print_settings: RppmPrintSettings
  created_at: string
  updated_at: string
}

type RppmDocumentRow = {
  id: string
  user_id: string
  template_type: string
  title: string
  mapel: string
  kelas_semester: string
  alokasi_waktu: string
  content_json: string
  print_settings: string
  status: 'DRAFT' | 'FINAL'
  created_at: string
  updated_at: string
}

type SavePayload = {
  id?: string | null
  template_type: RppmTemplateType
  content: RppmContent
  print_settings?: RppmPrintSettings
  status?: 'DRAFT' | 'FINAL'
}

async function requireRppmAccess(db: D1Database, userId: string) {
  const allowed = await checkFeatureAccess(db, userId, 'rppm-generator')
  if (!allowed) throw new Error('Anda tidak memiliki akses RPPM Generator.')
}

function assertTemplateType(value: string): RppmTemplateType {
  if (RPPM_TEMPLATE_TYPES.includes(value as RppmTemplateType)) return value as RppmTemplateType
  throw new Error('Template RPPM tidak valid.')
}

function rowToDocument(row: RppmDocumentRow): RppmSavedDocument {
  const templateType = assertTemplateType(row.template_type)
  const fallbackSpec: Partial<RppmSpec> = {
    mata_pelajaran: row.mapel,
    kelas_semester: row.kelas_semester,
    topik_pembelajaran: row.title,
    alokasi_waktu: row.alokasi_waktu,
  }

  let contentSource: unknown = {}
  let printSource: unknown = DEFAULT_RPPM_PRINT_SETTINGS
  try {
    contentSource = JSON.parse(row.content_json || '{}')
  } catch {
    contentSource = {}
  }
  try {
    printSource = JSON.parse(row.print_settings || '{}')
  } catch {
    printSource = DEFAULT_RPPM_PRINT_SETTINGS
  }

  return {
    id: row.id,
    template_type: templateType,
    title: row.title,
    mapel: row.mapel,
    kelas_semester: row.kelas_semester,
    alokasi_waktu: row.alokasi_waktu,
    status: row.status,
    content: normalizeRppmContent(contentSource, fallbackSpec),
    print_settings: normalizePrintSettings(printSource),
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export async function getRppmPageData(): Promise<{ documents: RppmSavedDocument[] }> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Anda harus login.')

  const db = await getDB()
  await requireRppmAccess(db, user.id)

  const rows = await db.prepare(`
    SELECT *
    FROM rppm_documents
    WHERE user_id = ?
    ORDER BY updated_at DESC, created_at DESC
  `).bind(user.id).all<RppmDocumentRow>()

  return { documents: (rows.results || []).map(rowToDocument) }
}

export async function saveRppmDocument(payload: SavePayload): Promise<{ error: string | null; document?: RppmSavedDocument }> {
  try {
    const user = await getCurrentUser()
    if (!user) return { error: 'Anda harus login.' }

    const db = await getDB()
    await requireRppmAccess(db, user.id)

    const templateType = assertTemplateType(payload.template_type)
    getRppmTemplate(templateType)

    const content = normalizeRppmContent(payload.content)
    const printSettings = normalizePrintSettings(payload.print_settings || DEFAULT_RPPM_PRINT_SETTINGS)
    const status = payload.status === 'FINAL' ? 'FINAL' : 'DRAFT'
    const title = content.spesifikasi.topik_pembelajaran || 'RPPM Tanpa Judul'
    const mapel = content.spesifikasi.mata_pelajaran || ''
    const kelasSemester = content.spesifikasi.kelas_semester || ''
    const alokasiWaktu = content.spesifikasi.alokasi_waktu || ''

    let row: RppmDocumentRow | null

    if (payload.id) {
      const existing = await db.prepare('SELECT id FROM rppm_documents WHERE id = ? AND user_id = ?')
        .bind(payload.id, user.id)
        .first<{ id: string }>()
      if (!existing) return { error: 'Draft RPPM tidak ditemukan.' }

      row = await db.prepare(`
        UPDATE rppm_documents
        SET template_type = ?, title = ?, mapel = ?, kelas_semester = ?, alokasi_waktu = ?,
            content_json = ?, print_settings = ?, status = ?, updated_at = datetime('now')
        WHERE id = ? AND user_id = ?
        RETURNING *
      `).bind(
        templateType,
        title,
        mapel,
        kelasSemester,
        alokasiWaktu,
        JSON.stringify(content),
        JSON.stringify(printSettings),
        status,
        payload.id,
        user.id,
      ).first<RppmDocumentRow>()
    } else {
      row = await db.prepare(`
        INSERT INTO rppm_documents (user_id, template_type, title, mapel, kelas_semester, alokasi_waktu, content_json, print_settings, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING *
      `).bind(
        user.id,
        templateType,
        title,
        mapel,
        kelasSemester,
        alokasiWaktu,
        JSON.stringify(content),
        JSON.stringify(printSettings),
        status,
      ).first<RppmDocumentRow>()
    }

    if (!row) return { error: 'Gagal menyimpan RPPM.' }
    revalidatePath('/dashboard/rppm-generator')
    return { error: null, document: rowToDocument(row) }
  } catch (error: any) {
    return { error: error?.message || 'Gagal menyimpan RPPM.' }
  }
}
