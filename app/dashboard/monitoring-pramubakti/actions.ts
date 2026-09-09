'use server'

import { revalidatePath } from 'next/cache'
import { requirePbAccess, getPbData } from '@/lib/pramubakti-db'
import { pbDates } from '@/lib/pramubakti'
import { readTeacherLeaveReasons, validateTeacherLeaveReason } from '@/lib/teacher-leave-db'
import { todayWIB, nowWIBISO } from '@/lib/time'

export async function getPramubaktiMonitoring(start = todayWIB(), end = todayWIB()) {
  const { db, actor } = await requirePbAccess('monitor')
  const [data, reasons, school, years] = await Promise.all([
    getPbData(db, start, end), readTeacherLeaveReasons(db),
    db.prepare("SELECT key,value FROM system_settings WHERE key IN ('nama_madrasah','alamat_madrasah','logo_madrasah','school_name','school_address')").all<{ key: string; value: string }>(),
    db.prepare('SELECT id,nama FROM tahun_ajaran ORDER BY nama DESC').all<{ id: string; nama: string }>(),
  ])
  const audit = await db.prepare('SELECT a.*,u.nama_lengkap AS actor_name FROM pb_audit a LEFT JOIN "user" u ON u.id=a.actor_id WHERE substr(a.created_at,1,10) BETWEEN ? AND ? ORDER BY a.created_at DESC LIMIT 100').bind(start, end).all<{ id: string; actor_name: string; action: string; target: string; reason: string; created_at: string }>()
  return { ...data, reasons, school: Object.fromEntries(school.results.map(s => [s.key, s.value])), years: years.results, audit: audit.results, canManage: actor.roles.some(r => ['super_admin', 'admin_tu', 'wakamad'].includes(r)) }
}

export async function setPramubaktiLeave(payload: { userId: string; start: string; end: string; slotIds: string[]; status: 'SAKIT' | 'IZIN' | 'BATAL'; reasonId: string | null; note: string; overrideReport: boolean }) {
  try {
    const { db, actor } = await requirePbAccess('monitor', true)
    pbDates(payload.start, payload.end)
    if (!['SAKIT', 'IZIN', 'BATAL'].includes(payload.status) || !payload.note.trim() || payload.note.length > 1000) throw new Error('Status dan alasan perubahan wajib diisi (maksimal 1000 karakter).')
    if (payload.status === 'IZIN') await validateTeacherLeaveReason(db, 'IZIN', payload.reasonId)
    const data = await getPbData(db, payload.start, payload.end, payload.userId)
    const items = data.items.filter(i => i.slot && i.status !== 'TAMBAHAN' && (!payload.slotIds.length || payload.slotIds.includes(i.slot.id)))
    if (!items.length) throw new Error('Tidak ada kewajiban pada pilihan ini.')
    if (items.length > 300) throw new Error('Pilih maksimal 300 slot dalam satu perubahan.')
    if (payload.status !== 'BATAL' && items.some(i => i.report) && !payload.overrideReport) throw new Error('Ada laporan hadir. Centang konfirmasi koreksi untuk mempertahankan bukti dan mengganti status.')
    const statements: D1PreparedStatement[] = []
    const now = nowWIBISO()
    for (const item of items) {
      if (payload.status === 'BATAL') statements.push(db.prepare('DELETE FROM pb_leaves WHERE user_id=? AND tanggal=? AND slot_id=?').bind(item.user_id, item.tanggal, item.slot!.id))
      else statements.push(db.prepare(`INSERT INTO pb_leaves(user_id,tanggal,slot_id,status,reason_id,note,actor_id,updated_at,override_report) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,tanggal,slot_id) DO UPDATE SET status=excluded.status,reason_id=excluded.reason_id,note=excluded.note,actor_id=excluded.actor_id,updated_at=excluded.updated_at,override_report=excluded.override_report`).bind(item.user_id, item.tanggal, item.slot!.id, payload.status, payload.status === 'IZIN' ? payload.reasonId : null, payload.note.trim(), actor.id, now, payload.overrideReport ? 1 : 0))
    }
    statements.push(db.prepare('INSERT INTO pb_audit(id,actor_id,action,target,reason,before_json,after_json,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(), actor.id, 'leave.change', payload.userId, payload.note, JSON.stringify(items), JSON.stringify(payload), now))
    await db.batch(statements)
    for (const path of ['/dashboard/monitoring-pramubakti', '/dashboard/pelaporan-pramubakti', '/dashboard/ckh-generator', '/dashboard']) revalidatePath(path)
    return { success: `${items.length} slot diperbarui. Bukti laporan tetap tersimpan.` }
  } catch (error) { return { error: error instanceof Error ? error.message : 'Gagal mengubah status.' } }
}

export async function correctPramubaktiReport(payload: { id: string; revision: number; jobs: string[]; tempat: string; status: 'TEPAT_WAKTU' | 'TAMBAHAN'; reason: string }) {
  try {
    const { db, actor } = await requirePbAccess('monitor', true)
    if (!payload.reason.trim() || payload.reason.length > 1000 || !payload.tempat.trim() || payload.tempat.length > 300 || !payload.jobs.length || payload.jobs.length > 50 || payload.jobs.some(j => !j.trim() || j.length > 100) || !['TEPAT_WAKTU', 'TAMBAHAN'].includes(payload.status)) throw new Error('Pekerjaan, tempat, status, dan alasan koreksi wajib diisi dengan benar.')
    const old = await db.prepare('SELECT * FROM pb_reports WHERE id=?').bind(payload.id).first<{ id: string; revision: number; slot_id: string | null }>()
    if (!old || old.revision !== payload.revision) throw new Error('Laporan sudah berubah. Muat ulang sebelum mengoreksi.')
    if ((old.slot_id === null) !== (payload.status === 'TAMBAHAN')) throw new Error('Jenis wajib/tambahan tidak dapat diubah melalui koreksi.')
    // Audit and revision update are one transaction; trigger rejects concurrent edits.
    await db.batch([
      db.prepare('INSERT INTO pb_audit(id,actor_id,action,target,reason,before_json,after_json,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(), actor.id, 'report.correct', payload.id, payload.reason.trim(), JSON.stringify(old), JSON.stringify(payload), nowWIBISO()),
      db.prepare('UPDATE pb_reports SET jobs_json=?,tempat=?,status=?,actor_id=?,revision=? WHERE id=?').bind(JSON.stringify(payload.jobs.map(j => j.trim())), payload.tempat.trim(), payload.status, actor.id, payload.revision + 1, payload.id),
    ])
    for (const path of ['/dashboard/monitoring-pramubakti', '/dashboard/pelaporan-pramubakti', '/dashboard/ckh-generator', '/dashboard']) revalidatePath(path)
    return { success: 'Koreksi tersimpan beserta jejak audit.' }
  } catch (error) { return { error: error instanceof Error ? error.message : 'Koreksi gagal.' } }
}
