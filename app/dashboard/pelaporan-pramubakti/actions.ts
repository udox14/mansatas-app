'use server'

import { revalidatePath } from 'next/cache'
import { uploadToR2, validateImageFile, deleteFromR2 } from '@/utils/r2'
import { todayWIB, currentTimeWIB, nowWIBISO } from '@/lib/time'
import { getPbData, getPbRules, requirePbAccess } from '@/lib/pramubakti-db'
import { pbInputStatus, getWeekRangePb } from '@/lib/pramubakti'

export async function getPramubaktiReports(start?: string, end?: string) {
  const { db, actor } = await requirePbAccess('self')
  const today = todayWIB()
  const week = getWeekRangePb(today)
  const startDate = start || week.start
  const endDate = end || week.end
  const [data, rules, recentPlacesRows] = await Promise.all([
    getPbData(db, startDate, endDate, actor.id),
    getPbRules(),
    db.prepare(`
      SELECT DISTINCT tempat 
      FROM pb_reports 
      WHERE user_id = ? AND tempat IS NOT NULL AND TRIM(tempat) != '' 
      ORDER BY waktu_input DESC 
      LIMIT 8
    `).bind(actor.id).all<{ tempat: string }>()
  ])
  const recentPlaces = (recentPlacesRows.results || []).map(r => r.tempat.trim()).filter(Boolean)
  return { ...data, rules, today, defaultStart: startDate, defaultEnd: endDate, recentPlaces }
}

export async function submitPramubaktiReport(form: FormData): Promise<{ error?: string; success?: string }> {
  let uploaded: string | null = null
  try {
    const { db, actor } = await requirePbAccess('self', true)
    const date = todayWIB()
    if (form.get('tanggal') !== date) throw new Error('Laporan hanya dapat diisi untuk hari ini (WIB). Muat ulang halaman.')
    const tempat = String(form.get('tempat') || '').trim()
    const jobIds = [...new Set(form.getAll('jobs').map(String))]
    const slotId = String(form.get('slot_id') || '') || null
    const id = String(form.get('request_id') || '')
    if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Identitas pengiriman tidak valid.')
    if (!tempat || tempat.length > 300 || !jobIds.length || jobIds.length > 50) throw new Error('Pilih pekerjaan dan isi tempat (maksimal 300 karakter).')
    const foto = form.get('foto')
    if (!(foto instanceof File) || !foto.size) throw new Error('Foto wajib diambil sebelum mengirim laporan.')
    const imageError = validateImageFile(foto)
    if (imageError) throw new Error(imageError)
    const bytes = new Uint8Array(await foto.slice(0, 12).arrayBuffer())
    const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    const png = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71
    const webp = new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP'
    if (!jpeg && !png && !webp) throw new Error('Isi file foto tidak valid.')
    const previous = await db.prepare('SELECT user_id FROM pb_reports WHERE id=?').bind(id).first<{ user_id: string }>()
    if (previous?.user_id === actor.id) return { success: 'Laporan sudah tersimpan.' }
    if (previous) throw new Error('Identitas pengiriman sudah digunakan.')
    const [data, rules] = await Promise.all([getPbData(db, date, date, actor.id), getPbRules()])
    const jobs = jobIds.map(job => data.jobs.find(j => j.id === job && j.active === 1))
    if (jobs.some(j => !j)) throw new Error('Pilihan pekerjaan berubah. Muat ulang halaman.')
    const item = slotId ? data.items.find(i => i.slot?.id === slotId) : null
    if (slotId && (!item || item.report || item.leave)) throw new Error('Slot tidak tersedia, sudah dilaporkan, atau berstatus izin/sakit.')
    pbInputStatus(item?.slot || null, currentTimeWIB().hhmm, rules.restricted, rules.late, rules.threshold)
    const upload = await uploadToR2(foto, `pramubakti/${actor.id}`, `${crypto.randomUUID()}.${png ? 'png' : webp ? 'webp' : 'jpg'}`)
    if (upload.error || !upload.url) throw new Error(upload.error || 'Unggah foto gagal.')
    uploaded = upload.url
    if (todayWIB() !== date) throw new Error('Tanggal sudah berganti. Muat ulang sebelum mengirim laporan.')
    const status = pbInputStatus(item?.slot || null, currentTimeWIB().hhmm, rules.restricted, rules.late, rules.threshold)
    const names = jobs.map(j => j!.name)
    const time = nowWIBISO()
    await db.batch([
      db.prepare(`INSERT INTO pb_reports(id,user_id,tanggal,slot_id,jobs_json,tempat,foto_url,waktu_input,status,actor_id) VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(id, actor.id, date, slotId, JSON.stringify(names), tempat, uploaded, time, status, actor.id),
      db.prepare('INSERT INTO pb_audit(id,actor_id,action,target,reason,after_json,created_at) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(), actor.id, 'report.create', id, 'Pelaporan pekerjaan', JSON.stringify({ slotId, names, tempat, status }), time),
    ])
    uploaded = null
    for (const path of ['/dashboard/pelaporan-pramubakti', '/dashboard/monitoring-pramubakti', '/dashboard', '/dashboard/ckh-generator']) revalidatePath(path)
    return { success: 'Laporan berhasil disimpan dan tersedia sebagai sumber CKH.' }
  } catch (error) {
    if (uploaded) await deleteFromR2(uploaded).catch(() => undefined)
    const message = error instanceof Error ? error.message : 'Laporan gagal disimpan.'
    return { error: message.includes('UNIQUE') ? 'Laporan sudah tersimpan. Muat ulang untuk melihatnya.' : message }
  }
}
