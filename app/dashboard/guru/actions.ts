// app/dashboard/guru/actions.ts
'use server'

import { getDB, dbUpdate } from '@/utils/db'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { createAuth, hashPassword } from '@/utils/auth'
import { revalidatePath } from 'next/cache'
import { uploadFotoSiswa, validateImageFile } from '@/utils/r2'
import { getCurrentUser } from '@/utils/auth/server'
import { getUserRoles } from '@/lib/features'

async function getAuth() {
  const { env } = await getCloudflareContext({ async: true })
  return createAuth(env.DB)
}

async function verifyStaffAdminAccess() {
  const user = await getCurrentUser()
  if (!user) return false
  const db = await getDB()
  const roles = await getUserRoles(db, user.id)
  return roles.some(role => ['super_admin', 'admin_tu'].includes(role))
}

export async function ensureJabatanStrukturalSchema(db?: D1Database) {
  const database = db || await getDB()
  await database.prepare(`
    CREATE TABLE IF NOT EXISTS master_jabatan_struktural (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      nama TEXT NOT NULL UNIQUE,
      urutan INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run()
  try {
    await database.prepare('ALTER TABLE "user" ADD COLUMN jabatan_struktural_id TEXT REFERENCES master_jabatan_struktural(id) ON DELETE SET NULL').run()
  } catch {
    // Column already exists on migrated databases.
  }
  const defaults = [
    ['jbt_kepsek', 'Kepala Madrasah', 1],
    ['jbt_waka_kurikulum', 'Wakamad Bidang Kurikulum', 2],
    ['jbt_waka_kesiswaan', 'Wakamad Bidang Kesiswaan', 3],
    ['jbt_waka_sarpras', 'Wakamad Bidang Sarana Prasarana', 4],
    ['jbt_waka_humas', 'Wakamad Bidang Humas', 5],
    ['jbt_ktu', 'Kepala TU', 6],
    ['jbt_bendahara', 'Bendahara', 7],
    ['jbt_operator', 'Operator', 8],
    ['jbt_staff_tu', 'Staff TU', 9],
    ['jbt_wali_kelas', 'Wali Kelas', 10],
    ['jbt_guru_bk', 'Guru BK', 11],
    ['jbt_guru', 'Guru', 12],
  ]
  await database.batch(defaults.map(([id, nama, urutan]) =>
    database.prepare('INSERT OR IGNORE INTO master_jabatan_struktural (id, nama, urutan) VALUES (?, ?, ?)')
      .bind(id, nama, urutan)
  ))
}

// ============================================================
// TAMBAH PEGAWAI (1 user)
// ============================================================
export async function tambahPegawai(prevState: any, formData: FormData) {
  if (!(await verifyStaffAdminAccess())) return { error: 'Akses Ditolak: Hanya Super Admin / Admin TU.', success: null }
  const nama_lengkap = (formData.get('nama_lengkap') as string).trim()
  const email = (formData.get('email') as string).trim()
  const role = formData.get('role') as string
  const nip = (formData.get('nip') as string)?.trim() || null
  const jabatan_cetak = (formData.get('jabatan_cetak') as string)?.trim() || null
  const jabatan_struktural_id_raw = (formData.get('jabatan_struktural_id') as string)?.trim()
  const jabatan_struktural_id = jabatan_struktural_id_raw && jabatan_struktural_id_raw !== '_none' ? jabatan_struktural_id_raw : null

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
    await ensureJabatanStrukturalSchema(db)
    // Update role utama di tabel user
    await db.prepare(`UPDATE "user" SET role = ?, nama_lengkap = ?, nip = ?, jabatan_cetak = ?, jabatan_struktural_id = ?, updatedAt = datetime('now') WHERE id = ?`)
      .bind(role, nama_lengkap, nip, jabatan_cetak, jabatan_struktural_id, res.user.id).run()
    // Insert ke user_roles
    await db.prepare('INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?, ?)')
      .bind(res.user.id, role).run()
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
export async function editPegawai(id: string, nama_lengkap: string, email: string, nip?: string, jabatan_cetak?: string, jabatan_struktural_id?: string) {
  if (!(await verifyStaffAdminAccess())) return { error: 'Akses Ditolak: Hanya Super Admin / Admin TU.' }
  const db = await getDB()
  await ensureJabatanStrukturalSchema(db)
  const strukturalId = jabatan_struktural_id?.trim() && jabatan_struktural_id !== '_none' ? jabatan_struktural_id : null
  const result = await dbUpdate(
    db, '"user"',
    {
      nama_lengkap,
      name: nama_lengkap,
      email,
      nip: nip?.trim() || null,
      jabatan_cetak: jabatan_cetak?.trim() || null,
      jabatan_struktural_id: strukturalId,
      updatedAt: new Date().toISOString(),
    },
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
  if (!(await verifyStaffAdminAccess())) return { error: 'Akses Ditolak: Hanya Super Admin / Admin TU.' }
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
// SET USER ROLES (multi-role)
// ============================================================
export async function setUserRoles(userId: string, roles: string[], primaryRole: string) {
  if (!(await verifyStaffAdminAccess())) return { error: 'Akses Ditolak: Hanya Super Admin / Admin TU.' }
  if (roles.length === 0) return { error: 'User harus memiliki minimal 1 role.' }
  if (!roles.includes(primaryRole)) return { error: 'Role utama harus termasuk dalam daftar role.' }

  const db = await getDB()

  const stmts: D1PreparedStatement[] = [
    // Update primary role
    db.prepare('UPDATE "user" SET role = ?, updatedAt = datetime(\'now\') WHERE id = ?').bind(primaryRole, userId),
    // Clear existing roles
    db.prepare('DELETE FROM user_roles WHERE user_id = ?').bind(userId),
    // Insert new roles
    ...roles.map(role =>
      db.prepare('INSERT INTO user_roles (user_id, role) VALUES (?, ?)').bind(userId, role)
    )
  ]

  try {
    await db.batch(stmts)
  } catch (e: any) {
    return { error: 'Gagal menyimpan role: ' + (e?.message || '') }
  }

  revalidatePath('/dashboard/guru')
  revalidatePath('/dashboard')
  return { success: 'Role berhasil diperbarui.' }
}

// ============================================================
// UBAH ROLE PEGAWAI (legacy single-role — tetap berfungsi)
// ============================================================
export async function ubahRolePegawai(id: string, newRole: string) {
  if (!(await verifyStaffAdminAccess())) return { error: 'Akses Ditolak: Hanya Super Admin / Admin TU.' }
  const db = await getDB()

  const stmts: D1PreparedStatement[] = [
    db.prepare('UPDATE "user" SET role = ?, updatedAt = datetime(\'now\') WHERE id = ?').bind(newRole, id),
    db.prepare('DELETE FROM user_roles WHERE user_id = ?').bind(id),
    db.prepare('INSERT INTO user_roles (user_id, role) VALUES (?, ?)').bind(id, newRole),
  ]

  try {
    await db.batch(stmts)
  } catch (e: any) {
    return { error: e.message }
  }

  revalidatePath('/dashboard/guru')
  return { success: 'Jabatan/Role berhasil diperbarui.' }
}

// ============================================================
// HAPUS PEGAWAI
// ============================================================
export async function hapusPegawai(id: string) {
  if (!(await verifyStaffAdminAccess())) return { error: 'Akses Ditolak: Hanya Super Admin / Admin TU.' }
  const db = await getDB()
  try {
    await db.prepare('DELETE FROM user_feature_overrides WHERE user_id = ?').bind(id).run()
    await db.prepare('DELETE FROM user_roles WHERE user_id = ?').bind(id).run()
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
// IMPORT MASSAL
// ============================================================
export async function importPegawaiMassal(dataExcel: any[]) {
  if (!(await verifyStaffAdminAccess())) return { success: null, error: 'Akses Ditolak: Hanya Super Admin / Admin TU.', logs: [] }
  const db = await getDB()
  const errorLogs: string[] = []

  const users: Array<{ nama_lengkap: string; email: string; role: string; nip: string | null; jabatan_cetak: string | null }> = []

  for (const row of dataExcel) {
    const nama_lengkap = String(row.NAMA_LENGKAP || '').trim()
    const email = String(row.EMAIL || '').trim().toLowerCase()
    const rawJabatan = String(row.JABATAN || 'guru').toLowerCase().trim()
    const nip = String(row.NIP || '').trim() || null
    const jabatan_cetak = String(row.JABATAN_CETAK || row.JABATAN_PRINT || row.JABATAN || '').trim() || null
    if (!nama_lengkap || !email) continue

    let role = 'guru'
    if (rawJabatan.includes('bk')) role = 'guru_bk'
    else if (rawJabatan.includes('piket')) role = 'guru_piket'
    else if (rawJabatan.includes('waka') || rawJabatan.includes('wakil')) role = 'wakamad'
    else if (rawJabatan.includes('kepala')) role = 'kepsek'
    else if (rawJabatan.includes('tu') || rawJabatan.includes('tata')) role = 'admin_tu'
    else if (rawJabatan.includes('resepsionis')) role = 'resepsionis'
    else if (rawJabatan.includes('ppl') || rawJabatan.includes('praktek')) role = 'guru_ppl'
    else if (rawJabatan.includes('wali kelas') || rawJabatan.includes('walas')) role = 'wali_kelas'

    users.push({ nama_lengkap, email, role, nip, jabatan_cetak })
  }

  if (users.length === 0) return { success: null, error: 'Data kosong atau format tidak sesuai.', logs: [] }

  // Hash SEKALI
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

  const chunkSize = 20
  let successCount = 0

  for (let i = 0; i < toInsert.length; i += chunkSize) {
    const chunk = toInsert.slice(i, i + chunkSize)

    const userPlaceholders = chunk.map(() =>
      `(lower(hex(randomblob(16))), ?, ?, 1, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    ).join(', ')
    const userValues = chunk.flatMap(u => [u.nama_lengkap, u.email, u.role, u.nama_lengkap, u.nip, u.jabatan_cetak])

    await db.prepare(
      `INSERT OR IGNORE INTO "user" (id, name, email, emailVerified, role, nama_lengkap, nip, jabatan_cetak, createdAt, updatedAt) VALUES ${userPlaceholders}`
    ).bind(...userValues).run()

    const emailList = chunk.map(() => '?').join(',')
    const newUsers = await db.prepare(
      `SELECT id, email, role FROM "user" WHERE email IN (${emailList})`
    ).bind(...chunk.map(u => u.email)).all<any>()

    if (newUsers.results && newUsers.results.length > 0) {
      const accPlaceholders = newUsers.results.map(() =>
        `(lower(hex(randomblob(16))), ?, 'credential', ?, ?, datetime('now'), datetime('now'))`
      ).join(', ')
      const accValues = newUsers.results.flatMap((u: any) => [u.email, u.id, passwordHash])

      await db.prepare(
        `INSERT OR IGNORE INTO account (id, accountId, providerId, userId, password, createdAt, updatedAt) VALUES ${accPlaceholders}`
      ).bind(...accValues).run()

      // Insert ke user_roles juga
      const roleStmts = newUsers.results.map((u: any) =>
        db.prepare('INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?, ?)').bind(u.id, u.role)
      )
      if (roleStmts.length > 0) {
        await db.batch(roleStmts)
      }

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

// ============================================================
// ASSIGN JABATAN STRUKTURAL
// ============================================================
export async function uploadFotoPegawaiAction(userId: string, formData: FormData) {
  if (!(await verifyStaffAdminAccess())) return { error: 'Akses Ditolak: Hanya Super Admin / Admin TU.' }
  const file = formData.get('foto') as File
  if (!file || file.size === 0) return { error: 'Tidak ada file.' }

  const validationError = validateImageFile(file)
  if (validationError) return { error: validationError }

  // Reuse the existing R2 upload function
  const { url, error: uploadError } = await uploadFotoSiswa(`pegawai_${userId}`, file)
  if (uploadError || !url) return { error: uploadError || 'Upload gagal' }

  const versionedUrl = `${url}?v=${Date.now()}`

  const db = await getDB()
  const result = await dbUpdate(
    db, '"user"',
    { avatar_url: versionedUrl, updatedAt: new Date().toISOString() },
    { id: userId }
  )
  if (result.error) return { error: result.error }

  revalidatePath('/dashboard/guru')
  return { success: 'Foto berhasil diperbarui!', url: versionedUrl }
}
