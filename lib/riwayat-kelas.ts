export async function ensureRiwayatKelasSnapshotColumns(db: D1Database) {
  const tableInfo = await db.prepare('PRAGMA table_info(riwayat_kelas)').all<{ name: string }>()
  const columns = new Set((tableInfo.results ?? []).map(col => col.name))

  const additions: Array<[string, string]> = [
    ['kelas_tingkat', 'INTEGER'],
    ['kelas_nomor', 'TEXT'],
    ['kelas_kelompok', 'TEXT'],
    ['kelas_nama', 'TEXT'],
  ]

  for (const [name, type] of additions) {
    if (!columns.has(name)) {
      await db.prepare(`ALTER TABLE riwayat_kelas ADD COLUMN ${name} ${type}`).run()
    }
  }
}

export function formatKelasSnapshot(tingkat: number | string | null | undefined, nomor: string | number | null | undefined, kelompok: string | null | undefined) {
  const tingkatText = tingkat == null ? '' : String(tingkat)
  const nomorText = nomor == null ? '' : String(nomor)
  const kelompokText = kelompok && kelompok !== 'UMUM' ? ` ${kelompok}` : ''
  return `${tingkatText}-${nomorText}${kelompokText}`.trim()
}
