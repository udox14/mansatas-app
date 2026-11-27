import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/schema-guard', () => ({
  ensureSchemaOnce: vi.fn(async (_key: string, fn: () => Promise<unknown>) => fn()),
}))

import {
  BK_REKAMAN_EXTRA_COLUMNS,
  bkCreateSchema,
  bkUpdateSchema,
  ensureBkRekamanColumns,
  ensureBkRekamanSchema,
} from './bk-schema'

function createMockDb(existingColumns: string[], options?: { throwDuplicateOn?: string; throwErrorOn?: string }) {
  const executed: string[] = []
  const db = {
    prepare(sql: string) {
      return {
        async all() {
          executed.push(sql)
          if (sql.includes("pragma_table_info('bk_rekaman')")) {
            return { results: existingColumns.map(name => ({ name })) }
          }
          return { results: [] }
        },
        async run() {
          executed.push(sql)
          if (options?.throwDuplicateOn && sql.includes(options.throwDuplicateOn)) {
            throw new Error(`duplicate column name: ${options.throwDuplicateOn}`)
          }
          if (options?.throwErrorOn && sql.includes(options.throwErrorOn)) {
            throw new Error('disk full')
          }
          return { success: true }
        },
      }
    },
  } as unknown as D1Database

  return { db, executed }
}

describe('BK schema & validation', () => {
  it('adds only missing columns on bk_rekaman', async () => {
    const { db, executed } = createMockDb(['id', 'siswa_id', 'deskripsi', 'tanggal', 'tempat'])
    await ensureBkRekamanSchema(db)

    const alterCalls = executed.filter(sql => sql.startsWith('ALTER TABLE bk_rekaman'))
    expect(alterCalls).toHaveLength(BK_REKAMAN_EXTRA_COLUMNS.length - 2)
    expect(alterCalls.some(sql => sql.includes('ADD COLUMN tanggal'))).toBe(false)
    expect(alterCalls.some(sql => sql.includes('ADD COLUMN tempat'))).toBe(false)
    expect(alterCalls.some(sql => sql.includes('ADD COLUMN waktu'))).toBe(true)
    expect(alterCalls.some(sql => sql.includes('ADD COLUMN teknik_konseling'))).toBe(true)
    expect(alterCalls.some(sql => sql.includes('ADD COLUMN media'))).toBe(true)
    expect(alterCalls.some(sql => sql.includes('ADD COLUMN akar_masalah'))).toBe(true)
    expect(alterCalls.some(sql => sql.includes('ADD COLUMN hasil_konsultasi'))).toBe(true)
  })

  it('ignores duplicate column errors from concurrent isolates', async () => {
    const { db } = createMockDb(['id'], { throwDuplicateOn: 'media' })
    await expect(ensureBkRekamanColumns(db)).resolves.toBeUndefined()
  })

  it('rethrows unexpected DDL errors', async () => {
    const { db } = createMockDb(['id'], { throwErrorOn: 'media' })
    await expect(ensureBkRekamanColumns(db)).rejects.toThrow('disk full')
  })

  it('accepts full Catatan Penanganan Siswa create payload', () => {
    const res = bkCreateSchema.safeParse({
      siswa_id: 'siswa-1',
      guru_bk_id: 'guru-1',
      tahun_ajaran_id: 'ta-1',
      bidang: 'Pribadi',
      topik_id: null,
      tanggal: '2026-11-27',
      tempat: 'Ruang BK',
      waktu: '09:00 - 09:45 WIB',
      teknik_konseling: 'Konseling Individu (CBT)',
      media: 'Tatap Muka',
      deskripsi: 'Siswa tampak murung dan sering tidak hadir.',
      akar_masalah: 'Kurang komunikasi di rumah dan manajemen waktu belajar.',
      hasil_konsultasi: 'Siswa memahami masalah dan menyepakati jadwal belajar baru.',
      tindak_lanjut: 'Konseling lanjutan 1 minggu lagi dan pemantauan wali kelas.',
      catatan_tindak_lanjut: '',
    })
    expect(res.success).toBe(true)
  })

  it('rejects invalid date format and unknown fields', () => {
    const badDate = bkCreateSchema.safeParse({
      siswa_id: 'siswa-1',
      guru_bk_id: 'guru-1',
      tahun_ajaran_id: 'ta-1',
      bidang: 'Akademik',
      topik_id: null,
      tanggal: '27-11-2026',
      deskripsi: 'Keluhan',
      tindak_lanjut: '',
    })
    expect(badDate.success).toBe(false)

    const unknownField = bkUpdateSchema.safeParse({
      deskripsi: 'Diperbarui',
      extra_field: 'tidak boleh',
    })
    expect(unknownField.success).toBe(false)
  })

  it('allows partial update of Catatan Penanganan Siswa fields', () => {
    const res = bkUpdateSchema.safeParse({
      bidang: 'Sosial',
      tanggal: '2026-11-27',
      tempat: 'Ruang BK',
      waktu: '10:00',
      teknik_konseling: 'Mediasi',
      media: 'Tatap Muka',
      deskripsi: 'Perselisihan dengan teman sebangku',
      akar_masalah: 'Salah paham dalam tugas kelompok',
      hasil_konsultasi: 'Kedua siswa saling memaafkan',
      tindak_lanjut: 'Pemantauan 2 minggu',
    })
    expect(res.success).toBe(true)
  })
})
