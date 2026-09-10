'use server'

import { revalidatePath } from 'next/cache'
import { checkFeatureCrudAccess, type CrudAction } from '@/lib/features'
import {
  CASH_METHODS,
  isValidIsoDate,
  normalizeCashflowFilters,
  type CashDirection,
  type CashflowAnalytics,
  type CashflowCategory,
  type CashflowEntry,
  type CashflowFilters,
  type CashflowPageData,
  type CashMethod,
} from '@/lib/cashflow'
import { getSession } from '@/utils/auth/server'
import { getDB } from '@/utils/db-server'
import { uploadCashflowProof } from '@/utils/r2'
import { getKomiteReportSettings } from '@/lib/komite-report-settings'
import { getOrSetFinanceCache, invalidateFinanceCache } from '@/lib/finance-cache'

const FEATURE_ID = 'keuangan-kas-keluar'

async function requireCashflow(action: CrudAction) {
  const session = await getSession()
  if (!session?.user) throw new Error('Unauthorized')
  const db = await getDB()
  if (!(await checkFeatureCrudAccess(db, session.user.id, FEATURE_ID, action))) throw new Error('Forbidden')
  return { db, userId: session.user.id }
}

function revalidateCashflow() {
  invalidateFinanceCache()
  revalidatePath('/dashboard/keuangan/kas-keluar')
  revalidatePath('/dashboard/keuangan/laporan')
  revalidatePath('/dashboard/keuangan/pengaturan')
  revalidatePath('/dashboard')
}

const ledgerCte = `
  WITH ledger AS (
    SELECT
      'student-' || t.id AS id, 'student' AS origin, 'income' AS direction,
      CASE WHEN t.kategori='spp' THEN 'spp' ELSE 'dspt' END AS source,
      NULL AS category_id, CASE WHEN t.kategori='spp' THEN 'SPP' ELSE 'DSPT' END AS category_name,
      substr(t.created_at,1,10) AS transaction_date, t.jumlah_total AS amount,
      t.metode_bayar AS method, s.nama_lengkap AS counterparty,
      COALESCE(t.nomor_kuitansi,'Pembayaran siswa') AS description,
      t.bukti_transfer_url AS proof_url, t.nomor_kuitansi AS proof_number, t.input_oleh AS recorder_id,
      COALESCE(u.nama_lengkap,u.name,'Sistem') AS recorder_name,
      s.id AS student_id, s.nama_lengkap AS student_name,
      trim(COALESCE(k.tingkat || '-' || k.nomor_kelas || CASE WHEN k.kelompok IS NOT NULL AND k.kelompok<>'' THEN ' ' || k.kelompok ELSE '' END,'-')) AS student_class,
      s.tahun_masuk AS angkatan,
      CASE WHEN t.is_void=1 THEN 'void' ELSE 'active' END AS status,
      t.void_alasan AS void_reason, t.created_at AS created_at,
      s.kelas_id AS kelas_id
    FROM fin_transaksi t
    JOIN siswa s ON s.id=t.siswa_id AND s.status='aktif'
    LEFT JOIN kelas k ON k.id=s.kelas_id
    LEFT JOIN "user" u ON u.id=t.input_oleh
    WHERE t.kategori IN ('dspt','spp')

    UNION ALL

    SELECT
      'student-dspt-balance-' || d.id, 'student', 'income', 'dspt', NULL, 'DSPT',
      substr(COALESCE(d.updated_at,d.created_at),1,10), d.total_dibayar-COALESCE(r.total_recorded,0),
      'tunai', s.nama_lengkap, 'Saldo DSPT tanpa rincian transaksi', NULL, NULL, NULL, 'Sistem',
      s.id, s.nama_lengkap,
      trim(COALESCE(k.tingkat || '-' || k.nomor_kelas || CASE WHEN k.kelompok IS NOT NULL AND k.kelompok<>'' THEN ' ' || k.kelompok ELSE '' END,'-')),
      s.tahun_masuk, 'active', NULL, COALESCE(d.updated_at,d.created_at), s.kelas_id
    FROM fin_dspt d
    JOIN siswa s ON s.id=d.siswa_id AND s.status='aktif'
    LEFT JOIN kelas k ON k.id=s.kelas_id
    LEFT JOIN (
      SELECT td.ref_id, SUM(td.jumlah) total_recorded
      FROM fin_transaksi_detail td JOIN fin_transaksi t ON t.id=td.transaksi_id
      WHERE td.ref_type='dspt' AND t.is_void=0 GROUP BY td.ref_id
    ) r ON r.ref_id=d.id
    WHERE d.total_dibayar-COALESCE(r.total_recorded,0) > 0

    UNION ALL

    SELECT
      'student-spp-balance-' || sp.id, 'student', 'income', 'spp', NULL, 'SPP',
      substr(COALESCE(sp.updated_at,sp.created_at),1,10), sp.total_dibayar-COALESCE(r.total_recorded,0),
      'tunai', s.nama_lengkap, 'Saldo SPP tanpa rincian transaksi', NULL, NULL, NULL, 'Sistem',
      s.id, s.nama_lengkap,
      trim(COALESCE(k.tingkat || '-' || k.nomor_kelas || CASE WHEN k.kelompok IS NOT NULL AND k.kelompok<>'' THEN ' ' || k.kelompok ELSE '' END,'-')),
      s.tahun_masuk, 'active', NULL, COALESCE(sp.updated_at,sp.created_at), s.kelas_id
    FROM fin_spp_saldo_awal sp
    JOIN siswa s ON s.id=sp.siswa_id AND s.status='aktif'
    LEFT JOIN kelas k ON k.id=s.kelas_id
    LEFT JOIN (
      SELECT td.ref_id, SUM(td.jumlah) total_recorded
      FROM fin_transaksi_detail td JOIN fin_transaksi t ON t.id=td.transaksi_id
      WHERE td.ref_type='spp_saldo_awal' AND t.is_void=0 GROUP BY td.ref_id
    ) r ON r.ref_id=sp.id
    WHERE sp.total_dibayar-COALESCE(r.total_recorded,0) > 0

    UNION ALL

    SELECT
      e.id, 'manual', e.direction, 'manual', e.category_id, c.name,
      e.transaction_date, e.amount, e.method, e.counterparty, e.description,
      e.proof_url, e.proof_number, e.created_by,
      COALESCE(u.nama_lengkap,u.name,'-'), NULL, NULL, NULL, NULL,
      CASE WHEN e.is_void=1 THEN 'void' ELSE 'active' END,
      e.void_reason, e.created_at, NULL
    FROM fin_cashflow_entries e
    JOIN fin_cashflow_categories c ON c.id=e.category_id
    LEFT JOIN "user" u ON u.id=e.created_by
  )
`

function ledgerWhere(filters: CashflowFilters) {
  const f = normalizeCashflowFilters(filters)
  const clauses: string[] = ['1=1']
  const params: unknown[] = []
  if (f.dateFrom && isValidIsoDate(f.dateFrom)) { clauses.push('transaction_date >= ?'); params.push(f.dateFrom) }
  if (f.dateTo && isValidIsoDate(f.dateTo)) { clauses.push('transaction_date <= ?'); params.push(f.dateTo) }
  if (f.direction && f.direction !== 'all') { clauses.push('direction = ?'); params.push(f.direction) }
  if (f.source && f.source !== 'all') { clauses.push('source = ?'); params.push(f.source) }
  if (f.categoryId) { clauses.push('category_id = ?'); params.push(f.categoryId) }
  if (f.method && f.method !== 'all') { clauses.push('method = ?'); params.push(f.method) }
  if (f.recorderId) { clauses.push('recorder_id = ?'); params.push(f.recorderId) }
  if (f.status && f.status !== 'all') { clauses.push('status = ?'); params.push(f.status) }
  else if (!f.status) clauses.push("status = 'active'")
  if (f.angkatan) { clauses.push('angkatan = ?'); params.push(Number(f.angkatan)) }
  if (f.kelasId) { clauses.push('kelas_id = ?'); params.push(f.kelasId) }
  if (f.search) {
    clauses.push("(lower(counterparty) LIKE ? OR lower(description) LIKE ? OR lower(category_name) LIKE ? OR lower(recorder_name) LIKE ?)")
    const term = `%${f.search.toLowerCase()}%`
    params.push(term, term, term, term)
  }
  return { f, where: clauses.join(' AND '), params }
}

function number(value: unknown) { return Number(value || 0) }

function toEntry(row: any): CashflowEntry {
  return {
    id: row.id, origin: row.origin, direction: row.direction, source: row.source,
    categoryId: row.category_id, categoryName: row.category_name,
    transactionDate: row.transaction_date, amount: number(row.amount), method: row.method,
    counterparty: row.counterparty || '', description: row.description || '', proofUrl: row.proof_url || null, proofNumber: row.proof_number || null,
    recorderId: row.recorder_id || null, recorderName: row.recorder_name || '-', studentId: row.student_id || null,
    studentName: row.student_name || null, studentClass: row.student_class || null,
    angkatan: row.angkatan == null ? null : number(row.angkatan), status: row.status,
    voidReason: row.void_reason || null, createdAt: row.created_at,
  }
}

function mappedSeriesJson(value: unknown) {
  try {
    const rows = JSON.parse(String(value || '[]'))
    if (!Array.isArray(rows)) return []
    return rows.map((row: any) => ({ key: String(row.key), label: String(row.label), total: number(row.total), count: number(row.count) }))
  } catch {
    return []
  }
}

export async function getCashflowPage(filters: CashflowFilters = {}): Promise<CashflowPageData> {
  const { db, userId } = await requireCashflow('read')
  const { f, where, params } = ledgerWhere(filters)
  const cacheKey = `cashflow:${userId}:${JSON.stringify(f)}`
  return getOrSetFinanceCache(cacheKey, async () => {
    const offset = (f.page - 1) * f.pageSize
    const analyticsSql = `${ledgerCte}, filtered AS MATERIALIZED (
      SELECT * FROM ledger WHERE ${where}
    )
    SELECT
      COUNT(*) total_rows,
      COALESCE(SUM(CASE WHEN status='active' AND direction='income' THEN amount ELSE 0 END),0) total_income,
      COALESCE(SUM(CASE WHEN status='active' AND direction='income' AND origin='manual' THEN amount ELSE 0 END),0) manual_income,
      COALESCE(SUM(CASE WHEN status='active' AND direction='expense' THEN amount ELSE 0 END),0) total_expense,
      SUM(CASE WHEN status='active' AND direction='income' THEN 1 ELSE 0 END) income_count,
      COALESCE(AVG(CASE WHEN status='active' AND direction='income' THEN amount END),0) income_average,
      COALESCE(MAX(CASE WHEN status='active' AND direction='income' THEN amount END),0) income_largest,
      SUM(CASE WHEN status='active' AND direction='expense' THEN 1 ELSE 0 END) expense_count,
      COALESCE(AVG(CASE WHEN status='active' AND direction='expense' THEN amount END),0) expense_average,
      COALESCE(MAX(CASE WHEN status='active' AND direction='expense' THEN amount END),0) expense_largest,
      (SELECT COALESCE(json_group_array(json_object('key',key,'label',label,'total',total,'count',count)),'[]') FROM (
        SELECT substr(transaction_date,1,7) key, substr(transaction_date,1,7) label, SUM(amount) total, COUNT(*) count FROM filtered WHERE status='active' AND direction='income' GROUP BY key ORDER BY key
      )) monthly_income_json,
      (SELECT COALESCE(json_group_array(json_object('key',key,'label',label,'total',total,'count',count)),'[]') FROM (
        SELECT substr(transaction_date,1,7) key, substr(transaction_date,1,7) label, SUM(amount) total, COUNT(*) count FROM filtered WHERE status='active' AND direction='expense' GROUP BY key ORDER BY key
      )) monthly_expense_json,
      (SELECT COALESCE(json_group_array(json_object('key',key,'label',label,'total',total,'count',count)),'[]') FROM (
        SELECT source key, CASE source WHEN 'manual' THEN 'Manual' ELSE upper(source) END label, SUM(amount) total, COUNT(*) count FROM filtered WHERE status='active' AND direction='income' GROUP BY source ORDER BY total DESC
      )) income_sources_json,
      (SELECT COALESCE(json_group_array(json_object('key',key,'label',label,'total',total,'count',count)),'[]') FROM (
        SELECT method key, CASE method WHEN 'qris' THEN 'QRIS' WHEN 'transfer' THEN 'Transfer' ELSE 'Tunai' END label, SUM(amount) total, COUNT(*) count FROM filtered WHERE status='active' AND direction='income' GROUP BY method ORDER BY total DESC
      )) income_methods_json,
      (SELECT COALESCE(json_group_array(json_object('key',key,'label',label,'total',total,'count',count)),'[]') FROM (
        SELECT category_id key, category_name label, SUM(amount) total, COUNT(*) count FROM filtered WHERE status='active' AND direction='income' AND origin='manual' GROUP BY category_id,category_name ORDER BY total DESC LIMIT 10
      )) income_categories_json,
      (SELECT COALESCE(json_group_array(json_object('key',key,'label',label,'total',total,'count',count)),'[]') FROM (
        SELECT method key, CASE method WHEN 'qris' THEN 'QRIS' WHEN 'transfer' THEN 'Transfer' ELSE 'Tunai' END label, SUM(amount) total, COUNT(*) count FROM filtered WHERE status='active' AND direction='expense' GROUP BY method ORDER BY total DESC
      )) expense_methods_json,
      (SELECT COALESCE(json_group_array(json_object('key',key,'label',label,'total',total,'count',count)),'[]') FROM (
        SELECT category_id key, category_name label, SUM(amount) total, COUNT(*) count FROM filtered WHERE status='active' AND direction='expense' GROUP BY category_id,category_name ORDER BY total DESC LIMIT 10
      )) expense_categories_json
    FROM filtered`

    const [rowsResult, aggregate, categoriesResult, recordersResult, classesResult, angkatanResult] = await Promise.all([
      db.prepare(`${ledgerCte} SELECT * FROM ledger WHERE ${where} ORDER BY transaction_date DESC, created_at DESC LIMIT ? OFFSET ?`).bind(...params,f.pageSize,offset).all<any>(),
      db.prepare(analyticsSql).bind(...params).first<any>(),
      db.prepare('SELECT id,direction,name,sort_order,is_active,is_system FROM fin_cashflow_categories ORDER BY direction,sort_order,name').all<any>(),
      db.prepare(`SELECT DISTINCT u.id, COALESCE(u.nama_lengkap,u.name,'-') name FROM "user" u WHERE EXISTS (SELECT 1 FROM fin_transaksi t WHERE t.input_oleh=u.id) OR EXISTS (SELECT 1 FROM fin_cashflow_entries e WHERE e.created_by=u.id) ORDER BY name`).all<any>(),
      db.prepare(`SELECT id, trim(tingkat || '-' || nomor_kelas || CASE WHEN kelompok IS NOT NULL AND kelompok<>'' THEN ' ' || kelompok ELSE '' END) label FROM kelas ORDER BY tingkat,nomor_kelas,kelompok`).all<any>(),
      db.prepare("SELECT DISTINCT tahun_masuk FROM siswa WHERE status='aktif' AND tahun_masuk IS NOT NULL ORDER BY tahun_masuk DESC").all<any>(),
    ])
    const row = aggregate ?? {}
    const summary = { totalIncome: number(row.total_income), manualIncome: number(row.manual_income), totalExpense: number(row.total_expense) }
    const analytics: CashflowAnalytics = {
      income: { total: summary.totalIncome, count: number(row.income_count), average: Math.round(number(row.income_average)), largest: number(row.income_largest) },
      expense: { total: summary.totalExpense, count: number(row.expense_count), average: Math.round(number(row.expense_average)), largest: number(row.expense_largest) },
      monthlyIncome: mappedSeriesJson(row.monthly_income_json), monthlyExpense: mappedSeriesJson(row.monthly_expense_json),
      incomeSources: mappedSeriesJson(row.income_sources_json), incomeMethods: mappedSeriesJson(row.income_methods_json), incomeCategories: mappedSeriesJson(row.income_categories_json),
      expenseMethods: mappedSeriesJson(row.expense_methods_json), expenseCategories: mappedSeriesJson(row.expense_categories_json),
    }
    return {
      entries: (rowsResult.results ?? []).map(toEntry), totalRows: number(row.total_rows), summary, analytics,
      categories: (categoriesResult.results ?? []).map((item: any): CashflowCategory => ({ id: item.id, direction: item.direction, name: item.name, sortOrder: number(item.sort_order), isActive: item.is_active === 1, isSystem: item.is_system === 1 })),
      recorders: recordersResult.results ?? [], classes: classesResult.results ?? [],
      angkatan: (angkatanResult.results ?? []).map((item: any) => number(item.tahun_masuk)),
    }
  })
}

type ManualEntryInput = {
  direction: CashDirection
  categoryId: string
  transactionDate: string
  amount: number
  method: CashMethod
  counterparty: string
  description: string
  proofNumber?: string
}

async function validateEntry(db: D1Database, input: ManualEntryInput) {
  if (!['income','expense'].includes(input.direction)) return 'Arah transaksi tidak valid.'
  if (!isValidIsoDate(input.transactionDate)) return 'Tanggal transaksi tidak valid.'
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) return 'Nominal harus berupa bilangan rupiah positif.'
  if (!CASH_METHODS.includes(input.method)) return 'Metode transaksi tidak valid.'
  if (!input.description?.trim() || input.description.trim().length > 500) return 'Keterangan wajib diisi maksimal 500 karakter.'
  if ((input.counterparty || '').trim().length > 150) return 'Sumber/penerima maksimal 150 karakter.'
  if ((input.proofNumber || '').trim().length > 80) return 'Nomor bukti maksimal 80 karakter.'
  const category = await db.prepare('SELECT id FROM fin_cashflow_categories WHERE id=? AND direction=? AND is_active=1').bind(input.categoryId,input.direction).first()
  return category ? null : 'Kategori tidak aktif atau tidak sesuai jenis transaksi.'
}

function cleanInput(input: ManualEntryInput): ManualEntryInput {
  return { ...input, amount: Number(input.amount), counterparty: (input.counterparty || '').trim(), description: (input.description || '').trim(), proofNumber: (input.proofNumber || '').trim() }
}

async function allocateProofNumber(db: D1Database, direction: CashDirection, transactionDate: string) {
  const period = transactionDate.slice(0, 7)
  const prefix = direction === 'income' ? 'KM' : 'KK'
  const row = await db.prepare(`INSERT INTO fin_cashflow_proof_sequences(direction,period,counter,updated_at) VALUES(?,?,1,datetime('now')) ON CONFLICT(direction,period) DO UPDATE SET counter=counter+1,updated_at=datetime('now') RETURNING counter`)
    .bind(direction,period).first<{ counter: number }>()
  if (!row) throw new Error('Gagal membuat nomor bukti otomatis.')
  return `${prefix}-${period.replace('-','')}-${String(row.counter).padStart(4,'0')}`
}

export async function createCashflowEntry(input: ManualEntryInput, proof?: FormData) {
  const { db, userId } = await requireCashflow('create')
  const value = cleanInput(input)
  const error = await validateEntry(db, value)
  if (error) return { error, success: null }
  const reportSettings = await getKomiteReportSettings()
  let proofNumber = value.proofNumber || ''
  if (reportSettings.proofNumberMode === 'manual' && !proofNumber) return { error: 'Nomor bukti wajib diisi sesuai pengaturan laporan.', success: null }
  if (reportSettings.proofNumberMode === 'automatic' || (!proofNumber && reportSettings.proofNumberMode === 'source_first')) proofNumber = await allocateProofNumber(db,value.direction,value.transactionDate)
  if (proofNumber && await db.prepare('SELECT 1 FROM fin_cashflow_entries WHERE lower(proof_number)=lower(?) LIMIT 1').bind(proofNumber).first()) return { error: 'Nomor bukti sudah digunakan.', success: null }
  const id = crypto.randomUUID()
  let proofUrl: string | null = null
  const file = proof?.get('proof') as File | null
  if (file?.size) {
    const uploaded = await uploadCashflowProof(file, id)
    if (uploaded.error) return { error: uploaded.error, success: null }
    proofUrl = uploaded.url
  }
  const snapshot = { ...value, proofUrl, proofNumber }
  await db.batch([
    db.prepare(`INSERT INTO fin_cashflow_entries (id,direction,category_id,transaction_date,amount,method,counterparty,description,proof_url,proof_number,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(id,value.direction,value.categoryId,value.transactionDate,value.amount,value.method,value.counterparty,value.description,proofUrl,proofNumber,userId),
    db.prepare(`INSERT INTO fin_cashflow_audit (id,entry_id,action,after_json,actor_id) VALUES (?,?, 'create', ?,?)`)
      .bind(crypto.randomUUID(),id,JSON.stringify(snapshot),userId),
  ])
  revalidateCashflow()
  return { error: null, success: value.direction === 'income' ? 'Pemasukan berhasil dicatat.' : 'Pengeluaran berhasil dicatat.' }
}

export async function updateCashflowEntry(id: string, input: ManualEntryInput, proof?: FormData) {
  const { db, userId } = await requireCashflow('update')
  const before = await db.prepare('SELECT * FROM fin_cashflow_entries WHERE id=? AND is_void=0').bind(id).first<any>()
  if (!before) return { error: 'Transaksi aktif tidak ditemukan.', success: null }
  const value = cleanInput(input)
  const error = await validateEntry(db, value)
  if (error) return { error, success: null }
  const reportSettings = await getKomiteReportSettings()
  let proofNumber = reportSettings.proofNumberMode === 'automatic'
    ? before.proof_number || ''
    : value.proofNumber || before.proof_number || ''
  if (reportSettings.proofNumberMode === 'manual' && !proofNumber) return { error: 'Nomor bukti wajib diisi sesuai pengaturan laporan.', success: null }
  if (!proofNumber && reportSettings.proofNumberMode !== 'manual') proofNumber = await allocateProofNumber(db,value.direction,value.transactionDate)
  if (proofNumber && await db.prepare('SELECT 1 FROM fin_cashflow_entries WHERE lower(proof_number)=lower(?) AND id<>? LIMIT 1').bind(proofNumber,id).first()) return { error: 'Nomor bukti sudah digunakan.', success: null }
  let proofUrl = before.proof_url || null
  const file = proof?.get('proof') as File | null
  if (file?.size) {
    const uploaded = await uploadCashflowProof(file, id)
    if (uploaded.error) return { error: uploaded.error, success: null }
    proofUrl = uploaded.url
  }
  const after = { ...value, proofUrl, proofNumber }
  await db.batch([
    db.prepare(`UPDATE fin_cashflow_entries SET direction=?,category_id=?,transaction_date=?,amount=?,method=?,counterparty=?,description=?,proof_url=?,proof_number=?,updated_by=?,updated_at=datetime('now') WHERE id=?`)
      .bind(value.direction,value.categoryId,value.transactionDate,value.amount,value.method,value.counterparty,value.description,proofUrl,proofNumber || null,userId,id),
    db.prepare(`INSERT INTO fin_cashflow_audit (id,entry_id,action,before_json,after_json,actor_id) VALUES (?,?,'update',?,?,?)`)
      .bind(crypto.randomUUID(),id,JSON.stringify(before),JSON.stringify(after),userId),
  ])
  revalidateCashflow()
  return { error: null, success: 'Transaksi berhasil diperbarui.' }
}

export async function voidCashflowEntry(id: string, reason: string) {
  const { db, userId } = await requireCashflow('delete')
  const before = await db.prepare('SELECT * FROM fin_cashflow_entries WHERE id=? AND is_void=0').bind(id).first<any>()
  const cleanReason = reason.trim()
  if (!before) return { error: 'Transaksi aktif tidak ditemukan.', success: null }
  if (cleanReason.length < 3 || cleanReason.length > 300) return { error: 'Alasan pembatalan wajib diisi 3–300 karakter.', success: null }
  await db.batch([
    db.prepare(`UPDATE fin_cashflow_entries SET is_void=1,void_reason=?,voided_by=?,voided_at=datetime('now'),updated_by=?,updated_at=datetime('now') WHERE id=?`).bind(cleanReason,userId,userId,id),
    db.prepare(`INSERT INTO fin_cashflow_audit (id,entry_id,action,before_json,actor_id,reason) VALUES (?,?,'void',?,?,?)`).bind(crypto.randomUUID(),id,JSON.stringify(before),userId,cleanReason),
  ])
  revalidateCashflow()
  return { error: null, success: 'Transaksi berhasil dibatalkan.' }
}
