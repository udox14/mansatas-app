'use server'

import { revalidatePath } from 'next/cache'
import { checkFeatureAccess } from '@/lib/features'
import { setSystemSetting } from '@/lib/system-settings'
import { getSession } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { uploadKomiteQris } from '@/utils/r2'

async function requirePengaturanKomite() {
  const session = await getSession()
  if (!session?.user) throw new Error('Unauthorized')
  const db = await getDB()
  const allowed = await checkFeatureAccess(db, session.user.id, 'keuangan-pengaturan')
  if (!allowed) throw new Error('Forbidden')
  return { db, userId: session.user.id }
}

export async function saveKomitePaymentSettings(formData: FormData) {
  await requirePengaturanKomite()
  const bankLabel = String(formData.get('bankLabel') || '').trim()
  const rekening = String(formData.get('rekening') || '').trim()
  const atasNama = String(formData.get('atasNama') || '').trim()
  const whatsapp = String(formData.get('whatsapp') || '').replace(/\D/g, '')

  if (!bankLabel || !rekening || !atasNama) {
    return { error: 'Nama bank, nomor rekening, dan atas nama wajib diisi.', success: null }
  }

  await Promise.all([
    setSystemSetting('keuangan_komite_bank_label', bankLabel),
    setSystemSetting('keuangan_komite_rekening', rekening),
    setSystemSetting('keuangan_komite_atas_nama', atasNama),
    setSystemSetting('keuangan_komite_whatsapp', whatsapp),
  ])

  revalidatePath('/dashboard/keuangan/pengaturan')
  revalidatePath('/portal-ortu')
  return { error: null, success: 'Pengaturan pembayaran komite berhasil disimpan.' }
}

export async function uploadKomiteQrisAction(formData: FormData) {
  await requirePengaturanKomite()
  const file = formData.get('qris') as File | null
  if (!file || file.size <= 0) return { error: 'File QR code wajib dipilih.', success: null }

  const uploaded = await uploadKomiteQris(file)
  if (uploaded.error || !uploaded.url) return { error: uploaded.error || 'Gagal upload QR code.', success: null }

  await setSystemSetting('keuangan_komite_qris_url', uploaded.url)
  revalidatePath('/dashboard/keuangan/pengaturan')
  revalidatePath('/portal-ortu')
  return { error: null, success: 'QR code komite berhasil diperbarui.', url: uploaded.url }
}
