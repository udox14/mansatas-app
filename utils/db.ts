// Lokasi: utils/db.ts
// Wrapper Cloudflare D1 - pengganti supabase.from(...)
// Menyediakan helper query yang mirip pola Supabase agar migrasi lebih mudah

// ============================================================
// HELPER TYPES
// ============================================================
export type DbResult<T> = { data: T | null; error: string | null }
export type DbListResult<T> = { data: T[]; error: string | null }

const SQL_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/
const ALLOWED_TABLES = new Set<string>([
  'agenda_guru', 'agenda_piket', 'bk_rekaman', 'bk_topik', 'buku_tamu',
  'delegasi_tugas', 'delegasi_tugas_kelas', 'ekstrakurikuler', 'ekstrakurikuler_pertemuan',
  'izin_keluar_komplek', 'izin_tidak_masuk_kelas', 'jadwal_guru_piket', 'jadwal_mengajar',
  'jadwal_notifikasi', 'kelas', 'master_pelanggaran', 'mata_pelajaran', 'nilai_harian_header',
  'penerimaan_pt', 'pengaturan_akademik', 'penugasan_mengajar', 'peserta_rapat',
  'pmb_jadwal_tes', 'pmb_pendaftar', 'psikotes_rekom_mapping', 'siswa',
  'siswa_pelanggaran', 'siswa_psikotes', 'tahun_ajaran', 'undangan_rapat', 'user',
])

function safeIdentifier(value: string): string {
  if (!SQL_IDENTIFIER.test(value)) throw new Error('Invalid database identifier')
  return `"${value}"`
}

function safeTable(value: string): string {
  const normalized = value === '"user"' ? 'user' : value
  if (!ALLOWED_TABLES.has(normalized)) throw new Error('Database table is not allowlisted')
  return safeIdentifier(normalized)
}

function safeColumnList(value: string | undefined): string {
  if (!value || value.trim() === '*') return '*'
  return value.split(',').map(column => safeIdentifier(column.trim())).join(', ')
}

// ============================================================
// GENERIC QUERY HELPERS
// ============================================================

// SELECT * FROM table WHERE key = value
export async function dbSelect<T>(
  db: D1Database,
  table: string,
  where?: Record<string, unknown>,
  options?: { orderBy?: string; limit?: number; columns?: string }
): Promise<T[]> {
  const cols = safeColumnList(options?.columns)
  let sql = `SELECT ${cols} FROM ${safeTable(table)}`
  const params: unknown[] = []

  if (where && Object.keys(where).length > 0) {
    const conditions = Object.entries(where)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => {
        if (v === null) return `${safeIdentifier(k)} IS NULL`
        params.push(v)
        return `${safeIdentifier(k)} = ?`
      })
    if (conditions.length > 0) sql += ` WHERE ${conditions.join(' AND ')}`
  }

  if (options?.orderBy) sql += ` ORDER BY ${safeIdentifier(options.orderBy)}`
  if (options?.limit) {
    if (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 10_000) {
      throw new Error('Invalid query limit')
    }
    sql += ` LIMIT ${options.limit}`
  }

  const result = await db.prepare(sql).bind(...params).all<T>()
  return result.results
}

// SELECT single row
export async function dbSelectOne<T>(
  db: D1Database,
  table: string,
  where: Record<string, unknown>,
  columns?: string
): Promise<T | null> {
  const results = await dbSelect<T>(db, table, where, { limit: 1, columns })
  return results[0] ?? null
}

// INSERT INTO table (cols) VALUES (...)
// FIX: Menambahkan RETURNING * agar mengembalikan baris data beserta ID baru
export async function dbInsert<T = any>(
  db: D1Database,
  table: string,
  data: Record<string, unknown>
): Promise<{ success: boolean; error: string | null; data?: T }> {
  // Filter undefined values
  const clean = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined)
  )
  const keys = Object.keys(clean)
  if (keys.length === 0) return { success: false, error: 'Tidak ada data untuk disimpan.' }
  const placeholders = keys.map(() => '?').join(', ')
  const values = Object.values(clean).map(serializeValue)

  const sql = `INSERT INTO ${safeTable(table)} (${keys.map(safeIdentifier).join(', ')}) VALUES (${placeholders}) RETURNING *`

  try {
    const result = await db.prepare(sql).bind(...values).first<T>()
    return { success: true, error: null, data: result ?? undefined }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

// UPDATE table SET ... WHERE id = ?
export async function dbUpdate(
  db: D1Database,
  table: string,
  data: Record<string, unknown>,
  where: Record<string, unknown>
): Promise<{ success: boolean; error: string | null }> {
  const clean = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined)
  )
  if (Object.keys(clean).length === 0 || Object.keys(where).length === 0) {
    return { success: false, error: 'Data atau filter pembaruan kosong.' }
  }
  const setClauses = Object.keys(clean).map(k => `${safeIdentifier(k)} = ?`).join(', ')
  const setValues = Object.values(clean).map(serializeValue)

  const whereClauses = Object.keys(where).map(k => `${safeIdentifier(k)} = ?`).join(' AND ')
  const whereValues = Object.values(where)

  const sql = `UPDATE ${safeTable(table)} SET ${setClauses} WHERE ${whereClauses}`

  try {
    await db.prepare(sql).bind(...setValues, ...whereValues).run()
    return { success: true, error: null }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

// DELETE FROM table WHERE key = value
export async function dbDelete(
  db: D1Database,
  table: string,
  where: Record<string, unknown>
): Promise<{ success: boolean; error: string | null }> {
  if (Object.keys(where).length === 0) return { success: false, error: 'Filter penghapusan kosong.' }
  const conditions = Object.keys(where).map(k => `${safeIdentifier(k)} = ?`).join(' AND ')
  const values = Object.values(where)

  const sql = `DELETE FROM ${safeTable(table)} WHERE ${conditions}`

  try {
    await db.prepare(sql).bind(...values).run()
    return { success: true, error: null }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

// INSERT OR REPLACE (upsert by primary key)
export async function dbUpsert(
  db: D1Database,
  table: string,
  data: Record<string, unknown>,
  conflictKey: string
): Promise<{ success: boolean; error: string | null }> {
  const clean = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined)
  )
  const keys = Object.keys(clean)
  if (keys.length === 0) return { success: false, error: 'Tidak ada data untuk disimpan.' }
  safeIdentifier(conflictKey)
  const placeholders = keys.map(() => '?').join(', ')
  const values = Object.values(clean).map(serializeValue)

  // ON CONFLICT DO UPDATE
  const updateClauses = keys
    .filter(k => k !== conflictKey)
    .map(k => `${safeIdentifier(k)} = excluded.${safeIdentifier(k)}`)
    .join(', ')

  const sql = `INSERT INTO ${safeTable(table)} (${keys.map(safeIdentifier).join(', ')}) VALUES (${placeholders})
               ON CONFLICT(${safeIdentifier(conflictKey)}) DO UPDATE SET ${updateClauses}`

  try {
    await db.prepare(sql).bind(...values).run()
    return { success: true, error: null }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

// BATCH INSERT (untuk import massal)
export async function dbBatchInsert(
  db: D1Database,
  table: string,
  rows: Record<string, unknown>[]
): Promise<{ successCount: number; error: string | null }> {
  if (rows.length === 0) return { successCount: 0, error: null }

  // FIX: Dapatkan SEMUA keys unik dari seluruh baris untuk menghindari Data Loss
  const allKeysSet = new Set<string>()
  rows.forEach(row => Object.keys(row).forEach(k => allKeysSet.add(k)))
  const keys = Array.from(allKeysSet)
  
  const placeholders = keys.map(() => '?').join(', ')
  const sql = `INSERT OR IGNORE INTO ${safeTable(table)} (${keys.map(safeIdentifier).join(', ')}) VALUES (${placeholders})`

  const statements = rows.map(row => {
    // Mapping dengan fallback null jika row tersebut tidak punya kolom tsb
    const values = keys.map(k => serializeValue(row[k] ?? null))
    return db.prepare(sql).bind(...values)
  })

  try {
    let successCount = 0
    // FIX: Chunking Limit Exceeded (pecah per 100 eksekusi)
    const chunkSize = 100
    for (let i = 0; i < statements.length; i += chunkSize) {
      const chunk = statements.slice(i, i + chunkSize)
      const results = await db.batch(chunk)
      successCount += results.filter(r => r.success).length
    }
    return { successCount, error: null }
  } catch (e: any) {
    return { successCount: 0, error: e.message }
  }
}

// FIX: Di-export agar bisa dipakai di batch update actions.ts
// Serialize JS values ke format SQLite
export function serializeValue(v: unknown): unknown {
  if (v === null || v === undefined) return null
  if (typeof v === 'boolean') return v ? 1 : 0
  if (Array.isArray(v) || (typeof v === 'object' && v !== null)) {
    return JSON.stringify(v)
  }
  return v
}

// Parse JSON columns dari hasil query
export function parseJsonCol<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback
  try { return JSON.parse(value) as T } catch { return fallback }
}
