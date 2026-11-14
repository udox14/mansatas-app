'use server'

import { isKomiteFundSource, isKomiteFundScope } from '@/lib/komite-funds'
import { revalidatePath } from 'next/cache'
import { checkFeatureAccess, checkFeatureCrudAccess } from '@/lib/features'
import type { CashDirection } from '@/lib/cashflow'
import { setSystemSetting, setSystemSettings } from '@/lib/system-settings'
import { KOMITE_REPORT_SETTING_KEYS, type OpeningBalanceMode, type ProofNumberMode } from '@/lib/komite-report-settings'
import { getKomitePaymentSettings, komiteGradeKeys, parseKomiteGrade, type KomitePaymentAccount } from '@/lib/komite-payment-settings'
import { getSession } from '@/utils/auth/server'
import { getDB } from '@/utils/db-server'
import { uploadKomiteQris } from '@/utils/r2'
import { invalidateFinanceCache } from '@/lib/finance-cache'
import { DSPT_SETTING_KEYS } from '@/lib/dspt-settings'
import { dsptEntryModeSchema, dsptPackageSchema } from '@/lib/pmb-contract'
import { logActivity } from '@/lib/activity-log'

async function requirePengaturanKomite() {
  const session = await getSession()
  if (!session?.user) throw new Error('Unauthorized')
  const db = await getDB()
  const allowed = await checkFeatureAccess(db, session.user.id, 'keuangan-pengaturan')
  if (!allowed) throw new Error('Forbidden')
  return { db, userId: session.user.id }
}

export async function saveKomitePaymentSettings(formData: FormData) {
  const { db, userId } = await requirePengaturanKomite()
  if (!(await checkFeatureCrudAccess(db, userId, 'keuangan-pengaturan', 'update'))) return { error: 'Anda tidak memiliki izin mengubah pengaturan pembayaran.', success: null }
  const grade = parseKomiteGrade(formData.get('tingkat'))
  if (!grade) return { error: 'Tingkat kelas tidak valid.', success: null }
  const keys = komiteGradeKeys(grade)
  const before = await getKomitePaymentSettings(db)
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
      id: ids[index],
      bankLabel,
      rekening,
      atasNama,
      isActive: activeIds.has(ids[index]),
    })
  }

  if (accounts.some(account => !account.id) || new Set(accounts.map(account => account.id)).size !== accounts.length) {
    return { error: 'ID rekening wajib diisi dan tidak boleh duplikat.', success: null }
  }
  if (qrisEnabled && !before.byGrade[grade].qrisUrl) {
    return { error: 'Upload gambar QRIS untuk tingkat ini sebelum mengaktifkan QRIS.', success: null }
  }
  await setSystemSettings({
    [keys.accounts]: JSON.stringify(accounts),
    [keys.qrisEnabled]: qrisEnabled ? '1' : '0',
    keuangan_komite_whatsapp: whatsapp,
  })
  await logActivity({ db, module: 'keuangan-pengaturan', action: 'update_payment_settings',
    summary: `Memperbarui rekening dan metode pembayaran kelas ${grade}`,
    before: { ...before.byGrade[grade], whatsapp: before.whatsapp },
    after: { accounts, qrisEnabled, whatsapp }, metadata: { tingkat: grade } })

  revalidatePath('/dashboard/keuangan/pengaturan')
  revalidatePath('/portal-ortu')
  return { error: null, success: 'Pengaturan pembayaran komite berhasil disimpan.' }
}

export async function saveDsptSettings(input: { mode: string; defaultAmount: number; packages: unknown[]; allowOverride: boolean }) {
  const { db, userId } = await requirePengaturanKomite()
  if (!(await checkFeatureCrudAccess(db, userId, 'keuangan-pengaturan', 'update'))) return { error: 'Anda tidak memiliki izin mengubah pengaturan DSPT.', success: null }
  const mode = dsptEntryModeSchema.safeParse(input.mode)
  const packages = dsptPackageSchema.array().max(50).safeParse(input.packages)
  const defaultAmount = Number(input.defaultAmount)
  if (!mode.success || !packages.success || !Number.isSafeInteger(defaultAmount) || defaultAmount < 0) return { error: 'Pengaturan DSPT tidak valid.', success: null }
  if (new Set(packages.data.map(item => item.id)).size !== packages.data.length) return { error: 'ID paket DSPT tidak boleh duplikat.', success: null }
  const activeLabels = packages.data.filter(item => item.isActive).map(item => item.label.toLocaleLowerCase('id-ID'))
  if (new Set(activeLabels).size !== activeLabels.length) return { error: 'Nama paket DSPT aktif tidak boleh duplikat.', success: null }
  if (mode.data === 'default' && defaultAmount <= 0) return { error: 'Nominal default wajib lebih dari nol.', success: null }
  if (mode.data === 'package' && !packages.data.some(item => item.isActive)) return { error: 'Minimal satu paket DSPT harus aktif.', success: null }
  await setSystemSettings({
    [DSPT_SETTING_KEYS.mode]: mode.data,
    [DSPT_SETTING_KEYS.defaultAmount]: String(defaultAmount),
    [DSPT_SETTING_KEYS.packages]: JSON.stringify(packages.data),
    [DSPT_SETTING_KEYS.allowOverride]: input.allowOverride ? '1' : '0',
  })
  await logActivity({ db, module: 'keuangan-pengaturan', action: 'update_dspt_settings', summary: 'Memperbarui konfigurasi nominal DSPT', metadata: { mode: mode.data, defaultAmount, allowOverride: input.allowOverride, packageIds: packages.data.map(item => item.id) } })
  revalidatePath('/dashboard/keuangan/pengaturan')
  revalidatePath('/dashboard/keuangan/daftar-ulang')
  return { error: null, success: 'Pengaturan nominal DSPT berhasil disimpan.' }
}

export async function uploadKomiteQrisAction(formData: FormData) {
  const { db, userId } = await requirePengaturanKomite()
  if (!(await checkFeatureCrudAccess(db, userId, 'keuangan-pengaturan', 'update'))) return { error: 'Anda tidak memiliki izin mengubah pengaturan pembayaran.', success: null }
  const grade = parseKomiteGrade(formData.get('tingkat'))
  if (!grade) return { error: 'Tingkat kelas tidak valid.', success: null }
  const keys = komiteGradeKeys(grade)
  const before = await getKomitePaymentSettings(db)
  const file = formData.get('qris') as File | null
  if (!file || file.size <= 0) return { error: 'File QR code wajib dipilih.', success: null }

  const uploaded = await uploadKomiteQris(file, grade)
  if (uploaded.error || !uploaded.url) return { error: uploaded.error || 'Gagal upload QR code.', success: null }

  await setSystemSetting(keys.qrisUrl, uploaded.url)
  await logActivity({ db, module: 'keuangan-pengaturan', action: 'update_payment_qris',
    summary: `Memperbarui QRIS kelas ${grade}`, before: { qrisUrl: before.byGrade[grade].qrisUrl },
    after: { qrisUrl: uploaded.url }, metadata: { tingkat: grade } })
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
  invalidateFinanceCache()
  revalidatePath('/dashboard/keuangan/pengaturan')
  revalidatePath('/dashboard/keuangan/kas-keluar')
  return { error: null, success: 'Jenis arus kas berhasil disimpan.' }
}

export async function saveKomiteReportSettings(input: {
  openingBalanceMode: OpeningBalanceMode
  proofNumberMode: ProofNumberMode
  signaturesEnabled: boolean
  treasurerName: string
  chairmanName: string
  principalName: string
  storedPeriod?: string
  storedAmount?: number
  storedNote?: string
}) {
  const { db, userId } = await requirePengaturanKomite()
  if (!(await checkFeatureCrudAccess(db, userId, 'keuangan-pengaturan', 'update'))) return { error: 'Anda tidak memiliki izin mengubah pengaturan laporan.', success: null }
  if (!['cumulative','manual','stored'].includes(input.openingBalanceMode)) return { error: 'Metode saldo awal tidak valid.', success: null }
  if (!['manual','automatic','source_first'].includes(input.proofNumberMode)) return { error: 'Mode nomor bukti tidak valid.', success: null }
  const names = [input.treasurerName,input.chairmanName,input.principalName].map(value => String(value || '').trim())
  if (names.some(value => value.length > 120)) return { error: 'Nama penanda tangan maksimal 120 karakter.', success: null }
  await setSystemSettings({
    [KOMITE_REPORT_SETTING_KEYS.openingBalanceMode]: input.openingBalanceMode,
    [KOMITE_REPORT_SETTING_KEYS.proofNumberMode]: input.proofNumberMode,
    [KOMITE_REPORT_SETTING_KEYS.signaturesEnabled]: input.signaturesEnabled ? '1' : '0',
    [KOMITE_REPORT_SETTING_KEYS.treasurerName]: names[0],
    [KOMITE_REPORT_SETTING_KEYS.chairmanName]: names[1],
    [KOMITE_REPORT_SETTING_KEYS.principalName]: names[2],
  })
  if (input.storedPeriod) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.storedPeriod) || !Number.isSafeInteger(input.storedAmount)) return { error: 'Periode atau nominal saldo bulanan tidak valid.', success: null }
    const note = String(input.storedNote || '').trim().slice(0, 300)
    await db.prepare(`INSERT INTO fin_monthly_opening_balances(period,amount,note,updated_by,updated_at) VALUES(?,?,?,?,datetime('now')) ON CONFLICT(period) DO UPDATE SET amount=excluded.amount,note=excluded.note,updated_by=excluded.updated_by,updated_at=datetime('now')`)
      .bind(input.storedPeriod,input.storedAmount,note || null,userId).run()
  }
  invalidateFinanceCache()
  revalidatePath('/dashboard/keuangan/pengaturan')
  revalidatePath('/dashboard/keuangan/laporan')
  return { error: null, success: 'Pengaturan laporan keuangan berhasil disimpan.' }
}


export async function saveKomiteFundSetting(source: string, allowNegative: boolean) {
  const {db,userId}=await requirePengaturanKomite()
  if (!(await checkFeatureCrudAccess(db,userId,'keuangan-pengaturan','update'))) return {error:'Anda tidak memiliki izin mengubah pengaturan.'}
  if (!isKomiteFundSource(source) || typeof allowNegative!=='boolean') return {error:'Sumber dana tidak valid.'}
  await db.batch([
    db.prepare(`INSERT INTO fin_komite_fund_setting_audit (source,before_value,after_value,actor_id)
      VALUES (?,COALESCE((SELECT allow_negative FROM fin_komite_fund_settings WHERE source=?),0),?,?)`)
      .bind(source,source,Number(allowNegative),userId),
    db.prepare(`INSERT INTO fin_komite_fund_settings (source,allow_negative,updated_by) VALUES (?,?,?)
      ON CONFLICT(source) DO UPDATE SET allow_negative=excluded.allow_negative,updated_by=excluded.updated_by,updated_at=datetime('now')`)
      .bind(source,Number(allowNegative),userId),
  ])
  revalidatePath('/dashboard/keuangan/pengaturan')
  return {success:'Izin saldo minus tersimpan.'}
}

export async function saveKomiteFundOpeningBalance(form: FormData) {
  const {db,userId}=await requirePengaturanKomite()
  if (!(await checkFeatureCrudAccess(db,userId,'keuangan-pengaturan','update'))) return {error:'Anda tidak memiliki izin mengubah saldo awal.'}
  const source=form.get('fund')
  const period=String(form.get('period')??'')
  const raw=String(form.get('amount')??'').trim()
  const amount=Number(raw)
  if (!isKomiteFundScope(source)||source==='all'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)||!raw||!Number.isSafeInteger(amount)) return {error:'Sumber, bulan, atau saldo awal tidak valid.'}
  await db.prepare(`INSERT INTO fin_komite_opening_balances (period,source,amount,note,updated_by) VALUES (?,?,?,?,?)
    ON CONFLICT(period,source) DO UPDATE SET amount=excluded.amount,note=excluded.note,updated_by=excluded.updated_by,updated_at=datetime('now')`)
    .bind(period,source,amount,String(form.get('note')??'').trim().slice(0,300)||null,userId).run()
  revalidatePath('/dashboard/keuangan/pengaturan')
  return {success:'Saldo awal laporan tersimpan.'}
}
