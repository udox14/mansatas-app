'use server'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function tambahPegawai(prevState: any, formData: FormData) {
  const supabaseAdmin = createAdminClient()
  
  const nama_lengkap = (formData.get('nama_lengkap') as string).trim()
  const email = (formData.get('email') as string).trim()
  const role = formData.get('role') as string
  const password = 'mansatas2026' 

  if (!nama_lengkap || !email || !role) return { error: 'Semua field wajib diisi.', success: null }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nama_lengkap, role }
  })

  if (error) return { error: error.message.includes('already registered') ? 'Email sudah terdaftar!' : error.message, success: null }

  revalidatePath('/dashboard/guru')
  return { error: null, success: `Akun berhasil dibuat! Password default: ${password}` }
}

export async function editPegawai(id: string, nama_lengkap: string, email: string) {
  const supabaseAdmin = createAdminClient()
  const supabase = createClient()

  // Update email di sistem Autentikasi Supabase
  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, { 
    email, 
    user_metadata: { nama_lengkap } 
  })
  if (authError) return { error: authError.message.includes('already registered') ? 'Email tersebut sudah dipakai orang lain!' : authError.message }

  // Update nama di tabel Profiles
  const { error: dbError } = await supabase.from('profiles').update({ nama_lengkap }).eq('id', id)
  if (dbError) return { error: dbError.message }

  revalidatePath('/dashboard/guru')
  return { success: 'Data pegawai berhasil diperbarui.' }
}

export async function resetPasswordPegawai(id: string) {
  const supabaseAdmin = createAdminClient()
  const { error } = await supabaseAdmin.auth.admin.updateUserById(id, { password: 'mansatas2026' })
  
  if (error) return { error: 'Gagal mereset password: ' + error.message }
  return { success: 'Password berhasil direset ke: mansatas2026' }
}

export async function ubahRolePegawai(id: string, newRole: string) {
  const supabaseAdmin = createAdminClient()
  const supabase = createClient()
  
  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, { user_metadata: { role: newRole } })
  if (authError) return { error: authError.message }
  
  const { error: dbError } = await supabase.from('profiles').update({ role: newRole }).eq('id', id)
  if (dbError) return { error: dbError.message }
  
  revalidatePath('/dashboard/guru')
  return { success: 'Jabatan/Role berhasil diperbarui.' }
}

export async function hapusPegawai(id: string) {
  const supabaseAdmin = createAdminClient()
  const { error } = await supabaseAdmin.auth.admin.deleteUser(id)
  if (error) return { error: 'Gagal menghapus akun: ' + error.message }
  
  revalidatePath('/dashboard/guru')
  return { success: 'Akun pegawai berhasil dihapus permanen.' }
}

// FUNGSI BARU: Import Massal dari Excel
export async function importPegawaiMassal(dataExcel: any[]) {
  const supabaseAdmin = createAdminClient()
  let successCount = 0
  let errorLogs: string[] = []

  for (let i = 0; i < dataExcel.length; i++) {
    const row = dataExcel[i]
    const nama_lengkap = String(row.NAMA_LENGKAP || '').trim()
    const email = String(row.EMAIL || '').trim().toLowerCase()
    const rawJabatan = String(row.JABATAN || 'guru').toLowerCase().trim()
    const password = 'mansatas2026'

    if (!nama_lengkap || !email) continue

    // Normalisasi role agar sesuai dengan enum di database
    let role = 'guru'
    if (rawJabatan.includes('bk')) role = 'guru_bk'
    else if (rawJabatan.includes('piket')) role = 'guru_piket'
    else if (rawJabatan.includes('waka') || rawJabatan.includes('wakil')) role = 'wakamad'
    else if (rawJabatan.includes('kepala')) role = 'kepsek'
    else if (rawJabatan.includes('tu') || rawJabatan.includes('tata')) role = 'admin_tu'
    else if (rawJabatan.includes('satpam')) role = 'satpam'
    else if (rawJabatan.includes('pramu') || rawJabatan.includes('bersih')) role = 'pramubakti'

    const { error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nama_lengkap, role }
    })

    if (error) {
      errorLogs.push(`Baris ${i+2} (${nama_lengkap}): ${error.message.includes('already registered') ? 'Email sudah terdaftar' : error.message}`)
    } else {
      successCount++
    }
  }

  revalidatePath('/dashboard/guru')
  return { success: `Berhasil mengimport dan membuat ${successCount} akun pegawai baru.`, logs: errorLogs }
}