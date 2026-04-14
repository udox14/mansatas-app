// lib/act-as-actions.ts
'use server'

import { cookies } from 'next/headers'
import { getCurrentUser } from '@/utils/auth/server'
import { isSuperAdmin, ACT_AS_COOKIE, ACT_AS_DATE_COOKIE } from '@/lib/act-as'
import { revalidatePath } from 'next/cache'

/**
 * Set act-as cookie (super admin pilih guru target)
 */
export async function setActAsUser(targetUserId: string): Promise<{ error?: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  const isAdmin = await isSuperAdmin(user.id)
  if (!isAdmin) return { error: 'Hanya super admin yang bisa menggunakan fitur ini.' }

  const cookieStore = await cookies()
  cookieStore.set(ACT_AS_COOKIE, targetUserId, {
    path: '/',
    maxAge: 60 * 60 * 8, // 8 jam
    httpOnly: true,
    sameSite: 'lax',
  })

  revalidatePath('/dashboard/kehadiran')
  revalidatePath('/dashboard/agenda')

  return {}
}

/**
 * Clear act-as cookie (kembali ke akun sendiri)
 */
export async function clearActAs(): Promise<{ error?: string }> {
  const cookieStore = await cookies()
  cookieStore.delete(ACT_AS_COOKIE)
  cookieStore.delete(ACT_AS_DATE_COOKIE) // clear date juga

  revalidatePath('/dashboard/kehadiran')
  revalidatePath('/dashboard/agenda')

  return {}
}

/**
 * Set tanggal untuk fitur Act As (admin memilih tanggal)
 */
export async function setActAsDate(tanggal: string): Promise<{ error?: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  const isAdmin = await isSuperAdmin(user.id)
  if (!isAdmin) return { error: 'Hanya super admin yang bisa menggunakan fitur ini.' }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) return { error: 'Format tanggal tidak valid.' }

  const cookieStore = await cookies()
  cookieStore.set(ACT_AS_DATE_COOKIE, tanggal, {
    path: '/',
    maxAge: 60 * 60 * 8, // 8 jam
    httpOnly: true,
    sameSite: 'lax',
  })

  revalidatePath('/dashboard/kehadiran')
  revalidatePath('/dashboard/agenda')

  return {}
}

/**
 * Clear tanggal override (kembali ke hari ini)
 */
export async function clearActAsDate(): Promise<{ error?: string }> {
  const cookieStore = await cookies()
  cookieStore.delete(ACT_AS_DATE_COOKIE)

  revalidatePath('/dashboard/kehadiran')
  revalidatePath('/dashboard/agenda')

  return {}
}
