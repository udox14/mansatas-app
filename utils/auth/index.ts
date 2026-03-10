// utils/auth/index.ts
// @ts-nocheck
import { betterAuth } from 'better-auth'
import { admin } from 'better-auth/plugins'

// PBKDF2 via WebCrypto — satu-satunya hasher yang bisa jalan di Cloudflare Workers
async function pbkdf2Hash(password: string): Promise<string> {
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

async function pbkdf2Verify({ hash, password }: { hash: string; password: string }): Promise<boolean> {
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

export function createAuth(db: any) {
  return betterAuth({
    database: db,
    emailAndPassword: {
      enabled: true,
      password: {
        hash: pbkdf2Hash,
        verify: pbkdf2Verify,
      },
    },
    plugins: [admin()],
    session: {
      cookieCache: { enabled: true, maxAge: 60 * 5 },
    },
    user: {
      additionalFields: {
        nama_lengkap: { type: 'string', required: false, defaultValue: '' },
        role: { type: 'string', required: false, defaultValue: 'guru' },
        avatar_url: { type: 'string', required: false, defaultValue: '' },
      },
    },
  })
}