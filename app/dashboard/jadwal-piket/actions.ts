'use server'

import { dbInsert, dbUpdate, dbDelete, dbBatchInsert } from '@/utils/db'
import { getDB as getRawDB } from '@/utils/db-server'
import { requireActionAccess } from '@/lib/action-security'

async function getDB() {
  await requireActionAccess('jadwal-piket', 'read')
  return getRawDB()
}
import { getCurrentUser } from '@/utils/auth/server'
import { revalidatePath } from 'next/cache'
import { checkFeatureAccess } from '@/lib/features'
import { createActivityDiff, logActivity } from '@/lib/activity-log'

export type ShiftPiket = {
  id: number
  nama_shift: string
  jam_mulai: number
  jam_selesai: number
}

export type JadwalPiket = {
  id: string
  user_id: string
  hari: number
  shift_id: number
  nama_lengkap: string
}

const DEFAULT_SHIFTS: ShiftPiket[] = [
  { id: 1, nama_shift: 'Shift 1', jam_mulai: 1, jam_selesai: 5 },
  { id: 2, nama_shift: 'Shift 2', jam_mulai: 6, jam_selesai: 99 },
]

async function ensureDefaultShiftPiket(db: D1Database) {
  for (const shift of DEFAULT_SHIFTS) {
    await db.prepare(`
      INSERT OR IGNORE INTO pengaturan_shift_piket (id, nama_shift, jam_mulai, jam_selesai)
      VALUES (?, ?, ?, ?)
    `).bind(shift.id, shift.nama_shift, shift.jam_mulai, shift.jam_selesai).run()
  }
}

async function tableExists(db: D1Database, tableName: string) {
  const row = await db.prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table' AND name = ?
    LIMIT 1
  `).bind(tableName).first<{ name: string }>()
  return Boolean(row)
}

async function syncGuruPiketRoles(db: D1Database) {
  try {
    await db.prepare(`
      INSERT OR IGNORE INTO master_roles (value, label, is_custom)
      VALUES ('guru_piket', 'Guru Piket', 0)
    `).run()

    const piketRes = await db.prepare(`
      SELECT DISTINCT user_id FROM jadwal_guru_piket WHERE user_id IS NOT NULL AND user_id != ''
    `).all<{ user_id: string }>()

    const activePiketUserIds = new Set((piketRes.results || []).map(r => r.user_id))

    for (const uid of activePiketUserIds) {
      const rolesRes = await db.prepare(`
        SELECT role FROM user_roles WHERE user_id = ?
      `).bind(uid).all<{ role: string }>()

      const existingRoles = (rolesRes.results || []).map(r => r.role)

      if (existingRoles.length === 0) {
        const u = await db.prepare(`SELECT role FROM "user" WHERE id = ?`).bind(uid).first<{ role: string }>()
        const primaryRole = u?.role || 'guru'

        await db.batch([
          db.prepare('INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?, ?)').bind(uid, primaryRole),
          db.prepare('INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?, ?)').bind(uid, 'guru_piket'),
        ])
      } else if (!existingRoles.includes('guru_piket')) {
        await db.prepare('INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?, ?)').bind(uid, 'guru_piket').run()
      }
    }

    const oldPiketRolesRes = await db.prepare(`
      SELECT user_id FROM user_roles WHERE role = 'guru_piket'
    `).all<{ user_id: string }>()

    for (const row of oldPiketRolesRes.results || []) {
      if (!activePiketUserIds.has(row.user_id)) {
        await db.prepare(`DELETE FROM user_roles WHERE user_id = ? AND role = 'guru_piket'`).bind(row.user_id).run()

        const u = await db.prepare(`SELECT role FROM "user" WHERE id = ?`).bind(row.user_id).first<{ role: string }>()
        if (u?.role === 'guru_piket') {
          const remRolesRes = await db.prepare(`SELECT role FROM user_roles WHERE user_id = ?`).bind(row.user_id).all<{ role: string }>()
          const remRoles = (remRolesRes.results || []).map(r => r.role)
          const newPrimary = remRoles[0] || 'guru'
          await db.prepare(`UPDATE "user" SET role = ?, updatedAt = datetime('now') WHERE id = ?`).bind(newPrimary, row.user_id).run()
        }
      }
    }
  } catch (err) {
    console.error('Error syncing guru piket roles:', err)
  }
}

export async function getJadwalPiketData(): Promise<{
  shifts: ShiftPiket[]
  jadwal: JadwalPiket[]
}> {
  const db = await getDB()
  await ensureDefaultShiftPiket(db)
  await syncGuruPiketRoles(db)
  
  const shiftsRes = await db.prepare('SELECT * FROM pengaturan_shift_piket ORDER BY id ASC').all<ShiftPiket>()
  
  const jadwalRes = await db.prepare(`
    SELECT j.*, u.nama_lengkap
    FROM jadwal_guru_piket j
    JOIN "user" u ON j.user_id = u.id
    ORDER BY j.hari ASC, j.shift_id ASC, u.nama_lengkap ASC
  `).all<JadwalPiket>()

  return {
    shifts: shiftsRes.results || [],
    jadwal: jadwalRes.results || []
  }
}

export async function getDaftarGuruDropdown(): Promise<Array<{ id: string; nama: string; isGuruPpl: boolean }>> {
  const db = await getDB()
  const res = await db.prepare(
    `SELECT u.id, u.nama_lengkap,
      CASE WHEN u.role = 'guru_ppl' OR EXISTS (
        SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role = 'guru_ppl'
      ) THEN 1 ELSE 0 END AS is_guru_ppl
    FROM "user" u
    WHERE u.banned = 0
    ORDER BY u.nama_lengkap ASC`
  ).all<any>()
  return (res.results || []).map(u => ({
    id: u.id,
    nama: u.nama_lengkap || 'Tanpa Nama',
    isGuruPpl: Boolean(u.is_guru_ppl),
  }))
}

async function authorizeJadwalPiketMutation() {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' as const }
  const db = await getDB()
  if (!(await checkFeatureAccess(db, user.id, 'jadwal-piket'))) {
    return { error: 'Tidak memiliki akses' as const }
  }
  return { db, user }
}

/** Menambahkan beberapa guru untuk beberapa hari dalam satu proses. */
export async function tambahJadwalPiketMassal(
  userIds: string[],
  hariList: number[],
  shiftId: number,
): Promise<{ error?: string; success?: string; added?: number; skipped?: number }> {
  const access = await authorizeJadwalPiketMutation()
  if ('error' in access) return access
  const { db } = access

  const uniqueUserIds = [...new Set(userIds.filter(Boolean))]
  const uniqueHari = [...new Set(hariList)].filter(hari => Number.isInteger(hari) && hari >= 1 && hari <= 6)
  if (!uniqueUserIds.length) return { error: 'Pilih minimal satu guru.' }
  if (!uniqueHari.length) return { error: 'Pilih minimal satu hari (Senin–Sabtu).' }
  if (!Number.isInteger(shiftId) || shiftId < 1) return { error: 'Shift piket tidak valid.' }
  if (uniqueHari.includes(5) && shiftId !== 1) return { error: 'Jumat hanya dapat menggunakan Shift 1.' }

  const total = uniqueUserIds.length * uniqueHari.length
  if (total > 1000) return { error: 'Maksimal 1.000 jadwal dalam sekali proses.' }

  await ensureDefaultShiftPiket(db)
  const [guruRes, shiftExists] = await Promise.all([
    db.prepare(`SELECT id FROM "user" WHERE id IN (${uniqueUserIds.map(() => '?').join(', ')})`)
      .bind(...uniqueUserIds).all<{ id: string }>(),
    db.prepare('SELECT id FROM pengaturan_shift_piket WHERE id = ?').bind(shiftId).first<{ id: number }>(),
  ])
  if (!shiftExists) return { error: 'Shift piket belum tersedia. Coba simpan pengaturan shift dulu.' }
  if ((guruRes.results || []).length !== uniqueUserIds.length) return { error: 'Satu atau lebih guru tidak ditemukan. Coba muat ulang halaman.' }

  const existingRes = await db.prepare(`
    SELECT user_id, hari FROM jadwal_guru_piket
    WHERE shift_id = ?
      AND user_id IN (${uniqueUserIds.map(() => '?').join(', ')})
      AND hari IN (${uniqueHari.map(() => '?').join(', ')})
  `).bind(shiftId, ...uniqueUserIds, ...uniqueHari).all<{ user_id: string; hari: number }>()
  const existing = new Set((existingRes.results || []).map(row => `${row.user_id}:${row.hari}`))
  const rows = uniqueUserIds.flatMap(user_id => uniqueHari
    .filter(hari => !existing.has(`${user_id}:${hari}`))
    .map(hari => ({ user_id, hari, shift_id: shiftId })))

  if (!rows.length) return { success: 'Semua kombinasi yang dipilih sudah ada.', added: 0, skipped: total }
  const result = await dbBatchInsert(db, 'jadwal_guru_piket', rows)
  if (result.error) return { error: result.error }

  await syncGuruPiketRoles(db)
  await logActivity({
    db,
    module: 'jadwal-piket',
    action: 'create_jadwal_massal',
    summary: `Menambahkan ${rows.length} jadwal piket secara massal`,
    entityType: 'jadwal_guru_piket',
    entityId: 'bulk',
    entityLabel: `${uniqueUserIds.length} guru, ${uniqueHari.length} hari`,
    after: { userIds: uniqueUserIds, hariList: uniqueHari, shiftId, added: rows.length },
  })
  revalidatePath('/dashboard/jadwal-piket')
  revalidatePath('/dashboard/guru')
  revalidatePath('/dashboard/penugasan')
  return { success: `${rows.length} jadwal berhasil ditambahkan${existing.size ? `; ${existing.size} jadwal yang sudah ada dilewati.` : '.'}`, added: rows.length, skipped: existing.size }
}

/** Menghapus beberapa jadwal sekaligus, beserta relasi turunannya yang relevan. */
export async function hapusJadwalPiketMassal(ids: string[]): Promise<{ error?: string; success?: string; deleted?: number }> {
  const access = await authorizeJadwalPiketMutation()
  if ('error' in access) return access
  const { db } = access
  const uniqueIds = [...new Set(ids.filter(Boolean))]
  if (!uniqueIds.length) return { error: 'Pilih jadwal yang akan dihapus.' }
  if (uniqueIds.length > 1000) return { error: 'Maksimal 1.000 jadwal dalam sekali proses.' }

  // D1/SQLite memiliki batas jumlah parameter per query. Chunk menjaga hapus
  // massal tetap andal untuk jadwal besar.
  const idChunks = Array.from({ length: Math.ceil(uniqueIds.length / 100) }, (_, index) => uniqueIds.slice(index * 100, (index + 1) * 100))
  const before: any[] = []
  for (const idChunk of idChunks) {
    const placeholders = idChunk.map(() => '?').join(', ')
    const beforeRes = await db.prepare(`
      SELECT j.*, u.nama_lengkap FROM jadwal_guru_piket j
      LEFT JOIN "user" u ON u.id = j.user_id
      WHERE j.id IN (${placeholders})
    `).bind(...idChunk).all<any>()
    before.push(...(beforeRes.results || []))
  }
  if (!before.length) return { error: 'Jadwal yang dipilih tidak ditemukan.' }

  const hasAgendaPiket = await tableExists(db, 'agenda_piket')
  for (const idChunk of idChunks) {
    const placeholders = idChunk.map(() => '?').join(', ')
    const statements = []
    if (hasAgendaPiket) statements.push(db.prepare(`DELETE FROM agenda_piket WHERE jadwal_id IN (${placeholders})`).bind(...idChunk))
    statements.push(db.prepare(`DELETE FROM jadwal_guru_piket WHERE id IN (${placeholders})`).bind(...idChunk))
    await db.batch(statements)
  }

  await syncGuruPiketRoles(db)
  await logActivity({
    db,
    module: 'jadwal-piket',
    action: 'delete_jadwal_massal',
    severity: 'danger',
    summary: `Menghapus ${before.length} jadwal piket secara massal`,
    entityType: 'jadwal_guru_piket',
    entityId: 'bulk',
    entityLabel: `${before.length} jadwal`,
    before,
  })
  revalidatePath('/dashboard/jadwal-piket')
  revalidatePath('/dashboard/guru')
  revalidatePath('/dashboard/penugasan')
  revalidatePath('/dashboard/kelola-ppl')
  revalidatePath('/dashboard/agenda')
  return { success: `${before.length} jadwal berhasil dihapus.`, deleted: before.length }
}

export async function tambahJadwalPiket(user_id: string, hari: number, shift_id: number): Promise<{ error?: string, success?: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }
  const db = await getDB()
  if (!(await checkFeatureAccess(db, user.id, 'jadwal-piket'))) {
    return { error: 'Tidak memiliki akses' }
  }

  await ensureDefaultShiftPiket(db)

  if (!user_id) return { error: 'Guru wajib dipilih.' }
  if (!Number.isInteger(hari) || hari < 1 || hari > 7) return { error: 'Hari piket tidak valid.' }
  if (!Number.isInteger(shift_id) || shift_id < 1) return { error: 'Shift piket tidak valid.' }

  const [guruExists, shiftExists] = await Promise.all([
    db.prepare('SELECT id FROM "user" WHERE id = ?').bind(user_id).first<{ id: string }>(),
    db.prepare('SELECT id FROM pengaturan_shift_piket WHERE id = ?').bind(shift_id).first<{ id: number }>(),
  ])

  if (!guruExists) return { error: 'Guru yang dipilih tidak ditemukan. Coba muat ulang halaman.' }
  if (!shiftExists) return { error: 'Shift piket belum tersedia. Coba simpan pengaturan shift dulu.' }

  // Check unique
  const exist = await db.prepare('SELECT id FROM jadwal_guru_piket WHERE user_id = ? AND hari = ? AND shift_id = ?').bind(user_id, hari, shift_id).first()
  if (exist) return { error: 'Guru ini sudah memiliki jadwal pada shift tersebut.' }

  const guru = await db.prepare('SELECT id, nama_lengkap FROM "user" WHERE id = ?').bind(user_id).first<any>()
  const res = await dbInsert<any>(db, 'jadwal_guru_piket', {
    user_id, hari, shift_id
  })

  if (res.error) return { error: res.error }

  await syncGuruPiketRoles(db)

  await logActivity({
    db,
    module: 'jadwal-piket',
    action: 'create_jadwal',
    summary: `Menambahkan jadwal piket ${guru?.nama_lengkap || user_id}`,
    entityType: 'jadwal_guru_piket',
    entityId: res.data?.id,
    entityLabel: guru?.nama_lengkap || user_id,
    after: res.data ?? { user_id, hari, shift_id },
  })

  revalidatePath('/dashboard/jadwal-piket')
  revalidatePath('/dashboard/guru')
  revalidatePath('/dashboard/penugasan')
  return { success: 'Jadwal ditambahkan.' }
}

export async function hapusJadwalPiket(id: string): Promise<{ error?: string, success?: string }> {
  try {
    const user = await getCurrentUser()
    if (!user) return { error: 'Unauthorized' }
    const db = await getDB()
    if (!(await checkFeatureAccess(db, user.id, 'jadwal-piket'))) {
      return { error: 'Tidak memiliki akses' }
    }
    const before = await db.prepare(`
      SELECT j.*, u.nama_lengkap
      FROM jadwal_guru_piket j
      LEFT JOIN "user" u ON u.id = j.user_id
      WHERE j.id = ?
    `).bind(id).first<any>()

    const hasAgendaPiket = await tableExists(db, 'agenda_piket')

    // Bersihkan relasi turunan lebih dulu agar tidak bergantung penuh pada
    // cascade FK di environment yang schema-nya belum lengkap.
    if (hasAgendaPiket) {
      await db.prepare('DELETE FROM agenda_piket WHERE jadwal_id = ?').bind(id).run()
    }
    const res = await dbDelete(db, 'jadwal_guru_piket', { id })
    if (res.error) return { error: res.error }

    await syncGuruPiketRoles(db)

    await logActivity({
      db,
      module: 'jadwal-piket',
      action: 'delete_jadwal',
      severity: 'danger',
      summary: `Menghapus jadwal piket ${before?.nama_lengkap || id}`,
      entityType: 'jadwal_guru_piket',
      entityId: id,
      entityLabel: before?.nama_lengkap || id,
      before,
    })

    revalidatePath('/dashboard/jadwal-piket')
    revalidatePath('/dashboard/guru')
    revalidatePath('/dashboard/penugasan')
    revalidatePath('/dashboard/kelola-ppl')
    revalidatePath('/dashboard/agenda')
    return { success: 'Jadwal dihapus.' }
  } catch (error: any) {
    return { error: error?.message || 'Gagal menghapus jadwal piket.' }
  }
}

export async function simpanPengaturanShift(data: Array<{ id: number, jam_mulai: number, jam_selesai: number }>): Promise<{ error?: string, success?: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }
  const db = await getDB()
  if (!(await checkFeatureAccess(db, user.id, 'jadwal-piket'))) {
    return { error: 'Tidak memiliki akses' }
  }

  await ensureDefaultShiftPiket(db)
  const beforeRows = await db.prepare('SELECT * FROM pengaturan_shift_piket ORDER BY id ASC').all<any>()

  for (const s of data) {
    if (s.jam_mulai < 1 || s.jam_selesai < s.jam_mulai) return { error: 'Rentang jam tidak valid.' }
    await db.prepare('UPDATE pengaturan_shift_piket SET jam_mulai = ?, jam_selesai = ? WHERE id = ?')
            .bind(s.jam_mulai, s.jam_selesai, s.id).run()
  }

  await logActivity({
    db,
    module: 'jadwal-piket',
    action: 'set_shift',
    summary: 'Mengubah pengaturan shift piket',
    entityType: 'pengaturan_shift_piket',
    entityId: 'default',
    entityLabel: 'Shift piket',
    before: beforeRows.results ?? [],
    after: data,
    diff: createActivityDiff({ shifts: beforeRows.results ?? [] }, { shifts: data }),
  })

  revalidatePath('/dashboard/jadwal-piket')
  revalidatePath('/dashboard/penugasan')
  return { success: 'Pengaturan shift disimpan.' }
}
