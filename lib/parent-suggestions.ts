export const PARENT_SUGGESTION_CATEGORIES = [
  'Akademik',
  'Kesiswaan',
  'Sarpras',
  'Keuangan',
  'Layanan',
  'Lainnya',
] as const

export const PARENT_SUGGESTION_STATUSES = ['baru', 'dibaca', 'diproses', 'selesai'] as const

export type ParentSuggestionCategory = typeof PARENT_SUGGESTION_CATEGORIES[number]
export type ParentSuggestionStatus = typeof PARENT_SUGGESTION_STATUSES[number]

export async function ensureParentSuggestionTable(db: D1Database) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS parent_suggestions (
      id TEXT PRIMARY KEY,
      parent_user_id TEXT,
      siswa_id TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
      category TEXT NOT NULL CHECK(category IN ('Akademik', 'Kesiswaan', 'Sarpras', 'Keuangan', 'Layanan', 'Lainnya')),
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_anonymous INTEGER NOT NULL DEFAULT 0 CHECK(is_anonymous IN (0, 1)),
      status TEXT NOT NULL DEFAULT 'baru' CHECK(status IN ('baru', 'dibaca', 'diproses', 'selesai')),
      read_at TEXT,
      handled_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
      handled_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run()

  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_parent_suggestions_siswa_created
      ON parent_suggestions(siswa_id, created_at DESC)
  `).run()
  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_parent_suggestions_status_created
      ON parent_suggestions(status, created_at DESC)
  `).run()
  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_parent_suggestions_category_created
      ON parent_suggestions(category, created_at DESC)
  `).run()
}

export function normalizeParentSuggestionCategory(value: unknown): ParentSuggestionCategory | null {
  const text = String(value || '').trim()
  return PARENT_SUGGESTION_CATEGORIES.find((item) => item === text) || null
}

export function normalizeParentSuggestionStatus(value: unknown): ParentSuggestionStatus | null {
  const text = String(value || '').trim()
  return PARENT_SUGGESTION_STATUSES.find((item) => item === text) || null
}
