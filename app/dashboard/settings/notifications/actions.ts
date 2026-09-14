'use server'

import { getCurrentUser, isCurrentUserPlayReviewer } from '@/utils/auth/server'
import { PLAY_REVIEWER_WRITE_ERROR } from '@/lib/play-reviewer'
import { checkFeatureAccess } from '@/lib/features'
import { getDB } from '@/utils/db-server'
import { uploadToR2, validateImageFile } from '@/utils/r2'
import { revalidatePath } from 'next/cache'
import {
  emitConfiguredNotification,
  resetNotificationSetting,
  saveNotificationSetting,
  type NotificationContext,
} from '@/lib/notification-engine'
import { dispatchRawNotification } from '@/lib/notification-engine'
import { getNotificationDefinition, type NotificationChannel, type NotificationReminderConfig, type NotificationTargetConfig } from '@/lib/notification-catalog'

async function requireNotificationSettingsAccess() {
  if (await isCurrentUserPlayReviewer()) return { user: null, db: null, error: PLAY_REVIEWER_WRITE_ERROR }
  const user = await getCurrentUser()
  if (!user) return { user: null, db: null, error: 'Unauthorized' }
  const db = await getDB()
  const allowed = await checkFeatureAccess(db, user.id, 'settings-notifications')
  if (!allowed) return { user: null, db: null, error: 'Anda tidak memiliki hak akses pengaturan notifikasi.' }
  return { user, db, error: null }
}

export async function saveAutomaticNotificationSetting(input: {
  eventKey: string
  enabled: boolean
  titleTemplate: string
  bodyTemplate: string
  urlTemplate: string
  channels: NotificationChannel[]
  target: NotificationTargetConfig
  reminder: NotificationReminderConfig
  level: string
}) {
  const access = await requireNotificationSettingsAccess()
  if (!access.user || !access.db) return { error: access.error || 'Unauthorized' }

  const result = await saveNotificationSetting(input.eventKey, {
    ...input,
    updatedBy: access.user.id,
  }, access.db)
  if (result.success) revalidatePath('/dashboard/settings/notifications')
  return result
}

export async function resetAutomaticNotificationSetting(eventKey: string) {
  const access = await requireNotificationSettingsAccess()
  if (!access.user || !access.db) return { error: access.error || 'Unauthorized' }
  const result = await resetNotificationSetting(eventKey, access.user.id, access.db)
  if (result.success) revalidatePath('/dashboard/settings/notifications')
  return result
}

export async function sendAutomaticNotificationTest(eventKey: string) {
  const access = await requireNotificationSettingsAccess()
  if (!access.user || !access.db) return { error: access.error || 'Unauthorized' }
  const definition = getNotificationDefinition(eventKey)
  if (!definition) return { error: 'Event notifikasi tidak dikenal.' }

  const context: NotificationContext = {
    nama_siswa: 'Contoh Siswa',
    kelas: 'XII IPA 1',
    tanggal: new Date().toLocaleDateString('id-ID'),
    alasan: 'Contoh alasan',
    catatan: 'Contoh catatan',
    nominal: 'Rp1.000.000',
    nomor_kuitansi: 'TEST-0001',
    judul: 'Contoh judul',
    isi_pengumuman: 'Contoh isi pengumuman',
    nama_guru: access.user.name || 'Contoh Guru',
    waktu: '08.00',
    tempat: 'Ruang Rapat',
    agenda: 'Contoh agenda',
    nama_pelanggaran: 'Contoh pelanggaran',
    level_sanksi: 'Teguran',
    nomor_surat: 'TEST/SP/0001',
    judul_pengajuan: 'Contoh pengajuan Komite',
    nama_pengaju: access.user.name || 'Contoh Pengaju',
    nama_reviewer: 'Contoh Reviewer',
    tahap: 'Bendahara Komite',
    nomor_spb: 'SPB / 001 / KOMITE / IX / 2026',
    url: definition.defaultUrl,
    userId: access.user.id,
    userIds: [access.user.id],
  }

  const result = await emitConfiguredNotification({
    eventKey,
    sourceRef: `notification-test:${eventKey}:${access.user.id}:${Math.floor(Date.now() / 60000)}`,
    context,
    targetOverride: { kind: 'staff_users', ids: [access.user.id] },
    db: access.db,
    parentType: 'notification_test',
  })
  if (result.status === 'failed') return { error: result.error || 'Pengiriman tes gagal.' }
  if (result.status === 'disabled') return { error: 'Event masih nonaktif. Aktifkan dahulu untuk mengirim tes.' }
  if (result.status === 'skipped' || (result.sent === 0 && result.queued === 0)) {
    return { error: 'Tidak ada perangkat aktif untuk akun Anda. Buka aplikasi/portal, izinkan notifikasi, lalu coba lagi.' }
  }
  return {
    success: result.status === 'queued'
      ? 'Notifikasi tes masuk antrean pengiriman.'
      : `Notifikasi tes terkirim ke ${result.sent} channel/perangkat.`,
  }
}

export async function sendCustomNotification(
  prevState: any,
  formData: FormData
) {
  if (await isCurrentUserPlayReviewer()) return { error: PLAY_REVIEWER_WRITE_ERROR }
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  const db = await getDB()
  const allowed = await checkFeatureAccess(db, user.id, 'settings-notifications')
  
  if (!allowed) {
    return { error: 'Anda tidak memiliki hak akses untuk mengirim notifikasi broadcast.' }
  }

  const title = formData.get('title') as string
  const body = formData.get('body') as string
  const url = (formData.get('url') as string) || '/dashboard'
  const targetType = formData.get('targetType') as string
  const targetRole = formData.get('targetRole') as string
  const targetUserIdsRaw = formData.get('targetUserIds') as string

  if (!title || !body) {
    return { error: 'Judul dan Konten tidak boleh kosong.' }
  }

  let target: any = {}
  let targetContext: NotificationContext = {}
  if (targetType === 'all') {
    target = { kind: 'staff_all' }
  } else if (targetType === 'role') {
    if (!targetRole) return { error: 'Pilih role penerima.' }
    target = { kind: 'staff_role', value: targetRole }
  } else if (targetType === 'custom') {
    let userIds: string[] = []
    try { userIds = JSON.parse(targetUserIdsRaw || '[]') } catch {}
    if (userIds.length === 0) return { error: 'Pilih minimal 1 penerima.' }
    target = { kind: 'staff_users' }
    targetContext = { userIds }
  } else {
    return { error: 'Target tidak valid.' }
  }

  try {
    const result = await dispatchRawNotification({
      eventKey: 'manual_targeted_broadcast',
      sourceRef: `manual-targeted:${crypto.randomUUID()}`,
      title,
      body,
      url,
      channels: ['fcm', 'webpush'],
      target,
      context: targetContext,
      db,
    })
    if (result.status === 'failed') return { error: result.error || 'Terjadi kesalahan saat mengirim.' }
    return { success: result.status === 'queued' ? `Notifikasi masuk Queue (${result.queued} batch).` : `Notifikasi berhasil dikirim ke ${result.sent} perangkat.` }
  } catch (error: any) {
    return { error: error.message }
  }
}

// ============================================================
// BROADCAST KE SEMUA (pegawai + orang tua) — teks + link + gambar.
// Fan-out besar dipotong menjadi batch Queue; orang tua tetap mendapat fallback in-app.
// ============================================================
export async function sendBroadcast(prevState: any, formData: FormData) {
  if (await isCurrentUserPlayReviewer()) return { error: PLAY_REVIEWER_WRITE_ERROR }
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  const db = await getDB()
  const allowed = await checkFeatureAccess(db, user.id, 'settings-notifications')
  if (!allowed) {
    return { error: 'Anda tidak memiliki hak akses untuk mengirim broadcast.' }
  }

  const title = (formData.get('title') as string)?.trim()
  const body = (formData.get('body') as string)?.trim()
  const url = ((formData.get('url') as string) || '/dashboard').trim()
  const audience = (formData.get('audience') as string) || 'all' // all | staff | parents
  const imageFile = formData.get('image') as File | null

  if (!title || !body) {
    return { error: 'Judul dan Isi pesan tidak boleh kosong.' }
  }

  // Upload gambar (opsional) → butuh URL absolut untuk FCM notification.image
  let imageUrl: string | undefined
  if (imageFile && imageFile.size > 0) {
    const invalid = validateImageFile(imageFile)
    if (invalid) return { error: invalid }
    const up = await uploadToR2(imageFile, 'broadcast')
    if (up.error || !up.url) return { error: 'Gagal upload gambar: ' + (up.error || 'unknown') }
    const base = process.env.BETTER_AUTH_URL || ''
    imageUrl = up.url.startsWith('http') ? up.url : `${base}${up.url}`
  }

  const broadcastId = crypto.randomUUID()
  let staffSent = 0
  let parentSent = 0
  let queuedBatches = 0

  // 1) Pegawai (VAPID + FCM), target besar otomatis masuk Queue.
  if (audience === 'all' || audience === 'staff') {
    try {
      const res = await dispatchRawNotification({
        eventKey: 'manual_broadcast',
        sourceRef: `${broadcastId}:staff`,
        title,
        body,
        url,
        image: imageUrl,
        channels: ['fcm', 'webpush'],
        target: { kind: 'staff_all' },
        db,
      })
      staffSent = res.sent || 0
      queuedBatches += res.queued || 0
    } catch (e) {
      console.error('Broadcast staff gagal:', e)
    }
  }

  // 2) Orang tua (FCM + in-app fallback), target besar otomatis masuk Queue.
  if (audience === 'all' || audience === 'parents') {
    try {
      const res = await dispatchRawNotification({
        eventKey: 'manual_broadcast',
        sourceRef: `${broadcastId}:parents`,
        title,
        body,
        url,
        image: imageUrl,
        channels: ['fcm', 'in_app'],
        target: { kind: 'parents_all' },
        db,
        parentType: 'broadcast',
      })
      parentSent = res.sent || 0
      queuedBatches += res.queued || 0
    } catch (e) {
      console.error('Broadcast ortu (FCM) gagal:', e)
    }
  }

  return {
    success: queuedBatches > 0
      ? `Broadcast masuk Queue — ${queuedBatches} batch. Pegawai: ${staffSent} perangkat, orang tua: ${parentSent} perangkat.`
      : `Broadcast terkirim — pegawai: ${staffSent} perangkat, orang tua: ${parentSent} perangkat.`,
  }
}
