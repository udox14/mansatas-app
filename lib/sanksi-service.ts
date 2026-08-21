export type SanksiConfig = {
  id: string
  nama: string
  deskripsi: string | null
  poin_minimal: number
  urutan: number
}

const DEFAULT_SANKSI: SanksiConfig[] = [
  { id: 'default-1', nama: 'SP1', deskripsi: 'Surat Peringatan 1', poin_minimal: 100, urutan: 1 },
  { id: 'default-2', nama: 'SP2', deskripsi: 'Surat Peringatan 2', poin_minimal: 150, urutan: 2 },
  { id: 'default-3', nama: 'SP3', deskripsi: 'Surat Peringatan 3', poin_minimal: 200, urutan: 3 },
]

export async function ensureSanksiTable(db: D1Database): Promise<void> {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS sanksi_config (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      nama TEXT NOT NULL,
      deskripsi TEXT,
      poin_minimal INTEGER NOT NULL DEFAULT 0,
      urutan INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `).run()
}

export async function reorderSanksi(db: D1Database): Promise<void> {
  const all = await db.prepare('SELECT id FROM sanksi_config ORDER BY poin_minimal ASC').all<{ id: string }>()
  for (let index = 0; index < (all.results?.length || 0); index += 1) {
    await db.prepare('UPDATE sanksi_config SET urutan = ? WHERE id = ?')
      .bind(index + 1, all.results![index].id)
      .run()
  }
}

export async function loadSanksiList(db: D1Database): Promise<SanksiConfig[]> {
  try {
    await ensureSanksiTable(db)
    const result = await db.prepare('SELECT * FROM sanksi_config ORDER BY poin_minimal ASC').all<SanksiConfig>()
    let list = result.results || []

    if (list.length === 0) {
      for (const item of DEFAULT_SANKSI) {
        await db.prepare(`
          INSERT INTO sanksi_config (nama, deskripsi, poin_minimal, urutan)
          VALUES (?, ?, ?, ?)
        `).bind(item.nama, item.deskripsi, item.poin_minimal, item.urutan).run()
      }
      const seeded = await db.prepare('SELECT * FROM sanksi_config ORDER BY poin_minimal ASC').all<SanksiConfig>()
      list = seeded.results || []
    }

    return list
  } catch {
    return DEFAULT_SANKSI.map(item => ({ ...item }))
  }
}
