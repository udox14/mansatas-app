import { getAppSession } from '@/utils/auth/server'
import { getDB } from '@/utils/db-server'
import { internalErrorJson, noStoreJson, rejectCrossSiteMutation } from '@/lib/request-security'
import { validPushEndpoint, validPushKeys } from '@/lib/web-push-endpoint'

export async function POST(request: Request) {
  const rejected = rejectCrossSiteMutation(request)
  if (rejected) return rejected
  try {
    const session = await getAppSession()
    if (!session) return noStoreJson({ error: 'Unauthorized' }, { status: 401 })
    const subscription = await request.json().catch(() => null)
    const endpoint = subscription?.endpoint
    const { p256dh, auth } = subscription?.keys ?? {}
    if (!validPushEndpoint(endpoint) || !validPushKeys(p256dh, auth)) {
      return noStoreJson({ error: 'Langganan push tidak valid.' }, { status: 400 })
    }
    const db = await getDB()
    if (session.kind === 'parent') {
      const results = await db.batch([
        db.prepare('DELETE FROM web_push_subscriptions WHERE endpoint = ? AND p256dh = ? AND auth = ?').bind(endpoint, p256dh, auth),
        db.prepare(`INSERT INTO parent_web_push_subscriptions(siswa_id, endpoint, p256dh, auth)
          SELECT ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM web_push_subscriptions WHERE endpoint = ?)
          ON CONFLICT(endpoint) DO UPDATE SET siswa_id = excluded.siswa_id, p256dh = excluded.p256dh,
            auth = excluded.auth, updated_at = datetime('now')
          WHERE (siswa_id = excluded.siswa_id OR (p256dh = excluded.p256dh AND auth = excluded.auth))
            AND (siswa_id <> excluded.siswa_id OR p256dh <> excluded.p256dh OR auth <> excluded.auth)`)
          .bind(session.user.siswa_id, endpoint, p256dh, auth, endpoint),
        db.prepare('SELECT 1 FROM parent_web_push_subscriptions WHERE endpoint = ? AND siswa_id = ?')
          .bind(endpoint, session.user.siswa_id),
      ])
      if (!results[2].results.length) return noStoreJson({ error: 'Langganan browser perlu dibuat ulang.' }, { status: 409 })
    } else {
      const userAgent = (request.headers.get('user-agent') || '').slice(0, 512)
      const results = await db.batch([
        db.prepare('DELETE FROM parent_web_push_subscriptions WHERE endpoint = ? AND p256dh = ? AND auth = ?').bind(endpoint, p256dh, auth),
        db.prepare(`UPDATE web_push_subscriptions SET user_id = ?, p256dh = ?, auth = ?, user_agent = ?,
          updated_at = datetime('now') WHERE endpoint = ? AND (user_id = ? OR (p256dh = ? AND auth = ?))
          AND (user_id <> ? OR p256dh <> ? OR auth <> ?)`)
          .bind(session.user.id, p256dh, auth, userAgent, endpoint, session.user.id, p256dh, auth, session.user.id, p256dh, auth),
        db.prepare(`INSERT INTO web_push_subscriptions(user_id, endpoint, p256dh, auth, user_agent)
          SELECT ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM web_push_subscriptions WHERE endpoint = ?)
          AND NOT EXISTS (SELECT 1 FROM parent_web_push_subscriptions WHERE endpoint = ?)`)
          .bind(session.user.id, endpoint, p256dh, auth, userAgent, endpoint, endpoint),
        db.prepare('SELECT 1 FROM web_push_subscriptions WHERE endpoint = ? AND user_id = ?').bind(endpoint, session.user.id),
      ])
      if (!results[3].results.length) return noStoreJson({ error: 'Langganan browser perlu dibuat ulang.' }, { status: 409 })
    }
    return noStoreJson({ success: true })
  } catch {
    return internalErrorJson('web_push_register', new Error('Gagal menyimpan langganan Web Push.'))
  }
}

export async function DELETE(request: Request) {
  const rejected = rejectCrossSiteMutation(request)
  if (rejected) return rejected
  try {
    const session = await getAppSession()
    if (!session) return noStoreJson({ error: 'Unauthorized' }, { status: 401 })
    const subscription = await request.json().catch(() => null)
    const endpoint = subscription?.endpoint
    if (typeof endpoint !== 'string' || !endpoint || endpoint.length > 2048) {
      return noStoreJson({ error: 'Langganan push tidak valid.' }, { status: 400 })
    }
    const db = await getDB()
    if (session.kind === 'parent') {
      await db.prepare('DELETE FROM parent_web_push_subscriptions WHERE endpoint = ? AND siswa_id = ?')
        .bind(endpoint, session.user.siswa_id).run()
    } else {
      await db.prepare('DELETE FROM web_push_subscriptions WHERE endpoint = ? AND user_id = ?')
        .bind(endpoint, session.user.id).run()
    }
    return noStoreJson({ success: true })
  } catch {
    return internalErrorJson('web_push_unregister', new Error('Gagal melepas langganan Web Push.'))
  }
}
