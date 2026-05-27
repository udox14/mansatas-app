'use server'

import { revalidatePath } from 'next/cache'
import { getDB } from '@/utils/db'
import { getCurrentUser } from '@/utils/auth/server'
import {
  ensureKalenderPendidikanTables,
  enumerateDateStrings,
  getKbmExceptionsForRange,
  getKalenderEventsForRange,
  getKalenderDateStatus,
  hariNumFromDateString,
  type KbmExceptionTargetType,
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

function assertJam(value: number) {
  return Number.isInteger(value) && value > 0 && value <= 20
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

  const [events, kbmExceptions] = await Promise.all([
    getKalenderEventsForRange(db, startDate, endDate),
    getKbmExceptionsForRange(db, startDate, endDate),
  ])
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
    kbmExceptions,
    statuses,
    summary: {
      effective: statuses.filter(status => status.isEffective).length,
      nonEffective: statuses.filter(status => !status.isEffective).length,
      tanggalMerah: events.filter(event => event.category === 'TANGGAL_MERAH' && Number(event.is_effective) === 0).length,
      eventSekolah: events.filter(event => event.category !== 'TANGGAL_MERAH').length,
      kbmExceptions: kbmExceptions.length,
    },
    syncLog: syncLog || null,
  }
}

export async function getKalenderKelasOptions() {
  const db = await getDB()
  const rows = await db.prepare(`
    SELECT id, tingkat, nomor_kelas, kelompok
    FROM kelas
    ORDER BY tingkat ASC, kelompok ASC, CAST(nomor_kelas AS INTEGER) ASC
  `).all<any>()

  return (rows.results || []).map(row => ({
    id: row.id,
    tingkat: Number(row.tingkat),
    label: `${row.tingkat}${row.kelompok ?? ''}-${row.nomor_kelas}`,
  }))
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
  revalidatePath('/dashboard/agenda-kelas')
  revalidatePath('/dashboard/rekap-absensi')
  return { success: 'Kalender pendidikan disimpan.' }
}

export async function saveKbmException(payload: {
  id?: string
  tanggal: string
  judul: string
  kategori: KalenderKategori
  jam_ke_mulai: number
  jam_ke_selesai: number
  target_type: KbmExceptionTargetType
  target_value?: string | null
  description?: string
}) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }
  if (!assertDate(payload.tanggal)) return { error: 'Tanggal tidak valid.' }
  if (!payload.judul.trim()) return { error: 'Judul wajib diisi.' }
  if (!VALID_CATEGORIES.has(payload.kategori)) return { error: 'Kategori tidak valid.' }
  if (!assertJam(payload.jam_ke_mulai) || !assertJam(payload.jam_ke_selesai) || payload.jam_ke_mulai > payload.jam_ke_selesai) {
    return { error: 'Rentang jam pelajaran tidak valid.' }
  }
  if (!['ALL', 'TINGKAT', 'KELAS'].includes(payload.target_type)) return { error: 'Sasaran tidak valid.' }

  let targetValue: string | null = null
  if (payload.target_type === 'TINGKAT') {
    const tingkat = Number(payload.target_value)
    if (!Number.isInteger(tingkat) || tingkat < 1 || tingkat > 12) return { error: 'Tingkat kelas tidak valid.' }
    targetValue = String(tingkat)
  } else if (payload.target_type === 'KELAS') {
    if (!payload.target_value) return { error: 'Kelas target wajib dipilih.' }
    targetValue = payload.target_value
  }

  const db = await getDB()
  await ensureKalenderPendidikanTables(db)

  if (payload.target_type === 'KELAS' && targetValue) {
    const kelas = await db.prepare('SELECT id FROM kelas WHERE id = ?').bind(targetValue).first<{ id: string }>()
    if (!kelas) return { error: 'Kelas target tidak ditemukan.' }
  }

  if (payload.id) {
    await db.prepare(`
      UPDATE kbm_exceptions
      SET tanggal = ?, judul = ?, kategori = ?, jam_ke_mulai = ?, jam_ke_selesai = ?,
          target_type = ?, target_value = ?, description = ?, updated_by = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(
      payload.tanggal,
      payload.judul.trim(),
      payload.kategori,
      payload.jam_ke_mulai,
      payload.jam_ke_selesai,
      payload.target_type,
      targetValue,
      payload.description?.trim() || null,
      user.id,
      payload.id,
    ).run()
  } else {
    await db.prepare(`
      INSERT INTO kbm_exceptions
        (tanggal, judul, kategori, jam_ke_mulai, jam_ke_selesai, target_type, target_value, description, created_by, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      payload.tanggal,
      payload.judul.trim(),
      payload.kategori,
      payload.jam_ke_mulai,
      payload.jam_ke_selesai,
      payload.target_type,
      targetValue,
      payload.description?.trim() || null,
      user.id,
      user.id,
    ).run()
  }

  revalidatePath('/dashboard/kalender-pendidikan')
  revalidatePath('/dashboard/kehadiran')
  revalidatePath('/dashboard/agenda')
  revalidatePath('/dashboard/monitoring-agenda')
  revalidatePath('/dashboard/agenda-kelas')
  revalidatePath('/dashboard/rekap-absensi')
  return { success: 'Pengecualian jam KBM disimpan.' }
}

export async function deleteKbmException(id: string) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  const db = await getDB()
  await ensureKalenderPendidikanTables(db)
  await db.prepare('DELETE FROM kbm_exceptions WHERE id = ?').bind(id).run()

  revalidatePath('/dashboard/kalender-pendidikan')
  revalidatePath('/dashboard/kehadiran')
  revalidatePath('/dashboard/agenda')
  revalidatePath('/dashboard/monitoring-agenda')
  revalidatePath('/dashboard/agenda-kelas')
  revalidatePath('/dashboard/rekap-absensi')
  return { success: 'Pengecualian jam KBM dihapus.' }
}

export type KalenderImportRow = {
  start_date: string
  end_date: string
  title: string
  category: KalenderKategori
  is_effective: boolean
  description?: string
}

function normalizeImportCategory(value: string): KalenderKategori {
  const raw = value.trim().toUpperCase().replace(/\s+/g, '_').replace(/-/g, '_')
  if (raw.includes('CUTI') || raw.includes('LIBUR_NASIONAL') || raw.includes('TANGGAL_MERAH')) return 'TANGGAL_MERAH'
  if (raw.includes('SEMESTER')) return 'LIBUR_SEMESTER'
  if (raw.includes('RAPAT')) return 'RAPAT'
  if (raw.includes('UJIAN') || raw.includes('ASESMEN')) return 'UJIAN'
  if (raw.includes('KEGIATAN')) return 'KEGIATAN_MADRASAH'
  return VALID_CATEGORIES.has(raw as KalenderKategori) ? raw as KalenderKategori : 'TANGGAL_MERAH'
}

export async function importKalenderResmi(year: number, rows: KalenderImportRow[]) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }
  if (!Number.isInteger(year) || year < 2020 || year > 2100) return { error: 'Tahun tidak valid.' }
  if (!Array.isArray(rows) || rows.length === 0) return { error: 'Tidak ada data untuk diimpor.' }

  const cleanRows: KalenderImportRow[] = []
  for (const row of rows) {
    const startDate = String(row.start_date || '').slice(0, 10)
    const endDate = String(row.end_date || row.start_date || '').slice(0, 10)
    const title = String(row.title || '').trim()
    if (!assertDate(startDate) || !assertDate(endDate) || !title) continue
    if (startDate > endDate) continue
    if (!startDate.startsWith(`${year}-`)) continue
    cleanRows.push({
      start_date: startDate,
      end_date: endDate,
      title,
      category: normalizeImportCategory(row.category || 'TANGGAL_MERAH'),
      is_effective: Boolean(row.is_effective),
      description: row.description?.trim() || 'Impor SKB resmi',
    })
  }

  if (cleanRows.length === 0) return { error: 'Tidak ada baris valid untuk tahun tersebut.' }

  const db = await getDB()
  await ensureKalenderPendidikanTables(db)
  const yearStart = `${year}-01-01`
  const yearEnd = `${year}-12-31`
  const statements = [
    db.prepare(`
      DELETE FROM kalender_pendidikan_events
      WHERE source IN ('sync','official') AND start_date BETWEEN ? AND ?
    `).bind(yearStart, yearEnd),
    ...cleanRows.map((row, index) => db.prepare(`
      INSERT INTO kalender_pendidikan_events
        (start_date, end_date, title, category, is_effective, source, external_id, description, created_by, updated_by)
      VALUES (?, ?, ?, ?, ?, 'official', ?, ?, ?, ?)
    `).bind(
      row.start_date,
      row.end_date,
      row.title,
      row.category,
      row.is_effective ? 1 : 0,
      `${year}:official:${row.start_date}:${index}`,
      row.description || null,
      user.id,
      user.id,
    )),
  ]

  for (let i = 0; i < statements.length; i += 100) {
    await db.batch(statements.slice(i, i + 100))
  }

  await db.prepare(`
    INSERT INTO kalender_pendidikan_sync_logs (tahun, source, status, jumlah_data, message, synced_by)
    VALUES (?, 'SKB Resmi', 'SUCCESS', ?, ?, ?)
  `).bind(year, cleanRows.length, 'Impor SKB resmi berhasil', user.id).run()

  revalidatePath('/dashboard/kalender-pendidikan')
  revalidatePath('/dashboard/kehadiran')
  revalidatePath('/dashboard/agenda')
  revalidatePath('/dashboard/monitoring-agenda')
  revalidatePath('/dashboard/agenda-kelas')
  revalidatePath('/dashboard/rekap-absensi')
  return { success: `${cleanRows.length} data SKB resmi berhasil diimpor.`, count: cleanRows.length }
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
  revalidatePath('/dashboard/agenda-kelas')
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
