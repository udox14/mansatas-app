'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser, isCurrentUserPlayReviewer } from '@/utils/auth/server'
import { getDB } from '@/utils/db-server'
import { getUserRoles } from '@/lib/features'
import { isValidTanggal } from '@/lib/izin-massal'
import { getEffectiveDatesInRange, getKbmExceptionsForRange, hariNumFromDateString, splitTeachingSlotsByExceptions } from '@/lib/kalender-pendidikan'
import { todayWIB } from '@/lib/time'
import type { TeacherLeavePeriod } from '@/lib/teacher-leave-period'

export type LeaveInput = { id?: string; versi?: number; guruId: string; mulai: string; selesai: string; catatan?: string; penggantiId?: string; konflik?: string }
const TEACHERS = "'guru','wali_kelas','guru_piket','guru_bk','guru_tahfidz'"

function validDate(value: string) {
  if (!isValidTanggal(value) || value < '0001-01-01' || value > '9999-12-30') return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value
}

async function access() {
  const user = await getCurrentUser()
  if (!user || await isCurrentUserPlayReviewer()) return null
  const db = await getDB()
  const roles = await getUserRoles(db, user.id)
  if (!roles.includes('super_admin')) {
    if (!roles.includes('wakamad')) return null
    const position = await db.prepare('SELECT jabatan_struktural_id FROM "user" WHERE id = ?')
      .bind(user.id).first<string>('jabatan_struktural_id')
    if (position !== 'jbt_waka_kurikulum') return null
  }
  return { db, actorId: user.id }
}

export async function loadCutiGuru() {
  const ctx = await access()
  if (!ctx) return { error: 'Akses ditolak.' } as const
  const [people, periods] = await Promise.all([
    ctx.db.prepare(`SELECT u.id, u.nama_lengkap, u.akun_pengganti_cuti FROM "user" u
      WHERE COALESCE(u.banned, 0) = 0 AND (u.akun_pengganti_cuti = 1 OR u.role IN (${TEACHERS})
      OR EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role IN (${TEACHERS})))
      ORDER BY u.nama_lengkap`).all<{ id: string; nama_lengkap: string; akun_pengganti_cuti: number }>(),
    ctx.db.prepare(`SELECT c.*, u.nama_lengkap AS guru_nama, p.user_id AS pengganti_id, g.nama_lengkap AS pengganti_nama
      FROM cuti_guru c JOIN "user" u ON u.id = c.guru_id
      LEFT JOIN cuti_guru_pengganti p ON p.id = (SELECT id FROM cuti_guru_pengganti
        WHERE cuti_id = c.id AND mulai <= selesai AND (c.selesai < ? OR selesai >= ?)
        ORDER BY mulai DESC, rowid DESC LIMIT 1)
      LEFT JOIN "user" g ON g.id = p.user_id ORDER BY c.mulai DESC, c.id`).bind(todayWIB(), todayWIB())
      .all<TeacherLeavePeriod & { guru_nama: string; pengganti_id: string | null; pengganti_nama: string | null }>(),
  ])
  return { people: people.results, periods: periods.results }
}

async function preview(db: D1Database, input: LeaveInput) {
  if (!input?.guruId || !validDate(input.mulai) || !validDate(input.selesai) || input.selesai < input.mulai) {
    return { error: 'Pilih guru dan masukkan rentang tanggal yang valid.' } as const
  }
  if (input.penggantiId === input.guruId) return { error: 'Guru tidak dapat menggantikan dirinya sendiri.' } as const
  const from = input.mulai > todayWIB() ? input.mulai : todayWIB()
  if (input.penggantiId && from > input.selesai) return { error: 'Periode lampau hanya dapat dicatat sebagai cuti.' } as const
  const [people, classes, schedule] = await Promise.all([
    db.prepare(`SELECT u.id, u.akun_pengganti_cuti FROM "user" u WHERE u.id IN (?, ?) AND COALESCE(u.banned, 0) = 0
      AND (u.akun_pengganti_cuti = 1 OR u.role IN (${TEACHERS}) OR EXISTS (
        SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role IN (${TEACHERS})))`)
      .bind(input.guruId, input.penggantiId || null).all<{ id: string; akun_pengganti_cuti: number }>(),
    db.prepare(`SELECT tingkat, nomor_kelas, kelompok FROM kelas WHERE wali_kelas_id = ?
      AND (kbm_nonaktif_mulai IS NULL OR kbm_nonaktif_mulai > ?)`).bind(input.guruId, input.mulai)
      .all<{ tingkat: number; nomor_kelas: string; kelompok: string }>(),
    db.prepare(`SELECT pm.id, pm.guru_id, mp.nama_mapel, k.id AS kelas_id, k.tingkat, k.nomor_kelas, k.kelompok,
      k.kbm_nonaktif_mulai, jm.hari, jm.jam_ke, jm.tahun_ajaran_id
      FROM penugasan_mengajar pm JOIN kelas k ON k.id = pm.kelas_id
      JOIN mata_pelajaran mp ON mp.id = pm.mapel_id JOIN jadwal_mengajar jm ON jm.penugasan_id = pm.id
      JOIN tahun_ajaran ta ON ta.id = jm.tahun_ajaran_id AND ta.is_active = 1
      WHERE pm.guru_id IN (?, ?) OR pm.guru_id IN (
        SELECT c.guru_id FROM cuti_guru c JOIN cuti_guru_pengganti p ON p.cuti_id = c.id
        WHERE p.user_id = ? AND c.dibatalkan = 0 AND c.id <> ? AND p.mulai <= ? AND p.selesai >= ?
      )`).bind(input.guruId, input.penggantiId || null, input.penggantiId || null, input.id || '', input.selesai, from)
      .all<{ id: string; guru_id: string; nama_mapel: string; kelas_id: string; tingkat: number; nomor_kelas: string; kelompok: string; kbm_nonaktif_mulai: string | null; hari: number; jam_ke: number }>(),
  ])
  if (!people.results.some(p => p.id === input.guruId && !p.akun_pengganti_cuti)
    || (input.penggantiId && !people.results.some(p => p.id === input.penggantiId))) return { error: 'Guru atau pengganti tidak tersedia.' } as const
  const label = (k: { tingkat: number; nomor_kelas: string; kelompok: string }) => `${k.tingkat}-${k.nomor_kelas} ${k.kelompok || ''}`.trim()
  const own = schedule.results.filter(row => row.guru_id === input.guruId)
  const conflicts = new Set<string>()
  if (input.penggantiId) {
    const [dates, exceptions, coverage] = await Promise.all([
      getEffectiveDatesInRange(db, from, input.selesai),
      getKbmExceptionsForRange(db, from, input.selesai),
      db.prepare(`SELECT c.guru_id, p.mulai, p.selesai FROM cuti_guru_pengganti p JOIN cuti_guru c ON c.id = p.cuti_id
        WHERE p.user_id = ? AND c.id <> ? AND c.dibatalkan = 0 AND p.mulai <= ? AND p.selesai >= ?`)
        .bind(input.penggantiId, input.id || '', input.selesai, from).all<{ guru_id: string; mulai: string; selesai: string }>(),
    ])
    for (const date of dates) {
      const day = hariNumFromDateString(date)
      const dayExceptions = exceptions.filter(row => row.tanggal === date)
      const active = schedule.results.filter(row => row.hari === day
        && (!row.kbm_nonaktif_mulai || row.kbm_nonaktif_mulai > date)
        && splitTeachingSlotsByExceptions(dayExceptions, { id: row.kelas_id, tingkat: row.tingkat }, [row.jam_ke]).activeJamKe.length)
      const busy = new Set(active.filter(row => row.guru_id !== input.guruId && (
        row.guru_id === input.penggantiId || coverage.results.some(p => p.guru_id === row.guru_id && p.mulai <= date && p.selesai >= date)
      )).map(row => row.jam_ke))
      for (const row of active) if (row.guru_id === input.guruId && busy.has(row.jam_ke)) conflicts.add(`${date}, jam ${row.jam_ke}, ${label(row)}`)
    }
  }
  return { mengajar: [...new Set(own.map(row => `${label(row)} · ${row.nama_mapel}`))],
    binaan: classes.results.map(label), bentrok: [...conflicts].sort(), from }
}

export async function previewCutiGuru(input: LeaveInput) {
  const ctx = await access()
  return ctx ? preview(ctx.db, input) : { error: 'Akses ditolak.' } as const
}

export async function saveCutiGuru(input: LeaveInput) {
  const ctx = await access()
  if (!ctx) return { error: 'Akses ditolak.' }
  const { db, actorId } = ctx
  const result = await preview(db, input)
  if ('error' in result) return { error: result.error }
  if (result.bentrok.length && JSON.stringify(result.bentrok) !== input.konflik) return { error: 'Konfirmasi daftar bentrok yang terbaru.' }
  const id = input.id || crypto.randomUUID()
  const prior = input.id ? await db.prepare('SELECT * FROM cuti_guru WHERE id = ? AND dibatalkan = 0')
    .bind(id).first<TeacherLeavePeriod>() : null
  if (input.id && (!prior || prior.versi !== input.versi || prior.guru_id !== input.guruId)) return { error: 'Data berubah. Muat ulang daftar cuti.' }
  const version = (prior?.versi || 0) + 1
  const today = todayWIB()
  const assigned = prior && input.penggantiId ? await db.prepare(`SELECT mulai FROM cuti_guru_pengganti
    WHERE cuti_id = ? AND user_id = ? AND ? BETWEEN mulai AND selesai ORDER BY mulai DESC LIMIT 1`)
    .bind(id, input.penggantiId, today).first<{ mulai: string }>() : null
  const replacementStart = assigned && input.mulai <= today
    ? (assigned.mulai > input.mulai ? assigned.mulai : input.mulai)
    : result.from
  const note = input.catatan?.trim().slice(0, 1000) || null
  const statements = [
    prior
      ? db.prepare('UPDATE cuti_guru SET mulai = ?, selesai = ?, catatan = ?, versi = ? WHERE id = ? AND versi = ?')
        .bind(input.mulai, input.selesai, note, version, id, prior.versi)
      : db.prepare('INSERT INTO cuti_guru (id, guru_id, mulai, selesai, catatan) VALUES (?, ?, ?, ?, ?)')
        .bind(id, input.guruId, input.mulai, input.selesai, note),
    db.prepare(`DELETE FROM session WHERE userId IN (SELECT p.user_id FROM cuti_guru_pengganti p
      JOIN "user" u ON u.id = p.user_id AND u.akun_pengganti_cuti = 1
      WHERE p.cuti_id = ? AND ? BETWEEN p.mulai AND p.selesai
      AND (p.user_id <> COALESCE(?, '') OR p.selesai > ? OR p.mulai < ?))`)
      .bind(id, todayWIB(), input.penggantiId || null, input.selesai, input.mulai),
    db.prepare("UPDATE cuti_guru_pengganti SET selesai = date(?, '-1 day') WHERE cuti_id = ? AND selesai >= ?")
      .bind(assigned ? replacementStart : today, id, today),
  ]
  if (input.penggantiId) statements.push(db.prepare('INSERT INTO cuti_guru_pengganti (id, cuti_id, user_id, mulai, selesai) VALUES (?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), id, input.penggantiId, replacementStart, input.selesai))
  statements.push(db.prepare('INSERT INTO cuti_guru_audit (id, cuti_id, versi, actor_id, aksi, data) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), id, version, actorId, prior ? 'UBAH' : 'BUAT', JSON.stringify({
      sebelum: prior, mulai: input.mulai, selesai: input.selesai, catatan: note, penggantiId: input.penggantiId || null, bentrokDikonfirmasi: result.bentrok,
    })))
  try {
    await db.batch(statements)
  } catch (error) {
    const message = String(error)
    if (message.includes('CUTI_OVERLAP')) return { error: 'Periode bertumpuk dengan cuti guru yang sudah tercatat.' }
    if (message.includes('CUTI_REPLACEMENT_UNAVAILABLE')) return { error: 'Guru atau pengganti memiliki cuti atau penugasan pengganti yang bertumpuk.' }
    if (message.includes('UNIQUE constraint failed')) return { error: 'Data berubah. Muat ulang daftar cuti.' }
    throw error
  }
  revalidatePath('/dashboard', 'layout')
  return { success: true }
}

export async function cancelCutiGuru(id: string, versi: number) {
  const ctx = await access()
  if (!ctx) return { error: 'Akses ditolak.' }
  const { db, actorId } = ctx
  const auditId = crypto.randomUUID()
  try {
    const [changed] = await db.batch([
      db.prepare('UPDATE cuti_guru SET dibatalkan = 1, versi = versi + 1 WHERE id = ? AND versi = ? AND dibatalkan = 0').bind(id, versi),
      db.prepare(`INSERT INTO cuti_guru_audit (id, cuti_id, versi, actor_id, aksi, data)
        SELECT ?, id, versi, ?, 'BATAL', '{}' FROM cuti_guru WHERE id = ? AND versi = ? AND dibatalkan = 1`)
        .bind(auditId, actorId, id, versi + 1),
      db.prepare(`DELETE FROM session WHERE userId IN (SELECT p.user_id FROM cuti_guru_pengganti p
        JOIN "user" u ON u.id = p.user_id AND u.akun_pengganti_cuti = 1
        JOIN cuti_guru_audit a ON a.cuti_id = p.cuti_id AND a.id = ?
        WHERE p.cuti_id = ? AND ? BETWEEN p.mulai AND p.selesai)`).bind(auditId, id, todayWIB()),
    ])
    if (!changed.meta.changes) return { error: 'Data berubah. Muat ulang daftar cuti.' }
  } catch (error) {
    if (String(error).includes('UNIQUE constraint failed')) return { error: 'Data berubah. Muat ulang daftar cuti.' }
    throw error
  }
  revalidatePath('/dashboard', 'layout')
  return { success: true }
}
