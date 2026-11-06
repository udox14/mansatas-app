import { buildPushPayload } from '@block65/webcrypto-web-push';
import { getDB } from '@/utils/db-server'
import { validPushEndpoint } from '@/lib/web-push-endpoint'

export type WebPushRuntimeEnv = {
  NEXT_PUBLIC_VAPID_PUBLIC_KEY?: string
  VAPID_PRIVATE_KEY?: string
  VAPID_SUBJECT?: string
}

export type WebPushRuntimeOptions = {
  db?: D1Database
  env?: WebPushRuntimeEnv
}

type PushTarget = { userId?: string; userIds?: string[]; role?: string; all?: boolean };
type PushMessage = { title: string; body: string; url?: string; icon?: string }
type PushDestination = { endpoint: string; p256dh: string; auth: string }

function vapidCredentials(env?: WebPushRuntimeEnv) {
  const publicKey = env?.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = env?.VAPID_PRIVATE_KEY || process.env.VAPID_PRIVATE_KEY
  const subject = env?.VAPID_SUBJECT || process.env.VAPID_SUBJECT || 'mailto:admin@localhost'
  return publicKey && privateKey ? { publicKey, privateKey, subject } : null
}

async function pushRequest(row: PushDestination, payload: string, vapid: NonNullable<ReturnType<typeof vapidCredentials>>) {
  return buildPushPayload({ data: payload }, {
    endpoint: row.endpoint, expirationTime: null, keys: { p256dh: row.p256dh, auth: row.auth },
  }, vapid)
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, mapper: (item: T) => Promise<R>) {
  const output: R[] = []
  let cursor = 0
  const worker = async () => {
    while (cursor < items.length) {
      const index = cursor++
      output[index] = await mapper(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  return output
}

export async function sendParentWebPushBatch(
  notification: PushMessage,
  destinations: (PushDestination & { id: string; siswa_id: string })[],
  db: D1Database,
  env: WebPushRuntimeEnv,
) {
  if (destinations.length > 10) throw new Error('Batch Web Push terlalu besar.')
  const vapid = vapidCredentials(env)
  const payload = JSON.stringify(notification)
  return mapWithConcurrency(destinations, 4, async row => {
    if (!vapid || !validPushEndpoint(row.endpoint)) return { state: 'failed' as const, id: row.id }
    let request: Awaited<ReturnType<typeof pushRequest>>
    try {
      request = await pushRequest(row, payload, vapid)
    } catch {
      return { state: 'failed' as const, id: row.id }
    }
    try {
      const response = await fetch(row.endpoint, { ...request, body: Uint8Array.from(request.body), redirect: 'error', signal: AbortSignal.timeout(5000) })
      await response.body?.cancel().catch(() => undefined)
      if (response.ok) return { state: 'accepted' as const, id: row.id }
      if (response.status === 404 || response.status === 410) {
        await db.prepare('DELETE FROM parent_web_push_subscriptions WHERE id = ? AND siswa_id = ? AND endpoint = ?')
          .bind(row.id, row.siswa_id, row.endpoint).run()
      }
      const retryable = response.status === 429 || response.status >= 500
      return { state: retryable ? 'retry' as const : 'failed' as const, id: row.id }
    } catch {
      return { state: 'retry' as const, id: row.id }
    }
  })
}

/**
 * Mengirim push notification ke user menggunakan Web Crypto (Cloudflare Workers Compatible)
 */
export async function sendPushNotification(
  notification: PushMessage,
  target: PushTarget,
  options: WebPushRuntimeOptions = {},
) {
  try {
    const db = options.db || await getDB();
    
    let query: string;
    let bindings: any[] = [];

    if (target.userId) {
      query = `SELECT DISTINCT endpoint, p256dh, auth FROM web_push_subscriptions WHERE LOWER(user_id) = LOWER(?)`;
      bindings = [target.userId];
    } else if (target.userIds && target.userIds.length > 0) {
      const placeholders = target.userIds.map(() => '?').join(',');
      query = `SELECT DISTINCT wp.endpoint, wp.p256dh, wp.auth FROM web_push_subscriptions wp WHERE LOWER(wp.user_id) IN (${placeholders})`;
      bindings = target.userIds.map(id => id.toLowerCase());
    } else if (target.role) {
      query = `
        SELECT DISTINCT wp.endpoint, wp.p256dh, wp.auth
        FROM web_push_subscriptions wp
        JOIN "user" u ON LOWER(wp.user_id) = LOWER(u.id)
        WHERE (
          LOWER(u.role) = LOWER(?)
          OR u.id IN (SELECT user_id FROM user_roles WHERE LOWER(role) = LOWER(?))
        )
      `;
      bindings = [target.role, target.role];
    } else if (target.all) {
      query = `SELECT DISTINCT endpoint, p256dh, auth FROM web_push_subscriptions`;
      bindings = [];
    } else {
      return { success: false, message: "No target specified" };
    }

    const dbResult = await db.prepare(query).bind(...bindings).all();
    const results = (Array.isArray(dbResult) ? dbResult : (dbResult as any).results || []) as any[];

    if (results.length === 0) {
      return { success: true, sent: 0, message: "No active subscriptions found for target" };
    }

    const vapid = vapidCredentials(options.env);
    if (!vapid) {
      console.error("[PushService] VAPID keys missing in environment");
      return { success: false, message: "VAPID keys not configured" };
    }

    const payload = JSON.stringify(notification);
    
    // Batasi concurrency karena pembuatan VAPID payload memakai Web Crypto.
    const report = await mapWithConcurrency(results, 10, async (row: any) => {
      try {
        const pushPayload = await pushRequest(row, payload, vapid);

        const response = await fetch(row.endpoint, pushPayload as any);

        if (response.ok) {
          return { success: true, endpoint: row.endpoint };
        } else {
          const status = response.status;
          // 401/403 juga dapat terjadi pada subscription lama setelah rotasi VAPID.
          if ([401, 403, 404, 410].includes(status)) {
             await db.prepare('DELETE FROM web_push_subscriptions WHERE endpoint = ?')
              .bind(row.endpoint)
              .run();
          }
          const body = await response.text();
          console.error(`[PushService] Failed to send to ${row.endpoint}. Status: ${status}, Body: ${body}`);
          return { success: false, endpoint: row.endpoint, status, error: body };
        }
      } catch (err: any) {
        console.error(`[PushService] Error sending to ${row.endpoint}:`, err.message);
        return { success: false, endpoint: row.endpoint, error: err.message };
      }
    });
    const sent = report.filter(r => r.success).length;

    return {
      success: sent > 0 || report.length === 0,
      sent,
      report,
      ...(sent === 0 && report.length > 0 ? { error: 'Semua subscription Web Push gagal menerima notifikasi.' } : {}),
    };
  } catch (error) {
    console.error("Failed to send push notification:", error);
    return { success: false, error };
  }
}
