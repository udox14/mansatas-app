'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db-server'
import { getUserRoles } from '@/lib/features'
import { readStaffNotification, staffNotificationHref } from '@/lib/staff-notification-inbox'

export async function openStaffNotification(formData: FormData) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const db = await getDB()
  const roles = await getUserRoles(db,user.id)
  if (!roles.some(role => ['wali_kelas','super_admin','admin_tu','kepsek','wakamad'].includes(role))) redirect('/dashboard')
  const id = String(formData.get('id') || '')
  const notification = /^[a-f0-9]{32}$/.test(id) ? await readStaffNotification(db,user.id,id) : null
  revalidatePath('/dashboard/kelas-binaan')
  revalidatePath('/dashboard/kelas-binaan/notifikasi')
  redirect(notification ? staffNotificationHref(notification.url) : '/dashboard/kelas-binaan/notifikasi')
}
