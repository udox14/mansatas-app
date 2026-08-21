// Legacy-compatible wrapper untuk jalur notifikasi lama.
// Semua pengiriman tetap melewati notification engine agar deduplikasi,
// batching, Queue, dan fallback in-app berlaku konsisten.

import { dispatchRawNotification, type NotificationContext } from '@/lib/notification-engine'
import type { FcmNotif, FcmTarget } from '@/lib/fcm'
import type { NotificationTargetConfig } from '@/lib/notification-catalog'

type LegacyNotifyOptions = {
  eventKey?: string
  sourceRef?: string
}

function convertTarget(target: FcmTarget): { config: NotificationTargetConfig; context: NotificationContext; parent: boolean } | null {
  if (target.userId) {
    return { config: { kind: 'staff_users' }, context: { userId: target.userId, userIds: [target.userId] }, parent: false }
  }
  if (target.userIds?.length) {
    return { config: { kind: 'staff_users' }, context: { userIds: target.userIds }, parent: false }
  }
  if (target.role) {
    return { config: { kind: 'staff_role', value: target.role }, context: {}, parent: false }
  }
  if (target.all) {
    return { config: { kind: 'staff_all' }, context: {}, parent: false }
  }
  if (target.siswaId) {
    return { config: { kind: 'parent_student' }, context: { siswaId: target.siswaId }, parent: true }
  }
  if (target.siswaIds?.length) {
    return { config: { kind: 'parent_students' }, context: { siswaIds: target.siswaIds }, parent: true }
  }
  if (target.allParents) {
    return { config: { kind: 'parents_all' }, context: {}, parent: true }
  }
  return null
}

export async function notify(notification: FcmNotif, target: FcmTarget, options: LegacyNotifyOptions = {}) {
  const converted = convertTarget(target)
  if (!converted) return { success: false, sent: 0, error: 'Target notifikasi tidak valid.' }

  const result = await dispatchRawNotification({
    eventKey: options.eventKey || 'legacy_notify',
    sourceRef: options.sourceRef || `legacy-notify:${crypto.randomUUID()}`,
    title: notification.title,
    body: notification.body,
    url: notification.url || '/dashboard',
    image: notification.image,
    channels: converted.parent ? ['fcm', 'in_app'] : ['fcm', 'webpush'],
    target: converted.config,
    context: converted.context,
    parentType: 'legacy',
  })

  return {
    success: result.status !== 'failed',
    sent: result.sent,
    queued: result.queued,
    status: result.status,
    error: result.error,
  }
}
