'use server'

import { revalidatePath } from 'next/cache'
import { getDB } from '@/utils/db'
import { getCurrentUser } from '@/utils/auth/server'
import {
  ensureKalenderPendidikanTables,
  enumerateDateStrings,
  getKalenderEventsForRange,
  getKalenderDateStatus,
  hariNumFromDateString,
  type KalenderKategori,
} from '@/lib/kalender-pendidikan'

const VALID_CATEGORIES = new Set<KalenderKategori>([
  'TANGGAL_MERAH',
  'LIBUR_SEMESTER',
  'RAPAT',
  'UJIAN',
  'KEGIATAN_MADRASAH',
  'LAINNYA',
])

function assertDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function normalizeHolidayRows(payload: any): Array<{ date: string; title: string; externalId: string }> {
  const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.holidays) ? payload.holidays : []

  return rows.map((row: any) => {
    const date = String(row.date || row.tanggal || row.holiday_date || '').slice(0, 10)
    const title = String(row.description || row.name || row.summary || row.title || row.holiday_name || row.keterangan || 'Tanggal Merah').trim()
    const externalId = String(row.id || `${date}:${title}`.toLowerCase().replace(/\s+/g, '-'))
    return { date, title, externalId }
  }).filter((item: { date: string; title: string; externalId: string }) => assertDate(item.date) && item.title)
}

const OFFICIAL_HOLIDAYS_BY_YEAR: Record<number, Array<{ date: string; title: string }>> = {
  2026: [
    { date: '2026-01-01', title: 'Tahun Baru 2026 Masehi' },
    { date: '2026-01-16', title: 'Isra Mikraj Nabi Muhammad saw.' },
    { date: '2026-02-16', title: 'Cuti Bersama Tahun Baru Imlek 2577 Kongzili' },
    { date: '2026-02-17', title: 'Tahun Baru Imlek 2577 Kongzili' },
    { date: '2026-03-18', title: 'Cuti Bersama Hari Suci Nyepi Tahun Baru Saka 1948' },
    { date: '2026-03-19', title: 'Hari Suci Nyepi Tahun Baru Saka 1948' },
    { date: '2026-03-20', title: 'Cuti Bersama Idulfitri 1447 H' },
    { date: '2026-03-21', title: 'Idulfitri 1447 H' },
    { date: '2026-03-22', title: 'Idulfitri 1447 H' },
    { date: '2026-03-23', title: 'Cuti Bersama Idulfitri 1447 H' },
    { date: '2026-03-24', title: 'Cuti Bersama Idulfitri 1447 H' },
    { date: '2026-04-03', title: 'Wafat Yesus Kristus' },
    { date: '2026-04-05', title: 'Kebangkitan Yesus Kristus' },
    { date: '2026-05-01', title: 'Hari Buruh Internasional' },
    { date: '2026-05-14', title: 'Kenaikan Yesus Kristus' },
    { date: '2026-05-15', title: 'Cuti Bersama Kenaikan Yesus Kristus' },
    { date: '2026-05-27', title: 'Iduladha 1447 H' },
    { date: '2026-05-28', title: 'Cuti Bersama Iduladha 1447 H' },
    { date: '2026-05-31', title: 'Hari Raya Waisak 2570 BE' },
    { date: '2026-06-01', title: 'Hari Lahir Pancasila' },
    { date: '2026-06-16', title: '1 Muharam Tahun Baru Islam 1448 H' },
    { date: '2026-08-17', title: 'Proklamasi Kemerdekaan' },
    { date: '2026-08-25', title: 'Maulid Nabi Muhammad saw.' },
    { date: '2026-12-24', title: 'Cuti Bersama Kelahiran Yesus Kristus' },
    { date: '2026-12-25', title: 'Kelahiran Yesus Kristus' },
  ],
}

async function fetchHolidayRows(year: number) {
  const officialRows = OFFICIAL_HOLIDAYS_BY_YEAR[year]
  if (officialRows) {
    return {
      source: 'SKB 3 Menteri 2026',
      data: officialRows.map(item => ({
        date: item.date,
        title: item.title,
        externalId: `skb-${item.date}`,
      })),
    }
  }

  const sources = [
    {
      name: 'api-hari-libur.vercel.app',
      url: `https://api-hari-libur.vercel.app/api?year=${year}`,
    },
    {
      name: 'libur.deno.dev',
      url: `https://libur.deno.dev/api?year=${year}`,
    },
  ]

  let lastError = ''
  for (const source of sources) {
    try {
      const response = await fetch(source.url, { cache: 'no-store' })
      if (!response.ok) {
        lastError = `${source.name}: HTTP ${response.status}`
        continue
      }
      const data = normalizeHolidayRows(await response.json())
      if (data.length > 0) return { source: source.name, data }
      lastError = `${source.name}: data kosong`
    } catch (error: any) {
      lastError = `${source.name}: ${error?.message || 'gagal diakses'}`
    }
  }

  throw new Error(lastError || 'Sumber tanggal merah tidak tersedia.')
}

export async function getKalenderPendidikanData(year: number, month: number) {
  const db = await getDB()
  await ensureKalenderPendidikanTables(db)

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const events = await getKalenderEventsForRange(db, startDate, endDate)
  const dates = enumerateDateStrings(startDate, endDate)
  const statuses = await Promise.all(dates.map(tanggal => getKalenderDateStatus(db, tanggal)))

  const syncLog = await db.prepare(`
    SELECT tahun, source, status, jumlah_data, message, synced_at
    FROM kalender_pendidikan_sync_logs
    WHERE tahun = ?
    ORDER BY synced_at DESC
    LIMIT 1
  `).bind(year).first<any>()

  return {
    year,
    month,
    events,
    statuses,
    summary: {
      effective: statuses.filter(status => status.isEffective).length,
      nonEffective: statuses.filter(status => !status.isEffective).length,
      tanggalMerah: events.filter(event => event.category === 'TANGGAL_MERAH' && Number(event.is_effective) === 0).length,
      eventSekolah: events.filter(event => event.category !== 'TANGGAL_MERAH').length,
    },
    syncLog: syncLog || null,
  }
}

export async function saveKalenderEvent(payload: {
  id?: string
  start_date: string
  end_date: string
  title: string
  category: KalenderKategori
  is_effective: boolean
  description?: string
}) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }
  if (!assertDate(payload.start_date) || !assertDate(payload.end_date)) return { error: 'Tanggal tidak valid.' }
  if (payload.start_date > payload.end_date) return { error: 'Tanggal selesai tidak boleh lebih awal.' }
  if (!payload.title.trim()) return { error: 'Judul wajib diisi.' }
  if (!VALID_CATEGORIES.has(payload.category)) return { error: 'Kategori tidak valid.' }

  const db = await getDB()
  await ensureKalenderPendidikanTables(db)

  if (payload.id) {
    await db.prepare(`
      UPDATE kalender_pendidikan_events
      SET start_date = ?, end_date = ?, title = ?, category = ?, is_effective = ?,
          source = 'manual', external_id = NULL, description = ?, updated_by = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(
      payload.start_date,
      payload.end_date,
      payload.title.trim(),
      payload.category,
      payload.is_effective ? 1 : 0,
      payload.description?.trim() || null,
      user.id,
      payload.id,
    ).run()
  } else {
    await db.prepare(`
      INSERT INTO kalender_pendidikan_events
        (start_date, end_date, title, category, is_effective, source, description, created_by, updated_by)
      VALUES (?, ?, ?, ?, ?, 'manual', ?, ?, ?)
    `).bind(
      payload.start_date,
      payload.end_date,
      payload.title.trim(),
      payload.category,
      payload.is_effective ? 1 : 0,
      payload.description?.trim() || null,
      user.id,
      user.id,
    ).run()
  }

  revalidatePath('/dashboard/kalender-pendidikan')
  revalidatePath('/dashboard/kehadiran')
  revalidatePath('/dashboard/agenda')
  revalidatePath('/dashboard/monitoring-agenda')
  revalidatePath('/dashboard/rekap-absensi')
  return { success: 'Kalender pendidikan disimpan.' }
}

export async function deleteKalenderEvent(id: string) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  const db = await getDB()
  await ensureKalenderPendidikanTables(db)
  await db.prepare('DELETE FROM kalender_pendidikan_events WHERE id = ?').bind(id).run()

  revalidatePath('/dashboard/kalender-pendidikan')
  revalidatePath('/dashboard/kehadiran')
  revalidatePath('/dashboard/agenda')
  revalidatePath('/dashboard/monitoring-agenda')
  revalidatePath('/dashboard/rekap-absensi')
  return { success: 'Event kalender dihapus.' }
}

export async function syncTanggalMerah(year: number) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }
  if (!Number.isInteger(year) || year < 2020 || year > 2100) return { error: 'Tahun tidak valid.' }

  const db = await getDB()
  await ensureKalenderPendidikanTables(db)

  try {
    const { source, data } = await fetchHolidayRows(year)
    const yearStart = `${year}-01-01`
    const yearEnd = `${year}-12-31`
    const statements = [
      db.prepare(`
        DELETE FROM kalender_pendidikan_events
        WHERE source = 'sync' AND start_date BETWEEN ? AND ?
      `).bind(yearStart, yearEnd),
      ...data.map(item => db.prepare(`
      INSERT INTO kalender_pendidikan_events
        (start_date, end_date, title, category, is_effective, source, external_id, description, created_by, updated_by)
      VALUES (?, ?, ?, 'TANGGAL_MERAH', 0, 'sync', ?, ?, ?, ?)
      ON CONFLICT(source, external_id) DO UPDATE SET
        start_date = excluded.start_date,
        end_date = excluded.end_date,
        title = excluded.title,
        category = excluded.category,
        is_effective = excluded.is_effective,
        description = excluded.description,
        updated_by = excluded.updated_by,
        updated_at = datetime('now')
      `).bind(
        item.date,
        item.date,
        item.title,
        `${year}:${item.externalId}`,
        `Sinkron dari ${source}`,
        user.id,
        user.id,
      )),
    ]

    for (let i = 0; i < statements.length; i += 100) {
      await db.batch(statements.slice(i, i + 100))
    }

    await db.prepare(`
      INSERT INTO kalender_pendidikan_sync_logs (tahun, source, status, jumlah_data, message, synced_by)
      VALUES (?, ?, 'SUCCESS', ?, ?, ?)
    `).bind(year, source, data.length, 'Sinkron berhasil', user.id).run()

    revalidatePath('/dashboard/kalender-pendidikan')
    return { success: `${data.length} tanggal merah berhasil disinkronkan.`, count: data.length }
  } catch (error: any) {
    const message = error?.message || 'Sinkron gagal.'
    await db.prepare(`
      INSERT INTO kalender_pendidikan_sync_logs (tahun, source, status, jumlah_data, message, synced_by)
      VALUES (?, 'holiday-api', 'FAILED', 0, ?, ?)
    `).bind(year, message, user.id).run()
    return { error: message }
  }
}

export async function getTanggalEfektifInfo(tanggal: string) {
  const db = await getDB()
  const status = await getKalenderDateStatus(db, tanggal)
  return {
    ...status,
    hari: hariNumFromDateString(tanggal),
  }
}
