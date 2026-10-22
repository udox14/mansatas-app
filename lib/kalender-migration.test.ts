import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DatabaseSync } from 'node:sqlite'

let sqlite: DatabaseSync

/** Shim D1 minimal untuk memverifikasi DDL dan query kalender di SQLite lokal. */
function d1(): D1Database {
  return {
    prepare(sql: string) {
      let args: Array<string | number | null> = []
      const statement = {
        bind(...values: Array<string | number | null>) { args = values; return statement },
        async all<T>() {
          const rows = sqlite.prepare(sql).all(...args) as T[]
          return { results: rows, success: true, meta: {} }
        },
        async first<T>() {
          return (sqlite.prepare(sql).get(...args) || null) as T | null
        },
        async run() {
          const info = sqlite.prepare(sql).run(...args)
          return { success: true, meta: { changes: info.changes } }
        },
      }
      return statement
    },
  } as unknown as D1Database
}

function columns() {
  return (sqlite.prepare(`SELECT name FROM pragma_table_info('kalender_pendidikan_events')`).all() as Array<{ name: string }>)
    .map(row => row.name)
}

describe('migrasi kolom sasaran kalender pendidikan', () => {
  beforeEach(() => {
    // Guard schema bersifat per-modul; reset agar tiap kasus memakai instance baru.
    vi.resetModules()
    sqlite = new DatabaseSync(':memory:')
    // Skema lama: belum memiliki target_type/target_value.
    sqlite.exec(`
      CREATE TABLE kalender_pendidikan_events (
        id            TEXT PRIMARY KEY,
        start_date    TEXT NOT NULL,
        end_date      TEXT NOT NULL,
        title         TEXT NOT NULL,
        category      TEXT NOT NULL DEFAULT 'LAINNYA',
        is_effective  INTEGER NOT NULL DEFAULT 0,
        source        TEXT NOT NULL DEFAULT 'manual',
        external_id   TEXT,
        description   TEXT,
        created_by    TEXT,
        updated_by    TEXT,
        created_at    TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO kalender_pendidikan_events (id, start_date, end_date, title, category, is_effective, source)
      VALUES ('legacy', '2026-10-02', '2026-10-03', 'Libur lama', 'LAINNYA', 0, 'manual');
    `)
  })

  afterEach(() => sqlite.close())

  it('menambahkan kolom target tanpa menghapus data lama', async () => {
    const { ensureKalenderPendidikanTables } = await import('./kalender-pendidikan')
    await ensureKalenderPendidikanTables(d1())

    expect(columns()).toEqual(expect.arrayContaining(['target_type', 'target_value']))
    const legacy = sqlite.prepare(`SELECT target_type, target_value FROM kalender_pendidikan_events WHERE id = 'legacy'`)
      .get() as { target_type: string; target_value: string | null }
    expect(legacy).toEqual({ target_type: 'ALL', target_value: null })
  })

  it('idempoten saat dipanggil berulang', async () => {
    const { ensureKalenderPendidikanTables } = await import('./kalender-pendidikan')
    await ensureKalenderPendidikanTables(d1())
    await expect(ensureKalenderPendidikanTables(d1())).resolves.toBeUndefined()
    expect(columns().filter(name => name === 'target_type')).toHaveLength(1)
  })

  it('membaca event lama sebagai berlaku untuk semua kelas', async () => {
    const { getKalenderEventsForRange, kalenderHolidayExceptionsForRange } = await import('./kalender-pendidikan')
    const events = await getKalenderEventsForRange(d1(), '2026-10-01', '2026-10-31')
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ id: 'legacy', target_type: 'ALL', target_value: null })
    expect(kalenderHolidayExceptionsForRange(events, '2026-10-01', '2026-10-31')).toEqual([])
  })

  it('menghitung rentang tanggal tanpa pergeseran zona waktu', async () => {
    const { enumerateDateStrings } = await import('./kalender-pendidikan')
    expect(enumerateDateStrings('2026-10-30', '2026-11-02')).toEqual([
      '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02',
    ])
  })
})
