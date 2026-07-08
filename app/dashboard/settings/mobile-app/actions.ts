'use server'

import { getCurrentUser } from '@/utils/auth/server'
import { sendFcmNotification } from '@/lib/fcm'

// Kirim FCM test ke perangkat milik user yang sedang login.
export async function sendTestFcmToSelf() {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  const res = await sendFcmNotification(
    {
      title: '🔔 Test FCM',
      body: `Halo ${user.name || 'pengguna'}, notifikasi FCM berhasil sampai ke perangkat ini.`,
      url: '/dashboard/settings/mobile-app',
    },
    { userId: user.id }
  )

  if (!res.success) {
    return { error: 'Gagal mengirim FCM: ' + ((res as any).message || (res as any).error || 'unknown') }
  }
  if ((res.sent || 0) === 0) {
    return {
      error:
        'Tidak ada token FCM terdaftar untuk akun ini. Buka via APK Android & izinkan notifikasi dulu.',
    }
  }
  return { success: `Test FCM terkirim ke ${res.sent} perangkat.` }
}
