// app/dashboard/guru/actions.ts
'use server'

import { getDB, dbUpdate } from '@/utils/db'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { createAuth, hashPassword } from '@/utils/auth'
import { revalidatePath } from 'next/cache'
import { uploadFotoSiswa, validateImageFile } from '@/utils/r2'

async function getAuth() {
  const { env } = await getCloudflareContext({ async: true })
  return createAuth(env.DB)
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
    // Update role utama di tabel user
    await db.prepare(`UPDATE "user" SET role = ?, nama_lengkap = ?, updatedAt = datetime('now') WHERE id = ?`)
      .bind(role, nama_lengkap, res.user.id).run()
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
// SET USER ROLES (multi-role)
// ============================================================
export async function setUserRoles(userId: string, roles: string[], primaryRole: string) {
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
    else if (rawJabatan.includes('resepsionis')) role = 'resepsionis'
    else if (rawJabatan.includes('ppl') || rawJabatan.includes('praktek')) role = 'guru_ppl'
    else if (rawJabatan.includes('wali kelas') || rawJabatan.includes('walas')) role = 'wali_kelas'

    users.push({ nama_lengkap, email, role })
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
      `(lower(hex(randomblob(16))), ?, ?, 1, ?, ?, datetime('now'), datetime('now'))`
    ).join(', ')
    const userValues = chunk.flatMap(u => [u.nama_lengkap, u.email, u.role, u.nama_lengkap])

    await db.prepare(
      `INSERT OR IGNORE INTO "user" (id, name, email, emailVerified, role, nama_lengkap, createdAt, updatedAt) VALUES ${userPlaceholders}`
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
export async function assignJabatanStruktural(userId: string, jabatanId: string | null) {
  const db = await getDB()
  const result = await dbUpdate(
    db, '"user"',
    { jabatan_struktural_id: jabatanId, updatedAt: new Date().toISOString() },
    { id: userId }
  )
  if (result.error) return { error: result.error }
  revalidatePath('/dashboard/guru')
  return { success: 'Jabatan struktural berhasil diperbarui.' }
}

// ============================================================
// SET DOMISILI PEGAWAI
// ============================================================
export async function setDomisiliPegawai(userId: string, domisili: string | null) {
  const db = await getDB()
  const result = await dbUpdate(
    db, '"user"',
    { domisili_pegawai: domisili, updatedAt: new Date().toISOString() },
    { id: userId }
  )
  if (result.error) return { error: result.error }
  revalidatePath('/dashboard/guru')
  return { success: 'Domisili pegawai berhasil diperbarui.' }
}

// ============================================================
// CRUD MASTER JABATAN STRUKTURAL
// ============================================================
export async function tambahJabatanStruktural(nama: string) {
  if (!nama.trim()) return { error: 'Nama jabatan wajib diisi.' }
  const db = await getDB()
  // Ambil urutan max + 1
  const max = await db.prepare('SELECT MAX(urutan) as mx FROM master_jabatan_struktural').first<any>()
  const urutan = (max?.mx || 0) + 1
  try {
    await db.prepare('INSERT INTO master_jabatan_struktural (id, nama, urutan) VALUES (lower(hex(randomblob(16))), ?, ?)')
      .bind(nama.trim(), urutan).run()
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) return { error: 'Jabatan sudah ada.' }
    return { error: e.message }
  }
  revalidatePath('/dashboard/guru')
  return { success: 'Jabatan struktural berhasil ditambahkan.' }
}

export async function hapusJabatanStruktural(id: string): Promise<{ success?: string; error?: string }> {
  const db = await getDB()
  try {
    // Set null dulu di user yang pakai jabatan ini
    await db.prepare('UPDATE "user" SET jabatan_struktural_id = NULL WHERE jabatan_struktural_id = ?').bind(id).run()
    await db.prepare('DELETE FROM master_jabatan_struktural WHERE id = ?').bind(id).run()
    revalidatePath('/dashboard/guru')
    return { success: 'Jabatan struktural berhasil dihapus.' }
  } catch (e: any) {
    return { error: e.message || 'Gagal menghapus jabatan struktural.' }
  }
}

export async function editJabatanStruktural(id: string, nama: string): Promise<{ success?: string; error?: string }> {
  if (!nama.trim()) return { error: 'Nama jabatan wajib diisi.' }
  const db = await getDB()
  try {
    await db.prepare('UPDATE master_jabatan_struktural SET nama = ? WHERE id = ?').bind(nama.trim(), id).run()
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) return { error: 'Nama jabatan sudah ada.' }
    return { error: e.message }
  }
  revalidatePath('/dashboard/guru')
  return { success: 'Jabatan struktural berhasil diperbarui.' }
}

// ============================================================
// UPLOAD FOTO PEGAWAI KE R2
// ============================================================
export async function uploadFotoPegawaiAction(userId: string, formData: FormData) {
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
  revalidatePath('/dashboard/presensi')
  return { success: 'Foto berhasil diperbarui!', url: versionedUrl }
}
