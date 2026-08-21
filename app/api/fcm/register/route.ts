import { getAppSession } from '@/utils/auth/server'
import { getDB } from '@/utils/db-server'
import { NextRequest, NextResponse } from 'next/server'
import { internalErrorJson, noStoreJson, rejectCrossSiteMutation } from '@/lib/request-security'
import { logSecurityEvent } from '@/lib/security-log'

const ALLOWED_PLATFORMS = new Set(['android', 'ios', 'web'])

function validateToken(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const token = value.trim()
  return token.length >= 10 && token.length <= 4096 ? token : null
}

async function resolveOwner() {
  const session = await getAppSession()
  if (!session) return null
  return session.kind === 'staff'
    ? { ownerType: 'staff' as const, userId: session.user.id, siswaId: null }
    : { ownerType: 'parent' as const, userId: null, siswaId: session.user.siswa_id }
}

// Simpan FCM device token. Deteksi sesi: staff (user_id) atau orang tua (siswa_id).
export async function POST(req: NextRequest) {
  const originError = rejectCrossSiteMutation(req)
  if (originError) return originError
  try {
    const owner = await resolveOwner()
    if (!owner) return noStoreJson({ error: 'Unauthorized' }, { status: 401 })

    const { token, platform } = await req.json()
    const validToken = validateToken(token)
    const validPlatform = platform == null || platform === '' ? null : String(platform).toLowerCase()
    if (!validToken) return noStoreJson({ error: 'Invalid token' }, { status: 400 })
    if (validPlatform && !ALLOWED_PLATFORMS.has(validPlatform)) {
      return noStoreJson({ error: 'Invalid platform' }, { status: 400 })
    }

    const userAgent = (req.headers.get('user-agent') || '').slice(0, 512)
    const db = await getDB()
    const existing = await db.prepare(
      'SELECT owner_type, user_id, siswa_id FROM fcm_tokens WHERE token = ?'
    ).bind(validToken).first<{ owner_type: string; user_id: string | null; siswa_id: string | null }>()

    const sameOwner = !existing || (
      existing.owner_type === owner.ownerType
      && existing.user_id === owner.userId
      && existing.siswa_id === owner.siswaId
    )
    if (!sameOwner) {
      logSecurityEvent('warning', 'fcm_token_owner_conflict', {
        requesterType: owner.ownerType,
        requesterId: owner.userId || owner.siswaId,
      })
      return noStoreJson({ error: 'Token perangkat masih terhubung ke akun lain. Logout dari akun lama terlebih dahulu.' }, { status: 409 })
    }

    await db
      .prepare(
        `INSERT INTO fcm_tokens (token, owner_type, user_id, siswa_id, platform, user_agent, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(token) DO UPDATE SET
           owner_type = excluded.owner_type,
           user_id    = excluded.user_id,
           siswa_id   = excluded.siswa_id,
           platform   = excluded.platform,
           user_agent = excluded.user_agent,
           updated_at = datetime('now')`
      )
      .bind(validToken, owner.ownerType, owner.userId, owner.siswaId, validPlatform, userAgent)
      .run()

    return noStoreJson({ success: true, message: 'FCM token saved' })
  } catch (error) {
    return internalErrorJson('fcm_register_failed', error)
  }
}

export async function DELETE(req: NextRequest) {
  const originError = rejectCrossSiteMutation(req)
  if (originError) return originError
  try {
    const owner = await resolveOwner()
    if (!owner) return noStoreJson({ error: 'Unauthorized' }, { status: 401 })
    const { token } = await req.json()
    const validToken = validateToken(token)
    if (!validToken) return noStoreJson({ error: 'Invalid token' }, { status: 400 })
    const db = await getDB()
    const result = await db.prepare(`
      DELETE FROM fcm_tokens
      WHERE token = ? AND owner_type = ?
        AND COALESCE(user_id, '') = COALESCE(?, '')
        AND COALESCE(siswa_id, '') = COALESCE(?, '')
    `).bind(validToken, owner.ownerType, owner.userId, owner.siswaId).run()
    if (Number(result.meta?.changes || 0) === 0) {
      logSecurityEvent('warning', 'fcm_delete_owner_mismatch', {
        requesterType: owner.ownerType,
        requesterId: owner.userId || owner.siswaId,
      })
      return noStoreJson({ error: 'Token tidak ditemukan.' }, { status: 404 })
    }
    return noStoreJson({ success: true, message: 'FCM token removed' })
  } catch (error) {
    return internalErrorJson('fcm_delete_failed', error)
  }
}
