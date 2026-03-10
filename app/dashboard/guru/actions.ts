// app/dashboard/guru/actions.ts
'use server'

import { getDB, dbUpdate } from '@/utils/db'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { createAuth } from '@/utils/auth'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

async function getAuth() {
  const { env } = await getCloudflareContext({ async: true })
  return createAuth(env.DB)
}

// PBKDF2 — sama persis dengan yang di auth/index.ts
async function hashPassword(password: string): Promise<string> {
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

// ============================================================
// TAMBAH PEGAWAI (1 user)
// ============================================================
export async function tambahPegawai(prevState: any, formData: FormData) {
  const nama_lengkap = (formData.get('nama_lengkap') as string).trim()
  const email = (formData.get('email') as string).trim()
  const role = formData.get('role') as string

  if (!nama_lengkap || !email || !role) {
    return { error: 'Semua field wajib diisi.', success: null }
  }

  const auth = await getAuth()
  try {
    const res = await auth.api.signUpEmail({
      body: { name: nama_lengkap, email, password: 'mansatas2026' },
    }) as any
    if (!res?.user?.id) throw new Error('Gagal membuat akun.')
    const db = await getDB()
    await db.prepare(`UPDATE "user" SET role = ?, nama_lengkap = ?, updatedAt = datetime('now') WHERE id = ?`)
      .bind(role, nama_lengkap, res.user.id).run()
  } catch (e: any) {
    const msg = e?.message || ''
    return { error: msg.includes('already') || msg.includes('exists') ? 'Email sudah terdaftar!' : msg, success: null }
  }

  revalidatePath('/dashboard/guru')
  return { error: null, success: 'Akun berhasil dibuat! Password default: mansatas2026' }
}

// ============================================================
// EDIT PEGAWAI
// ============================================================
export async function editPegawai(id: string, nama_lengkap: string, email: string) {
  const db = await getDB()
  const result = await dbUpdate(
    db, '"user"',
    { nama_lengkap, name: nama_lengkap, email, updatedAt: new Date().toISOString() },
    { id }
  )
  if (result.error) return { error: result.error }
  revalidatePath('/dashboard/guru')
  return { success: 'Data pegawai berhasil diperbarui.' }
}

// ============================================================
// RESET PASSWORD
// ============================================================
export async function resetPasswordPegawai(id: string) {
  const db = await getDB()
  try {
    const passwordHash = await hashPassword('mansatas2026')
    await db.prepare(`UPDATE account SET password = ?, updatedAt = datetime('now') WHERE userId = ? AND providerId = 'credential'`)
      .bind(passwordHash, id).run()
  } catch (e: any) {
    return { error: 'Gagal mereset password: ' + (e?.message || '') }
  }
  return { success: 'Password berhasil direset ke: mansatas2026' }
}

// ============================================================
// UBAH ROLE PEGAWAI
// ============================================================
export async function ubahRolePegawai(id: string, newRole: string) {
  const db = await getDB()
  const result = await dbUpdate(
    db, '"user"',
    { role: newRole, updatedAt: new Date().toISOString() },
    { id }
  )
  if (result.error) return { error: result.error }
  revalidatePath('/dashboard/guru')
  return { success: 'Jabatan/Role berhasil diperbarui.' }
}

// ============================================================
// HAPUS PEGAWAI
// ============================================================
export async function hapusPegawai(id: string) {
  const db = await getDB()
  try {
    await db.prepare('DELETE FROM session WHERE userId = ?').bind(id).run()
    await db.prepare('DELETE FROM account WHERE userId = ?').bind(id).run()
    await db.prepare('DELETE FROM "user" WHERE id = ?').bind(id).run()
  } catch (e: any) {
    return { error: 'Gagal menghapus akun: ' + (e?.message || '') }
  }
  revalidatePath('/dashboard/guru')
  return { success: 'Akun pegawai berhasil dihapus permanen.' }
}

// ============================================================
// IMPORT MASSAL — hash PBKDF2 langsung, tanpa Scrypt
// ============================================================
export async function importPegawaiMassal(dataExcel: any[]) {
  const db = await getDB()
  const errorLogs: string[] = []

  const users: Array<{ nama_lengkap: string; email: string; role: string }> = []

  for (const row of dataExcel) {
    const nama_lengkap = String(row.NAMA_LENGKAP || '').trim()
    const email = String(row.EMAIL || '').trim().toLowerCase()
    const rawJabatan = String(row.JABATAN || 'guru').toLowerCase().trim()
    if (!nama_lengkap || !email) continue

    let role = 'guru'
    if (rawJabatan.includes('bk')) role = 'guru_bk'
    else if (rawJabatan.includes('piket')) role = 'guru_piket'
    else if (rawJabatan.includes('waka') || rawJabatan.includes('wakil')) role = 'wakamad'
    else if (rawJabatan.includes('kepala')) role = 'kepsek'
    else if (rawJabatan.includes('tu') || rawJabatan.includes('tata')) role = 'admin_tu'
    else if (rawJabatan.includes('satpam')) role = 'satpam'
    else if (rawJabatan.includes('pramu') || rawJabatan.includes('bersih')) role = 'pramubakti'

    users.push({ nama_lengkap, email, role })
  }

  if (users.length === 0) return { success: null, error: 'Data kosong atau format tidak sesuai.', logs: [] }

  // Hash SEKALI — PBKDF2 jalan di Workers
  const passwordHash = await hashPassword('mansatas2026')

  // Cek email existing
  const existingRes = await db.prepare('SELECT email FROM "user"').all<any>()
  const existingEmails = new Set((existingRes.results || []).map((u: any) => u.email.toLowerCase()))

  const toInsert = users.filter(u => {
    if (existingEmails.has(u.email)) {
      errorLogs.push(`${u.nama_lengkap} (${u.email}): Email sudah terdaftar`)
      return false
    }
    return true
  })

  if (toInsert.length === 0) {
    return { success: null, error: 'Semua email sudah terdaftar.', logs: errorLogs }
  }

  // Batch insert 20 per chunk
  const chunkSize = 20
  let successCount = 0

  for (let i = 0; i < toInsert.length; i += chunkSize) {
    const chunk = toInsert.slice(i, i + chunkSize)

    const userPlaceholders = chunk.map(() =>
      `(lower(hex(randomblob(16))), ?, ?, 1, ?, ?, datetime('now'), datetime('now'))`
    ).join(', ')
    const userValues = chunk.flatMap(u => [u.nama_lengkap, u.email, u.role, u.nama_lengkap])

    await db.prepare(
      `INSERT OR IGNORE INTO "user" (id, name, email, emailVerified, role, nama_lengkap, createdAt, updatedAt) VALUES ${userPlaceholders}`
    ).bind(...userValues).run()

    const emailList = chunk.map(() => '?').join(',')
    const newUsers = await db.prepare(
      `SELECT id, email FROM "user" WHERE email IN (${emailList})`
    ).bind(...chunk.map(u => u.email)).all<any>()

    if (newUsers.results && newUsers.results.length > 0) {
      const accPlaceholders = newUsers.results.map(() =>
        `(lower(hex(randomblob(16))), ?, 'credential', ?, ?, datetime('now'), datetime('now'))`
      ).join(', ')
      const accValues = newUsers.results.flatMap((u: any) => [u.email, u.id, passwordHash])

      await db.prepare(
        `INSERT OR IGNORE INTO account (id, accountId, providerId, userId, password, createdAt, updatedAt) VALUES ${accPlaceholders}`
      ).bind(...accValues).run()

      successCount += newUsers.results.length
    }
  }

  revalidatePath('/dashboard/guru')
  return {
    success: `Berhasil mengimport ${successCount} akun pegawai. Password default: mansatas2026`,
    error: null,
    logs: errorLogs,
  }
}