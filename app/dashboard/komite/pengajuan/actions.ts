'use server'

import { revalidatePath } from 'next/cache'
import { getDB } from '@/utils/db'
import { getSession } from '@/utils/auth/server'
import { checkFeatureAccess, getUserRoles } from '@/lib/features'
import {
  KOMITE_FEATURE_ID, KOMITE_STAGE_ROLE,
  canReviewKomite, canSubmitKomite, ensureKomitePengajuanSchema, stageForStatus,
  type KomiteReviewAction,
} from '@/lib/komite-pengajuan'
import { deleteKomiteObjects, uploadKomitePdfs } from '@/utils/r2'
import { logActivity } from '@/lib/activity-log'
import { notify } from '@/lib/notify'

const PAGE_PATH = '/dashboard/komite/pengajuan'

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

function parseNominal(value: FormDataEntryValue | null) {
  const parsed = Number(String(value || '').replace(/[^0-9]/g, ''))
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0
}

function formFiles(formData: FormData) {
  return formData.getAll('files').filter((entry): entry is File => entry instanceof File && entry.size > 0)
}

export async function getKomiteDashboardData() {
  const { db, user, roles } = await requireContext()
  const [rowsResult, reviewedResult] = await Promise.all([
    db.prepare(`
      SELECT p.*, COALESCE(u.nama_lengkap,u.name,u.email) AS pengaju_name
      FROM komite_pengajuan p JOIN "user" u ON u.id = p.pengaju_id
      ORDER BY p.updated_at DESC, p.created_at DESC
    `).all<any>(),
    db.prepare('SELECT DISTINCT pengajuan_id FROM komite_pengajuan_reviews WHERE actor_id = ?').bind(user.id).all<{ pengajuan_id: string }>(),
  ])
  const reviewedIds = new Set((reviewedResult.results || []).map(row => row.pengajuan_id))
  const isSuper = roles.includes('super_admin')
  const isMember = roles.includes('anggota_komite')
  const visible = (rowsResult.results || []).filter(row => {
    if (isSuper || row.pengaju_id === user.id || reviewedIds.has(row.id)) return true
    if (isMember && row.status === 'disetujui') return true
    const stage = stageForStatus(row.status)
    return Boolean(stage && roles.includes(KOMITE_STAGE_ROLE[stage]))
  })

  const ids = visible.map(row => row.id)
  let versions: any[] = []
  let files: any[] = []
  let reviews: any[] = []
  if (ids.length) {
    const placeholders = ids.map(() => '?').join(',')
    const [versionRows, fileRows, reviewRows] = await Promise.all([
      db.prepare(`SELECT * FROM komite_pengajuan_versions WHERE pengajuan_id IN (${placeholders}) ORDER BY version_number DESC`).bind(...ids).all<any>(),
      db.prepare(`SELECT f.id,f.version_id,f.original_filename,f.size_bytes,f.created_at,v.pengajuan_id,v.version_number
        FROM komite_pengajuan_files f JOIN komite_pengajuan_versions v ON v.id=f.version_id
        WHERE v.pengajuan_id IN (${placeholders}) ORDER BY v.version_number DESC,f.created_at`).bind(...ids).all<any>(),
      db.prepare(`SELECT * FROM komite_pengajuan_reviews WHERE pengajuan_id IN (${placeholders}) ORDER BY created_at DESC`).bind(...ids).all<any>(),
    ])
    versions = versionRows.results || []
    files = fileRows.results || []
    reviews = reviewRows.results || []
  }

  const items = visible.map(row => ({
    ...row,
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

  const reviewQueue = items.filter(item => {
    if (item.pengaju_id === user.id) return false
    const stage = stageForStatus(item.status)
    return Boolean(stage && (isSuper || roles.includes(KOMITE_STAGE_ROLE[stage])))
  })

  return {
    items,
    users,
    currentUserId: user.id,
    roles,
    canCreate: await canSubmitKomite(db, user.id, roles),
    isSuper,
    reviewCount: reviewQueue.length,
  }
}

export async function saveKomiteDraftAction(formData: FormData) {
  const { db, user, roles } = await requireContext()
  if (!(await canSubmitKomite(db, user.id, roles))) return { error: 'Anda tidak memiliki izin untuk mengajukan.' }
  const id = cleanText(formData.get('id'), 80)
  const judul = cleanText(formData.get('judul'), 180)
  const uraian = String(formData.get('uraian') || '').trim().slice(0, 4000)
  const nominal = parseNominal(formData.get('nominal'))
  const files = formFiles(formData)
  if (!judul || !uraian || !nominal) return { error: 'Judul, uraian, dan nominal wajib diisi.' }

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
      statements.push(db.prepare(`INSERT INTO komite_pengajuan (id,judul,uraian,nominal,pengaju_id,status,current_version) VALUES (?,?,?,?,?,'draft',?)`)
        .bind(pengajuanId, judul, uraian, nominal, user.id, versionNumber))
    } else {
      statements.push(db.prepare(`UPDATE komite_pengajuan SET judul=?,uraian=?,nominal=?,current_version=?,updated_at=datetime('now') WHERE id=?`)
        .bind(judul, uraian, nominal, versionNumber, pengajuanId))
    }
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
  const row = await db.prepare('SELECT * FROM komite_pengajuan WHERE id=?').bind(id).first<any>()
  if (!row || row.pengaju_id !== user.id || !['draft','perlu_revisi'].includes(row.status)) return { error: 'Pengajuan tidak dapat dikirim.' }
  const version = await db.prepare(`SELECT v.id,(SELECT COUNT(*) FROM komite_pengajuan_files f WHERE f.version_id=v.id) AS file_count
    FROM komite_pengajuan_versions v WHERE v.pengajuan_id=? AND v.version_number=?`).bind(id, row.current_version).first<any>()
  if (!version || Number(version.file_count) < 1) return { error: 'Dokumen versi aktif belum tersedia.' }
  await db.batch([
    db.prepare(`UPDATE komite_pengajuan SET status='menunggu_bendahara',submitted_at=COALESCE(submitted_at,datetime('now')),updated_at=datetime('now') WHERE id=?`).bind(id),
    db.prepare(`UPDATE komite_pengajuan_versions SET submitted_at=datetime('now') WHERE id=?`).bind(version.id),
  ])
  await logActivity({ db, module: 'komite_pengajuan', action: 'submit', summary: `Mengirim pengajuan ${row.judul} ke Bendahara Komite`, entityType: 'komite_pengajuan', entityId: id, entityLabel: row.judul })
  await notify({ title: 'Pengajuan dana baru', body: `${user.nama_lengkap || user.name} mengirim “${row.judul}”.`, url: PAGE_PATH }, { role: 'bendahara_komite' })
  revalidatePath(PAGE_PATH)
  return { success: 'Pengajuan dikirim ke Bendahara Komite.' }
}

export async function deleteKomiteDraftAction(id: string) {
  const { db, user } = await requireContext()
  const row = await db.prepare('SELECT * FROM komite_pengajuan WHERE id=?').bind(id).first<any>()
  if (!row || row.pengaju_id !== user.id || row.status !== 'draft') return { error: 'Hanya draft sendiri yang dapat dihapus.' }
  const keys = await db.prepare(`SELECT f.r2_key FROM komite_pengajuan_files f JOIN komite_pengajuan_versions v ON v.id=f.version_id WHERE v.pengajuan_id=?`).bind(id).all<{ r2_key: string }>()
  await db.prepare('DELETE FROM komite_pengajuan WHERE id=?').bind(id).run()
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
  const keys = await db.prepare(`SELECT f.r2_key FROM komite_pengajuan_files f
    JOIN komite_pengajuan_versions v ON v.id=f.version_id WHERE v.pengajuan_id=?`).bind(id).all<{ r2_key: string }>()
  try {
    await db.prepare('DELETE FROM komite_pengajuan WHERE id=?').bind(id).run()
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
  const catatan = String(formData.get('catatan') || '').trim().slice(0, 3000)
  if (!['setujui','minta_revisi','tolak'].includes(action)) return { error: 'Aksi review tidak valid.' }
  if (action !== 'setujui' && !catatan) return { error: 'Catatan wajib diisi untuk revisi atau penolakan.' }
  const row = await db.prepare('SELECT * FROM komite_pengajuan WHERE id=?').bind(id).first<any>()
  if (!row) return { error: 'Pengajuan tidak ditemukan.' }
  const permission = await canReviewKomite(db, user.id, row.pengaju_id, row.status, roles)
  if (!permission.allowed || !permission.stage) return { error: 'Anda tidak berwenang memproses tahap ini.' }

  let nomorSpb = row.nomor_spb
  let penerima = row.penerima_pembayaran
  if (permission.stage === 'bendahara' && action === 'setujui') {
    nomorSpb = cleanText(formData.get('nomor_spb'), 100)
    penerima = cleanText(formData.get('penerima_pembayaran'), 180)
    if (!nomorSpb || !penerima) return { error: 'Nomor SPB dan penerima pembayaran wajib diisi.' }
    const duplicate = await db.prepare('SELECT id FROM komite_pengajuan WHERE nomor_spb=? COLLATE NOCASE AND id<>? LIMIT 1').bind(nomorSpb, id).first()
    if (duplicate) return { error: 'Nomor SPB sudah digunakan pengajuan lain.' }
  }

  const actor = await db.prepare('SELECT COALESCE(nama_lengkap,name,email) AS name,signature_url FROM "user" WHERE id=?').bind(user.id).first<any>()
  const nextStatus = action === 'minta_revisi' ? 'perlu_revisi'
    : action === 'tolak' ? 'ditolak'
      : permission.stage === 'bendahara' ? 'menunggu_ketua'
        : permission.stage === 'ketua' ? 'menunggu_kepala' : 'disetujui'
  const actorRole = permission.bypass ? 'super_admin' : KOMITE_STAGE_ROLE[permission.stage]
  const reviewId = crypto.randomUUID()
  try {
    await db.batch([
      db.prepare(`INSERT INTO komite_pengajuan_reviews
        (id,pengajuan_id,version_number,stage,action,catatan,actor_id,actor_name,actor_role,actor_signature_url,is_super_admin_bypass,nomor_spb_snapshot,penerima_snapshot)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(reviewId,id,row.current_version,permission.stage,action,catatan || null,user.id,actor?.name || user.name,actorRole,actor?.signature_url || null,permission.bypass ? 1 : 0,nomorSpb || null,penerima || null),
      db.prepare(`UPDATE komite_pengajuan SET status=?,nomor_spb=?,penerima_pembayaran=?,
        approved_at=CASE WHEN ?='disetujui' THEN datetime('now') ELSE approved_at END,
        rejected_at=CASE WHEN ?='ditolak' THEN datetime('now') ELSE rejected_at END,
        updated_at=datetime('now') WHERE id=? AND status=?`)
        .bind(nextStatus,nomorSpb || null,penerima || null,nextStatus,nextStatus,id,row.status),
    ])
  } catch (error: any) {
    if (error?.message?.includes('UNIQUE')) {
      const latest = await db.prepare('SELECT status FROM komite_pengajuan WHERE id=?').bind(id).first<{ status: string }>()
      return { error: latest?.status !== row.status ? 'Tahap ini sudah diproses pengguna lain.' : 'Nomor SPB sudah digunakan atau tahap ini sudah pernah diproses.' }
    }
    return { error: error?.message || 'Gagal menyimpan review.' }
  }
  await logActivity({ db, module: 'komite_pengajuan', action: `review_${action}`, severity: action === 'tolak' ? 'warning' : 'info', summary: `${action === 'setujui' ? 'Menyetujui' : action === 'minta_revisi' ? 'Meminta revisi' : 'Menolak'} pengajuan ${row.judul} pada tahap ${permission.stage}`, entityType: 'komite_pengajuan', entityId: id, entityLabel: row.judul, metadata: { stage: permission.stage, bypass: permission.bypass, version: row.current_version } })

  if (nextStatus === 'menunggu_ketua') await notify({ title: 'Pengajuan menunggu review', body: `“${row.judul}” menunggu persetujuan Ketua Komite.`, url: PAGE_PATH }, { role: 'ketua_komite' })
  else if (nextStatus === 'menunggu_kepala') await notify({ title: 'Pengajuan menunggu review', body: `“${row.judul}” menunggu persetujuan Kepala Madrasah.`, url: PAGE_PATH }, { role: 'kepsek' })
  else if (nextStatus === 'perlu_revisi') await notify({ title: 'Pengajuan perlu revisi', body: `“${row.judul}” perlu diperbaiki. Buka riwayat untuk melihat catatan reviewer.`, url: PAGE_PATH }, { userId: row.pengaju_id })
  else if (nextStatus === 'ditolak') await notify({ title: 'Pengajuan ditolak', body: `“${row.judul}” ditolak.`, url: PAGE_PATH }, { userId: row.pengaju_id })
  else if (nextStatus === 'disetujui') await notify({ title: 'Pengajuan disetujui', body: `“${row.judul}” disetujui. SPB telah tersedia.`, url: PAGE_PATH }, { userId: row.pengaju_id })
  revalidatePath(PAGE_PATH)
  return { success: nextStatus === 'disetujui' ? 'Pengajuan disetujui dan SPB telah terbit.' : 'Review berhasil disimpan.' }
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
