import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { expect, it } from 'vitest'
import { loadDisciplinePeriods, resolveDisciplinePeriod } from './discipline-period'

it('resolves dates independently of activation and rejects ambiguous or missing semesters', async () => {
  const rows = [
    { id: 'old', nama: '2025/2026', semester: 2, is_active: 1 },
    { id: 'current', nama: '2026/2027', semester: 1, is_active: 0 },
  ]
  const db = { prepare: () => ({ all: async () => ({ results: rows }) }) } as unknown as D1Database
  const periods = await loadDisciplinePeriods(db)
  expect(resolveDisciplinePeriod(periods, '2026-06-30').period?.id).toBe('old')
  expect(resolveDisciplinePeriod(periods, '2026-07-01').period?.id).toBe('current')
  expect(resolveDisciplinePeriod(periods, '2026-11-02').period?.id).toBe('current')
  expect(resolveDisciplinePeriod(periods, '2027-01-01').period).toBeNull()
  expect(resolveDisciplinePeriod([...periods, periods[1]], '2026-11-02').period).toBeNull()
})

it('blocks mismatched direct writes and allows correction of a historical row', () => {
  const sqlite = new DatabaseSync(':memory:')
  try {
    sqlite.exec(`
      CREATE TABLE tahun_ajaran (id TEXT PRIMARY KEY, nama, semester);
      CREATE TABLE siswa_pelanggaran (id TEXT PRIMARY KEY, tanggal, tahun_ajaran_id, publication_status);
      INSERT INTO tahun_ajaran VALUES ('old', '2025/2026', 2), ('current', '2026 / 2027', 1);
      INSERT INTO siswa_pelanggaran VALUES ('legacy', '2026-11-02', 'old', 'published');
    `)
    sqlite.exec(readFileSync(new URL('../migrations/0128_guard_discipline_period.sql', import.meta.url), 'utf8'))
    const insert = sqlite.prepare('INSERT INTO siswa_pelanggaran VALUES (?, ?, ?, ?)')
    expect(() => insert.run('incorrect', '2026-11-02', 'old', 'published')).toThrow('tidak cocok')
    expect(() => insert.run('invalid', '2026-11-31', 'current', 'published')).toThrow('tidak cocok')
    expect(insert.run('valid', '2026-11-02', 'current', 'published').changes).toBe(1)
    expect(() => sqlite.exec("UPDATE siswa_pelanggaran SET tanggal='2026-01-02' WHERE id='valid'")).toThrow('tidak cocok')
    expect(() => sqlite.exec("UPDATE siswa_pelanggaran SET publication_status='rejected' WHERE id='legacy'")).not.toThrow()
    expect(sqlite.prepare("UPDATE siswa_pelanggaran SET tahun_ajaran_id='current' WHERE id='legacy'").run().changes).toBe(1)
  } finally {
    sqlite.close()
  }
})
