// Lokasi: app/dashboard/settings/profile/actions.ts
'use server'

import { getDB, dbUpdate } from '@/utils/db'
import { uploadAvatar, validateImageFile } from '@/utils/r2'
import { createAuth } from '@/utils/auth'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { getCurrentUser } from '@/utils/auth/server'
import { headers } from 'next/headers'
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
  if (!nama_lengkap) return { error: 'Nama lengkap tidak boleh kosong', success: null }

  const db = await getDB()
  const result = await dbUpdate(
    db,
    '"user"',
    { nama_lengkap, name: nama_lengkap, updatedAt: new Date().toISOString() },
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
    await (auth.api as any).setUserData({
      body: { userId: user.id, password },
      headers: await headers(),
    })
  } catch (e: any) {
    return { error: 'Gagal merubah password: ' + (e?.message || ''), success: null }
  }

  return { error: null, success: 'Password berhasil diubah!' }
}

// ============================================================
// UPLOAD AVATAR KE R2
// Avatar pakai nama tetap per user → otomatis overwrite, tidak ada file orphan
// ============================================================
export async function uploadAvatarAction(formData: FormData) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  const file = formData.get('avatar') as File
  if (!file || file.size === 0) return { error: 'Tidak ada file yang dipilih' }

  // Validasi ukuran dan format sebelum upload ke R2
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
