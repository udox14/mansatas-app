export type KalenderKategori =
  | 'TANGGAL_MERAH'
  | 'LIBUR_SEMESTER'
  | 'RAPAT'
  | 'UJIAN'
  | 'KEGIATAN_MADRASAH'
  | 'LAINNYA'

export type KalenderEvent = {
  id: string
  start_date: string
  end_date: string
  title: string
  category: KalenderKategori
  is_effective: number
  source: 'manual' | 'sync' | 'official'
  external_id: string | null
  description: string | null
}

export type KalenderDateStatus = {
  tanggal: string
  isEffective: boolean
  isSunday: boolean
  reason: string | null
  category: KalenderKategori | 'MINGGU' | null
  events: KalenderEvent[]
}

export const KALENDER_CATEGORY_LABELS: Record<KalenderKategori, string> = {
  TANGGAL_MERAH: 'Tanggal Merah',
  LIBUR_SEMESTER: 'Libur Semester',
  RAPAT: 'Rapat',
  UJIAN: 'Ujian',
  KEGIATAN_MADRASAH: 'Kegiatan Madrasah',
  LAINNYA: 'Lainnya',
}

export async function ensureKalenderPendidikanTables(db: D1Database) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS kalender_pendidikan_events (
      id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      start_date    TEXT NOT NULL,
      end_date      TEXT NOT NULL,
      title         TEXT NOT NULL,
      category      TEXT NOT NULL DEFAULT 'LAINNYA'
                    CHECK(category IN ('TANGGAL_MERAH','LIBUR_SEMESTER','RAPAT','UJIAN','KEGIATAN_MADRASAH','LAINNYA')),
      is_effective  INTEGER NOT NULL DEFAULT 0,
      source        TEXT NOT NULL DEFAULT 'manual' CHECK(source IN ('manual','sync','official')),
      external_id   TEXT,
      description   TEXT,
      created_by    TEXT REFERENCES "user"(id) ON DELETE SET NULL,
      updated_by    TEXT REFERENCES "user"(id) ON DELETE SET NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
      CHECK(start_date <= end_date),
      UNIQUE(source, external_id)
    )
  `).run()
  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_kalender_pendidikan_events_range
    ON kalender_pendidikan_events(start_date, end_date)
  `).run()
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS kalender_pendidikan_sync_logs (
      id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      tahun         INTEGER NOT NULL,
      source        TEXT NOT NULL,
      status        TEXT NOT NULL CHECK(status IN ('SUCCESS','FAILED')),
      jumlah_data   INTEGER NOT NULL DEFAULT 0,
      message       TEXT,
      synced_by     TEXT REFERENCES "user"(id) ON DELETE SET NULL,
      synced_at     TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run()
}

export function hariNumFromDateString(dateString: string) {
  const day = new Date(dateString + 'T00:00:00').getDay()
  return day === 0 ? 7 : day
}

export function enumerateDateStrings(startDate: string, endDate: string) {
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  const dates: string[] = []
  const cursor = new Date(start)

  while (cursor <= end) {
    dates.push(cursor.toISOString().split('T')[0])
    cursor.setDate(cursor.getDate() + 1)
  }

  return dates
}

export async function getKalenderEventsForRange(db: D1Database, startDate: string, endDate: string) {
  await ensureKalenderPendidikanTables(db)
  const result = await db.prepare(`
    SELECT id, start_date, end_date, title, category, is_effective, source, external_id, description
    FROM kalender_pendidikan_events
    WHERE start_date <= ? AND end_date >= ?
    ORDER BY start_date ASC, source ASC, title ASC
  `).bind(endDate, startDate).all<KalenderEvent>()

  return result.results || []
}

export async function getKalenderDateStatus(db: D1Database, tanggal: string): Promise<KalenderDateStatus> {
  const events = await getKalenderEventsForRange(db, tanggal, tanggal)
  const manualEvents = events.filter(event => event.source === 'manual')
  const officialEvents = events.filter(event => event.source === 'official')
  const decidingEvent = manualEvents[0] || officialEvents[0] || events[0] || null
  const isSunday = hariNumFromDateString(tanggal) === 7

  if (decidingEvent) {
    return {
      tanggal,
      isEffective: Number(decidingEvent.is_effective) === 1,
      isSunday,
      reason: decidingEvent.title,
      category: decidingEvent.category,
      events,
    }
  }

  if (isSunday) {
    return {
      tanggal,
      isEffective: false,
      isSunday,
      reason: 'Minggu',
      category: 'MINGGU',
      events,
    }
  }

  return { tanggal, isEffective: true, isSunday, reason: null, category: null, events }
}

export async function getEffectiveDatesInRange(db: D1Database, startDate: string, endDate: string) {
  const dates = enumerateDateStrings(startDate, endDate)
  const events = await getKalenderEventsForRange(db, startDate, endDate)
  const byDate = new Map<string, KalenderEvent[]>()

  for (const event of events) {
    for (const tanggal of enumerateDateStrings(event.start_date, event.end_date)) {
      if (tanggal < startDate || tanggal > endDate) continue
      if (!byDate.has(tanggal)) byDate.set(tanggal, [])
      byDate.get(tanggal)!.push(event)
    }
  }

  return dates.filter(tanggal => {
    const dayEvents = byDate.get(tanggal) || []
    const manual = dayEvents.find(event => event.source === 'manual')
    const official = dayEvents.find(event => event.source === 'official')
    const deciding = manual || official || dayEvents[0] || null
    if (deciding) return Number(deciding.is_effective) === 1
    return hariNumFromDateString(tanggal) !== 7
  })
}
