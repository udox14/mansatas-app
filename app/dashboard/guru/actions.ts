// Lokasi: app/dashboard/guru/actions.ts
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

// Helper: buat user langsung via sign-up lalu set role
async function createUserDirect(nama_lengkap: string, email: string, password: string, role: string) {
  const auth = await getAuth()

  // Signup dulu (tanpa role)
  const signUpRes = await auth.api.signUpEmail({
    body: { name: nama_lengkap, email, password },
  }) as any

  if (!signUpRes?.user?.id) throw new Error('Gagal membuat akun.')

  // Set role langsung ke DB
  const db = await getDB()
  await db.prepare(`UPDATE "user" SET role = ?, nama_lengkap = ?, updatedAt = ? WHERE id = ?`)
    .bind(role, nama_lengkap, new Date().toISOString(), signUpRes.user.id)
    .run()

  return signUpRes.user
}

// ============================================================
// TAMBAH PEGAWAI
// ============================================================
export async function tambahPegawai(prevState: any, formData: FormData) {
  const nama_lengkap = (formData.get('nama_lengkap') as string).trim()
  const email = (formData.get('email') as string).trim()
  const role = formData.get('role') as string
  const password = 'mansatas2026'

  if (!nama_lengkap || !email || !role) {
    return { error: 'Semua field wajib diisi.', success: null }
  }

  try {
    await createUserDirect(nama_lengkap, email, password, role)
  } catch (e: any) {
    const msg = e?.message || ''
    return { error: msg.includes('already') || msg.includes('exists') ? 'Email sudah terdaftar!' : msg, success: null }
  }

  revalidatePath('/dashboard/guru')
  return { error: null, success: `Akun berhasil dibuat! Password default: ${password}` }
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
// RESET PASSWORD PEGAWAI
// ============================================================
export async function resetPasswordPegawai(id: string) {
  const auth = await getAuth()
  try {
    await (auth.api as any).setUserData({
      body: { userId: id, password: 'mansatas2026' },
      headers: await headers(),
    })
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
    // Hapus session & account dulu, baru user
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
// IMPORT MASSAL PEGAWAI
// ============================================================
export async function importPegawaiMassal(dataExcel: any[]) {
  const auth = await getAuth()
  let successCount = 0
  const errorLogs: string[] = []

  for (let i = 0; i < dataExcel.length; i++) {
    const row = dataExcel[i]
    const nama_lengkap = String(row.NAMA_LENGKAP || '').trim()
    const email = String(row.EMAIL || '').trim().toLowerCase()
    const rawJabatan = String(row.JABATAN || 'guru').toLowerCase().trim()
    const password = 'mansatas2026'

    if (!nama_lengkap || !email) continue

    let role = 'guru'
    if (rawJabatan.includes('bk')) role = 'guru_bk'
    else if (rawJabatan.includes('piket')) role = 'guru_piket'
    else if (rawJabatan.includes('waka') || rawJabatan.includes('wakil')) role = 'wakamad'
    else if (rawJabatan.includes('kepala')) role = 'kepsek'
    else if (rawJabatan.includes('tu') || rawJabatan.includes('tata')) role = 'admin_tu'
    else if (rawJabatan.includes('satpam')) role = 'satpam'
    else if (rawJabatan.includes('pramu') || rawJabatan.includes('bersih')) role = 'pramubakti'

    try {
      await createUserDirect(nama_lengkap, email, password, role)
      successCount++
    } catch (e: any) {
      const msg = e?.message || ''
      errorLogs.push(`Baris ${i + 2} (${nama_lengkap}): ${msg.includes('already') || msg.includes('exists') ? 'Email sudah terdaftar' : msg}`)
    }
  }

  revalidatePath('/dashboard/guru')
  return {
    success: `Berhasil mengimport dan membuat ${successCount} akun pegawai baru.`,
    logs: errorLogs,
  }
}