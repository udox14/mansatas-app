'use server'

import { revalidatePath } from 'next/cache'
import { requirePbAccess, getPbConfig } from '@/lib/pramubakti-db'
import { addDays, validDate, validateSlots, validatePbTemplates, type PbSlot, type PbJob } from '@/lib/pramubakti'
import { todayWIB, nowWIBISO } from '@/lib/time'

export async function getPramubaktiSettings() {
  const { db } = await requirePbAccess('settings')
  return { ...await getPbConfig(db), tomorrow: addDays(todayWIB(), 1) }
}

export async function savePramubaktiSettings(payload:
  | { type: 'schedule'; effective_date: string; slots: PbSlot[] }
  | { type: 'holiday'; start_date: string; end_date: string; reason: string }
  | { type: 'removeHoliday'; id: string; reason: string }
  | { type: 'job'; job: PbJob }
  | { type: 'templates'; monthly: string; daily: string }
) {
  try {
    const { db, actor } = await requirePbAccess('settings', true)
    const config = await getPbConfig(db)
    const statements: D1PreparedStatement[] = []
    let target = payload.type as string
    if (payload.type === 'schedule') {
      if (!validDate(payload.effective_date) || payload.effective_date < addDays(todayWIB(), 1)) throw new Error('Jadwal baru berlaku paling cepat besok.')
      // A version is immutable. A future version can be replaced before taking effect.
      const slots = payload.slots.map(s => ({ ...s, id: crypto.randomUUID() }))
      validateSlots(slots)
      target = payload.effective_date
      statements.push(db.prepare(`INSERT INTO pb_schedule_versions(id,effective_date,slots_json,actor_id) VALUES(?,?,?,?) ON CONFLICT(effective_date) DO UPDATE SET slots_json=excluded.slots_json,actor_id=excluded.actor_id,created_at=datetime('now')`).bind(crypto.randomUUID(), target, JSON.stringify(slots), actor.id))
    } else if (payload.type === 'holiday') {
      if (!validDate(payload.start_date) || !validDate(payload.end_date) || payload.end_date < payload.start_date || !payload.reason.trim() || payload.reason.length > 500) throw new Error('Isi rentang libur dan alasan yang valid.')
      if (payload.start_date <= todayWIB()) throw new Error('Libur baru berlaku paling cepat besok agar riwayat penilaian tetap konsisten.')
      target = crypto.randomUUID()
      statements.push(db.prepare('INSERT INTO pb_holidays VALUES(?,?,?,?,?)').bind(target, payload.start_date, payload.end_date, payload.reason.trim(), actor.id))
    } else if (payload.type === 'removeHoliday') {
      const holiday = config.holidays.find(h => h.id === payload.id)
      if (!holiday || holiday.start_date <= todayWIB() || !payload.reason.trim()) throw new Error('Hanya libur mendatang yang dapat dibatalkan, dengan alasan.')
      target = payload.id
      statements.push(db.prepare('DELETE FROM pb_holidays WHERE id=? AND start_date>?').bind(target, todayWIB()))
    } else if (payload.type === 'job') {
      const job = payload.job
      if (!job.name.trim() || job.name.length > 100 || !Number.isInteger(job.sort_order) || ![0, 1].includes(job.active)) throw new Error('Nama, urutan, atau status pekerjaan tidak valid.')
      target = job.id || crypto.randomUUID()
      statements.push(db.prepare('INSERT INTO pb_jobs VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,sort_order=excluded.sort_order,active=excluded.active').bind(target, job.name.trim(), job.sort_order, job.active))
    } else if (payload.type === 'templates') {
      validatePbTemplates(payload.monthly, payload.daily)
      statements.push(db.prepare('UPDATE pb_templates SET monthly=?,daily=?,actor_id=? WHERE id=1').bind(payload.monthly.trim(), payload.daily.trim(), actor.id))
    } else throw new Error('Tindakan tidak valid.')
    const before = payload.type === 'schedule' ? config.versions.find(v => v.effective_date === target)
      : payload.type === 'job' ? config.jobs.find(j => j.id === target)
      : payload.type === 'templates' ? config.templates
      : payload.type === 'removeHoliday' ? config.holidays.find(h => h.id === target) : null
    statements.push(db.prepare('INSERT INTO pb_audit(id,actor_id,action,target,reason,before_json,after_json,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(), actor.id, `settings.${payload.type}`, target, 'reason' in payload ? payload.reason : 'Perubahan pengaturan', JSON.stringify(before || null), JSON.stringify(payload), nowWIBISO()))
    await db.batch(statements)
    for (const path of ['/dashboard/settings/pramubakti', '/dashboard/pelaporan-pramubakti', '/dashboard/monitoring-pramubakti', '/dashboard/ckh-generator', '/dashboard']) revalidatePath(path)
    return { success: 'Pengaturan disimpan.' }
  } catch (error) { return { error: error instanceof Error ? error.message : 'Pengaturan gagal disimpan.' } }
}
