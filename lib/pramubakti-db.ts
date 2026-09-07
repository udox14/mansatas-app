import { getDB } from '@/utils/db-server'
import { requireActionAccess } from '@/lib/action-security'
import { getUserRoles } from '@/lib/features'
import { currentTimeWIB, todayWIB } from '@/lib/time'
import { getSystemSettingBoolean, getSystemSettingNumber, SYSTEM_SETTING_KEYS } from '@/lib/system-settings'
import { buildPbItems, pbDates, PB_DAILY, PB_MONTHLY, DEFAULT_PB_SLOTS, type PbHoliday, type PbJob, type PbLeave, type PbMember, type PbReport, type PbVersion } from './pramubakti'

export async function requirePbAccess(mode: 'self' | 'monitor' | 'settings', write = false) {
  const feature = mode === 'self' ? 'pelaporan-pramubakti' : mode === 'monitor' ? 'monitoring-pramubakti' : 'settings-pramubakti'
  const actor = await requireActionAccess(feature, write ? (mode === 'self' ? 'create' : 'update') : 'read')
  const db = await getDB()
  if (actor.kind !== 'staff') throw new Error('Akses pegawai diperlukan.')
  if (mode === 'self' && !actor.roles.includes('pramubakti') && !actor.roles.includes('super_admin')) throw new Error('Pelaporan hanya untuk akun Pramubakti. Gunakan monitoring untuk mengelola laporan.')
  if (mode === 'settings' && !actor.roles.some(r => ['super_admin', 'admin_tu'].includes(r))) throw new Error('Pengaturan hanya dapat dikelola admin.')
  if (mode === 'monitor') {
    const allowed = actor.roles.some(r => ['super_admin', 'admin_tu', ...(!write ? ['kepsek'] : [])].includes(r))
    const sarana = await db.prepare('SELECT jabatan_struktural_id FROM "user" WHERE id=?').bind(actor.id).first<{ jabatan_struktural_id: string }>()
    if (!allowed && !(actor.roles.includes('wakamad') && sarana?.jabatan_struktural_id === 'jbt_waka_sarpras')) throw new Error('Monitoring ini khusus Wakamad Sarana Prasarana dan pengelola yang berwenang.')
  }
  return { db, actor }
}

export async function isPramubakti(db: D1Database, userId: string) { return (await getUserRoles(db, userId)).includes('pramubakti') }

export async function getPbConfig(db: D1Database) {
  const [versions, holidays, jobs, templates] = await Promise.all([
    db.prepare('SELECT id,effective_date,slots_json FROM pb_schedule_versions ORDER BY effective_date').all<{ id: string; effective_date: string; slots_json: string }>(),
    db.prepare('SELECT id,start_date,end_date,reason FROM pb_holidays ORDER BY start_date').all<PbHoliday>(),
    db.prepare('SELECT * FROM pb_jobs ORDER BY sort_order,name').all<PbJob>(),
    db.prepare('SELECT monthly,daily FROM pb_templates WHERE id=1').first<{ monthly: string; daily: string }>(),
  ])
  let parsedVersions = versions.results.map(v => ({ id: v.id, effective_date: v.effective_date, slots: JSON.parse(v.slots_json) })) as PbVersion[]
  if (parsedVersions.length === 0) {
    parsedVersions = [{ id: 'default_pb_v1', effective_date: '2026-01-01', slots: DEFAULT_PB_SLOTS }]
  }
  return { versions: parsedVersions, holidays: holidays.results, jobs: jobs.results, templates: templates || { monthly: PB_MONTHLY, daily: PB_DAILY } }
}

export async function getPbRules() {
  const [restricted, late, threshold] = await Promise.all([
    getSystemSettingBoolean(SYSTEM_SETTING_KEYS.agendaTimeRestriction, true),
    getSystemSettingBoolean(SYSTEM_SETTING_KEYS.agendaLateEnabled, true),
    getSystemSettingNumber(SYSTEM_SETTING_KEYS.agendaLateThresholdMinutes, 10),
  ])
  return { restricted, late, threshold: Math.max(0, threshold) }
}

export async function getPbData(db: D1Database, start: string, end: string, userId?: string) {
  pbDates(start, end)
  const userClause = userId ? ' AND user_id=?' : ''
  const args = userId ? [start, end, userId] : [start, end]
  const [config, members, reports, leaves] = await Promise.all([
    getPbConfig(db),
    db.prepare(`SELECT m.*,COALESCE(u.nama_lengkap,u.name,u.id) AS nama_lengkap FROM pb_members m JOIN "user" u ON u.id=m.user_id WHERE 1=1${userId ? ' AND m.user_id=?' : ''}`).bind(...(userId ? [userId] : [])).all<PbMember>(),
    db.prepare(`SELECT * FROM pb_reports WHERE tanggal BETWEEN ? AND ?${userClause} ORDER BY waktu_input,id`).bind(...args).all<Omit<PbReport, 'jobs'> & { jobs_json: string }>(),
    db.prepare(`SELECT l.*,r.nama AS reason_name,COALESCE(r.kepentingan_sekolah,0) AS kepentingan_sekolah FROM pb_leaves l LEFT JOIN alasan_izin_guru r ON r.id=l.reason_id WHERE tanggal BETWEEN ? AND ?${userId ? ' AND l.user_id=?' : ''}`).bind(...args).all<Omit<PbLeave, 'kepentingan_sekolah'> & { kepentingan_sekolah: number }>(),
  ])
  const reportRows: PbReport[] = reports.results.map(r => ({ ...r, jobs: JSON.parse(r.jobs_json) }))
  const leaveRows = leaves.results.map(l => ({ ...l, kepentingan_sekolah: l.kepentingan_sekolah === 1 }))
  let memberRows = members.results
  if (userId && memberRows.length === 0) {
    const userRow = await db.prepare('SELECT id, COALESCE(nama_lengkap, name, id) AS nama_lengkap FROM "user" WHERE id = ?').bind(userId).first<{ id: string; nama_lengkap: string }>()
    if (userRow) {
      memberRows = [{
        id: `auto_${userId}`,
        user_id: userId,
        nama_lengkap: userRow.nama_lengkap,
        start_date: '2026-01-01',
        end_date: null,
      }]
    }
  }
  const items = buildPbItems({ start, end, today: todayWIB(), time: currentTimeWIB().hhmm, ...config, members: memberRows, reports: reportRows, leaves: leaveRows })
  return { ...config, members: memberRows, reports: reportRows, leaves: leaveRows, items }
}

export async function getPbCkhDates(db: D1Database, userId: string, start: string, end: string) {
  const data = await getPbData(db, start, end, userId)
  return [...new Set(data.items.filter(item => !item.leave && (item.slot || item.report)).map(item => item.tanggal))].sort()
}
