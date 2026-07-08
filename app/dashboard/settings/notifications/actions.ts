'use server'

import { getCurrentUser } from '@/utils/auth/server'
import { sendPushNotification } from '@/lib/web-push'
import { sendFcmNotification } from '@/lib/fcm'
import { notify } from '@/lib/notify'
import { checkFeatureAccess } from '@/lib/features'
import { getDB } from '@/utils/db'
import { uploadToR2, validateImageFile } from '@/utils/r2'

export async function sendCustomNotification(
  prevState: any,
  formData: FormData
) {
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
  if (targetType === 'all') {
    target.all = true
  } else if (targetType === 'role') {
    if (!targetRole) return { error: 'Pilih role penerima.' }
    target.role = targetRole
  } else if (targetType === 'custom') {
    let userIds: string[] = []
    try { userIds = JSON.parse(targetUserIdsRaw || '[]') } catch {}
    if (userIds.length === 0) return { error: 'Pilih minimal 1 penerima.' }
    target.userIds = userIds
  } else {
    return { error: 'Target tidak valid.' }
  }

  try {
    const act = await sendPushNotification({ title, body, url }, target)
    if (act.success) {
      return { success: `Notifikasi berhasil dikirim ke ${act.sent} perangkat.` }
    } else {
      return { error: 'Terjadi kesalahan saat mengirim: ' + (act as any).message }
    }
  } catch (error: any) {
    return { error: error.message }
  }
}

// ============================================================
// BROADCAST KE SEMUA (pegawai + orang tua) — teks + link + gambar
// Staff via notify (VAPID+FCM), ortu via FCM + tulis in-app parent_notifications
// ============================================================
export async function sendBroadcast(prevState: any, formData: FormData) {
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
  const notif = { title, body, url, image: imageUrl }
  let staffSent = 0
  let parentSent = 0

  // 1) Pegawai (VAPID + FCM)
  if (audience === 'all' || audience === 'staff') {
    try {
      const res = await notify(notif, { all: true })
      staffSent = res.sent || 0
    } catch (e) {
      console.error('Broadcast staff gagal:', e)
    }
  }

  // 2) Orang tua (FCM) + in-app parent_notifications
  if (audience === 'all' || audience === 'parents') {
    try {
      const res = await sendFcmNotification(notif, { allParents: true })
      parentSent = (res as any).sent || 0
    } catch (e) {
      console.error('Broadcast ortu (FCM) gagal:', e)
    }

    // Tulis in-app ke semua siswa aktif agar muncul di portal ortu walau push kelewat
    try {
      const siswa = await db
        .prepare(`SELECT id FROM siswa WHERE status = 'aktif'`)
        .all<{ id: string }>()
      const rows = siswa.results || []
      const stmts = rows.map((s) =>
        db
          .prepare(
            `INSERT OR IGNORE INTO parent_notifications (siswa_id, type, title, message, source_ref, level)
             VALUES (?, 'broadcast', ?, ?, ?, 'info')`
          )
          .bind(s.id, title, body, broadcastId)
      )
      for (let i = 0; i < stmts.length; i += 100) await db.batch(stmts.slice(i, i + 100))
    } catch (e) {
      console.error('Broadcast tulis parent_notifications gagal:', e)
    }
  }

  return {
    success: `Broadcast terkirim — pegawai: ${staffSent} perangkat, orang tua: ${parentSent} perangkat.`,
  }
}
