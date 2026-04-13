import { buildPushPayload } from '@block65/webcrypto-web-push';
import { getDB } from '@/utils/db';

const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateVapidKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT || 'mailto:admin@localhost';

type PushTarget = { userId?: string; userIds?: string[]; role?: string; all?: boolean };

/**
 * Mengirim push notification ke user menggunakan Web Crypto (Cloudflare Workers Compatible)
 */
export async function sendPushNotification(
  notification: { title: string, body: string, url?: string, icon?: string },
  target: PushTarget
) {
  try {
    const db = await getDB();
    
    // Query dasar
    let query = `SELECT endpoint, p256dh, auth FROM web_push_subscriptions`;
    let bindings: any[] = [];
    let conditions: string[] = [];

    if (target.userId) {
      conditions.push(`LOWER(user_id) = LOWER(?)`);
      bindings.push(target.userId);
    } else if (target.userIds && target.userIds.length > 0) {
      // Kirim ke daftar user spesifik
      const placeholders = target.userIds.map(() => '?').join(',');
      query = `SELECT wp.endpoint, wp.p256dh, wp.auth FROM web_push_subscriptions wp WHERE LOWER(wp.user_id) IN (${placeholders})`;
      bindings = target.userIds.map(id => id.toLowerCase());
    } else if (target.role) {
      query = `
        SELECT wp.endpoint, wp.p256dh, wp.auth 
        FROM web_push_subscriptions wp
        JOIN "user" u ON wp.user_id = u.id
        WHERE (u.id IN (SELECT user_id FROM user_roles WHERE LOWER(role) = LOWER(?)) OR LOWER(u.role) = LOWER(?))
      `;
      bindings.push(target.role, target.role);
    } else if (target.all) {
      // all users
    } else {
      return { success: false, message: "No target specified" };
    }

    if (conditions.length > 0) {
      query += ` WHERE ` + conditions.join(' AND ');
    }

    const dbResult = await db.prepare(query).bind(...bindings).all();
    const results = (Array.isArray(dbResult) ? dbResult : (dbResult as any).results || []) as any[];

    if (results.length === 0) {
      return { success: true, sent: 0, message: "No active subscriptions found for target" };
    }

    if (!publicVapidKey || !privateVapidKey) {
      console.error("[PushService] VAPID keys missing in environment");
      return { success: false, message: "VAPID keys not configured" };
    }

    const payload = JSON.stringify(notification);
    
    // Kirim secara paralel menggunakan fetch-based library
    const promises = results.map(async (row: any) => {
      try {
        const subscription = {
          endpoint: row.endpoint,
          expirationTime: null,
          keys: {
            p256dh: row.p256dh,
            auth: row.auth
          }
        };

        const vapid = {
          subject,
          publicKey: publicVapidKey,
          privateKey: privateVapidKey,
        };

        const pushPayload = await buildPushPayload(
          { data: payload },
          subscription,
          vapid
        );

        const response = await fetch(row.endpoint, pushPayload as any);

        if (response.ok) {
          return { success: true, endpoint: row.endpoint };
        } else {
          const status = response.status;
          // Jika 410 Gone atau 404 Not Found, berarti subscription expired
          if (status === 410 || status === 404) {
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

    const report = await Promise.all(promises);
    const sent = report.filter(r => r.success).length;

    return { success: true, sent, report };
  } catch (error) {
    console.error("Failed to send push notification:", error);
    return { success: false, error };
  }
}
