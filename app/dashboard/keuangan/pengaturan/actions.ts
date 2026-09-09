'use server'

import { revalidatePath } from 'next/cache'
import { checkFeatureAccess, checkFeatureCrudAccess } from '@/lib/features'
import type { CashDirection } from '@/lib/cashflow'
import { setSystemSetting } from '@/lib/system-settings'
import type { KomitePaymentAccount } from '@/lib/komite-payment-settings'
import { getSession } from '@/utils/auth/server'
import { getDB } from '@/utils/db-server'
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

export async function saveCashflowCategories(rows: Array<{
  id: string
  direction: CashDirection
  name: string
  sortOrder: number
  isActive: boolean
  isNew?: boolean
}>) {
  const { db, userId } = await requirePengaturanKomite()
  if (!(await checkFeatureCrudAccess(db, userId, 'keuangan-pengaturan', 'update'))) {
    return { error: 'Anda tidak memiliki izin mengubah jenis arus kas.', success: null }
  }
  if (!Array.isArray(rows) || rows.length < 2 || rows.length > 100) return { error: 'Daftar jenis arus kas tidak valid.', success: null }
  const cleaned = rows.map((row, index) => ({
    id: String(row.id || '').trim(), direction: row.direction,
    name: String(row.name || '').trim().replace(/\s+/g, ' '),
    sortOrder: index * 10 + 10, isActive: Boolean(row.isActive), isNew: Boolean(row.isNew),
  }))
  if (cleaned.some(row => !row.id || !['income','expense'].includes(row.direction) || row.name.length < 2 || row.name.length > 100)) {
    return { error: 'Setiap nama jenis wajib diisi 2–100 karakter.', success: null }
  }
  for (const direction of ['income','expense'] as const) {
    const names = cleaned.filter(row => row.direction === direction).map(row => row.name.toLocaleLowerCase('id-ID'))
    if (new Set(names).size !== names.length) return { error: `Nama kategori ${direction === 'income' ? 'pemasukan' : 'pengeluaran'} tidak boleh duplikat.`, success: null }
    if (!cleaned.some(row => row.direction === direction && row.isActive)) return { error: `Minimal satu kategori ${direction === 'income' ? 'pemasukan' : 'pengeluaran'} harus aktif.`, success: null }
  }
  const existing = await db.prepare('SELECT id,direction FROM fin_cashflow_categories').all<{ id: string; direction: CashDirection }>()
  const directionById = new Map((existing.results ?? []).map(row => [row.id,row.direction]))
  if (cleaned.some(row => directionById.has(row.id) && directionById.get(row.id) !== row.direction)) return { error: 'Arah kategori yang sudah dipakai tidak dapat diubah.', success: null }
  await db.batch(cleaned.map(row => row.isNew
    ? db.prepare(`INSERT INTO fin_cashflow_categories (id,direction,name,sort_order,is_active,is_system,created_by,updated_by) VALUES (?,?,?,?,?,0,?,?)`).bind(row.id,row.direction,row.name,row.sortOrder,row.isActive ? 1 : 0,userId,userId)
    : db.prepare(`UPDATE fin_cashflow_categories SET name=?,sort_order=?,is_active=?,updated_by=?,updated_at=datetime('now') WHERE id=? AND direction=?`).bind(row.name,row.sortOrder,row.isActive ? 1 : 0,userId,row.id,row.direction)
  ))
  revalidatePath('/dashboard/keuangan/pengaturan')
  revalidatePath('/dashboard/keuangan/kas-keluar')
  return { error: null, success: 'Jenis arus kas berhasil disimpan.' }
}
