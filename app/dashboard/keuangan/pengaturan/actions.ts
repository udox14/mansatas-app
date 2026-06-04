'use server'

import { revalidatePath } from 'next/cache'
import { checkFeatureAccess } from '@/lib/features'
import { setSystemSetting } from '@/lib/system-settings'
import type { KomitePaymentAccount } from '@/lib/komite-payment-settings'
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
  const ids = formData.getAll('accountId').map((value) => String(value || '').trim())
  const bankLabels = formData.getAll('bankLabel').map((value) => String(value || '').trim())
  const rekenings = formData.getAll('rekening').map((value) => String(value || '').trim())
  const atasNamas = formData.getAll('atasNama').map((value) => String(value || '').trim())
  const activeIds = new Set(formData.getAll('activeAccountIds').map((value) => String(value || '').trim()))
  const whatsapp = String(formData.get('whatsapp') || '').replace(/\D/g, '')
  const qrisEnabled = formData.get('qrisEnabled') === '1'

  const accounts: KomitePaymentAccount[] = []
  const totalRows = Math.max(ids.length, bankLabels.length, rekenings.length, atasNamas.length)
  for (let index = 0; index < totalRows; index++) {
    const bankLabel = bankLabels[index] || ''
    const rekening = rekenings[index] || ''
    const atasNama = atasNamas[index] || ''
    if (!bankLabel && !rekening && !atasNama) continue
    if (!bankLabel || !rekening || !atasNama) {
      return { error: 'Setiap rekening harus memiliki nama bank, nomor rekening, dan atas nama.', success: null }
    }
    accounts.push({
      id: ids[index] || `rekening-${Date.now()}-${index}`,
      bankLabel,
      rekening,
      atasNama,
      isActive: activeIds.has(ids[index] || `rekening-${Date.now()}-${index}`),
    })
  }

  if (accounts.length === 0) {
    return { error: 'Minimal tambahkan satu rekening pembayaran.', success: null }
  }
  if (!qrisEnabled && accounts.every((account) => !account.isActive)) {
    return { error: 'Aktifkan minimal satu metode pembayaran: QRIS atau salah satu rekening.', success: null }
  }

  const primaryAccount = accounts.find((account) => account.isActive) || accounts[0]
  await Promise.all([
    setSystemSetting('keuangan_komite_accounts', JSON.stringify(accounts)),
    setSystemSetting('keuangan_komite_bank_label', primaryAccount.bankLabel),
    setSystemSetting('keuangan_komite_rekening', primaryAccount.rekening),
    setSystemSetting('keuangan_komite_atas_nama', primaryAccount.atasNama),
    setSystemSetting('keuangan_komite_whatsapp', whatsapp),
    setSystemSetting('keuangan_komite_qris_enabled', qrisEnabled ? '1' : '0'),
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
