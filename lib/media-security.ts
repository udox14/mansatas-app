import { getCloudflareContext } from '@opennextjs/cloudflare'
import { assertStudentScope, getAuthenticatedActor, isAdministrativeActor, type AuthenticatedActor } from '@/lib/action-security'
import { checkFeatureCrudAccess } from '@/lib/features'
import { logSecurityEvent } from '@/lib/security-log'

const encoder = new TextEncoder()
const MAX_GRANT_SECONDS = 5 * 60

export type MediaPolicy =
  | { visibility: 'public'; cacheControl: string }
  | { visibility: 'private'; featureId?: string }
  | { visibility: 'internal' }

const PREFIX_POLICIES: ReadonlyArray<{ prefix: string; policy: MediaPolicy }> = [
  { prefix: 'pramubakti/', policy: { visibility: 'private', featureId: 'pelaporan-pramubakti' } },
  { prefix: 'system/', policy: { visibility: 'public', cacheControl: 'public, max-age=31536000, immutable' } },
  { prefix: 'foto_siswa/', policy: { visibility: 'private' } },
  { prefix: 'avatars/', policy: { visibility: 'private' } },
  { prefix: 'agenda/', policy: { visibility: 'private', featureId: 'agenda' } },
  { prefix: 'agenda_piket/', policy: { visibility: 'private', featureId: 'jadwal-piket' } },
  { prefix: 'ekskul/', policy: { visibility: 'private', featureId: 'ekstrakurikuler' } },
  { prefix: 'pelanggaran/', policy: { visibility: 'private', featureId: 'kedisiplinan' } },
  { prefix: 'payment_proofs/', policy: { visibility: 'private', featureId: 'keuangan-dspt' } },
  { prefix: 'cashflow_proofs/', policy: { visibility: 'private', featureId: 'keuangan-kas-keluar' } },
  { prefix: 'keuangan_settings/', policy: { visibility: 'private', featureId: 'keuangan-pengaturan' } },
  { prefix: 'signatures/', policy: { visibility: 'private' } },
  { prefix: 'tpg/s36/', policy: { visibility: 'private', featureId: 'tpg-dokumen' } },
  { prefix: 'presensi/', policy: { visibility: 'private', featureId: 'kehadiran' } },
  { prefix: 'broadcast/', policy: { visibility: 'private', featureId: 'settings-notifications' } },
  { prefix: 'sp_ttd/', policy: { visibility: 'private', featureId: 'sp' } },
  { prefix: 'buku-tamu/', policy: { visibility: 'private', featureId: 'buku-tamu' } },
  { prefix: 'pmb/', policy: { visibility: 'private', featureId: 'pmb' } },
  { prefix: 'pdf-cache/', policy: { visibility: 'internal' } },
  { prefix: 'private/rapbm/', policy: { visibility: 'internal' } },
  { prefix: 'private/komite-pengajuan/', policy: { visibility: 'internal' } },
]

function normalizeMediaKey(key: string): string | null {
  let decoded: string
  try {
    decoded = decodeURIComponent(key)
  } catch {
    return null
  }
  if (!decoded || decoded.length > 1024 || decoded.startsWith('/') || decoded.includes('\\')) return null
  const segments = decoded.split('/')
  if (segments.some(segment => !segment || segment === '.' || segment === '..' || /[\u0000-\u001f]/.test(segment))) return null
  return decoded
}

export function getMediaPolicy(rawKey: string): { key: string; policy: MediaPolicy } | null {
  const key = normalizeMediaKey(rawKey)
  if (!key) return null
  const match = PREFIX_POLICIES.find(entry => key.startsWith(entry.prefix))
  return match ? { key, policy: match.policy } : null
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

async function hmac(secret: string, value: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)))
}

function constantTimeEqual(a: string, b: string) {
  const length = Math.max(a.length, b.length)
  let mismatch = a.length ^ b.length
  for (let i = 0; i < length; i++) mismatch |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0)
  return mismatch === 0
}

export async function createMediaGrant(
  key: string,
  audience: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000)
) {
  const resolved = getMediaPolicy(key)
  if (!resolved || resolved.policy.visibility === 'public' || !secret) throw new Error('Media grant target is invalid')
  const exp = nowSeconds + MAX_GRANT_SECONDS
  const sig = bytesToBase64Url(await hmac(secret, `${resolved.key}\n${audience}\n${exp}`))
  return { aud: audience, exp, sig }
}

export async function createSignedMediaUrl(url: string | null | undefined, audience: string, secret: string) {
  if (!url) return url ?? null
  let key: string | null = null
  try {
    const parsed = new URL(url, 'https://media.local')
    const marker = '/api/media/'
    const index = parsed.pathname.indexOf(marker)
    if (index >= 0) key = parsed.pathname.slice(index + marker.length)
  } catch {
    return url
  }
  if (!key) return url
  const grant = await createMediaGrant(key, audience, secret)
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}aud=${encodeURIComponent(grant.aud)}&exp=${grant.exp}&sig=${encodeURIComponent(grant.sig)}`
}

export async function verifyMediaGrant(
  key: string,
  audience: string | null,
  expiry: string | null,
  signature: string | null,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000)
) {
  if (!audience || !expiry || !signature || !secret) return false
  const exp = Number(expiry)
  if (!Number.isSafeInteger(exp) || exp < nowSeconds || exp > nowSeconds + MAX_GRANT_SECONDS) return false
  const expected = bytesToBase64Url(await hmac(secret, `${key}\n${audience}\n${exp}`))
  return constantTimeEqual(expected, signature)
}

async function parentOwnsRelatedMedia(db: D1Database, actor: Extract<AuthenticatedActor, { kind: 'parent' }>, key: string) {
  const proxyUrl = `/api/media/${key}`
  if (key.startsWith('payment_proofs/')) {
    const submissionId = key.split('/')[1]
    return Boolean(await db.prepare('SELECT 1 ok FROM fin_payment_submissions WHERE id = ? AND siswa_id = ? LIMIT 1')
      .bind(submissionId, actor.siswaId).first())
  }
  if (key.startsWith('pelanggaran/')) {
    return Boolean(await db.prepare('SELECT 1 ok FROM siswa_pelanggaran WHERE siswa_id = ? AND foto_url LIKE ? LIMIT 1')
      .bind(actor.siswaId, `${proxyUrl}%`).first())
  }
  if (key.startsWith('agenda/')) {
    return Boolean(await db.prepare(`
      SELECT 1 ok FROM agenda_guru ag
      JOIN penugasan_mengajar pm ON ag.penugasan_id = pm.id
      JOIN siswa s ON s.kelas_id = pm.kelas_id
      WHERE s.id = ? AND ag.foto_url LIKE ? LIMIT 1
    `).bind(actor.siswaId, `${proxyUrl}%`).first())
  }
  return false
}

async function authorizeActor(actor: AuthenticatedActor, key: string, policy: MediaPolicy) {
  const { env } = await getCloudflareContext({ async: true })
  if (actor.kind === 'parent') {
    if (key.startsWith(`foto_siswa/${actor.siswaId}/`)) return true
    return parentOwnsRelatedMedia(env.DB, actor, key)
  }

  if (key.startsWith('avatars/')) return true
  if (key.startsWith('pramubakti/')) {
    const owner = key.split('/')[1]
    if (owner === actor.id && await checkFeatureCrudAccess(env.DB, actor.id, 'pelaporan-pramubakti', 'read')) return true
    if (!(await checkFeatureCrudAccess(env.DB, actor.id, 'monitoring-pramubakti', 'read'))) return false
    if (actor.roles.some(r => ['super_admin', 'admin_tu', 'kepsek'].includes(r))) return true
    const structural = await env.DB.prepare('SELECT jabatan_struktural_id FROM "user" WHERE id=?').bind(actor.id).first<{ jabatan_struktural_id: string }>()
    return actor.roles.includes('wakamad') && structural?.jabatan_struktural_id === 'jbt_waka_sarpras'
  }
  if (key.startsWith('foto_siswa/')) {
    const siswaId = key.split('/')[1]
    if (!siswaId) return false
    if (siswaId.startsWith('pegawai_')) return true
    try {
      await assertStudentScope(actor, siswaId, 'media')
      return true
    } catch {
      return false
    }
  }
  if (key.startsWith('signatures/')) {
    const ownerId = key.split('/')[1]
    return ownerId === actor.id || isAdministrativeActor(actor)
  }
  if (key.startsWith('tpg/s36/')) {
    const ownerId = key.slice('tpg/s36/'.length).replace(/\.pdf$/i, '')
    if (ownerId === actor.id || isAdministrativeActor(actor)) return true
  }
  if (policy.visibility === 'private' && policy.featureId) {
    return checkFeatureCrudAccess(env.DB, actor.id, policy.featureId, 'read')
  }
  return isAdministrativeActor(actor)
}

export async function authorizeMediaRequest(request: Request, rawKey: string) {
  const resolved = getMediaPolicy(rawKey)
  if (!resolved) return null
  if (resolved.policy.visibility === 'public') return resolved

  const { env } = await getCloudflareContext({ async: true })
  const url = new URL(request.url)
  const grantValid = await verifyMediaGrant(
    resolved.key,
    url.searchParams.get('aud'),
    url.searchParams.get('exp'),
    url.searchParams.get('sig'),
    env.MEDIA_SIGNING_SECRET || ''
  )
  if (grantValid && resolved.policy.visibility !== 'internal') return resolved
  if (resolved.policy.visibility === 'internal') return null

  const actor = await getAuthenticatedActor()
  if (!actor) return null
  try {
    return (await authorizeActor(actor, resolved.key, resolved.policy)) ? resolved : null
  } catch (error) {
    logSecurityEvent('error', 'media_authorization_failed', { key: resolved.key, actorId: actor.id, error })
    return null
  }
}
