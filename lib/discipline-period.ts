import { ensureSchemaOnce } from '@/lib/schema-guard'
import { academicPeriodDates } from '@/lib/tahun-ajaran'

export async function loadDisciplinePeriods(db: D1Database) {
  const { results } = await db.prepare('SELECT id, nama, semester FROM tahun_ajaran WHERE semester IN (1, 2)')
    .all<{ id: string; nama: string; semester: number }>()
  return results.map(row => ({ ...row, ...academicPeriodDates(row.nama, row.semester) }))
}

export function resolveDisciplinePeriod(periods: Awaited<ReturnType<typeof loadDisciplinePeriods>>, date: string) {
  const matches = periods.filter(({ startDate, endDate }) => startDate && endDate && date >= startDate && date <= endDate)
  if (matches.length === 1) return { period: matches[0], error: null }
  if (matches.length === 0) return { period: null, error: `Tahun ajaran dan semester untuk tanggal ${date} belum diatur.` }
  return { period: null, error: `Ada lebih dari satu semester untuk tanggal ${date}. Hubungi admin untuk memperbaikinya.` }
}

export function ensureDisciplineImportSignature(db: D1Database) {
  return ensureSchemaOnce('discipline-import-signature', async () => {
    const { results } = await db.prepare('PRAGMA table_info(siswa_pelanggaran)').all<{ name: string }>()
    if (!results.some(column => column.name === 'source_signature')) {
      try {
        await db.prepare('ALTER TABLE siswa_pelanggaran ADD COLUMN source_signature TEXT').run()
      } catch (error) {
        // Recheck in case another Worker added it between PRAGMA and ALTER.
        const current = await db.prepare('PRAGMA table_info(siswa_pelanggaran)').all<{ name: string }>()
        if (!current.results.some(column => column.name === 'source_signature')) throw error
      }
    }
    await db.prepare(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_pelanggaran_source_signature
      ON siswa_pelanggaran(source_signature) WHERE source_signature IS NOT NULL
    `).run()
  })
}
