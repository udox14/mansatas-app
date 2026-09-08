'use server'

import { requireActionAccess } from '@/lib/action-security'
import { getDB } from '@/utils/db-server'
import { revalidatePath } from 'next/cache'
import { readTeacherLeaveReasons, validateTeacherLeaveReason } from '@/lib/teacher-leave-db'
import type { TeacherLeaveReason } from '@/lib/teacher-leave'

function refresh() { revalidatePath('/dashboard', 'layout') }

export async function getTeacherLeaveOptions() {
  await requireActionAccess(['monitoring-agenda', 'monitoring-penugasan'], 'read', { allowedRoles: ['super_admin'] })
  return { reasons: await readTeacherLeaveReasons(await getDB()), canManage: true }
}

export async function saveTeacherLeaveReason(input: TeacherLeaveReason) {
  const actor = await requireActionAccess(['monitoring-agenda', 'monitoring-penugasan'], 'update', { allowedRoles: ['super_admin'] })
  const nama = input.nama.trim()
  if (!nama || nama.length > 120 || typeof input.kepentingan_sekolah !== 'boolean' || typeof input.aktif !== 'boolean') {
    return { error: 'Nama alasan wajib diisi, maksimal 120 karakter.' }
  }
  const db = await getDB()
  const before = input.id ? await db.prepare('SELECT * FROM alasan_izin_guru WHERE id = ?').bind(input.id).first() : null
  if (input.id && !before) return { error: 'Alasan tidak ditemukan.' }
  const id = input.id || crypto.randomUUID()
  try {
    await db.batch([
      db.prepare(`INSERT INTO alasan_izin_guru (id, nama, kepentingan_sekolah, aktif, created_by, updated_by)
        VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET nama = excluded.nama,
        kepentingan_sekolah = excluded.kepentingan_sekolah, aktif = excluded.aktif,
        updated_by = excluded.updated_by, updated_at = datetime('now')`)
        .bind(id, nama, Number(input.kepentingan_sekolah), Number(input.aktif), actor.id, actor.id),
      db.prepare('INSERT INTO izin_guru_audit (id, actor_id, action, target_id, before_json, after_json) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(crypto.randomUUID(), actor.id, 'MASTER', id, JSON.stringify(before), JSON.stringify({ ...input, id, nama })),
    ])
    refresh()
    return { success: 'Alasan disimpan. Performa dan cetakan terkait mengikuti kategori terbaru.' }
  } catch {
    return { error: 'Gagal menyimpan. Pastikan nama alasan belum digunakan.' }
  }
}

export type TeacherLeaveMappingTarget = { delegasi_id: string } | { penugasan_id: string; tanggal: string }

export async function mapTeacherLeaveReasons(targets: TeacherLeaveMappingTarget[], reasonId: string) {
  const actor = await requireActionAccess(['monitoring-agenda', 'monitoring-penugasan'], 'update', { allowedRoles: ['super_admin'] })
  if (!targets.length || targets.length > 100) return { error: 'Pilih 1–100 izin.' }
  const db = await getDB()
  try { await validateTeacherLeaveReason(db, 'IZIN', reasonId) } catch { return { error: 'Pilih alasan izin yang masih aktif.' } }
  const unique = [...new Map(targets.map(target => [JSON.stringify(target), target])).values()]
  const statements: D1PreparedStatement[] = []
  for (const target of unique) {
    let before: Record<string, unknown> | null
    let targetId: string
    if ('delegasi_id' in target) {
      before = await db.prepare("SELECT * FROM delegasi_tugas WHERE id = ? AND alasan_ketidakhadiran = 'IZIN'").bind(target.delegasi_id).first()
      if (!before) return { error: 'Salah satu penugasan tidak ditemukan atau bukan izin. Muat ulang data.' }
      targetId = target.delegasi_id
      statements.push(db.prepare("UPDATE delegasi_tugas SET alasan_izin_guru_id = ?, updated_at = datetime('now') WHERE id = ? AND alasan_ketidakhadiran = 'IZIN'").bind(reasonId, targetId))
    } else {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(target.tanggal)) return { error: 'Tanggal tidak valid.' }
      before = await db.prepare(`SELECT pm.guru_id, ag.id AS agenda_id, ag.alasan_izin_guru_id,
        COALESCE(ag.status, dt.alasan_ketidakhadiran) AS status,
        COALESCE(ag.jam_ke_mulai, MIN(jm.jam_ke)) AS mulai, COALESCE(ag.jam_ke_selesai, MAX(jm.jam_ke)) AS selesai
        FROM penugasan_mengajar pm LEFT JOIN jadwal_mengajar jm ON jm.penugasan_id = pm.id
        LEFT JOIN agenda_guru ag ON ag.penugasan_id = pm.id AND ag.tanggal = ?
        LEFT JOIN delegasi_tugas dt ON dt.id = (
          SELECT d.id FROM delegasi_tugas d JOIN delegasi_tugas_kelas dk ON dk.delegasi_id = d.id
          WHERE dk.penugasan_mengajar_id = pm.id AND d.dari_user_id = pm.guru_id AND d.tanggal = ?
          ORDER BY d.created_at DESC, d.id DESC LIMIT 1)
        WHERE pm.id = ? AND (ag.id IS NOT NULL OR jm.hari = CASE CAST(strftime('%w', ?) AS INTEGER) WHEN 0 THEN 7 ELSE CAST(strftime('%w', ?) AS INTEGER) END)
        GROUP BY pm.id`).bind(target.tanggal, target.tanggal, target.penugasan_id, target.tanggal, target.tanggal).first()
      if (!before || before.status !== 'IZIN') return { error: 'Salah satu sesi bukan izin atau jadwal tidak ditemukan. Muat ulang data.' }
      targetId = `${target.penugasan_id}:${target.tanggal}`
      statements.push(db.prepare(`INSERT INTO agenda_guru
        (guru_id, penugasan_id, tanggal, jam_ke_mulai, jam_ke_selesai, status, alasan_izin_guru_id, diubah_oleh)
        VALUES (?, ?, ?, ?, ?, 'IZIN', ?, ?)
        ON CONFLICT(penugasan_id, tanggal) DO UPDATE SET alasan_izin_guru_id = excluded.alasan_izin_guru_id,
        diubah_oleh = excluded.diubah_oleh, updated_at = datetime('now') WHERE agenda_guru.status = 'IZIN'`)
        .bind(before.guru_id, target.penugasan_id, target.tanggal, before.mulai, before.selesai, reasonId, actor.id))
    }
    statements.push(db.prepare('INSERT INTO izin_guru_audit (id, actor_id, action, target_id, before_json, after_json) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(crypto.randomUUID(), actor.id, 'MAP', targetId, JSON.stringify(before), JSON.stringify({ alasan_izin_guru_id: reasonId })))
  }
  try {
    await db.batch(statements)
    refresh()
    return { success: `${unique.length} izin diperbarui. Deskripsi sebelumnya tetap tersimpan.` }
  } catch { return { error: 'Pemetaan gagal disimpan. Silakan muat ulang dan coba lagi.' } }
}
