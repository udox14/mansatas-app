// utils/auth/index.ts
// Custom lightweight auth — pengganti better-auth
// Hanya pakai Web Crypto (PBKDF2) + D1 — zero external dependencies

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
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`
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
    role: row.role || 'wali_murid',
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
          await db.prepare('DELETE FROM session WHERE token = ?').bind(token).run()
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
