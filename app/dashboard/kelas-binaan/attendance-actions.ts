'use server'

import { revalidatePath } from 'next/cache'
import { getUserRoles } from '@/lib/features'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db-server'
import { todayWIB } from '@/lib/time'
import { invalidateAttendanceCache } from '@/lib/attendance-cache'
import { ensureActivityLogTables, logActivity } from '@/lib/activity-log'
import { notifyParentsDailyAttendanceFinal } from '@/lib/notification-engine'

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

export async function simpanKeputusanAbsensiWaliBatch(
  kelasId: string,
  tanggal: string,
  data: KeputusanAbsensiInput[]
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

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

    for (const item of toDelete) {
      stmts.push(
        db.prepare(`DELETE FROM keterangan_absensi_wali_kelas WHERE siswa_id = ? AND tanggal = ?`)
          .bind(item.siswa_id, tanggal)
      )
    }

    for (const item of toUpsert) {
      stmts.push(
        db.prepare(`
          INSERT INTO keterangan_absensi_wali_kelas (id, siswa_id, tanggal, status, keterangan, dibuat_oleh)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(siswa_id, tanggal) DO UPDATE SET
            status = excluded.status,
            keterangan = excluded.keterangan,
            dibuat_oleh = excluded.dibuat_oleh,
            updated_at = datetime('now')
        `).bind(crypto.randomUUID(), item.siswa_id, tanggal, item.status, item.keterangan || null, user.id)
      )

      // Notifikasi sesi ALFA adalah informasi awal dari guru. Begitu wali kelas
      // menetapkan status final selain ALFA, jangan lagi tampilkan informasi lama
      // tersebut sebagai kondisi yang masih berlaku di portal orang tua.
      stmts.push(
        db.prepare(`
          UPDATE parent_notifications
          SET archived_at = CASE WHEN ? = 'ALFA' THEN NULL ELSE datetime('now') END
          WHERE siswa_id = ?
            AND type = 'absensi'
            AND source_ref LIKE '%:' || ? || ':ALFA'
        `).bind(item.status, item.siswa_id, tanggal)
      )
    }

    for (let i = 0; i < stmts.length; i += 100) {
      await db.batch(stmts.slice(i, i + 100))
    }
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
      await notifyParentsDailyAttendanceFinal(db, { kelasId, tanggal })
    } catch (notificationError) {
      console.error('Gagal kirim rekap FCM setelah keputusan wali:', notificationError)
    }

    revalidateAttendanceViews()

    const saved = toUpsert.length
    const removed = toDelete.length
    if (saved > 0 && removed > 0) return { success: `${saved} keputusan disimpan, status lainnya mengikuti input guru.` }
    if (saved > 0) return { success: `${saved} keputusan absensi disimpan.` }
    return { success: 'Keputusan absensi diperbarui.' }
  } catch (e: any) {
    return { error: e.message }
  }
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
