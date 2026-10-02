'use server'

import { revalidatePath } from 'next/cache'
import { getUserRoles } from '@/lib/features'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db-server'
import { todayWIB } from '@/lib/time'
import { getFinalAttendanceForClass } from '@/lib/wali-kelas-attendance'
import { readAttendanceNoticeState, attendanceNoticeActivation } from '@/lib/attendance-notice-state'
import { invalidateAttendanceCache } from '@/lib/attendance-cache'
import { ensureActivityLogTables, logActivity } from '@/lib/activity-log'
import { prepareAttendanceNotificationWork, flushAttendanceNotificationOutbox } from '@/lib/notification-engine'

type WaliStatus = 'HADIR' | 'SAKIT' | 'IZIN' | 'ALFA'

type KeputusanAbsensiInput = {
  siswa_id: string
  status: WaliStatus | null
  keterangan: string
}

function isAdminRole(roles: string[]) {
  return roles.some(role => ['super_admin', 'admin_tu', 'kepsek', 'wakamad'].includes(role))
}

function isValidDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

async function canAccessKelas(db: D1Database, userId: string, kelasId: string, roles: string[]) {
  if (isAdminRole(roles)) return true

  const kelas = await db.prepare(
    `SELECT id FROM kelas WHERE id = ? AND wali_kelas_id = ? LIMIT 1`
  ).bind(kelasId, userId).first<{ id: string }>()

  return !!kelas
}

function revalidateAttendanceViews() {
  revalidatePath('/dashboard/kelas-binaan')
  revalidatePath('/dashboard/keterangan-absensi')
  revalidatePath('/dashboard/rekap-absensi')
  revalidatePath('/portal-ortu')
}

async function saveWaliBatch(
  kelasId: string,
  tanggal: string,
  data: KeputusanAbsensiInput[],
  expected?: { penugasanId: string; teacherStatus: string; teacherUpdatedAt: string; waliStatus: string; waliNote: string }
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  if (!Array.isArray(data) || data.length > 50 || new Set(data.map(d => d.siswa_id)).size !== data.length || data.some(d => ![null, 'HADIR', 'SAKIT', 'IZIN', 'ALFA'].includes(d.status) || typeof d.keterangan !== 'string' || d.keterangan.length > 2000)) return { error: 'Data koreksi tidak valid.' }
  if (!kelasId || !tanggal) return { error: 'Kelas dan tanggal wajib dipilih.' }
  if (!isValidDateOnly(tanggal)) return { error: 'Format tanggal tidak valid.' }
  if (tanggal > todayWIB()) return { error: 'Keputusan absensi hanya dapat diisi sampai hari ini.' }

  const db = await getDB()
  const roles = await getUserRoles(db, user.id)
  const allowed = await canAccessKelas(db, user.id, kelasId, roles)
  if (!allowed) return { error: 'Akses ditolak' }

  const siswaIds = data.map(item => item.siswa_id).filter(Boolean)
  if (siswaIds.length === 0) return { error: 'Tidak ada data siswa untuk disimpan.' }

  const placeholders = siswaIds.map(() => '?').join(',')
  const [siswaRes, existingRes] = await Promise.all([db.prepare(`
    SELECT id, nama_lengkap
    FROM siswa
    WHERE kelas_id = ? AND status = 'aktif' AND id IN (${placeholders})
  `).bind(kelasId, ...siswaIds).all<{ id: string; nama_lengkap: string }>(), db.prepare(`
    SELECT siswa_id, status, keterangan
    FROM keterangan_absensi_wali_kelas
    WHERE tanggal = ? AND siswa_id IN (${placeholders})
  `).bind(tanggal, ...siswaIds).all<{ siswa_id: string; status: WaliStatus; keterangan: string | null }>()])

  const allowedSiswaIds = new Set((siswaRes.results || []).map(row => row.id))
  if (allowedSiswaIds.size !== new Set(siswaIds).size) {
    return { error: 'Ada siswa yang tidak termasuk kelas ini.' }
  }

  const existingMap = new Map((existingRes.results || []).map(item => [item.siswa_id, item]))
  const changedData = data.filter(item => {
    const before = existingMap.get(item.siswa_id)
    return (before?.status || null) !== item.status || (before?.keterangan || '') !== (item.keterangan.trim() || '')
  })
  if (changedData.length === 0) return { success: 'Tidak ada perubahan keputusan absensi.' }

  const toDelete = changedData.filter(item => item.status === null)
  const toUpsert = changedData.filter((item): item is KeputusanAbsensiInput & { status: WaliStatus } => item.status !== null)

  try {
    const stmts: D1PreparedStatement[] = []
    const guard = expected ? ` AND COALESCE((SELECT status FROM keterangan_absensi_wali_kelas WHERE siswa_id = ? AND tanggal = ?),'') = ?
      AND COALESCE((SELECT keterangan FROM keterangan_absensi_wali_kelas WHERE siswa_id = ? AND tanggal = ?),'') = ?
      AND COALESCE((SELECT status FROM absensi_siswa WHERE siswa_id = ? AND penugasan_id = ? AND tanggal = ?),'HADIR') = ?
      AND COALESCE((SELECT updated_at FROM absensi_siswa WHERE siswa_id = ? AND penugasan_id = ? AND tanggal = ?),'') = ?` : ''
    const guardBindings = (siswaId: string) => expected ? [siswaId, tanggal, expected.waliStatus, siswaId, tanggal, expected.waliNote,
      siswaId, expected.penugasanId, tanggal, expected.teacherStatus, siswaId, expected.penugasanId, tanggal, expected.teacherUpdatedAt] : []

    for (const item of toDelete) {
      stmts.push(
        db.prepare(`DELETE FROM keterangan_absensi_wali_kelas WHERE siswa_id = ? AND tanggal = ? ${guard}`)
          .bind(item.siswa_id, tanggal, ...guardBindings(item.siswa_id))
      )
    }

    for (const item of toUpsert) {
      stmts.push(
        db.prepare(`
          INSERT INTO keterangan_absensi_wali_kelas (id, siswa_id, tanggal, status, keterangan, dibuat_oleh)
          SELECT ?, ?, ?, ?, ?, ? WHERE 1 = 1 ${guard}
          ON CONFLICT(siswa_id, tanggal) DO UPDATE SET
            status = excluded.status,
            keterangan = excluded.keterangan,
            dibuat_oleh = excluded.dibuat_oleh,
            updated_at = datetime('now')
        `).bind(crypto.randomUUID(), item.siswa_id, tanggal, item.status, item.keterangan || null, user.id, ...guardBindings(item.siswa_id))
      )

      // Notifikasi sesi ALFA adalah informasi awal dari guru. Begitu wali kelas
      // menetapkan status final selain ALFA, jangan lagi tampilkan informasi lama
      // tersebut sebagai kondisi yang masih berlaku di portal orang tua.
      if (!expected) stmts.push(
        db.prepare(`
          UPDATE parent_notifications
          SET archived_at = CASE WHEN ? = 'ALFA' THEN NULL ELSE datetime('now') END
          WHERE siswa_id = ?
            AND type = 'absensi'
            AND source_ref LIKE '%:' || ? || ':ALFA'
        `).bind(item.status, item.siswa_id, tanggal)
      )
    }

    const work = await prepareAttendanceNotificationWork(db, { kelasId, tanggal, siswaIds: changedData.map(d => d.siswa_id) })
    const written = await db.batch([...stmts, ...work])
    if (expected && !written[0]?.meta?.changes) return { error: 'Catatan sudah berubah. Muat ulang sebelum melakukan koreksi.' }
    invalidateAttendanceCache()

    const siswaNameMap = new Map((siswaRes.results || []).map(item => [item.id, item.nama_lengkap]))
    await logActivity({
      db,
      module: 'absensi',
      action: 'set_daily_attendance_decision',
      summary: `Memperbarui ${changedData.length} keputusan absensi harian kelas`,
      entityType: 'daily_attendance_decision_batch',
      entityId: `${kelasId}:${tanggal}`,
      entityLabel: `Keputusan absensi ${tanggal}`,
      before: changedData.map(item => ({ siswa_id: item.siswa_id, ...existingMap.get(item.siswa_id) })),
      after: changedData.map(item => ({ siswa_id: item.siswa_id, status: item.status, keterangan: item.keterangan.trim() || null })),
      metadata: { kelas_id: kelasId, tanggal },
      targets: changedData.map(item => ({
        type: 'siswa',
        id: item.siswa_id,
        label: siswaNameMap.get(item.siswa_id) || item.siswa_id,
        metadata: {
          tanggal,
          before: existingMap.get(item.siswa_id) || { status: null, keterangan: null },
          after: { status: item.status, keterangan: item.keterangan.trim() || null },
        },
      })),
    })

    try {
      await flushAttendanceNotificationOutbox(db)
    } catch (notificationError) {
      console.error('Gagal kirim rekap FCM setelah keputusan wali:', notificationError)
    }

    revalidateAttendanceViews()
    revalidatePath('/dashboard/kelas-binaan/koreksi')

    const saved = toUpsert.length
    const removed = toDelete.length
    if (saved > 0 && removed > 0) return { success: `${saved} keputusan disimpan, status lainnya mengikuti input guru.` }
    if (saved > 0) return { success: `${saved} keputusan absensi disimpan.` }
    return { success: 'Keputusan absensi diperbarui.' }
  } catch (e: any) {
    return { error: e.message }
  }
}

export async function simpanKeputusanAbsensiWaliBatch(kelasId: string, tanggal: string, data: KeputusanAbsensiInput[]) {
  return saveWaliBatch(kelasId, tanggal, data)
}

export type QuickAttendanceContext = {
  siswaId: string; kelasId: string; nama: string; kelas: string; tanggal: string; penugasanId: string;
  mapel: string; jam: string; catatanGuru: string; statusGuru: string; teacherUpdatedAt: string;
  waliStatus: WaliStatus | null; waliNote: string; revision: string;
  pendingBlocks: number; isFinal: boolean; dailyStatus: string; parentDueAt: string | null; parentSent: boolean;
}

export async function getKoreksiAbsensiCepat(siswaId: string, tanggal: string, penugasanId: string): Promise<{ data?: QuickAttendanceContext; error?: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }
  if (!isValidDateOnly(tanggal) || tanggal > todayWIB() || !siswaId || !penugasanId) return { error: 'Tautan kehadiran tidak valid.' }
  const db = await getDB()
  const student = await db.prepare(`SELECT s.kelas_id FROM siswa s JOIN penugasan_mengajar pm ON pm.kelas_id = s.kelas_id
    WHERE s.id = ? AND s.status = 'aktif' AND pm.id = ?`).bind(siswaId, penugasanId).first<{ kelas_id: string }>()
  if (!student || !await canAccessKelas(db, user.id, student.kelas_id, await getUserRoles(db, user.id))) return { error: 'Siswa tidak tersedia atau Anda tidak berhak mengoreksi kelas ini.' }
  const [snapshot, raw, wali] = await Promise.all([
    getFinalAttendanceForClass(db, student.kelas_id, tanggal, tanggal, { siswaId, fresh: true }),
    db.prepare(`SELECT mp.nama_mapel, ab.status, ab.updated_at, ab.catatan, ab.jam_ke_mulai, ab.jam_ke_selesai
      FROM penugasan_mengajar pm JOIN mata_pelajaran mp ON mp.id = pm.mapel_id
      LEFT JOIN absensi_siswa ab ON ab.penugasan_id = pm.id AND ab.siswa_id = ? AND ab.tanggal = ?
      WHERE pm.id = ?`).bind(siswaId, tanggal, penugasanId).first<{ nama_mapel: string; status: string | null; updated_at: string | null; catatan: string | null; jam_ke_mulai: number; jam_ke_selesai: number }>(),
    db.prepare('SELECT status, keterangan FROM keterangan_absensi_wali_kelas WHERE siswa_id = ? AND tanggal = ?')
      .bind(siswaId, tanggal).first<{ status: WaliStatus; keterangan: string | null }>(),
  ])
  const day = snapshot?.statusByStudent.get(siswaId)?.[0]
  const block = day?.block_statuses.find(b => b.penugasan_id === penugasanId)
  if (!day || !raw || !block) return { error: 'Sesi tidak aktif pada tanggal ini. Silakan periksa Kehadiran Harian.' }
  await attendanceNoticeActivation(db)
  const state = await readAttendanceNoticeState(db, siswaId, tanggal)
  const statusGuru = raw.status || 'HADIR'
  const teacherUpdatedAt = raw.updated_at || ''
  const waliStatus = wali?.status || null
  const waliNote = wali?.keterangan || ''
  const revision = JSON.stringify([statusGuru, teacherUpdatedAt, waliStatus, waliNote, block.status, day.sumber_status])
  return { data: { siswaId, kelasId: student.kelas_id, nama: day.nama_lengkap, kelas: snapshot!.kelas.label,
    tanggal, penugasanId, mapel: raw.nama_mapel, jam: `${block.jam_ke_mulai}–${block.jam_ke_selesai}`,
    catatanGuru: raw.catatan || '', statusGuru, teacherUpdatedAt, waliStatus, waliNote, revision,
    pendingBlocks: day.pending_blok, isFinal: day.is_daily_final, dailyStatus: day.status_akhir,
    parentDueAt: state?.initial_ref ? state.initial_due_at : null, parentSent: !!state?.initial_sent_at } }
}

export async function simpanKoreksiAbsensiCepat(input: { siswaId: string; tanggal: string; penugasanId: string; status: WaliStatus | null; keterangan: string; revision: string }) {
  const result = await getKoreksiAbsensiCepat(input.siswaId, input.tanggal, input.penugasanId)
  if (!result.data) return { error: result.error || 'Data tidak tersedia.' }
  const current = result.data
  if (current.revision !== input.revision) return { error: 'Catatan sudah berubah. Muat ulang sebelum melakukan koreksi.' }
  return saveWaliBatch(current.kelasId, input.tanggal, [{ siswa_id: input.siswaId, status: input.status, keterangan: input.keterangan }], {
    penugasanId: input.penugasanId, teacherStatus: current.statusGuru, teacherUpdatedAt: current.teacherUpdatedAt,
    waliStatus: current.waliStatus || '', waliNote: current.waliNote,
  })
}

export type KeputusanAbsensiHistoryRow = {
  id: string
  created_at: string
  actor_name: string | null
  tanggal: string
  before: { status: WaliStatus | null; keterangan: string | null }
  after: { status: WaliStatus | null; keterangan: string | null }
}

export async function getKeputusanAbsensiHistory(siswaId: string, tanggal?: string) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized', history: [] as KeputusanAbsensiHistoryRow[] }
  const db = await getDB()
  await ensureActivityLogTables(db)
  const roles = await getUserRoles(db, user.id)
  const siswa = await db.prepare('SELECT kelas_id FROM siswa WHERE id = ? LIMIT 1')
    .bind(siswaId).first<{ kelas_id: string }>()
  if (!siswa?.kelas_id || !(await canAccessKelas(db, user.id, siswa.kelas_id, roles))) {
    return { error: 'Akses ditolak', history: [] as KeputusanAbsensiHistoryRow[] }
  }

  const rows = await db.prepare(`
    SELECT al.id, al.created_at, al.actor_name, alt.metadata_json
    FROM activity_log_targets alt
    JOIN activity_logs al ON al.id = alt.log_id
    WHERE alt.target_type = 'siswa' AND alt.target_id = ?
      AND al.module = 'absensi' AND al.action = 'set_daily_attendance_decision'
    ORDER BY al.created_at DESC
    LIMIT 100
  `).bind(siswaId).all<{ id: string; created_at: string; actor_name: string | null; metadata_json: string | null }>()

  const history = (rows.results || []).flatMap(row => {
    try {
      const metadata = JSON.parse(row.metadata_json || '{}')
      if (tanggal && metadata.tanggal !== tanggal) return []
      return [{
        id: row.id,
        created_at: row.created_at,
        actor_name: row.actor_name,
        tanggal: metadata.tanggal || '',
        before: metadata.before || { status: null, keterangan: null },
        after: metadata.after || { status: null, keterangan: null },
      } satisfies KeputusanAbsensiHistoryRow]
    } catch {
      return []
    }
  })

  return { error: null, history }
}

export async function simpanKeputusanAbsensiWali(
  siswaId: string,
  tanggal: string,
  status: WaliStatus | null,
  keterangan: string
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  const db = await getDB()
  const siswa = await db.prepare(`
    SELECT s.kelas_id
    FROM siswa s
    WHERE s.id = ? AND s.status = 'aktif'
    LIMIT 1
  `).bind(siswaId).first<{ kelas_id: string }>()

  if (!siswa?.kelas_id) return { error: 'Siswa tidak valid.' }

  return simpanKeputusanAbsensiWaliBatch(siswa.kelas_id, tanggal, [
    { siswa_id: siswaId, status, keterangan },
  ])
}
