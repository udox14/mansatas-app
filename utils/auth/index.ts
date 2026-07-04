// utils/auth/index.ts
// Custom lightweight auth — pengganti better-auth
// Hanya pakai Web Crypto (PBKDF2) + D1 — zero external dependencies

import { logActivity } from '@/lib/activity-log'

// ============================================================
// PASSWORD HASHING (PBKDF2 — native Web Crypto, jalan di Workers)
// ============================================================
export async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder()
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  )
  const saltB64 = btoa(String.fromCharCode(...salt))
  const hashB64 = btoa(String.fromCharCode(...new Uint8Array(bits)))
  return `pbkdf2:100000:${saltB64}:${hashB64}`
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    const parts = hash.split(':')
    if (parts[0] !== 'pbkdf2') return false
    const [, iter, saltB64, hashB64] = parts
    const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0))
    const enc = new TextEncoder()
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: parseInt(iter), hash: 'SHA-256' },
      keyMaterial, 256
    )
    const newHashB64 = btoa(String.fromCharCode(...new Uint8Array(bits)))
    return newHashB64 === hashB64
  } catch {
    return false
  }
}

// ============================================================
// SESSION HELPERS
// ============================================================
const SESSION_EXPIRY_DAYS = 30
export const COOKIE_NAME = 'session_token'

function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

function getExpiresAt(): string {
  const d = new Date()
  d.setDate(d.getDate() + SESSION_EXPIRY_DAYS)
  return d.toISOString()
}

function buildSetCookie(token: string, maxAge: number): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`
}

function formatBirthDatePassword(raw: string | null | undefined): string | null {
  const value = String(raw || '').trim()
  if (!value) return null

  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) return `${isoMatch[3]}${isoMatch[2]}${isoMatch[1]}`

  const localMatch = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (localMatch) {
    const day = localMatch[1].padStart(2, '0')
    const month = localMatch[2].padStart(2, '0')
    return `${day}${month}${localMatch[3]}`
  }

  return null
}

// ============================================================
// TYPES
// ============================================================
export type AuthUser = {
  id: string
  name: string
  email: string
  role: string
  nama_lengkap: string | null
  avatar_url: string | null
  image: string | null
  emailVerified: boolean
  createdAt: string
  updatedAt: string
  banned: boolean
  banReason: string | null
  banExpires: string | null
}

export type AuthSession = {
  id: string
  token: string
  userId: string
  expiresAt: string
}

export type ParentAuthUser = {
  type: 'parent'
  siswa_id: string
  nisn: string
  nama_lengkap: string
}

export type ParentAuthSession = {
  id: string
  token: string
  siswaId: string
  nisn: string
  expiresAt: string
}

// ============================================================
// HELPER: extract token dari cookie header
// ============================================================
export function extractToken(hdrs: Headers): string | null {
  const cookieHeader = hdrs.get('cookie') || ''
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim()
    // Cookie baru
    if (trimmed.startsWith(`${COOKIE_NAME}=`)) {
      return trimmed.slice(COOKIE_NAME.length + 1).split('.')[0]
    }
    // Backward compat: cookie lama better-auth
    if (trimmed.startsWith('better-auth.session_token=')) {
      return trimmed.slice('better-auth.session_token='.length).split('.')[0]
    }
    if (trimmed.startsWith('__Secure-better-auth.session_token=')) {
      return trimmed.slice('__Secure-better-auth.session_token='.length).split('.')[0]
    }
  }
  return null
}

// ============================================================
// MAP DB ROW → AuthUser
// ============================================================
function mapUser(row: any): AuthUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role || 'guru',
    nama_lengkap: row.nama_lengkap || null,
    avatar_url: row.avatar_url || null,
    image: row.image || null,
    emailVerified: !!row.emailVerified,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    banned: !!row.banned,
    banReason: row.banReason || null,
    banExpires: row.banExpires || null,
  }
}

function normalizeDateToDdMmYyyy(value: string | null | undefined): string | null {
  if (!value) return null
  const raw = String(value).trim()
  if (!raw) return null

  const digits = raw.replace(/\D/g, '')
  if (digits.length === 8) {
    // DDMMYYYY
    if (/^\d{2}\d{2}\d{4}$/.test(digits)) {
      const dd = digits.slice(0, 2)
      const mm = digits.slice(2, 4)
      const yyyy = digits.slice(4, 8)
      if (Number(dd) >= 1 && Number(dd) <= 31 && Number(mm) >= 1 && Number(mm) <= 12) {
        return `${dd}${mm}${yyyy}`
      }
    }
    // YYYYMMDD
    const yyyy = digits.slice(0, 4)
    const mm = digits.slice(4, 6)
    const dd = digits.slice(6, 8)
    if (Number(dd) >= 1 && Number(dd) <= 31 && Number(mm) >= 1 && Number(mm) <= 12) {
      return `${dd}${mm}${yyyy}`
    }
  }

  // YYYY-MM-DD
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) {
    const [, y, m, d] = iso
    return `${d}${m}${y}`
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const local = raw.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/)
  if (local) {
    const [, d, m, y] = local
    return `${d}${m}${y}`
  }

  return null
}

async function ensureParentSessionTable(db: D1Database) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS parent_session (
      id TEXT PRIMARY KEY,
      token TEXT NOT NULL UNIQUE,
      siswa_id TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
      nisn TEXT NOT NULL,
      expiresAt TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `).run()
}

async function ensureParentCredentialTable(db: D1Database) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS parent_credentials (
      siswa_id TEXT PRIMARY KEY REFERENCES siswa(id) ON DELETE CASCADE,
      password_hash TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run()
}

// ============================================================
// CREATE AUTH — main factory
// ============================================================
export function createAuth(db: D1Database) {
  return {
    api: {
      // ---- SIGN IN ----
      async signInEmail(opts: {
        body: { email: string; password: string }
        headers?: Headers
        asResponse?: boolean
      }) {
        const { email, password } = opts.body

        const user = await db.prepare('SELECT * FROM "user" WHERE email = ?').bind(email).first<any>()
        if (!user) {
          if (opts.asResponse) return new Response('Invalid credentials', { status: 401 })
          throw new Error('Invalid credentials')
        }

        if (user.banned) {
          if (opts.asResponse) return new Response('Account banned', { status: 403 })
          throw new Error('Account banned')
        }

        const account = await db.prepare(
          `SELECT password FROM account WHERE userId = ? AND providerId = 'credential'`
        ).bind(user.id).first<any>()
        if (!account?.password) {
          if (opts.asResponse) return new Response('Invalid credentials', { status: 401 })
          throw new Error('Invalid credentials')
        }

        const valid = await verifyPassword(account.password, password)
        if (!valid) {
          if (opts.asResponse) return new Response('Invalid credentials', { status: 401 })
          throw new Error('Invalid credentials')
        }

        // Create session
        const token = generateToken()
        const sessionId = crypto.randomUUID()
        const now = new Date().toISOString()
        const expiresAt = getExpiresAt()

        await db.prepare(
          `INSERT INTO session (id, token, userId, expiresAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(sessionId, token, user.id, expiresAt, now, now).run()

        await logActivity({
          db,
          module: 'auth',
          action: 'login',
          summary: `${user.nama_lengkap || user.name || user.email} login`,
          entityType: 'user',
          entityId: user.id,
          entityLabel: user.nama_lengkap || user.name || user.email,
          actor: {
            id: user.id,
            name: user.nama_lengkap || user.name,
            email: user.email,
            roles: [user.role].filter(Boolean),
            sessionId,
          },
        })

        const maxAge = SESSION_EXPIRY_DAYS * 24 * 60 * 60
        const setCookie = buildSetCookie(token, maxAge)

        if (opts.asResponse) {
          return new Response(JSON.stringify({ user: mapUser(user), session: { id: sessionId, token } }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Set-Cookie': setCookie },
          })
        }

        return { user: mapUser(user), session: { id: sessionId, token }, setCookie }
      },

      // ---- SIGN UP ----
      async signUpEmail(opts: { body: { name: string; email: string; password: string } }) {
        const { name, email, password } = opts.body

        const existing = await db.prepare('SELECT id FROM "user" WHERE email = ?').bind(email).first<any>()
        if (existing) throw new Error('User already exists')

        const userId = crypto.randomUUID()
        const accountId = crypto.randomUUID()
        const now = new Date().toISOString()
        const passwordHash = await hashPassword(password)

        await db.batch([
          db.prepare(
            `INSERT INTO "user" (id, name, email, emailVerified, createdAt, updatedAt, nama_lengkap) VALUES (?, ?, ?, 1, ?, ?, ?)`
          ).bind(userId, name, email, now, now, name),
          db.prepare(
            `INSERT INTO account (id, accountId, providerId, userId, password, createdAt, updatedAt) VALUES (?, ?, 'credential', ?, ?, ?, ?)`
          ).bind(accountId, email, userId, passwordHash, now, now),
        ])

        const user = await db.prepare('SELECT * FROM "user" WHERE id = ?').bind(userId).first<any>()
        return { user: mapUser(user!) }
      },

      // ---- SIGN OUT ----
      async signOut(opts: { headers: Headers }) {
        const token = extractToken(opts.headers)
        if (token) {
          const row = await db.prepare(
            `SELECT s.id as sid, u.* FROM session s JOIN "user" u ON s.userId = u.id WHERE s.token = ?`
          ).bind(token).first<any>()

          await db.prepare('DELETE FROM session WHERE token = ?').bind(token).run()
          await ensureParentSessionTable(db)
          await db.prepare('DELETE FROM parent_session WHERE token = ?').bind(token).run()

          if (row) {
            await logActivity({
              db,
              module: 'auth',
              action: 'logout',
              summary: `${row.nama_lengkap || row.name || row.email} logout`,
              entityType: 'user',
              entityId: row.id,
              entityLabel: row.nama_lengkap || row.name || row.email,
              actor: {
                id: row.id,
                name: row.nama_lengkap || row.name,
                email: row.email,
                roles: [row.role].filter(Boolean),
                sessionId: row.sid,
              },
            })
          }
        }
      },

      // ---- GET SESSION ----
      async getSession(opts: { headers: Headers }): Promise<{ user: AuthUser; session: AuthSession } | null> {
        const token = extractToken(opts.headers)
        if (!token) return null

        const row = await db.prepare(
          `SELECT s.id as sid, s.token, s.userId, s.expiresAt, u.*
           FROM session s JOIN "user" u ON s.userId = u.id
           WHERE s.token = ?`
        ).bind(token).first<any>()

        if (!row) return null

        // Cek expired
        if (new Date(row.expiresAt) < new Date()) {
          await db.prepare('DELETE FROM session WHERE token = ?').bind(token).run()
          return null
        }

        if (row.banned) return null

        return {
          user: mapUser(row),
          session: { id: row.sid, token: row.token, userId: row.userId, expiresAt: row.expiresAt },
        }
      },

      // ---- SIGN IN PARENT (NISN + password parent) ----
      async signInParent(opts: {
        body: { nisn: string; password: string }
        asResponse?: boolean
      }) {
        const nisn = String(opts.body.nisn || '').replace(/\D/g, '')
        const password = String(opts.body.password || '').replace(/\D/g, '')

        if (!/^\d{6,20}$/.test(nisn)) {
          if (opts.asResponse) return new Response('Invalid NISN', { status: 400 })
          throw new Error('Invalid NISN')
        }
        if (!/^\d{6,20}$/.test(password)) {
          if (opts.asResponse) return new Response('Invalid password format', { status: 400 })
          throw new Error('Invalid password format')
        }

        // Beberapa NISN hasil import Excel tersimpan dengan tanda petik depan.
        const siswa = await db.prepare(
          `SELECT s.id, s.nisn, s.nama_lengkap, s.tanggal_lahir, s.status, k.tingkat AS kelas_tingkat
           FROM siswa s
           LEFT JOIN kelas k ON k.id = s.kelas_id
           WHERE s.nisn = ?
              OR REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(s.nisn, ''), '''', ''), ' ', ''), '.', ''), '-', '') = ?
           LIMIT 1`
        ).bind(nisn, nisn).first<any>()

        if (!siswa) {
          if (opts.asResponse) return new Response('Invalid credentials', { status: 401 })
          throw new Error('Invalid credentials')
        }
        if (siswa.status && siswa.status !== 'aktif') {
          if (opts.asResponse) return new Response('Invalid credentials', { status: 401 })
          throw new Error('Invalid credentials')
        }

        await ensureParentCredentialTable(db)
        const credential = await db.prepare(
          `SELECT password_hash FROM parent_credentials WHERE siswa_id = ? LIMIT 1`
        ).bind(siswa.id).first<{ password_hash: string }>()

        let valid = false
        const normalizedSiswaNisn = String(siswa.nisn || '').replace(/\D/g, '')
        const birthDatePassword = formatBirthDatePassword(siswa.tanggal_lahir)

        if (credential?.password_hash) {
          valid = await verifyPassword(credential.password_hash, password)
          // Fallback: jika hash tidak cocok, cek langsung terhadap NISN atau tanggal lahir.
          // Ini mengatasi kasus di mana orang tua pertama kali login pakai NISN lalu
          // coba login lagi pakai tanggal lahir (atau sebaliknya).
          if (!valid) {
            valid = password === normalizedSiswaNisn || Boolean(birthDatePassword && password === birthDatePassword)
            if (valid) {
              // Update hash ke password yang baru dipakai
              const passwordHash = await hashPassword(password)
              await db.prepare(`
                INSERT INTO parent_credentials (siswa_id, password_hash, updated_at)
                VALUES (?, ?, datetime('now'))
                ON CONFLICT(siswa_id) DO UPDATE SET
                  password_hash = excluded.password_hash,
                  updated_at = excluded.updated_at
              `).bind(siswa.id, passwordHash).run()
            }
          }
        } else {
          valid = password === normalizedSiswaNisn || Boolean(birthDatePassword && password === birthDatePassword)
          if (valid) {
            const passwordHash = await hashPassword(password)
            await db.prepare(`
              INSERT INTO parent_credentials (siswa_id, password_hash, updated_at)
              VALUES (?, ?, datetime('now'))
              ON CONFLICT(siswa_id) DO NOTHING
            `).bind(siswa.id, passwordHash).run()
          }
        }
        if (!valid) {
          if (opts.asResponse) return new Response('Invalid credentials', { status: 401 })
          throw new Error('Invalid credentials')
        }

        // Guard: blokir login untuk tingkat kelas tertentu bila diaktifkan admin.
        // Dicek setelah password valid agar pesan blokir hanya muncul untuk akun sah.
        // Baca setting terpisah (try/catch) supaya error DB tidak menggagalkan login.
        const blockSettings = new Map<string, string>()
        try {
          const rows = await db.prepare(
            `SELECT key, value FROM system_settings
             WHERE key IN ('parent_login_block_enabled', 'parent_login_block_tingkat', 'parent_login_block_message')`
          ).all<{ key: string; value: string }>()
          for (const r of rows.results || []) blockSettings.set(r.key, r.value)
        } catch {
          // Tabel belum ada / error baca → anggap tidak ada blokir.
        }

        if (blockSettings.get('parent_login_block_enabled') === '1') {
          let blockedTingkat: number[] = []
          try {
            const parsed = JSON.parse(blockSettings.get('parent_login_block_tingkat') || '[]')
            if (Array.isArray(parsed)) blockedTingkat = parsed.map((v) => Number(v)).filter((v) => Number.isInteger(v))
          } catch {}
          const tingkat = Number(siswa.kelas_tingkat)
          if (Number.isInteger(tingkat) && blockedTingkat.includes(tingkat)) {
            const message = (blockSettings.get('parent_login_block_message') || '').trim()
              || 'Login portal orang tua untuk tingkat kelas Anda sedang dinonaktifkan sementara oleh sekolah.'
            if (opts.asResponse) return new Response(message, { status: 403 })
            throw new Error(message)
          }
        }

        await ensureParentSessionTable(db)
        const token = generateToken()
        const sessionId = crypto.randomUUID()
        const now = new Date().toISOString()
        const expiresAt = getExpiresAt()
        await db.prepare(
          `INSERT INTO parent_session (id, token, siswa_id, nisn, expiresAt, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(sessionId, token, siswa.id, String(siswa.nisn || '').replace(/\D/g, ''), expiresAt, now, now).run()

        const maxAge = SESSION_EXPIRY_DAYS * 24 * 60 * 60
        const setCookie = buildSetCookie(token, maxAge)
        const payload = {
          user: {
            type: 'parent' as const,
            siswa_id: siswa.id,
            nisn: String(siswa.nisn || '').replace(/\D/g, ''),
            nama_lengkap: siswa.nama_lengkap,
          },
          session: {
            id: sessionId,
            token,
            siswaId: siswa.id,
            nisn: String(siswa.nisn || '').replace(/\D/g, ''),
            expiresAt,
          },
        }

        if (opts.asResponse) {
          return new Response(JSON.stringify(payload), {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Set-Cookie': setCookie },
          })
        }

        return { ...payload, setCookie }
      },

      // ---- GET PARENT SESSION ----
      async getParentSession(opts: { headers: Headers }): Promise<{ user: ParentAuthUser; session: ParentAuthSession } | null> {
        const token = extractToken(opts.headers)
        if (!token) return null

        await ensureParentSessionTable(db)
        const row = await db.prepare(
          `SELECT ps.id as sid, ps.token, ps.siswa_id, ps.nisn, ps.expiresAt, s.nama_lengkap
           FROM parent_session ps
           JOIN siswa s ON s.id = ps.siswa_id
           WHERE ps.token = ?`
        ).bind(token).first<any>()

        if (!row) return null
        if (new Date(row.expiresAt) < new Date()) {
          await db.prepare('DELETE FROM parent_session WHERE token = ?').bind(token).run()
          return null
        }

        return {
          user: {
            type: 'parent',
            siswa_id: row.siswa_id,
            nisn: row.nisn,
            nama_lengkap: row.nama_lengkap,
          },
          session: {
            id: row.sid,
            token: row.token,
            siswaId: row.siswa_id,
            nisn: row.nisn,
            expiresAt: row.expiresAt,
          },
        }
      },

      async changeParentPassword(opts: { siswaId: string; newPassword: string }) {
        await ensureParentCredentialTable(db)
        const passwordHash = await hashPassword(opts.newPassword)
        await db.prepare(`
          INSERT INTO parent_credentials (siswa_id, password_hash, updated_at)
          VALUES (?, ?, datetime('now'))
          ON CONFLICT(siswa_id) DO UPDATE SET
            password_hash = excluded.password_hash,
            updated_at = excluded.updated_at
        `).bind(opts.siswaId, passwordHash).run()
      },

      // ---- CHANGE PASSWORD (pengganti admin plugin setUserData) ----
      async changePassword(opts: { userId: string; newPassword: string }) {
        const passwordHash = await hashPassword(opts.newPassword)
        await db.prepare(
          `UPDATE account SET password = ?, updatedAt = datetime('now') WHERE userId = ? AND providerId = 'credential'`
        ).bind(passwordHash, opts.userId).run()
      },
    },
  }
}
