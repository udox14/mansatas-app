// app/dashboard/settings/profile/actions.ts
'use server'

import { getDB, dbUpdate } from '@/utils/db'
import { uploadAvatar, uploadSignature, validateImageFile } from '@/utils/r2'
import { createAuth } from '@/utils/auth'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { getCurrentUser } from '@/utils/auth/server'
import { revalidatePath } from 'next/cache'

async function getAuth() {
  const { env } = await getCloudflareContext({ async: true })
  return createAuth(env.DB)
}

// ============================================================
// UPDATE NAMA PROFIL
// ============================================================
export async function updateProfileInfo(prevState: any, formData: FormData) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Anda belum login', success: null }

  const nama_lengkap = (formData.get('nama_lengkap') as string)?.trim()
  const nip = (formData.get('nip') as string)?.trim() || null
  const pangkat_golongan = (formData.get('pangkat_golongan') as string)?.trim() || null
  const jabatan_cetak = (formData.get('jabatan_cetak') as string)?.trim() || null
  const nomor_whatsapp = (formData.get('nomor_whatsapp') as string)?.trim() || null
  if (!nama_lengkap) return { error: 'Nama lengkap tidak boleh kosong', success: null }

  const db = await getDB()
  const result = await dbUpdate(
    db,
    '"user"',
    { nama_lengkap, name: nama_lengkap, nip, pangkat_golongan, jabatan_cetak, nomor_whatsapp, updatedAt: new Date().toISOString() },
    { id: user.id }
  )

  if (result.error) return { error: 'Gagal memperbarui profil: ' + result.error, success: null }

  revalidatePath('/', 'layout')
  return { error: null, success: 'Profil berhasil diperbarui!' }
}

// ============================================================
// GANTI PASSWORD
// ============================================================
export async function updatePassword(prevState: any, formData: FormData) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Anda belum login', success: null }

  const password = formData.get('password') as string
  const confirm_password = formData.get('confirm_password') as string

  if (password.length < 6) return { error: 'Password minimal 6 karakter', success: null }
  if (password !== confirm_password)
    return { error: 'Konfirmasi password tidak cocok', success: null }

  const auth = await getAuth()

  try {
    await auth.api.changePassword({ userId: user.id, newPassword: password })
  } catch (e: any) {
    return { error: 'Gagal merubah password: ' + (e?.message || ''), success: null }
  }

  return { error: null, success: 'Password berhasil diubah!' }
}

// ============================================================
// UPLOAD AVATAR KE R2
// ============================================================
export async function uploadAvatarAction(formData: FormData) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  const file = formData.get('avatar') as File
  if (!file || file.size === 0) return { error: 'Tidak ada file yang dipilih' }

  const validationError = validateImageFile(file)
  if (validationError) return { error: validationError }

  const { url, error: uploadError } = await uploadAvatar(user.id, file)
  if (uploadError || !url) return { error: uploadError || 'Upload gagal' }

  const db = await getDB()
  const result = await dbUpdate(
    db,
    '"user"',
    { avatar_url: url, updatedAt: new Date().toISOString() },
    { id: user.id }
  )
  if (result.error) return { error: result.error }

  revalidatePath('/', 'layout')
  return { success: 'Foto profil berhasil diperbarui!', url }
}

// ============================================================
// UPLOAD TANDA TANGAN KE R2
// ============================================================
export async function uploadSignatureAction(formData: FormData) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  const file = formData.get('signature') as File
  if (!file || file.size === 0) return { error: 'Tidak ada file yang dipilih' }

  const validationError = validateImageFile(file)
  if (validationError) return { error: validationError }

  const { url, error: uploadError } = await uploadSignature(user.id, file)
  if (uploadError || !url) return { error: uploadError || 'Upload gagal' }

  const db = await getDB()
  const result = await dbUpdate(
    db,
    '"user"',
    { signature_url: url, updatedAt: new Date().toISOString() },
    { id: user.id }
  )
  if (result.error) return { error: result.error }

  revalidatePath('/dashboard/settings/profile')
  revalidatePath('/dashboard/ckh-generator')
  return { success: 'Tanda tangan berhasil diperbarui!', url }
}

// ============================================================
// SIMPAN KONFIGURASI BOTTOM NAV
// ============================================================
export async function saveBottomNavOverride(features: string[]) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Anda belum login' }

  if (features.length > 4) {
    return { error: 'Maksimal 4 fitur' }
  }

  const db = await getDB()
  const result = await dbUpdate(
    db,
    '"user"',
    { bottom_nav_override: JSON.stringify(features), updatedAt: new Date().toISOString() },
    { id: user.id }
  )

  if (result.error) return { error: 'Gagal menyimpan konfigurasi: ' + result.error }

  revalidatePath('/', 'layout')
  return { success: 'Konfigurasi Bottom Nav berhasil disimpan.' }
}
