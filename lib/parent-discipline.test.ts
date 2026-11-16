import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import {
  canReviewDisciplineRecord,
  listReviewableDisciplineStudents,
  normalizeDisciplineClarificationMode,
  normalizeDisciplinePublishMode,
  publicationStatusForMode,
} from './parent-discipline'

describe('parent discipline policy', () => {
  it('keeps backward-compatible defaults for invalid settings', () => {
    expect(normalizeDisciplinePublishMode('unknown')).toBe('immediate')
    expect(normalizeDisciplineClarificationMode('unknown')).toBe('whatsapp')
  })

  it('requires review only when verified mode is selected', () => {
    expect(publicationStatusForMode('immediate')).toBe('published')
    expect(publicationStatusForMode('verified')).toBe('pending')
  })

  it('accepts every supported clarification mode', () => {
    expect(normalizeDisciplineClarificationMode('whatsapp')).toBe('whatsapp')
    expect(normalizeDisciplineClarificationMode('form')).toBe('form')
    expect(normalizeDisciplineClarificationMode('disabled')).toBe('disabled')
  })

  it('keeps the same review permissions when checking historical students together', async () => {
    const sqlite = new DatabaseSync(':memory:')
    try {
      sqlite.exec(`
        CREATE TABLE siswa (id, kelas_id);
        CREATE TABLE kelas (id, wali_kelas_id);
        CREATE TABLE "user" (id, role);
        CREATE TABLE user_roles (user_id, role);
        CREATE TABLE kelas_binaan_bk (kelas_id, tahun_ajaran_id, guru_bk_id);
        CREATE TABLE tahun_ajaran (id, is_active);
        INSERT INTO siswa VALUES ('a', '1'), ('b', '2'), ('c', NULL);
        INSERT INTO kelas VALUES ('1', 'wali'), ('2', 'other');
        INSERT INTO tahun_ajaran VALUES ('current', 1), ('prior', 0);
        INSERT INTO kelas_binaan_bk VALUES ('1', 'current', 'bk'), ('2', 'prior', 'bk');
        INSERT INTO user_roles VALUES ('admin', 'super_admin');
        INSERT INTO "user" VALUES ('principal', 'kepsek');
      `)
      const db = {
        prepare(sql: string) {
          return {
            bind(...args: SQLInputValue[]) {
              return { all: async () => ({ results: sqlite.prepare(sql).all(...args) }) }
            },
          }
        },
      } as unknown as D1Database
      const students = ['a', 'b', 'c']
      expect(await listReviewableDisciplineStudents(db, 'wali', students)).toEqual(['a'])
      expect(await listReviewableDisciplineStudents(db, 'bk', students)).toEqual(['a'])
      expect(await listReviewableDisciplineStudents(db, 'admin', students)).toEqual(students)
      expect(await listReviewableDisciplineStudents(db, 'principal', students)).toEqual(students)
      expect(await canReviewDisciplineRecord(db, 'bk', 'b')).toBe(false)
      expect(await canReviewDisciplineRecord(db, 'wali', 'a')).toBe(true)
    } finally {
      sqlite.close()
    }
  })
})
