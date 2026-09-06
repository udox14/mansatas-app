'use server'

import { getCurrentUser, isCurrentUserPlayReviewer } from '@/utils/auth/server'
import { PLAY_REVIEWER_WRITE_ERROR } from '@/lib/play-reviewer'
import { sendFcmNotification } from '@/lib/fcm'
import { requireActionAccess } from '@/lib/action-security'
import { getSystemSettingBoolean, setSystemSetting, SYSTEM_SETTING_KEYS } from '@/lib/system-settings'
import { getDB } from '@/utils/db-server'
import { logActivity } from '@/lib/activity-log'
import { revalidatePath } from 'next/cache'

export async function setAndroidPlayStoreRequired(enabled: boolean) {
  if (await isCurrentUserPlayReviewer()) return { error: PLAY_REVIEWER_WRITE_ERROR }

  const actor = await requireActionAccess('settings-mobile-app', 'update', {
    allowedRoles: ['super_admin'],
  })
  if (actor.kind !== 'staff') return { error: 'Unauthorized' }

  const db = await getDB()
  const previousValue = await getSystemSettingBoolean(SYSTEM_SETTING_KEYS.androidPlayStoreRequired, false)
  await setSystemSetting(SYSTEM_SETTING_KEYS.androidPlayStoreRequired, enabled ? '1' : '0')
  await logActivity({
    db,
    module: 'pengaturan',
    action: 'set_android_play_store_required',
    severity: enabled ? 'warning' : 'info',
    summary: `${enabled ? 'Mengaktifkan' : 'Menonaktifkan'} kewajiban aplikasi Google Play untuk browser Android`,
    entityType: 'system_setting',
    entityId: SYSTEM_SETTING_KEYS.androidPlayStoreRequired,
    before: { enabled: previousValue },
    after: { enabled },
  })

  revalidatePath('/', 'layout')
  revalidatePath('/dashboard/settings/mobile-app')
  return {
    success: enabled
      ? 'Browser Android sekarang wajib berpindah ke aplikasi Google Play.'
      : 'Browser Android dapat mengakses versi web kembali.',
  }
}

// Kirim FCM test ke perangkat milik user yang sedang login.
export async function sendTestFcmToSelf() {
  if (await isCurrentUserPlayReviewer()) return { error: PLAY_REVIEWER_WRITE_ERROR }
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
