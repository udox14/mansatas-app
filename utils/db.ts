// Lokasi: utils/db.ts
// Wrapper Cloudflare D1 - pengganti supabase.from(...)
// Menyediakan helper query yang mirip pola Supabase agar migrasi lebih mudah

import { getCloudflareContext } from '@opennextjs/cloudflare'

// Ambil D1 binding dari Cloudflare context
export async function getDB(): Promise<D1Database> {
  const { env } = await getCloudflareContext({ async: true })
  return env.DB
}

// ============================================================
// HELPER TYPES
// ============================================================
export type DbResult<T> = { data: T | null; error: string | null }
export type DbListResult<T> = { data: T[]; error: string | null }

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
  const cols = options?.columns ?? '*'
  let sql = `SELECT ${cols} FROM ${table}`
  const params: unknown[] = []

  if (where && Object.keys(where).length > 0) {
    const conditions = Object.entries(where)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => {
        if (v === null) return `${k} IS NULL`
        params.push(v)
        return `${k} = ?`
      })
    if (conditions.length > 0) sql += ` WHERE ${conditions.join(' AND ')}`
  }

  if (options?.orderBy) sql += ` ORDER BY ${options.orderBy}`
  if (options?.limit) sql += ` LIMIT ${options.limit}`

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
export async function dbInsert(
  db: D1Database,
  table: string,
  data: Record<string, unknown>
): Promise<{ success: boolean; error: string | null }> {
  // Filter undefined values
  const clean = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined)
  )
  const keys = Object.keys(clean)
  const placeholders = keys.map(() => '?').join(', ')
  const values = Object.values(clean).map(serializeValue)

  const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`

  try {
    await db.prepare(sql).bind(...values).run()
    return { success: true, error: null }
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
  const setClauses = Object.keys(clean).map(k => `${k} = ?`).join(', ')
  const setValues = Object.values(clean).map(serializeValue)

  const whereClauses = Object.keys(where).map(k => `${k} = ?`).join(' AND ')
  const whereValues = Object.values(where)

  const sql = `UPDATE ${table} SET ${setClauses} WHERE ${whereClauses}`

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
  const conditions = Object.keys(where).map(k => `${k} = ?`).join(' AND ')
  const values = Object.values(where)

  const sql = `DELETE FROM ${table} WHERE ${conditions}`

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
  const placeholders = keys.map(() => '?').join(', ')
  const values = Object.values(clean).map(serializeValue)

  // ON CONFLICT DO UPDATE
  const updateClauses = keys
    .filter(k => k !== conflictKey)
    .map(k => `${k} = excluded.${k}`)
    .join(', ')

  const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})
               ON CONFLICT(${conflictKey}) DO UPDATE SET ${updateClauses}`

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

  const keys = Object.keys(rows[0])
  const placeholders = keys.map(() => '?').join(', ')
  const sql = `INSERT OR IGNORE INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`

  const statements = rows.map(row => {
    const values = keys.map(k => serializeValue(row[k]))
    return db.prepare(sql).bind(...values)
  })

  try {
    const results = await db.batch(statements)
    const successCount = results.filter(r => r.success).length
    return { successCount, error: null }
  } catch (e: any) {
    return { successCount: 0, error: e.message }
  }
}

// Serialize JS values ke format SQLite
function serializeValue(v: unknown): unknown {
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