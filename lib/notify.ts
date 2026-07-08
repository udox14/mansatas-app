// lib/notify.ts
// Wrapper fan-out ke dua kanal notif yang berjalan permanen berdampingan:
//   - VAPID Web Push (lib/web-push.ts)  → web / PWA / iOS
//   - FCM (lib/fcm.ts)                  → Android native (Capacitor)
// Satu device hanya punya salah satu kanal (VAPID sub ATAU FCM token), jadi tidak dobel.

import { sendPushNotification } from '@/lib/web-push'
import { sendFcmNotification, type FcmNotif, type FcmTarget } from '@/lib/fcm'

export async function notify(notification: FcmNotif, target: FcmTarget) {
  const [vapid, fcm] = await Promise.all([
    // Web Push (VAPID) hanya paham target staff: userId/userIds/role/all
    (target.userId || target.userIds || target.role || target.all)
      ? sendPushNotification(
          {
            title: notification.title,
            body: notification.body,
            url: notification.url,
            icon: (notification.data && notification.data.icon) || undefined,
          },
          {
            userId: target.userId,
            userIds: target.userIds,
            role: target.role,
            all: target.all,
          }
        ).catch((e) => ({ success: false, error: e }))
      : Promise.resolve({ success: true, sent: 0 }),
    sendFcmNotification(notification, target).catch((e) => ({ success: false, error: e })),
  ])

  const vapidSent = (vapid as any).sent || 0
  const fcmSent = (fcm as any).sent || 0
  return { success: true, vapidSent, fcmSent, sent: vapidSent + fcmSent, vapid, fcm }
}
