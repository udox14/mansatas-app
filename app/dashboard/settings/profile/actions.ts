// BUAT FILE BARU
// Lokasi: app/dashboard/settings/profile/actions.ts
'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateProfileInfo(prevState: any, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Anda belum login', success: null }

  const nama_lengkap = formData.get('nama_lengkap') as string
  if (!nama_lengkap) return { error: 'Nama lengkap tidak boleh kosong', success: null }

  const { error } = await supabase.from('profiles').update({ nama_lengkap }).eq('id', user.id)
  if (error) return { error: 'Gagal memperbarui profil: ' + error.message, success: null }

  revalidatePath('/', 'layout') // Revalidate seluruh app agar nama di header berubah
  return { error: null, success: 'Profil berhasil diperbarui!' }
}

export async function updatePassword(prevState: any, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Anda belum login', success: null }

  const password = formData.get('password') as string
  const confirm_password = formData.get('confirm_password') as string

  if (password.length < 6) return { error: 'Password minimal 6 karakter', success: null }
  if (password !== confirm_password) return { error: 'Konfirmasi password tidak cocok', success: null }

  // Supabase Auth memiliki fungsi bawaan untuk user merubah passwordnya sendiri
  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: 'Gagal merubah password: ' + error.message, success: null }

  return { error: null, success: 'Password berhasil diubah!' }
}

export async function uploadAvatar(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const file = formData.get('avatar') as File
  if (!file || file.size === 0) return { error: 'Tidak ada file yang dipilih' }

  const ext = file.name.split('.').pop()
  const fileName = `${user.id}/avatar_${Date.now()}.${ext}`

  // Upload ke bucket 'avatars' (upsert true agar bisa menimpa file lama jika namanya sama)
  const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file, { upsert: true })
  if (uploadError) return { error: uploadError.message }

  const { data: publicUrl } = supabase.storage.from('avatars').getPublicUrl(fileName)

  // Update url di tabel profil
  const { error: updateError } = await supabase.from('profiles').update({ avatar_url: publicUrl.publicUrl }).eq('id', user.id)
  if (updateError) return { error: updateError.message }

  revalidatePath('/', 'layout')
  return { success: 'Foto profil berhasil diperbarui!', url: publicUrl.publicUrl }
}