// lib/fcm.ts
// Firebase Cloud Messaging (HTTP v1) sender — Cloudflare Workers compatible.
// Kanal Android native (Capacitor). VAPID (lib/web-push.ts) tetap dipakai untuk web/PWA/iOS.
//
// Butuh Worker secrets: FCM_PROJECT_ID, FCM_CLIENT_EMAIL, FCM_PRIVATE_KEY (PEM service account).
// Access token OAuth2 di-cache di KV (NEXT_INC_CACHE_KV) ~55 menit.

import { getDB } from '@/utils/db'
import { getCloudflareContext } from '@opennextjs/cloudflare'

const TOKEN_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging'
const TOKEN_AUD = 'https://oauth2.googleapis.com/token'
const KV_TOKEN_KEY = 'fcm_access_token'

export type FcmNotif = {
  title: string
  body: string
  url?: string
  image?: string
  data?: Record<string, string>
}

export type FcmTarget = {
  // pegawai / staff
  userId?: string
  userIds?: string[]
  role?: string
  all?: boolean
  // orang tua / parent
  siswaId?: string
  siswaIds?: string[]
  allParents?: boolean
}

// ============================================================
// OAuth2: mint access token dari service account (JWT RS256)
// ============================================================

function base64UrlEncode(input: string | ArrayBuffer): string {
  let bytes: Uint8Array
  if (typeof input === 'string') {
    bytes = new TextEncoder().encode(input)
  } else {
    bytes = new Uint8Array(input)
  }
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// PEM (pkcs8) → ArrayBuffer untuk importKey
function pemToArrayBuffer(pem: string): ArrayBuffer {
  const clean = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\\n/g, '')
    .replace(/\s/g, '')
  const binary = atob(clean)
  const buf = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i)
  return buf.buffer
}

async function mintAccessToken(clientEmail: string, privateKeyPem: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const claim = {
    iss: clientEmail,
    scope: TOKEN_SCOPE,
    aud: TOKEN_AUD,
    iat: now,
    exp: now + 3600,
  }

  const unsigned = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(claim))}`

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(privateKeyPem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned))
  const jwt = `${unsigned}.${base64UrlEncode(sig)}`

  const res = await fetch(TOKEN_AUD, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`FCM OAuth token gagal (${res.status}): ${t}`)
  }
  const json = (await res.json()) as { access_token?: string }
  if (!json.access_token) throw new Error('FCM OAuth: access_token kosong')
  return json.access_token
}

async function getAccessToken(): Promise<string> {
  const clientEmail = process.env.FCM_CLIENT_EMAIL
  const privateKey = process.env.FCM_PRIVATE_KEY
  if (!clientEmail || !privateKey) throw new Error('FCM_CLIENT_EMAIL / FCM_PRIVATE_KEY belum diset')

  let kv: KVNamespace | undefined
  try {
    const { env } = await getCloudflareContext({ async: true })
    kv = env.NEXT_INC_CACHE_KV
  } catch {
    kv = undefined
  }

  if (kv) {
    const cached = await kv.get(KV_TOKEN_KEY)
    if (cached) return cached
  }

  const token = await mintAccessToken(clientEmail, privateKey)
  if (kv) {
    // exp 3600s, cache 3300s biar aman
    await kv.put(KV_TOKEN_KEY, token, { expirationTtl: 3300 })
  }
  return token
}

// ============================================================
// Ambil token FCM sesuai target
// ============================================================
async function resolveTokens(target: FcmTarget): Promise<string[]> {
  const db = await getDB()
  let query: string
  let bindings: unknown[] = []

  if (target.userId) {
    query = `SELECT token FROM fcm_tokens WHERE owner_type='staff' AND LOWER(user_id) = LOWER(?)`
    bindings = [target.userId]
  } else if (target.userIds && target.userIds.length > 0) {
    const ph = target.userIds.map(() => '?').join(',')
    query = `SELECT token FROM fcm_tokens WHERE owner_type='staff' AND LOWER(user_id) IN (${ph})`
    bindings = target.userIds.map((id) => id.toLowerCase())
  } else if (target.role) {
    query = `
      SELECT ft.token
      FROM fcm_tokens ft
      JOIN "user" u ON LOWER(ft.user_id) = LOWER(u.id)
      WHERE ft.owner_type='staff' AND (
        LOWER(u.role) = LOWER(?)
        OR u.id IN (SELECT user_id FROM user_roles WHERE LOWER(role) = LOWER(?))
      )
    `
    bindings = [target.role, target.role]
  } else if (target.all) {
    query = `SELECT token FROM fcm_tokens WHERE owner_type='staff'`
  } else if (target.siswaId) {
    query = `SELECT token FROM fcm_tokens WHERE owner_type='parent' AND siswa_id = ?`
    bindings = [target.siswaId]
  } else if (target.siswaIds && target.siswaIds.length > 0) {
    const ph = target.siswaIds.map(() => '?').join(',')
    query = `SELECT token FROM fcm_tokens WHERE owner_type='parent' AND siswa_id IN (${ph})`
    bindings = target.siswaIds
  } else if (target.allParents) {
    query = `SELECT token FROM fcm_tokens WHERE owner_type='parent'`
  } else {
    return []
  }

  const res = await db.prepare(query).bind(...bindings).all<{ token: string }>()
  return (res.results || []).map((r) => r.token)
}

// ============================================================
// Kirim FCM notification
// ============================================================
export async function sendFcmNotification(notification: FcmNotif, target: FcmTarget) {
  try {
    const projectId = process.env.FCM_PROJECT_ID
    if (!projectId) {
      console.error('[FCM] FCM_PROJECT_ID belum diset')
      return { success: false, message: 'FCM not configured' }
    }

    const tokens = await resolveTokens(target)
    if (tokens.length === 0) {
      return { success: true, sent: 0, message: 'No FCM tokens for target' }
    }

    const accessToken = await getAccessToken()
    const endpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`
    const db = await getDB()

    const data: Record<string, string> = { ...(notification.data || {}) }
    if (notification.url) data.url = notification.url

    const send = async (token: string) => {
      const message: any = {
        token,
        notification: {
          title: notification.title,
          body: notification.body,
          ...(notification.image ? { image: notification.image } : {}),
        },
        data,
        webpush: notification.url ? { fcm_options: { link: notification.url } } : undefined,
      }
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ message }),
        })
        if (res.ok) return { success: true, token }
        const errText = await res.text()
        // UNREGISTERED / NOT_FOUND → token mati, hapus
        if (res.status === 404 || errText.includes('UNREGISTERED') || errText.includes('registration-token-not-registered')) {
          await db.prepare('DELETE FROM fcm_tokens WHERE token = ?').bind(token).run()
        }
        console.error(`[FCM] gagal kirim (${res.status}): ${errText}`)
        return { success: false, token, status: res.status, error: errText }
      } catch (err: any) {
        console.error('[FCM] error kirim:', err.message)
        return { success: false, token, error: err.message }
      }
    }

    const report: any[] = []
    for (let i = 0; i < tokens.length; i += 100) {
      const chunk = tokens.slice(i, i + 100)
      const r = await Promise.all(chunk.map(send))
      report.push(...r)
    }
    const sent = report.filter((r) => r.success).length
    return { success: true, sent, report }
  } catch (error) {
    console.error('[FCM] Gagal mengirim FCM:', error)
    return { success: false, error }
  }
}

// ============================================================
// Notif absensi ke orang tua (Alfa/Sakit)
// Dipanggil setelah simpan absensi (sebelah enqueue WhatsApp).
// Menulis parent_notifications (in-app) + kirim FCM ke token siswa.
// ============================================================
const STATUS_LABEL: Record<string, string> = {
  ALFA: 'ALFA (tanpa keterangan)',
  SAKIT: 'SAKIT',
}

export async function notifyParentsAttendance(
  db: D1Database,
  options: { penugasanId: string; tanggal: string }
) {
  const rows = await db
    .prepare(
      `
      SELECT ab.siswa_id, ab.status, s.nama_lengkap
      FROM absensi_siswa ab
      JOIN siswa s ON s.id = ab.siswa_id
      WHERE ab.penugasan_id = ? AND ab.tanggal = ?
        AND ab.status IN ('ALFA','SAKIT')
        AND s.status = 'aktif'
      ORDER BY s.nama_lengkap
    `
    )
    .bind(options.penugasanId, options.tanggal)
    .all<{ siswa_id: string; status: string; nama_lengkap: string }>()

  const list = rows.results || []
  if (list.length === 0) return { notified: 0 }

  // 1) Tulis in-app parent_notifications (UNIQUE(siswa_id,type,source_ref) cegah dobel)
  const insStmts = list.map((r) => {
    const label = STATUS_LABEL[r.status] || r.status
    const title = 'Notifikasi Kehadiran'
    const message = `Ananda ${r.nama_lengkap} tercatat ${label} pada ${options.tanggal}. Mohon konfirmasi kepada wali kelas.`
    const sourceRef = `${options.penugasanId}:${options.tanggal}:${r.status}`
    const level = r.status === 'ALFA' ? 'warning' : 'info'
    return db
      .prepare(
        `INSERT OR IGNORE INTO parent_notifications (siswa_id, type, title, message, source_ref, level)
         VALUES (?, 'absensi', ?, ?, ?, ?)`
      )
      .bind(r.siswa_id, title, message, sourceRef, level)
  })
  try {
    for (let i = 0; i < insStmts.length; i += 100) await db.batch(insStmts.slice(i, i + 100))
  } catch (e) {
    console.error('[FCM] gagal tulis parent_notifications:', e)
  }

  // 2) Kirim FCM ke token orang tua per siswa
  let notified = 0
  for (const r of list) {
    const label = STATUS_LABEL[r.status] || r.status
    const res = await sendFcmNotification(
      {
        title: 'Notifikasi Kehadiran',
        body: `Ananda ${r.nama_lengkap} tercatat ${label} pada ${options.tanggal}.`,
        url: '/portal-ortu',
      },
      { siswaId: r.siswa_id }
    )
    notified += (res as any).sent || 0
  }

  return { notified, students: list.length }
}
