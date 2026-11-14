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
import { todayWIB } from '@/lib/time'
import { getSession } from '@/utils/auth/server'
import { getDB } from '@/utils/db-server'
import { uploadCashflowProof } from '@/utils/r2'
import { getKomiteReportSettings } from '@/lib/komite-report-settings'
import { getOrSetFinanceCache, invalidateFinanceCache } from '@/lib/finance-cache'

import { cashLedgerSql, checkKomiteCash, checkKomiteWrite, isKomiteFundScope, komiteCashError, listKomiteFundOptions, parseFundAllocations, validateKomiteFundSources } from '@/lib/komite-funds'

import { listActiveKomiteCohorts } from '@/lib/komite-cohorts'

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
  revalidatePath('/dashboard/keuangan/rapbm')
  revalidatePath('/dashboard')
}

function ledgerWhere(filters: CashflowFilters) {
  const f = normalizeCashflowFilters(filters)
  const clauses: string[] = ['1=1']
  const params: unknown[] = []
  if (typeof f.entryId==='string' && f.entryId.length<=120) { clauses.push('id=?');params.push(f.entryId) }
  if (f.dateFrom && isValidIsoDate(f.dateFrom)) { clauses.push('transaction_date >= ?'); params.push(f.dateFrom) }
  if (f.dateTo && isValidIsoDate(f.dateTo)) { clauses.push('transaction_date <= ?'); params.push(f.dateTo) }
  if (f.direction && f.direction !== 'all') { clauses.push('direction = ?'); params.push(f.direction) }
  if (f.studentScope==='active_students') clauses.push("(student_id IS NULL OR student_status='aktif')")
  if (f.source && f.source !== 'all') { clauses.push('source = ?'); params.push(f.source) }
  if (f.categoryId) { clauses.push('category_id = ?'); params.push(f.categoryId) }
  if (f.method && f.method !== 'all') { clauses.push('method = ?'); params.push(f.method) }
  if (f.recorderId) { clauses.push('recorder_id = ?'); params.push(f.recorderId) }
  if (f.status && f.status !== 'all') { clauses.push('status = ?'); params.push(f.status) }
  else if (!f.status && !f.entryId) clauses.push("status = 'active'")

  if (f.kelasId) { clauses.push('kelas_id = ?'); params.push(f.kelasId) }
  if (f.search) {
    clauses.push("(lower(counterparty) LIKE ? OR lower(description) LIKE ? OR lower(category_name) LIKE ? OR lower(recorder_name) LIKE ?)")
    const term = `%${f.search.toLowerCase()}%`
    params.push(term, term, term, term)
  }
  const fund = isKomiteFundScope(f.angkatan) && f.angkatan !== 'all' ? f.angkatan : undefined
  return { f, where: clauses.join(' AND '), params: fund ? [fund, ...params] : params, ledgerCte: cashLedgerSql(fund) }
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
    fundSource: row.fund_source || null,
    linkedSpb: !!row.komite_pengajuan_id,
    groupId: row.group_id || null,
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
  const { f, where, params, ledgerCte } = ledgerWhere(filters)
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

    const base = ledgerWhere({...f,angkatan:undefined})
    const [rowsResult, aggregate, categoriesResult, recordersResult, classesResult, fundOptions, activeYears, cohortTotals] = await Promise.all([
      db.prepare(`${ledgerCte} SELECT * FROM ledger WHERE ${where} ORDER BY transaction_date DESC, created_at DESC LIMIT ? OFFSET ?`).bind(...params,f.pageSize,offset).all<any>(),
      db.prepare(analyticsSql).bind(...params).first<any>(),
      db.prepare('SELECT id,direction,name,sort_order,is_active,is_system FROM fin_cashflow_categories ORDER BY direction,sort_order,name').all<any>(),
      db.prepare(`SELECT DISTINCT u.id, COALESCE(u.nama_lengkap,u.name,'-') name FROM "user" u WHERE EXISTS (SELECT 1 FROM fin_transaksi t WHERE t.input_oleh=u.id) OR EXISTS (SELECT 1 FROM fin_cashflow_entries e WHERE e.created_by=u.id) ORDER BY name`).all<any>(),
      db.prepare(`SELECT id, trim(tingkat || '-' || nomor_kelas || CASE WHEN kelompok IS NOT NULL AND kelompok<>'' THEN ' ' || kelompok ELSE '' END) label FROM kelas ORDER BY tingkat,nomor_kelas,kelompok`).all<any>(),
      listKomiteFundOptions(db),
      listActiveKomiteCohorts(db),
      db.prepare(`${base.ledgerCte}, matching AS MATERIALIZED (
        SELECT id,amount,direction FROM ledger WHERE (${base.where}) AND status='active'
      ), scoped AS (
        SELECT 'all' scope,amount,direction FROM matching
        UNION ALL
        SELECT p.source,p.amount,m.direction FROM matching m JOIN fin_komite_cash_parts p ON p.id=m.id
      )
      SELECT scope,SUM(CASE WHEN direction='income' THEN amount ELSE 0 END) income,
        SUM(CASE WHEN direction='expense' THEN amount ELSE 0 END) expense FROM scoped GROUP BY scope`)
        .bind(...base.params).all<{scope:string;income:number;expense:number}>(),
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
      activeYears, cohortTotals:Object.fromEntries(cohortTotals.results.map(row=>[row.scope,{income:row.income,expense:row.expense}])),
      angkatan: fundOptions.years, positions: fundOptions.positions, historicalPositions:fundOptions.historicalPositions,
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
  fundSource?: string
  groupId?: string
}

async function validateEntry(db: D1Database, input: ManualEntryInput) {
  if (!['income','expense'].includes(input.direction)) return 'Arah transaksi tidak valid.'
  if (!isValidIsoDate(input.transactionDate) || input.transactionDate>todayWIB()) return 'Tanggal transaksi tidak valid.'
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) return 'Nominal harus berupa bilangan rupiah positif.'
  if (!CASH_METHODS.includes(input.method)) return 'Metode transaksi tidak valid.'
  if (!input.description?.trim() || input.description.trim().length > 500) return 'Keterangan wajib diisi maksimal 500 karakter.'
  if ((input.counterparty || '').trim().length > 150) return 'Sumber/penerima maksimal 150 karakter.'
  if ((input.proofNumber || '').trim().length > 80) return 'Nomor bukti maksimal 80 karakter.'
  if (input.categoryId==='expense-komite-spb') return 'Catat pencairan melalui pengajuan SPB.'
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
  let allocation
  try {
    ;[allocation] = parseFundAllocations([{ source: value.fundSource, groupId: value.groupId, amount: value.amount }], value.amount, value.direction === 'income')
    await validateKomiteFundSources(db,[allocation])
  } catch (cause) {
    return { error: (cause as Error).message, success: null }
  }
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
  try { await db.batch([
    db.prepare(`INSERT INTO fin_cashflow_entries (id,direction,category_id,transaction_date,amount,method,counterparty,description,proof_url,proof_number,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(id,value.direction,value.categoryId,value.transactionDate,value.amount,value.method,value.counterparty,value.description,proofUrl,proofNumber,userId),
    db.prepare(`INSERT INTO fin_komite_allocations (id,cashflow_id,source,group_id,amount,state,actor_id)
      VALUES (?,?,?,?,?,'realized',?)`).bind(crypto.randomUUID(),id,allocation.source,allocation.groupId,allocation.amount,userId),
    ...(value.direction === 'expense' ? [checkKomiteCash(db,[allocation.source])] : []),
    db.prepare(`INSERT INTO fin_cashflow_audit (id,entry_id,action,after_json,actor_id) VALUES (?,?, 'create', ?,?)`)
      .bind(crypto.randomUUID(),id,JSON.stringify(snapshot),userId),
  ]) } catch (cause) {
    return { error: await komiteCashError(db,cause,[{source: allocation.source,amount: -value.amount}]), success:null }
  }
  revalidateCashflow()
  return { error: null, success: value.direction === 'income' ? 'Pemasukan berhasil dicatat.' : 'Pengeluaran berhasil dicatat.' }
}

export async function updateCashflowEntry(id: string, input: ManualEntryInput, proof?: FormData) {
  const { db, userId } = await requireCashflow('update')
  const before = await db.prepare('SELECT * FROM fin_cashflow_entries WHERE id=? AND is_void=0').bind(id).first<any>()
  if (!before) return { error: 'Transaksi aktif tidak ditemukan.', success: null }
  if (before.komite_pengajuan_id) return { error: 'Koreksi pencairan ini melalui pengajuan SPB.', success: null }
  const value = cleanInput(input)
  const error = await validateEntry(db, value)
  if (error) return { error, success: null }
  let allocation
  try {
    ;[allocation] = parseFundAllocations([{ source: value.fundSource, groupId: value.groupId, amount: value.amount }], value.amount, value.direction === 'income')
    await validateKomiteFundSources(db,[allocation])
  } catch (cause) {
    return { error: (cause as Error).message, success: null }
  }
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
  const old = (await db.prepare("SELECT source,amount FROM fin_komite_allocations WHERE cashflow_id=? AND state='realized'").bind(id).all<{source:string;amount:number}>()).results
  const delta = new Map<string,number>()
  for(const row of old) delta.set(row.source,(delta.get(row.source)??0)+(before.direction==='income'?-row.amount:row.amount))
  delta.set(allocation.source,(delta.get(allocation.source)??0)+(value.direction==='income'?value.amount:-value.amount))
  const affected=[...delta].filter(([,amount])=>amount<0).map(([source])=>source)
  try { await db.batch([
    db.prepare(`UPDATE fin_cashflow_entries SET direction=?,category_id=?,transaction_date=?,amount=?,method=?,counterparty=?,description=?,proof_url=?,proof_number=?,updated_by=?,komite_revision=komite_revision+1,updated_at=strftime('%Y-%m-%d %H:%M:%f','now') WHERE id=? AND is_void=0 AND komite_pengajuan_id IS NULL AND komite_revision=?`)
      .bind(value.direction,value.categoryId,value.transactionDate,value.amount,value.method,value.counterparty,value.description,proofUrl,proofNumber || null,userId,id,before.komite_revision),
    checkKomiteWrite(db),
    db.prepare("UPDATE fin_komite_allocations SET state='released' WHERE cashflow_id=? AND state='realized'").bind(id),
    db.prepare(`INSERT INTO fin_komite_allocations (id,cashflow_id,source,group_id,amount,state,actor_id)
      VALUES (?,?,?,?,?,'realized',?)`).bind(crypto.randomUUID(),id,allocation.source,allocation.groupId,allocation.amount,userId),
    checkKomiteCash(db,affected),
    db.prepare(`INSERT INTO fin_cashflow_audit (id,entry_id,action,before_json,after_json,actor_id) VALUES (?,?,'update',?,?,?)`)
      .bind(crypto.randomUUID(),id,JSON.stringify(before),JSON.stringify(after),userId),
  ]) } catch (cause) {
    const delta = [...old.map(row => ({ ...row, amount: before.direction === 'income' ? -row.amount : row.amount })),
      { source: allocation.source, amount: value.direction === 'income' ? value.amount : -value.amount }]
    return { error: await komiteCashError(db,cause,delta), success:null }
  }
  revalidateCashflow()
  return { error: null, success: 'Transaksi berhasil diperbarui.' }
}

export async function voidCashflowEntry(id: string, reason: string) {
  const { db, userId } = await requireCashflow('delete')
  const before = await db.prepare('SELECT * FROM fin_cashflow_entries WHERE id=? AND is_void=0').bind(id).first<any>()
  const cleanReason = reason.trim()
  if (!before) return { error: 'Transaksi aktif tidak ditemukan.', success: null }
  if (before.komite_pengajuan_id) return { error: 'Koreksi pencairan ini melalui pengajuan SPB.', success: null }
  if (cleanReason.length < 3 || cleanReason.length > 300) return { error: 'Alasan pembatalan wajib diisi 3–300 karakter.', success: null }
  const old = (await db.prepare("SELECT source,amount FROM fin_komite_allocations WHERE cashflow_id=? AND state='realized'").bind(id).all<{source:string;amount:number}>()).results
  try { await db.batch([
    db.prepare(`UPDATE fin_cashflow_entries SET is_void=1,void_reason=?,voided_by=?,voided_at=datetime('now'),updated_by=?,komite_revision=komite_revision+1,updated_at=strftime('%Y-%m-%d %H:%M:%f','now') WHERE id=? AND is_void=0 AND komite_pengajuan_id IS NULL AND komite_revision=?`).bind(cleanReason,userId,userId,id,before.komite_revision),
    checkKomiteWrite(db),
    ...(before.direction === 'income' ? [checkKomiteCash(db,old.map(row=>row.source))] : []),
    db.prepare(`INSERT INTO fin_cashflow_audit (id,entry_id,action,before_json,actor_id,reason) VALUES (?,?,'void',?,?,?)`).bind(crypto.randomUUID(),id,JSON.stringify(before),userId,cleanReason),
  ]) } catch (cause) {
    return { error: await komiteCashError(db,cause,old.map(row=>({...row,amount:-row.amount}))), success:null }
  }
  revalidateCashflow()
  return { error: null, success: 'Transaksi berhasil dibatalkan.' }
}

export async function mapHistoricalCashflow(id: string, fundSource: string, groupId: string, reason: string) {
  const { db, userId } = await requireCashflow('update')
  const entry = await db.prepare("SELECT * FROM fin_cashflow_entries WHERE id=? AND is_void=0 AND komite_pengajuan_id IS NULL").bind(id).first<{direction:CashDirection;amount:number}>()
  if (!entry || reason.trim().length<3 || reason.trim().length>300) return {error:'Transaksi atau alasan pemetaan belum lengkap.',success:null}
  try {
    const [part] = parseFundAllocations([{source:fundSource,groupId,amount:entry.amount}],entry.amount,entry.direction==='income')
    await validateKomiteFundSources(db,[part])
    await db.batch([
      db.prepare(`UPDATE fin_cashflow_entries SET komite_revision=komite_revision+1
        WHERE id=? AND komite_pre_migration=1 AND komite_pengajuan_id IS NULL AND is_void=0
        AND NOT EXISTS(SELECT 1 FROM fin_komite_allocations WHERE cashflow_id=?)`).bind(id,id),
      checkKomiteWrite(db),
      db.prepare(`INSERT INTO fin_komite_allocations (id,cashflow_id,source,group_id,amount,state,actor_id,historical)
        SELECT ?,id,?,?,amount,'realized',?,1 FROM fin_cashflow_entries WHERE id=? AND amount=? AND direction=? AND is_void=0
        AND komite_pengajuan_id IS NULL AND komite_pre_migration=1 AND NOT EXISTS(SELECT 1 FROM fin_komite_allocations WHERE cashflow_id=?)`)
        .bind(crypto.randomUUID(),part.source,part.groupId,userId,id,entry.amount,entry.direction,id),
      checkKomiteWrite(db),
      db.prepare(`INSERT INTO fin_cashflow_audit (id,entry_id,action,after_json,actor_id,reason) VALUES (?,?,'update',?,?,?)`)
        .bind(crypto.randomUUID(),id,JSON.stringify(part),userId,reason.trim()),
    ])
  } catch(error) { return {error:await komiteCashError(db,error,[]),success:null} }
  revalidateCashflow()
  return {error:null,success:'Sumber dana historis tersimpan.'}
}


export async function getCashflowPrintRows(filters: CashflowFilters, detailed: boolean) {
  const { db } = await requireCashflow('read')
  const { where, params, ledgerCte } = ledgerWhere(filters)
  const rows = await db.prepare(`${ledgerCte} SELECT ${detailed ? '*' : 'status,direction,SUM(amount) amount'}
    FROM ledger WHERE ${where}
    ${detailed ? 'ORDER BY transaction_date,created_at,id' : 'GROUP BY status,direction'}`).bind(...params).all<Record<string,unknown>>()
  return {
    income: rows.results.filter(row=>row.status==='active'&&row.direction==='income').reduce((sum,row)=>sum+Number(row.amount),0),
    expense: rows.results.filter(row=>row.status==='active'&&row.direction==='expense').reduce((sum,row)=>sum+Number(row.amount),0),
    entries:detailed ? rows.results.map(toEntry) : [],
  }
}
