'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { checkFeatureAccess, getUserRoles } from '@/lib/features'
import { uploadS36Pdf, validatePdfFile } from '@/utils/r2'
import { monthLabel, TPG_CKH_ROLES, type TpgUserStatus } from '@/lib/tpg'

function assertPeriod(year: number, month: number) {
  if (!Number.isInteger(year) || year < 2020 || year > 2100) throw new Error('Tahun tidak valid.')
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new Error('Bulan tidak valid.')
}

async function requireTpgAccess(db: D1Database, userId: string) {
  const allowed = await checkFeatureAccess(db, userId, 'tpg-dokumen')
  if (!allowed) throw new Error('Anda tidak memiliki akses Dokumen TPG.')
}

export async function uploadS36Action(formData: FormData) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  const year = Number(formData.get('period_year'))
  const month = Number(formData.get('period_month'))
  const file = formData.get('s36') as File
  try {
    assertPeriod(year, month)
  } catch (e: any) {
    return { error: e.message || 'Periode tidak valid.' }
  }
  if (!file || file.size === 0) return { error: 'Pilih file PDF S36 dulu.' }
  const validationError = validatePdfFile(file)
  if (validationError) return { error: validationError }

  const db = await getDB()
  await requireTpgAccess(db, user.id)

  const uploaded = await uploadS36Pdf(user.id, file)
  if (uploaded.error || !uploaded.key) return { error: uploaded.error || 'Upload S36 gagal.' }

  await db.prepare(`
    INSERT INTO tpg_s36_uploads
      (user_id, period_year, period_month, r2_key, original_filename, file_size, uploaded_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      period_year = excluded.period_year,
      period_month = excluded.period_month,
      r2_key = excluded.r2_key,
      original_filename = excluded.original_filename,
      file_size = excluded.file_size,
      uploaded_at = datetime('now'),
      updated_at = datetime('now')
  `).bind(user.id, year, month, uploaded.key, file.name || 'S36.pdf', file.size).run()

  revalidatePath('/dashboard/tpg-dokumen')
  return { success: `S36 ${monthLabel(year, month)} berhasil diupload.`, uploadedAt: new Date().toISOString() }
}

export async function getTpgDokumenData(s36Year: number, s36Month: number, ckhYear: number, ckhMonth: number) {
  assertPeriod(s36Year, s36Month)
  assertPeriod(ckhYear, ckhMonth)

  const authUser = await getCurrentUser()
  if (!authUser) throw new Error('Unauthorized')

  const db = await getDB()
  await requireTpgAccess(db, authUser.id)
  const roles = await getUserRoles(db, authUser.id)
  const canManage = roles.includes('super_admin') || roles.includes('admin_tu')
  const rolePlaceholders = TPG_CKH_ROLES.map(() => '?').join(',')
  const params: unknown[] = [s36Year, s36Month, ckhYear, ckhMonth, ...TPG_CKH_ROLES]
  let userClause = `
    (
      u.role IN (${rolePlaceholders})
      OR EXISTS (
        SELECT 1 FROM user_roles ur2
        WHERE ur2.user_id = u.id AND ur2.role IN (${rolePlaceholders})
      )
    )
  `
  params.push(...TPG_CKH_ROLES)
  if (!canManage) {
    userClause = 'u.id = ?'
    params.splice(4)
    params.push(authUser.id)
  }

  const result = await db.prepare(`
    SELECT
      u.id,
      COALESCE(u.nama_lengkap, u.name) as nama_lengkap,
      u.role,
      u.nip,
      u.jabatan_cetak,
      u.signature_url,
      s.period_year as s36_period_year,
      s.period_month as s36_period_month,
      s.original_filename as s36_original_filename,
      s.file_size as s36_file_size,
      s.uploaded_at as s36_uploaded_at,
      d.id as ckh_document_id,
      d.status as ckh_status,
      d.updated_at as ckh_updated_at,
      d.signature_enabled,
      COALESCE((
        SELECT COUNT(*)
        FROM ckh_rows r
        WHERE r.document_id = d.id
          AND (TRIM(r.kegiatan_bulanan) <> '' OR TRIM(r.catatan_harian) <> '')
      ), 0) as ckh_row_count
    FROM "user" u
    LEFT JOIN tpg_s36_uploads s
      ON s.user_id = u.id AND s.period_year = ? AND s.period_month = ?
    LEFT JOIN ckh_documents d
      ON d.user_id = u.id AND d.year = ? AND d.month = ?
    WHERE ${userClause}
      AND COALESCE(u.banned, 0) = 0
    GROUP BY u.id
    ORDER BY u.nama_lengkap ASC, u.name ASC
  `).bind(...params).all<TpgUserStatus>()

  return {
    currentUserId: authUser.id,
    canManage,
    roles,
    s36Year,
    s36Month,
    ckhYear,
    ckhMonth,
    users: result.results || [],
  }
}
