import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import { expect, it } from 'vitest'
import { getActiveDisciplineYear, loadDisciplineHistory, loadPublishedDisciplineTotals } from './discipline-history'

it('shares active history while retaining lifetime points only for published records', async () => {
  const sqlite = new DatabaseSync(':memory:')
  try {
    sqlite.exec(`
      CREATE TABLE tahun_ajaran (id, nama, is_active);
      INSERT INTO tahun_ajaran VALUES ('past', '2025/2026', 0), ('current', '2026/2027', 1);
      CREATE TABLE siswa (id, nama_lengkap, foto_url, kelas_id);
      INSERT INTO siswa VALUES ('a', 'Siswa A', NULL, NULL), ('b', 'Siswa B', NULL, NULL);
      CREATE TABLE kelas (id, tingkat, nomor_kelas, kelompok);
      CREATE TABLE "user" (id, nama_lengkap);
      CREATE TABLE master_pelanggaran (id, nama_pelanggaran, kategori, poin);
      INSERT INTO master_pelanggaran VALUES ('master', 'Nama terbaru', 'Sedang', 40);
      CREATE TABLE siswa_pelanggaran (
        id, siswa_id, tahun_ajaran_id, tanggal, master_pelanggaran_id, publication_status,
        nama_pelanggaran_snapshot, kategori_snapshot, poin_snapshot, created_at,
        jam_input, keterangan, foto_url, diinput_oleh, review_note, reviewed_at
      );
      INSERT INTO siswa_pelanggaran (
        id, siswa_id, tahun_ajaran_id, tanggal, master_pelanggaran_id, publication_status,
        nama_pelanggaran_snapshot, kategori_snapshot, poin_snapshot
      ) VALUES
        ('old-year', 'a', 'past', '2026-11-02', 'master', 'published', NULL, NULL, 4),
        ('recorded', 'a', 'current', '2026-10-28', 'master', 'published', 'Nama saat dicatat', 'Ringan', 8),
        ('pending', 'a', 'current', '2026-10-29', 'master', 'pending', NULL, NULL, 20),
        ('rejected', 'a', 'current', '2026-10-30', 'master', 'rejected', NULL, NULL, 10),
        ('other-student', 'b', 'current', '2026-10-31', 'master', 'published', NULL, NULL, NULL);
    `)
    const db = {
      prepare(sql: string) {
        const stmt = sqlite.prepare(sql)
        let values: SQLInputValue[] = []
        return {
          bind(...args: SQLInputValue[]) { values = args; return this },
          async first() { return stmt.get(...values) ?? null },
          async all() { return { results: stmt.all(...values) } },
        }
      },
    } as unknown as D1Database

    const active = await getActiveDisciplineYear(db)
    expect(active).toMatchObject({ id: 'current' })
    const moduleHistory = await loadDisciplineHistory(db, active!.id)
    const detailHistory = await loadDisciplineHistory(db, active!.id, 'a')
    expect(detailHistory).toEqual(moduleHistory.filter(row => row.siswa_id === 'a'))
    expect(detailHistory.map(row => row.id)).toEqual(['rejected', 'pending', 'recorded'])
    expect(detailHistory[2]).toMatchObject({ nama_pelanggaran: 'Nama saat dicatat', kategori: 'Ringan', poin: 8 })
    expect(await loadPublishedDisciplineTotals(db)).toEqual({ a: 12, b: 40 })
    expect(await loadPublishedDisciplineTotals(db, 'a')).toEqual({ a: 12 })
  } finally {
    sqlite.close()
  }
})
