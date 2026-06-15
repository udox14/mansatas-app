'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { checkFeatureAccess } from '@/lib/features'
import { getSystemSetting, setSystemSetting } from '@/lib/system-settings'
import { WA_FEATURE_ID, createWhatsAppCampaign, ensureWhatsAppTables, processWhatsAppOutbox, type WaTargetScope } from '@/lib/whatsapp'

async function guard() {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized', user: null, db: null as any }
  const db = await getDB()
  const allowed = await checkFeatureAccess(db, user.id, WA_FEATURE_ID)
  if (!allowed) return { error: 'Akses ditolak.', user: null, db: null as any }
  await ensureWhatsAppTables(db)
  return { error: null, user, db }
}

function parseScope(value: FormDataEntryValue | null): WaTargetScope {
  const scope = String(value || 'all')
  return ['all', 'kelas', 'tingkat', 'siswa'].includes(scope) ? scope as WaTargetScope : 'all'
}

export async function createWhatsappCampaignAction(formData: FormData) {
  const { error, user, db } = await guard()
  if (error || !user) return

  const title = String(formData.get('title') || '').trim()
  const bodyText = String(formData.get('body_text') || '').trim()
  const purpose = String(formData.get('purpose') || 'school_announcement').trim()
  const category = String(formData.get('category') || 'utility').trim()
  const templateName = String(formData.get('template_name') || '').trim() || null
  const languageCode = String(formData.get('language_code') || 'id').trim() || 'id'
  const targetScope = parseScope(formData.get('target_scope'))
  const kelasId = String(formData.get('kelas_id') || '').trim() || null
  const tingkatRaw = String(formData.get('tingkat') || '').trim()
  const tingkat = tingkatRaw ? Number.parseInt(tingkatRaw, 10) : null
  const siswaIds = String(formData.get('siswa_ids') || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)

  if (!title || !bodyText) return
  if (targetScope === 'kelas' && !kelasId) return
  if (targetScope === 'tingkat' && !tingkat) return
  if (targetScope === 'siswa' && siswaIds.length === 0) return

  const result = await createWhatsAppCampaign(db, {
    title,
    bodyText,
    purpose,
    category,
    templateName,
    languageCode,
    targetScope,
    kelasId,
    tingkat,
    siswaIds,
    createdBy: user.id,
  })

  revalidatePath('/dashboard/whatsapp')
  redirect(`/dashboard/whatsapp?campaign=${result.campaignId}`)
}

export async function processWhatsappOutboxAction() {
  const { error, db } = await guard()
  if (error) return
  await processWhatsAppOutbox(db, 25)
  revalidatePath('/dashboard/whatsapp')
}

export async function saveWhatsappSettingsAction(prevState: any, formData: FormData) {
  const { error } = await guard()
  if (error) return { error }

  const password = String(formData.get('password') || '').trim()
  const targetPassword = await getSystemSetting('whatsapp_settings_password', 'admin123')
  if (password !== targetPassword) {
    return { error: 'Password salah!' }
  }

  const provider = String(formData.get('provider') || 'wablas').trim()
  const phoneNumberId = String(formData.get('phone_number_id') || '').trim()
  const kirimdevApiKey = String(formData.get('kirimdev_api_key') || '').trim()
  const kirimdevWebhookSecret = String(formData.get('kirimdev_webhook_secret') || '').trim()

  await setSystemSetting('whatsapp_provider', provider)
  await setSystemSetting('whatsapp_phone_number_id', phoneNumberId)
  await setSystemSetting('kirimdev_api_key', kirimdevApiKey)
  await setSystemSetting('kirimdev_webhook_secret', kirimdevWebhookSecret)

  revalidatePath('/dashboard/whatsapp')
  return { success: true }
}
