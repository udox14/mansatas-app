import { getCloudflareContext } from '@opennextjs/cloudflare'
import { ensureSchemaOnce } from '@/lib/schema-guard'
import { ensureParentCommunicationTables } from '@/lib/portal-ortu-loaders'
import { deleteMemCache, getMemCache, setMemCache } from '@/utils/mem-cache'

const BK_SYNC_KV_TTL_SECONDS = 7 * 24 * 60 * 60
const BK_SYNC_MEM_TTL_MS = 60 * 60 * 1000

function memKey(siswaId: string) {
  return `bk-parent-sync:${siswaId}`
}

function kvKey(siswaId: string) {
  return `bk-parent-sync:v1:${siswaId}`
}

async function getKV(): Promise<KVNamespace | null> {
  try {
    const { env } = await getCloudflareContext({ async: true })
    return (env.NEXT_INC_CACHE_KV as KVNamespace) ?? null
  } catch {
    return null
  }
}

export async function syncBkParentCommunication(
  db: D1Database,
  siswaId: string,
  options: { force?: boolean } = {},
): Promise<void> {
  if (!siswaId) return

  if (!options.force) {
    if (getMemCache<boolean>(memKey(siswaId))) return
    const kv = await getKV()
    if (kv) {
      try {
        if ((await kv.get(kvKey(siswaId))) === '1') {
          setMemCache(memKey(siswaId), true, BK_SYNC_MEM_TTL_MS)
          return
        }
      } catch {
        // Fall through to DB sync if KV read fails.
      }
    }
  }

  await ensureSchemaOnce('parent-communication', () => ensureParentCommunicationTables(db))

  const bkRows = await db.prepare(`
    SELECT r.id, r.tindak_lanjut, r.catatan_tindak_lanjut
    FROM bk_rekaman r
    WHERE r.siswa_id = ?
    ORDER BY r.updated_at DESC
    LIMIT 50
  `).bind(siswaId).all<{ id: string; tindak_lanjut: string | null; catatan_tindak_lanjut: string | null }>()

  const statements: D1PreparedStatement[] = []
  for (const row of bkRows.results || []) {
    const tindak = String(row.tindak_lanjut || '').toLowerCase()
    const isSummon = tindak.includes('pemanggilan orang tua')
    const isCollab = tindak.includes('kolaborasi dengan orang tua')
    if (!isSummon && !isCollab) continue

    const type = isSummon ? 'pemanggilan' : 'kolaborasi'
    const title = isSummon ? 'Pemanggilan orang tua' : 'Kolaborasi dengan orang tua'
    const message = row.catatan_tindak_lanjut
      ? String(row.catatan_tindak_lanjut)
      : `Tindak lanjut BK: ${row.tindak_lanjut}`

    statements.push(
      db.prepare(`
        INSERT OR IGNORE INTO parent_notifications (siswa_id, type, title, message, source_ref, level)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        siswaId,
        type,
        title,
        message,
        `bk:${row.id}`,
        isSummon ? 'critical' : 'info',
      )
    )

    if (isSummon) {
      statements.push(
        db.prepare(`
          INSERT OR IGNORE INTO parent_summons
          (siswa_id, source_ref, reason, note, created_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, NULL, datetime('now'), datetime('now'))
        `).bind(
          siswaId,
          `bk:${row.id}`,
          'Pemanggilan orang tua oleh BK/wali kelas',
          message,
        )
      )
    }
  }

  if (statements.length > 0) {
    for (let i = 0; i < statements.length; i += 50) {
      await db.batch(statements.slice(i, i + 50))
    }
  }

  setMemCache(memKey(siswaId), true, BK_SYNC_MEM_TTL_MS)
  const kv = await getKV()
  if (kv) {
    await kv.put(kvKey(siswaId), '1', { expirationTtl: BK_SYNC_KV_TTL_SECONDS }).catch(() => {})
  }
}

export async function invalidateBkParentSync(siswaId: string): Promise<void> {
  if (!siswaId) return
  deleteMemCache(memKey(siswaId))
  const kv = await getKV()
  if (kv) {
    await kv.delete(kvKey(siswaId)).catch(() => {})
  }
}
