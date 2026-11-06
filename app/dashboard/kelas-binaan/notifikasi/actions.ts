'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db-server'
import { getUserRoles } from '@/lib/features'
import { ATTENDANCE_CORRECTION_INBOX, readStaffNotification, staffNotificationHref } from '@/lib/staff-notification-inbox'
import { getAttendanceCorrectionReviewer } from '@/lib/attendance-correction-reviewer'

export async function openStaffNotification(formData: FormData) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const db = await getDB()
  const corrections = formData.get('scope') === 'koreksi'
  const allowed = corrections ? await getAttendanceCorrectionReviewer(db, user.id) :
    (await getUserRoles(db, user.id)).some(role => ['wali_kelas','super_admin','admin_tu','kepsek','wakamad'].includes(role))
  if (!allowed) redirect('/dashboard')
  const id = String(formData.get('id') || '')
  const notification = /^[a-f0-9]{32}$/.test(id) ? await readStaffNotification(db,user.id,id,corrections) : null
  revalidatePath('/dashboard/kelas-binaan')
  revalidatePath('/dashboard/kelas-binaan/notifikasi')
  if (corrections) revalidatePath('/dashboard/keterangan-absensi')
  redirect(notification ? staffNotificationHref(notification.url) :
    corrections ? ATTENDANCE_CORRECTION_INBOX : '/dashboard/kelas-binaan/notifikasi')
}
