import { ensureSchemaOnce } from '@/lib/schema-guard'

export type KalenderKategori =
  | 'TANGGAL_MERAH'
  | 'LIBUR_SEMESTER'
  | 'RAPAT'
  | 'UJIAN'
  | 'KEGIATAN_MADRASAH'
  | 'LAINNYA'

export type KalenderTargetType = 'ALL' | 'TINGKAT' | 'KELAS'

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
  target_type: KalenderTargetType
  target_value: string | null
}

/**
 * Konteks kelas untuk membaca status kalender.
 * - Tanpa scope = status madrasah (hanya event untuk semua kelas yang menentukan).
 * - Dengan scope = status untuk kelas/tingkat tersebut, termasuk event lintas kelas.
 */
export type KalenderScope = {
  kelasId?: string | null
  tingkat?: number | null
}

export type KalenderDateStatus = {
  tanggal: string
  isEffective: boolean
  isSunday: boolean
  reason: string | null
  category: KalenderKategori | 'MINGGU' | null
  events: KalenderEvent[]
}

export type KbmExceptionTargetType = 'ALL' | 'TINGKAT' | 'KELAS'

export type KbmException = {
  id: string
  tanggal: string
  judul: string
  kategori: KalenderKategori
  jam_ke_mulai: number
  jam_ke_selesai: number
  target_type: KbmExceptionTargetType
  target_value: string | null
  description: string | null
}

export type KbmExceptionClassTarget = {
  id: string
  tingkat: number
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
      target_type   TEXT NOT NULL DEFAULT 'ALL',
      target_value  TEXT,
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
  await ensureKalenderEventTargetSchema(db)
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
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS kbm_exceptions (
      id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      tanggal         TEXT NOT NULL,
      judul           TEXT NOT NULL,
      kategori        TEXT NOT NULL DEFAULT 'KEGIATAN_MADRASAH'
                      CHECK(kategori IN ('TANGGAL_MERAH','LIBUR_SEMESTER','RAPAT','UJIAN','KEGIATAN_MADRASAH','LAINNYA')),
      jam_ke_mulai    INTEGER NOT NULL,
      jam_ke_selesai  INTEGER NOT NULL,
      target_type     TEXT NOT NULL CHECK(target_type IN ('ALL','TINGKAT','KELAS')),
      target_value    TEXT,
      description     TEXT,
      created_by      TEXT REFERENCES "user"(id) ON DELETE SET NULL,
      updated_by      TEXT REFERENCES "user"(id) ON DELETE SET NULL,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
      CHECK(tanggal GLOB '????-??-??'),
      CHECK(jam_ke_mulai > 0),
      CHECK(jam_ke_selesai >= jam_ke_mulai),
      CHECK(
        (target_type = 'ALL' AND target_value IS NULL)
        OR (target_type IN ('TINGKAT','KELAS') AND target_value IS NOT NULL)
      )
    )
  `).run()
  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_kbm_exceptions_tanggal
    ON kbm_exceptions(tanggal)
  `).run()
  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_kbm_exceptions_target
    ON kbm_exceptions(target_type, target_value)
  `).run()
}

/**
 * Kolom sasaran (target) ditambahkan belakangan, sehingga database lama perlu
 * migrasi non-destruktif. ALTER TABLE ADD COLUMN tidak mendukung IF NOT EXISTS di
 * SQLite/D1, jadi keberadaan kolom diperiksa lebih dulu.
 *
 * Guard terpisah dipakai agar deployment lama yang sudah menandai schema
 * kalender sebagai selesai tetap menjalankan migrasi kolom ini.
 */
export async function ensureKalenderEventTargetSchema(db: D1Database) {
  await ensureSchemaOnce('kalender-pendidikan-target-v1', () => ensureKalenderEventTargetColumns(db))
}

async function ensureKalenderEventTargetColumns(db: D1Database) {
  const columns = await db.prepare(`SELECT name FROM pragma_table_info('kalender_pendidikan_events')`)
    .all<{ name: string }>()
  const existing = new Set((columns.results || []).map(column => column.name))
  const additions: Array<{ name: string; sql: string }> = [
    { name: 'target_type', sql: `ALTER TABLE kalender_pendidikan_events ADD COLUMN target_type TEXT NOT NULL DEFAULT 'ALL'` },
    { name: 'target_value', sql: `ALTER TABLE kalender_pendidikan_events ADD COLUMN target_value TEXT` },
  ]

  for (const addition of additions) {
    if (existing.has(addition.name)) continue
    try {
      await db.prepare(addition.sql).run()
    } catch (error) {
      // Isolate lain bisa menambahkan kolom yang sama lebih dulu.
      if (!String((error as { message?: string })?.message || error).includes('duplicate column')) throw error
    }
  }
}

export function hariNumFromDateString(dateString: string) {
  const day = new Date(dateString + 'T00:00:00').getDay()
  return day === 0 ? 7 : day
}

export function enumerateDateStrings(startDate: string, endDate: string) {
  // Tanggal kalender tidak boleh bergeser oleh zona waktu server lokal.
  const start = new Date(startDate + 'T00:00:00Z')
  const end = new Date(endDate + 'T00:00:00Z')
  const dates: string[] = []
  const cursor = new Date(start)

  while (cursor <= end) {
    dates.push(cursor.toISOString().split('T')[0])
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return dates
}

export async function getKalenderEventsForRange(db: D1Database, startDate: string, endDate: string) {
  await ensureSchemaOnce('kalender-pendidikan', () => ensureKalenderPendidikanTables(db))
  await ensureKalenderEventTargetSchema(db)
  const result = await db.prepare(`
    SELECT id, start_date, end_date, title, category, is_effective, source, external_id, description,
      target_type, target_value
    FROM kalender_pendidikan_events
    WHERE start_date <= ? AND end_date >= ?
    ORDER BY start_date ASC, source ASC, title ASC
  `).bind(endDate, startDate).all<KalenderEvent>()

  return (result.results || []).map(event => ({
    ...event,
    target_type: normalizeKalenderTargetType(event.target_type),
    target_value: event.target_value ?? null,
  }))
}

export function normalizeKalenderTargetType(value: unknown): KalenderTargetType {
  return value === 'TINGKAT' || value === 'KELAS' ? value : 'ALL'
}

/** Target tersimpan sebagai satu nilai tunggal atau array JSON (multi tingkat/kelas). */
export function getKalenderTargetValues(targetValue: string | null | undefined): string[] {
  return getKbmExceptionClassIds(targetValue ?? null)
}

/** Event berlaku untuk scope kelas tertentu? Tanpa scope hanya event semua kelas yang berlaku. */
export function kalenderEventAppliesToScope(
  event: Pick<KalenderEvent, 'target_type' | 'target_value'>,
  scope?: KalenderScope | null
) {
  const targetType = normalizeKalenderTargetType(event.target_type)
  if (targetType === 'ALL') return true
  if (!scope) return false

  if (targetType === 'TINGKAT') {
    if (scope.tingkat === null || scope.tingkat === undefined) return false
    return getKalenderTargetValues(event.target_value).map(Number).includes(Number(scope.tingkat))
  }

  if (targetType === 'KELAS') {
    if (!scope.kelasId) return false
    return getKalenderTargetValues(event.target_value).includes(scope.kelasId)
  }

  return false
}

/** Event kalender yang berlaku untuk satu kelas konkret. */
export function kalenderEventAppliesToClass(
  event: Pick<KalenderEvent, 'target_type' | 'target_value'>,
  kelas: KbmExceptionClassTarget
) {
  return kalenderEventAppliesToScope(event, {
    kelasId: kelas.id,
    tingkat: kelas.tingkat === null || kelas.tingkat === undefined ? null : Number(kelas.tingkat),
  })
}

export const MAX_JAM_PELAJARAN = 20

/**
 * Event kalender lintas kelas yang berstatus tidak efektif diperlakukan sebagai
 * pengecualian KBM sehari penuh, sehingga absensi/agenda/jurnal untuk kelas
 * tersebut otomatis kosong tanpa perlu logika khusus di setiap modul.
 */
export function kalenderHolidayExceptionsForRange(
  events: KalenderEvent[],
  startDate: string,
  endDate: string
): KbmException[] {
  const rows: KbmException[] = []

  for (const event of events) {
    if (Number(event.is_effective) === 1) continue
    if (normalizeKalenderTargetType(event.target_type) === 'ALL') continue

    const dates = enumerateDateStrings(event.start_date, event.end_date)
    for (const tanggal of dates) {
      if (tanggal < startDate || tanggal > endDate) continue
      const targetValues = event.target_type === 'KELAS'
        ? [event.target_value || '']
        : getKalenderTargetValues(event.target_value)
      for (const targetValue of targetValues) {
        if (!targetValue) continue
        rows.push({
          id: `kalender:${event.id}:${tanggal}:${targetValue}`,
          tanggal,
          judul: event.title,
          kategori: event.category,
          jam_ke_mulai: 1,
          jam_ke_selesai: MAX_JAM_PELAJARAN,
          target_type: event.target_type,
          target_value: targetValue,
          description: event.description,
        })
      }
    }
  }

  return rows
}

export type KbmExceptionQueryOptions = {
  /** Sertakan libur lintas kelas dari Kalender Pendidikan sebagai pengecualian sehari penuh. */
  includeKalenderHolidays?: boolean
}

export async function getKbmExceptionsForRange(
  db: D1Database,
  startDate: string,
  endDate: string,
  options: KbmExceptionQueryOptions = {}
) {
  await ensureSchemaOnce('kalender-pendidikan', () => ensureKalenderPendidikanTables(db))
  const result = await db.prepare(`
    SELECT id, tanggal, judul, kategori, jam_ke_mulai, jam_ke_selesai, target_type, target_value, description
    FROM kbm_exceptions
    WHERE tanggal BETWEEN ? AND ?
    ORDER BY tanggal ASC, jam_ke_mulai ASC, judul ASC
  `).bind(startDate, endDate).all<KbmException>()

  const exceptions = result.results || []
  if (options.includeKalenderHolidays === false) return exceptions

  const events = await getKalenderEventsForRange(db, startDate, endDate)
  const holidays = kalenderHolidayExceptionsForRange(events, startDate, endDate)
  return holidays.length > 0 ? [...holidays, ...exceptions] : exceptions
}

export async function getKbmExceptionsForDate(
  db: D1Database,
  tanggal: string,
  options: KbmExceptionQueryOptions = {}
) {
  return getKbmExceptionsForRange(db, tanggal, tanggal, options)
}

// Legacy targets contain one class ID; multiple targets use a JSON array in
// the existing TEXT column so each exception remains one editable record.
export function getKbmExceptionClassIds(targetValue: string | null): string[] {
  if (!targetValue) return []
  if (!targetValue.startsWith('[')) return [targetValue]
  try {
    const values: unknown = JSON.parse(targetValue)
    return Array.isArray(values) && values.every(value => typeof value === 'string' && value.length > 0)
      ? Array.from(new Set(values as string[]))
      : []
  } catch {
    return []
  }
}

export function kbmExceptionAppliesToClass(exception: KbmException, kelas: KbmExceptionClassTarget) {
  if (exception.target_type === 'ALL') return true
  if (exception.target_type === 'TINGKAT') return String(kelas.tingkat) === String(exception.target_value)
  if (exception.target_type === 'KELAS') return getKbmExceptionClassIds(exception.target_value).includes(kelas.id)
  return false
}

export function teachingBlockOverlapsException(exception: KbmException, jamKeMulai: number, jamKeSelesai: number) {
  return jamKeMulai <= exception.jam_ke_selesai && jamKeSelesai >= exception.jam_ke_mulai
}

export function findTeachingBlockException(
  exceptions: KbmException[],
  kelas: KbmExceptionClassTarget,
  jamKeMulai: number,
  jamKeSelesai: number
) {
  return exceptions.find(exception =>
    kbmExceptionAppliesToClass(exception, kelas) &&
    teachingBlockOverlapsException(exception, jamKeMulai, jamKeSelesai)
  ) || null
}

export function isTeachingBlockExcepted(
  exceptions: KbmException[],
  kelas: KbmExceptionClassTarget,
  jamKeMulai: number,
  jamKeSelesai: number
) {
  return !!findTeachingBlockException(exceptions, kelas, jamKeMulai, jamKeSelesai)
}

export function findSlotException(
  exceptions: KbmException[],
  kelas: KbmExceptionClassTarget,
  jamKe: number
) {
  return findTeachingBlockException(exceptions, kelas, jamKe, jamKe)
}

export type TeachingSlotExceptionSegment = {
  exception_id: string
  judul: string
  description: string | null
  jam_ke_mulai: number
  jam_ke_selesai: number
}

/**
 * Memisahkan jam terjadwal menjadi jam KBM aktif dan segmen yang dikecualikan.
 * Pengecualian parsial tidak boleh menggugurkan seluruh blok mengajar.
 */
export function splitTeachingSlotsByExceptions(
  exceptions: KbmException[],
  kelas: KbmExceptionClassTarget,
  jamKeValues: Iterable<number>
) {
  const scheduledJamKe = Array.from(new Set(Array.from(jamKeValues).map(Number)))
    .filter(Number.isFinite)
    .sort((a, b) => a - b)
  const activeJamKe: number[] = []
  const exceptionSegments: TeachingSlotExceptionSegment[] = []

  for (const jamKe of scheduledJamKe) {
    const exception = findSlotException(exceptions, kelas, jamKe)
    if (!exception) {
      activeJamKe.push(jamKe)
      continue
    }

    const previous = exceptionSegments[exceptionSegments.length - 1]
    if (previous && previous.exception_id === exception.id && previous.jam_ke_selesai + 1 === jamKe) {
      previous.jam_ke_selesai = jamKe
    } else {
      exceptionSegments.push({
        exception_id: exception.id,
        judul: exception.judul,
        description: exception.description,
        jam_ke_mulai: jamKe,
        jam_ke_selesai: jamKe,
      })
    }
  }

  return { scheduledJamKe, activeJamKe, exceptionSegments }
}

export function hasActiveTeachingSlots(
  exceptions: KbmException[],
  kelas: KbmExceptionClassTarget,
  jamKeValues: Iterable<number>
) {
  return splitTeachingSlotsByExceptions(exceptions, kelas, jamKeValues).activeJamKe.length > 0
}

export function hasActiveTeachingSlotsInRange(
  exceptions: KbmException[],
  kelas: KbmExceptionClassTarget,
  jamKeMulai: number,
  jamKeSelesai: number
) {
  const length = Math.max(0, jamKeSelesai - jamKeMulai + 1)
  return hasActiveTeachingSlots(
    exceptions,
    kelas,
    Array.from({ length }, (_, index) => jamKeMulai + index)
  )
}

export async function getKalenderDateStatus(
  db: D1Database,
  tanggal: string,
  scope?: KalenderScope | null
): Promise<KalenderDateStatus> {
  const events = await getKalenderEventsForRange(db, tanggal, tanggal)
  return kalenderDateStatusFromEvents(tanggal, events, scope)
}

/**
 * Status satu tanggal. Event yang hanya berlaku untuk tingkat/kelas tertentu
 * tidak mengubah status madrasah, tetapi menentukan status kelas tersebut.
 */
export function kalenderDateStatusFromEvents(
  tanggal: string,
  rangeEvents: KalenderEvent[],
  scope?: KalenderScope | null
): KalenderDateStatus {
  const dayEvents = rangeEvents.filter(event => event.start_date <= tanggal && event.end_date >= tanggal)
  // Tanpa scope hasilnya status madrasah: hanya event untuk semua kelas yang berlaku.
  const events = dayEvents.filter(event => kalenderEventAppliesToScope(event, scope))
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

export async function getEffectiveDatesInRange(
  db: D1Database,
  startDate: string,
  endDate: string,
  scope?: KalenderScope | null
) {
  const dates = enumerateDateStrings(startDate, endDate)
  const events = await getKalenderEventsForRange(db, startDate, endDate)
  return dates.filter(tanggal => kalenderDateStatusFromEvents(tanggal, events, scope).isEffective)
}
