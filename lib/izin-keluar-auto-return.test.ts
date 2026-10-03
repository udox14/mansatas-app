import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import { readFileSync } from 'node:fs'
vi.mock('@/lib/attendance-cache', () => ({ invalidateAttendanceCache: vi.fn() }))
import { autoReturnIzinKeluar } from './izin-keluar-auto-return'
import { invalidateAttendanceCache } from './attendance-cache'

let sqlite: DatabaseSync
let db: D1Database
let queries: Array<{ sql: string; binds: SQLInputValue[] }>
const pattern = JSON.stringify([
  { hari: [5], slots: [{ selesai: '10:20' }, { selesai: '07:50' }] },
  { hari: [6], slots: [{ selesai: '13:00' }] },
])
function permit(id: string, time = '2026-10-02T08:00:00.000+07:00', status = 'BELUM KEMBALI', returned: string | null = null) {
  sqlite.prepare('INSERT INTO izin_keluar_komplek VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, time, returned, status, 'Ke dokter', 'original')
}
function row(id: string) { return sqlite.prepare('SELECT * FROM izin_keluar_komplek WHERE id = ?').get(id)! }
beforeEach(() => {
  vi.clearAllMocks()
  queries = []
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec(`CREATE TABLE izin_keluar_komplek (id TEXT PRIMARY KEY, waktu_keluar TEXT,
    waktu_kembali TEXT, status TEXT, keterangan TEXT, updated_at TEXT);
    CREATE TABLE tahun_ajaran (is_active INTEGER, jam_pelajaran TEXT);`)
  sqlite.exec(readFileSync(new URL('../migrations/0117_izin_keluar_auto_return.sql', import.meta.url), 'utf8'))
  sqlite.prepare('INSERT INTO tahun_ajaran VALUES (1, ?)').run(pattern)
  db = { prepare(sql: string) {
    let binds: SQLInputValue[] = []
    const record = () => { queries.push({ sql, binds }); return sqlite.prepare(sql) }
    const statement = {
      bind(...values: SQLInputValue[]) { binds = values; return statement },
      async first() { return record().get(...binds) ?? null },
      async run() { return { meta: { changes: Number(record().run(...binds).changes) } } },
    }
    return statement
  } } as unknown as D1Database
})
afterEach(() => sqlite.close())

describe('auto return daily exit permits', () => {
  it('waits until the last slot ends in WIB, then closes atomically and only once', async () => {
    permit('open'); permit('manual', undefined, 'SUDAH KEMBALI', '2026-10-02T09:00:00.000+07:00')
    expect(await autoReturnIzinKeluar(db, new Date('2026-10-02T03:19:59Z'))).toEqual({ processed: 0 })
    expect(row('open').status).toBe('BELUM KEMBALI')
    expect(await autoReturnIzinKeluar(db, new Date('2026-10-02T03:20:00Z'))).toEqual({ processed: 1 })
    expect(row('open')).toMatchObject({ status: 'SUDAH KEMBALI', waktu_kembali: '2026-10-02T10:20:00.000+07:00' })
    expect(row('open').keterangan).toContain('Ke dokter\n[Otomatis:')
    expect(row('manual').keterangan).toBe('Ke dokter')
    expect(row('manual').waktu_kembali).toBe('2026-10-02T09:00:00.000+07:00')
    expect(invalidateAttendanceCache).toHaveBeenCalledTimes(1)
    queries = []
    expect(await autoReturnIzinKeluar(db, new Date('2026-10-02T03:25:00Z'))).toEqual({ processed: 0 })
    expect(queries).toHaveLength(1)
  })
  it('recovers yesterday at WIB midnight without extending it into today', async () => {
    permit('old'); permit('today', '2026-10-03T00:00:00.000+07:00')
    expect(await autoReturnIzinKeluar(db, new Date('2026-10-02T17:00:00Z'))).toEqual({ processed: 1 })
    expect(row('old').waktu_kembali).toBe('2026-10-02T10:20:00.000+07:00')
    expect(row('today').status).toBe('BELUM KEMBALI')
  })
  it.each(['not json', '[]', JSON.stringify([{ hari: [5], slots: [{ selesai: '10:20' }, { selesai: '25:99' }] }])])
    ('does not close today with missing/invalid timetable %s', async raw => {
      sqlite.prepare('UPDATE tahun_ajaran SET jam_pelajaran = ?').run(raw)
      permit('today'); permit('old', '2026-10-01T08:00:00Z')
      expect(await autoReturnIzinKeluar(db, new Date('2026-10-02T16:00:00Z'))).toEqual({ processed: 1 })
      expect(row('today').status).toBe('BELUM KEMBALI')
      expect(row('old').waktu_kembali).toBe('2026-10-01T23:59:00.000+07:00')
    })
  it('handles weekend recovery, late departure, future permits and existing return time', async () => {
    permit('late', '2026-10-02T11:00:00.000+07:00')
    permit('legacy', '2026-10-02T08:00:00Z')
    permit('future', '2026-10-05T08:00:00.000+07:00')
    permit('existing', undefined, 'BELUM KEMBALI', '2026-10-02T09:00:00.000+07:00')
    expect(await autoReturnIzinKeluar(db, new Date('2026-10-04T01:00:00Z'))).toEqual({ processed: 3 })
    expect(row('late').waktu_kembali).toBe(row('late').waktu_keluar)
    expect(row('legacy').waktu_kembali).toBe('2026-10-02T10:20:00.000+07:00')
    expect(row('existing').waktu_kembali).toBe('2026-10-02T09:00:00.000+07:00')
    expect(row('future').status).toBe('BELUM KEMBALI')
  })
  it('bounds backlog writes and uses the partial index for candidate lookup and update', async () => {
    for (let i = 0; i < 250; i++) permit(String(i))
    const now = new Date('2026-10-02T04:00:00Z')
    expect(await autoReturnIzinKeluar(db, now)).toEqual({ processed: 100 })
    for (const query of queries.filter(q => q.sql.includes('izin_keluar_komplek'))) {
      const plan = sqlite.prepare(`EXPLAIN QUERY PLAN ${query.sql}`).all(...query.binds)
      expect(plan.map(p => p.detail).join('\n')).toContain('idx_izin_keluar_pending_time')
      expect(plan.map(p => p.detail).join('\n')).not.toMatch(/SCAN izin_keluar_komplek(?:\n|$)/)
    }
    expect(await autoReturnIzinKeluar(db, now)).toEqual({ processed: 100 })
    expect(await autoReturnIzinKeluar(db, now)).toEqual({ processed: 50 })
    expect(await autoReturnIzinKeluar(db, now)).toEqual({ processed: 0 })
  })
})
