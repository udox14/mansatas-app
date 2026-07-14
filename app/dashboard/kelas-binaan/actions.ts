'use server'

import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { revalidatePath } from 'next/cache'
import { getUserRoles } from '@/lib/features'
import { createActivityDiff, logActivity } from '@/lib/activity-log'

const KELAS_BINAAN_DOMISILI = [
  'Pesantren Sukamanah',
  'Pesantren Sukahideng',
  'Pesantren Sukaguru',
  "Pesantren Al-Ma'mur",
  'Warga Desa Sukarapih',
  'Warga Desa Wargakerta',
  'KELUAR DARI PESANTREN',
] as const

async function ensureParentCommunicationTables(db: D1Database) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS parent_notifications (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      siswa_id TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      source_ref TEXT,
      level TEXT NOT NULL DEFAULT 'info',
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(siswa_id, type, source_ref)
    )
  `).run()

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS parent_summons (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      siswa_id TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
      source_ref TEXT,
      reason TEXT NOT NULL,
      event_date TEXT,
      event_time TEXT,
      location TEXT,
      note TEXT,
      status TEXT NOT NULL DEFAULT 'terkirim',
      parent_response TEXT,
      parent_response_note TEXT,
      parent_responded_at TEXT,
      created_by TEXT REFERENCES "user"(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(siswa_id, source_ref)
    )
  `).run()

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS parent_thread_notes (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      siswa_id TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
      actor_type TEXT NOT NULL,
      actor_id TEXT,
      note_type TEXT NOT NULL DEFAULT 'tindak_lanjut',
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run()
}

async function canAccessStudentClass(db: D1Database, userId: string, siswaId: string, roles: string[]) {
  const isAdmin = roles.some(role => ['super_admin', 'admin_tu', 'kepsek', 'wakamad'].includes(role))
  if (isAdmin) return true

  const row = await db.prepare(`
    SELECT s.id
    FROM siswa s
    JOIN kelas k ON k.id = s.kelas_id
    WHERE s.id = ? AND k.wali_kelas_id = ?
    LIMIT 1
  `).bind(siswaId, userId).first<any>()
  return !!row
}

function normalizeWhatsAppNumber(raw: string) {
  let value = String(raw || '').trim().replace(/[^\d+]/g, '')
  if (value.startsWith('+')) value = value.slice(1)
  if (value.startsWith('0')) value = `62${value.slice(1)}`
  if (value.startsWith('8')) value = `62${value}`
  return value
}

export async function updateStudentQuickDataFromKelasBinaan(payload: {
  siswaId: string
  tempatTinggal: string
  nomorWhatsapp: string
}) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Sesi berakhir. Silakan login kembali.' }

  const siswaId = String(payload.siswaId || '').trim()
  const tempatTinggal = String(payload.tempatTinggal || '').trim()
  const nomorWhatsapp = normalizeWhatsAppNumber(payload.nomorWhatsapp)

  if (!siswaId) return { error: 'Siswa tidak valid.' }
  if (!KELAS_BINAAN_DOMISILI.includes(tempatTinggal as (typeof KELAS_BINAAN_DOMISILI)[number])) {
    return { error: 'Status domisili tidak valid. Silakan pilih salah satu opsi yang tersedia.' }
  }
  if (nomorWhatsapp && (!/^\d{10,15}$/.test(nomorWhatsapp) || !nomorWhatsapp.startsWith('62'))) {
    return { error: 'Nomor WhatsApp tidak valid. Gunakan format 08..., 628..., atau +628...' }
  }

  const db = await getDB()
  const roles = await getUserRoles(db, user.id)
  const allowed = await canAccessStudentClass(db, user.id, siswaId, roles)
  if (!allowed) return { error: 'Akses ditolak. Siswa bukan bagian dari kelas binaan Anda.' }

  const before = await db.prepare(`
    SELECT id, nama_lengkap, kelas_id, tempat_tinggal, desa_kelurahan, nomor_whatsapp
    FROM siswa
    WHERE id = ? AND status = 'aktif'
    LIMIT 1
  `).bind(siswaId).first<any>()
  if (!before) return { error: 'Data siswa aktif tidak ditemukan.' }

  const storedTempatTinggal = tempatTinggal.startsWith('Pesantren ')
    ? tempatTinggal
    : 'Non-Pesantren'
  let storedDesaKelurahan = before.desa_kelurahan || null
  if (tempatTinggal === 'Warga Desa Sukarapih') storedDesaKelurahan = 'Sukarapih'
  if (tempatTinggal === 'Warga Desa Wargakerta') storedDesaKelurahan = 'Wargakerta'
  if (tempatTinggal === 'KELUAR DARI PESANTREN') {
    const currentVillage = String(before.desa_kelurahan || '').trim().toLowerCase()
    if (!currentVillage || currentVillage.includes('sukarapih') || currentVillage.includes('wargakerta')) {
      storedDesaKelurahan = 'KELUAR DARI PESANTREN'
    }
  }

  try {
    await db.prepare(`
      UPDATE siswa
      SET tempat_tinggal = ?, desa_kelurahan = ?, nomor_whatsapp = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(storedTempatTinggal, storedDesaKelurahan, nomorWhatsapp || null, siswaId).run()
  } catch (error: any) {
    const isConstraintError = String(error?.message || error).toLowerCase().includes('constraint')
    return {
      error: isConstraintError
        ? 'Data domisili tidak dapat disimpan karena validasi database.'
        : 'Gagal menyimpan data siswa. Silakan coba lagi.',
    }
  }

  const after = {
    ...before,
    tempat_tinggal: storedTempatTinggal,
    desa_kelurahan: storedDesaKelurahan,
    nomor_whatsapp: nomorWhatsapp || null,
  }
  await logActivity({
    db,
    module: 'kelas-binaan',
    action: 'quick_edit_siswa',
    severity: tempatTinggal === 'KELUAR DARI PESANTREN' ? 'warning' : 'info',
    summary: `Memperbarui domisili dan WhatsApp orang tua ${before.nama_lengkap}`,
    entityType: 'siswa',
    entityId: siswaId,
    entityLabel: before.nama_lengkap,
    before,
    after,
    diff: createActivityDiff(before, after),
    metadata: { flagged: tempatTinggal === 'KELUAR DARI PESANTREN' },
  })

  revalidatePath('/dashboard/kelas-binaan')
  revalidatePath('/dashboard/siswa')
  revalidatePath(`/dashboard/siswa/${siswaId}`)
  revalidatePath('/portal-ortu')

  return {
    success: tempatTinggal === 'KELUAR DARI PESANTREN'
      ? 'Data tersimpan dan siswa otomatis ditandai keluar dari pesantren.'
      : 'Data siswa berhasil diperbarui.',
    nomorWhatsapp,
    flagged: tempatTinggal === 'KELUAR DARI PESANTREN',
  }
}

export async function createParentSummonFromKelasBinaan(formData: FormData) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  const db = await getDB()
  await ensureParentCommunicationTables(db)
  const roles = await getUserRoles(db, user.id)

  const siswaId = String(formData.get('siswa_id') || '').trim()
  const kelasId = String(formData.get('kelas_id') || '').trim()
  const reason = String(formData.get('reason') || 'Pemanggilan orang tua').trim()
  const note = String(formData.get('note') || '').trim()
  const eventDate = String(formData.get('event_date') || '').trim() || null
  const eventTime = String(formData.get('event_time') || '').trim() || null
  const location = String(formData.get('location') || 'Ruang BK / Wali Kelas').trim() || null

  if (!siswaId) return { error: 'Siswa tidak valid.' }
  const allowed = await canAccessStudentClass(db, user.id, siswaId, roles)
  if (!allowed) return { error: 'Akses ditolak.' }

  const sourceRef = `kelas-binaan:${user.id}:${Date.now()}`

  await db.prepare(`
    INSERT INTO parent_summons
    (siswa_id, source_ref, reason, event_date, event_time, location, note, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).bind(siswaId, sourceRef, reason, eventDate, eventTime, location, note || null, user.id).run()

  await db.prepare(`
    INSERT INTO parent_notifications (siswa_id, type, title, message, source_ref, level)
    VALUES (?, 'pemanggilan', 'Pemanggilan Orang Tua', ?, ?, 'critical')
  `).bind(
    siswaId,
    `${reason}${note ? ` - ${note}` : ''}`,
    sourceRef
  ).run()

  await db.prepare(`
    INSERT INTO parent_thread_notes (siswa_id, actor_type, actor_id, note_type, content)
    VALUES (?, 'wali_kelas', ?, 'pemanggilan', ?)
  `).bind(
    siswaId,
    user.id,
    `${reason}${note ? `. Catatan: ${note}` : ''}`
  ).run()

  revalidatePath('/dashboard/kelas-binaan')
  if (kelasId) revalidatePath(`/dashboard/kelas-binaan?kelas=${kelasId}`)
  revalidatePath('/portal-ortu')

  return { success: 'Pemanggilan orang tua berhasil dibuat.' }
}

export async function cancelLatestParentSummonFromKelasBinaan(formData: FormData) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  const db = await getDB()
  await ensureParentCommunicationTables(db)
  const roles = await getUserRoles(db, user.id)

  const siswaId = String(formData.get('siswa_id') || '').trim()
  const kelasId = String(formData.get('kelas_id') || '').trim()
  const note = String(formData.get('note') || 'Pemanggilan dibatalkan oleh wali kelas.').trim()

  if (!siswaId) return { error: 'Siswa tidak valid.' }
  const allowed = await canAccessStudentClass(db, user.id, siswaId, roles)
  if (!allowed) return { error: 'Akses ditolak.' }

  const latest = await db.prepare(`
    SELECT id, status
    FROM parent_summons
    WHERE siswa_id = ?
    ORDER BY created_at DESC
    LIMIT 1
  `).bind(siswaId).first<{ id: string; status: string }>()

  if (!latest) return { error: 'Belum ada pemanggilan untuk dibatalkan.' }
  if (latest.status === 'dibatalkan') return { error: 'Pemanggilan terbaru sudah dibatalkan.' }
  if (latest.status === 'selesai') return { error: 'Pemanggilan sudah selesai dan tidak bisa dibatalkan.' }

  await db.prepare(`
    UPDATE parent_summons
    SET status = 'dibatalkan', updated_at = datetime('now')
    WHERE id = ?
  `).bind(latest.id).run()

  await db.prepare(`
    INSERT INTO parent_notifications (siswa_id, type, title, message, source_ref, level)
    VALUES (?, 'pemanggilan_batal', 'Pemanggilan Dibatalkan', ?, ?, 'info')
  `).bind(
    siswaId,
    note,
    `cancel:${latest.id}`
  ).run()

  await db.prepare(`
    INSERT INTO parent_thread_notes (siswa_id, actor_type, actor_id, note_type, content)
    VALUES (?, 'wali_kelas', ?, 'pemanggilan_batal', ?)
  `).bind(siswaId, user.id, note).run()

  revalidatePath('/dashboard/kelas-binaan')
  if (kelasId) revalidatePath(`/dashboard/kelas-binaan?kelas=${kelasId}`)
  revalidatePath('/portal-ortu')
  return { success: 'Pemanggilan terbaru berhasil dibatalkan.' }
}
