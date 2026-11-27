// Lokasi: lib/bk-schema.ts
import { z } from 'zod'
import { ensureSchemaOnce } from '@/lib/schema-guard'

export const BK_REKAMAN_EXTRA_COLUMNS: ReadonlyArray<{ name: string; sql: string }> = [
  { name: 'tanggal', sql: `ALTER TABLE bk_rekaman ADD COLUMN tanggal TEXT DEFAULT ''` },
  { name: 'tempat', sql: `ALTER TABLE bk_rekaman ADD COLUMN tempat TEXT DEFAULT ''` },
  { name: 'waktu', sql: `ALTER TABLE bk_rekaman ADD COLUMN waktu TEXT DEFAULT ''` },
  { name: 'teknik_konseling', sql: `ALTER TABLE bk_rekaman ADD COLUMN teknik_konseling TEXT DEFAULT ''` },
  { name: 'media', sql: `ALTER TABLE bk_rekaman ADD COLUMN media TEXT DEFAULT ''` },
  { name: 'akar_masalah', sql: `ALTER TABLE bk_rekaman ADD COLUMN akar_masalah TEXT DEFAULT ''` },
  { name: 'hasil_konsultasi', sql: `ALTER TABLE bk_rekaman ADD COLUMN hasil_konsultasi TEXT DEFAULT ''` },
]

const bkIdSchema = z.string().trim().min(1).max(100)
const bkDateSchema = z
  .string()
  .trim()
  .refine(v => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Format tanggal harus YYYY-MM-DD.')

export const bkCreateSchema = z.object({
  siswa_id: bkIdSchema,
  guru_bk_id: bkIdSchema,
  tahun_ajaran_id: bkIdSchema,
  bidang: z.enum(['Pribadi', 'Karir', 'Sosial', 'Akademik']),
  topik_id: bkIdSchema.nullable(),
  tanggal: bkDateSchema.optional(),
  tempat: z.string().trim().max(200).optional(),
  waktu: z.string().trim().max(100).optional(),
  teknik_konseling: z.string().trim().max(300).optional(),
  media: z.string().trim().max(200).optional(),
  deskripsi: z.string().max(5000),
  akar_masalah: z.string().max(5000).optional(),
  hasil_konsultasi: z.string().max(5000).optional(),
  tindak_lanjut: z.string().max(5000),
  catatan_tindak_lanjut: z.string().max(5000).optional(),
}).strict()

export const bkUpdateSchema = bkCreateSchema.pick({
  bidang: true,
  topik_id: true,
  tanggal: true,
  tempat: true,
  waktu: true,
  teknik_konseling: true,
  media: true,
  deskripsi: true,
  akar_masalah: true,
  hasil_konsultasi: true,
  tindak_lanjut: true,
  catatan_tindak_lanjut: true,
}).partial().strict()

/**
 * Memastikan kolom Catatan Penanganan Siswa pada tabel `bk_rekaman` tersedia.
 * Non-destruktif dan idempotent untuk Cloudflare D1 / SQLite.
 */
export async function ensureBkRekamanSchema(db: D1Database): Promise<void> {
  await ensureSchemaOnce('bk-rekaman-catatan-penanganan-v1', () => ensureBkRekamanColumns(db))
}

export async function ensureBkRekamanColumns(db: D1Database): Promise<void> {
  const columns = await db.prepare(`SELECT name FROM pragma_table_info('bk_rekaman')`)
    .all<{ name: string }>()
  const existing = new Set((columns.results || []).map(column => column.name))

  for (const addition of BK_REKAMAN_EXTRA_COLUMNS) {
    if (existing.has(addition.name)) continue
    try {
      await db.prepare(addition.sql).run()
    } catch (error) {
      // Isolate lain bisa menambahkan kolom yang sama lebih dulu.
      if (!String((error as { message?: string })?.message || error).toLowerCase().includes('duplicate column')) {
        throw error
      }
    }
  }
}
