'use client'

import { CohortCards } from '@/components/dashboard/cohort-cards'
import { cashCohortMetric } from '@/lib/komite-cohorts'
import { useMemo, useState, useTransition } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, Eye, FileText, Filter,
  Pencil, Plus, RefreshCcw, Search, SlidersHorizontal, Tag, TrendingDown, TrendingUp, XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { RupiahInput } from '@/components/ui/rupiah-input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatRupiah } from '@/lib/utils'
import { formatDateWIB, todayWIB } from '@/lib/time'
import type { CashDirection, CashflowCategory, CashflowEntry, CashflowFilters, CashflowPageData, CashMethod } from '@/lib/cashflow'
import { BudgetPositionSelect, FundSourceSelect } from '@/components/dashboard/komite-fund-fields'
import { komiteFundLabel } from '@/lib/komite-funds'
import { CashflowPrintDialog } from './cashflow-print-dialog'
import { createCashflowEntry, mapHistoricalCashflow, getCashflowPage, updateCashflowEntry, voidCashflowEntry } from './actions'
import type { ProofNumberMode } from '@/lib/komite-report-settings'

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#64748b']
const METHOD_LABEL: Record<string, string> = { tunai: 'Tunai', transfer: 'Transfer', qris: 'QRIS' }
const SOURCE_LABEL: Record<string, string> = { dspt: 'DSPT', spp: 'SPP', manual: 'Manual' }

type FormState = {
  direction: CashDirection
  categoryId: string
  transactionDate: string
  amount: string
  method: CashMethod
  counterparty: string
  description: string
  proofNumber: string
  fundSource: string
  groupId: string
  reason: string
}

function emptyForm(categories: CashflowCategory[], direction: CashDirection = 'income'): FormState {
  return {
    direction,
    categoryId: categories.find(c => c.direction === direction && c.isActive && c.id !== 'expense-komite-spb')?.id || '',
    transactionDate: todayWIB(),
    amount: '',
    method: 'tunai',
    counterparty: '',
    description: '',
    proofNumber: '',
    fundSource: '',
    groupId: '',
    reason: '',
  }
}

function monthLabel(key: string) {
  const [year, month] = key.split('-').map(Number)
  return new Intl.DateTimeFormat('id-ID', { month: 'short', year: '2-digit' }).format(new Date(year, month - 1, 1))
}

function StatCard({ label, value, icon: Icon, tone, note }: { label: string; value: number; icon: any; tone: 'emerald' | 'blue' | 'rose'; note: string }) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    blue: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
    rose: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
  }
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-1 text-lg font-bold tracking-tight tabular-nums text-slate-900 dark:text-white sm:text-xl">{formatRupiah(value)}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">{note}</p>
        </div>
        <span className={`rounded-lg p-2 ${tones[tone]}`}><Icon className="h-4 w-4" /></span>
      </div>
    </div>
  )
}

function ChartCard({ title, children, empty }: { title: string; children: React.ReactNode; empty?: boolean }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h3 className="mb-4 text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
      {empty ? <div className="flex h-64 items-center justify-center text-sm text-slate-400">Belum ada data pada filter ini.</div> : children}
    </section>
  )
}

function AnalyticsTab({ data, direction }: { data: CashflowPageData; direction: CashDirection }) {
  const isIncome = direction === 'income'
  const stats = data.analytics[direction]
  const monthly = (isIncome ? data.analytics.monthlyIncome : data.analytics.monthlyExpense).map(row => ({ ...row, label: monthLabel(row.key) }))
  const methods = isIncome ? data.analytics.incomeMethods : data.analytics.expenseMethods
  const categories = isIncome ? data.analytics.incomeCategories : data.analytics.expenseCategories
  const composition = isIncome ? data.analytics.incomeSources : methods
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[['Total', formatRupiah(stats.total)], ['Jumlah Transaksi', String(stats.count)], ['Rata-rata', formatRupiah(stats.average)], ['Terbesar', formatRupiah(stats.largest)]].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-white">{value}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title={`Tren ${isIncome ? 'Pemasukan' : 'Pengeluaran'} Bulanan`} empty={!monthly.length}>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthly}>
                <defs>
                  <linearGradient id={`cash-${direction}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={isIncome ? '#10b981' : '#f43f5e'} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={isIncome ? '#10b981' : '#f43f5e'} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={v => `${Math.round(v / 1000000)}jt`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => formatRupiah(Number(v))} />
                <Area type="monotone" dataKey="total" name={isIncome ? 'Pemasukan' : 'Pengeluaran'} stroke={isIncome ? '#10b981' : '#f43f5e'} fill={`url(#cash-${direction})`} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
        <ChartCard title={isIncome ? 'Komposisi Sumber Pemasukan' : 'Komposisi Metode Pengeluaran'} empty={!composition.length}>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={composition} dataKey="total" nameKey="label" innerRadius={58} outerRadius={92} paddingAngle={2}>
                  {composition.map((row, index) => <Cell key={row.key} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: any) => formatRupiah(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
        <ChartCard title={isIncome ? 'Pemasukan Manual per Jenis' : 'Pengeluaran per SNP/Kategori'} empty={!categories.length}>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categories.slice(0, 10)} layout="vertical" margin={{ left: 16, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={v => `${Math.round(v / 1000000)}jt`} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="label" width={150} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: any) => formatRupiah(Number(v))} />
                <Bar dataKey="total" name="Nominal" fill={isIncome ? '#3b82f6' : '#f59e0b'} radius={[0, 5, 5, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
        <ChartCard title={`Metode ${isIncome ? 'Pemasukan' : 'Pengeluaran'}`} empty={!methods.length}>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={methods}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={v => `${Math.round(v / 1000000)}jt`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => formatRupiah(Number(v))} />
                <Bar dataKey="total" name="Nominal" fill={isIncome ? '#10b981' : '#f43f5e'} radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>
    </div>
  )
}

export function KasKeluarClient({
  initialData,
  permissions,
  proofNumberMode,
  initialFund,
  initialEntry,
}: {
  initialData: CashflowPageData
  permissions: { create: boolean; update: boolean; delete: boolean }
  proofNumberMode: ProofNumberMode
  initialFund?: string
  initialEntry?: string
}) {
  const [data, setData] = useState(initialData)
  const [filters, setFilters] = useState<CashflowFilters>({ page: 1, pageSize: 20, angkatan: initialFund, entryId: initialEntry })
  const [draftFilters, setDraftFilters] = useState<CashflowFilters>({ page: 1, pageSize: 20, angkatan: initialFund, entryId: initialEntry })
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CashflowEntry | null>(null)
  const [voiding, setVoiding] = useState<CashflowEntry | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [proof, setProof] = useState<File | null>(null)
  const [form, setForm] = useState<FormState>(() => emptyForm(initialData.categories))
  const activeCategories = useMemo(
    () => data.categories.filter(c => c.direction === form.direction && c.isActive && c.id !== 'expense-komite-spb'),
    [data.categories, form.direction],
  )

  function load(next: CashflowFilters) {
    setFilters(next)
    setDraftFilters(next)
    startTransition(async () => {
      try {
        setData(await getCashflowPage(next))
      } catch {
        setMessage('Gagal memuat arus kas. Silakan coba lagi.')
      }
    })
  }

  function openCreate(direction: CashDirection) {
    setEditing(null)
    setProof(null)
    setForm(emptyForm(data.categories, direction))
    setFormOpen(true)
  }

  function openEdit(entry: CashflowEntry) {
    setEditing(entry)
    setProof(null)
    setForm({
      direction: entry.direction,
      categoryId: entry.categoryId || '',
      transactionDate: entry.transactionDate,
      amount: String(entry.amount),
      method: entry.method,
      counterparty: entry.counterparty,
      description: entry.description,
      proofNumber: entry.proofNumber || '',
      fundSource: entry.fundSource === 'unmapped' ? '' : entry.fundSource || '',
      groupId: entry.groupId || '',
      reason: '',
    })
    setFormOpen(true)
  }

  function changeDirection(direction: CashDirection) {
    setForm(current => ({
      ...current,
      direction,
      categoryId: data.categories.find(c => c.direction === direction && c.isActive && c.id !== 'expense-komite-spb')?.id || '',
    }))
  }

  function saveEntry(event: React.FormEvent) {
    event.preventDefault()
    setMessage('')
    const payload = { ...form, amount: Number(form.amount) }
    const fd = new FormData()
    if (proof) fd.set('proof', proof)
    startTransition(async () => {
      const result = editing?.fundSource === 'unmapped'
        ? await mapHistoricalCashflow(editing.id, form.fundSource, form.groupId, form.reason)
        : editing
          ? await updateCashflowEntry(editing.id, payload, fd)
          : await createCashflowEntry(payload, fd)
      setMessage(result.error ?? result.success ?? '')
      if (!result.error) {
        setFormOpen(false)
        setData(await getCashflowPage(filters))
      }
    })
  }

  function confirmVoid() {
    if (!voiding) return
    startTransition(async () => {
      const result = await voidCashflowEntry(voiding.id, voidReason)
      setMessage(result.error ?? result.success ?? '')
      if (!result.error) {
        setVoiding(null)
        setVoidReason('')
        setData(await getCashflowPage(filters))
      }
    })
  }

  const historical = editing?.fundSource === 'unmapped'
  const totalPages = Math.max(1, Math.ceil(data.totalRows / Number(filters.pageSize || 20)))
  const advancedCount = [
    draftFilters.dateFrom,
    draftFilters.dateTo,
    draftFilters.method && draftFilters.method !== 'all',
    draftFilters.recorderId,
    draftFilters.status && draftFilters.status !== 'active',
    draftFilters.studentScope && draftFilters.studentScope !== 'all',
    draftFilters.kelasId,
  ].filter(Boolean).length

  const unmappedTotals = data.cohortTotals?.unmapped
  const hasUnmapped = Boolean((unmappedTotals?.income ?? 0) > 0 || (unmappedTotals?.expense ?? 0) > 0 || data.entries.some(e => e.fundSource === 'unmapped' && e.status === 'active'))

  return (
    <div className="space-y-3.5 pb-10">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 [&>div]:mb-0">
          <CashflowPrintDialog filters={filters} data={data} />
          {filters.entryId && (
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => load({ ...filters, entryId: undefined })}>
              Tampilkan semua transaksi
            </Button>
          )}
        </div>
        {permissions.create && (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" className="h-8 gap-1.5 border-emerald-200 text-xs text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-300" onClick={() => openCreate('income')}>
              <Plus className="h-3.5 w-3.5" /> Catat Pemasukan
            </Button>
            <Button size="sm" className="h-8 gap-1.5 bg-rose-600 text-xs text-white hover:bg-rose-700" onClick={() => openCreate('expense')}>
              <Plus className="h-3.5 w-3.5" /> Catat Pengeluaran
            </Button>
          </div>
        )}
      </div>

      <CohortCards
        compact
        activeYears={data.activeYears}
        years={data.angkatan}
        value={filters.angkatan ?? 'all'}
        cashScopes
        disabled={isPending}
        metrics={Object.fromEntries(['all', ...data.activeYears.map(String)].map(scope => {
          const totals = data.cohortTotals[scope]
          return [scope, cashCohortMetric(totals?.income ?? 0, totals?.expense ?? 0)]
        }))}
        onChange={scope => {
          const angkatan = scope === 'all' ? undefined : scope
          const next = { ...filters, angkatan, page: 1 }
          setFilters(next)
          setDraftFilters(current => ({ ...current, angkatan, page: 1 }))
          startTransition(async () => {
            try {
              setData(await getCashflowPage(next))
            } catch {
              setFilters(filters)
              setDraftFilters(current => ({ ...current, angkatan: filters.angkatan }))
              setMessage('Gagal memuat arus kas. Silakan coba lagi.')
            }
          })
        }}
      />

      {hasUnmapped && filters.angkatan !== 'unmapped' && (
        <div className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-3.5 py-2.5 text-xs dark:border-amber-900/60 dark:bg-amber-950/30 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2 text-amber-900 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <p className="font-semibold">Terdapat transaksi historis yang belum dipetakan sumber dananya</p>
              <p className="text-amber-700 dark:text-amber-300">Filter ke cakupan &ldquo;Belum dipetakan&rdquo; lalu klik tombol <strong>Petakan</strong> pada baris terkait.</p>
            </div>
          </div>
          <Button size="sm" variant="outline" className="h-8 shrink-0 border-amber-300 bg-white text-xs text-amber-900 hover:bg-amber-100" onClick={() => load({ ...filters, angkatan: 'unmapped', page: 1 })}>
            <Tag className="mr-1.5 h-3.5 w-3.5" /> Tampilkan Belum Dipetakan
          </Button>
        </div>
      )}

      <div className="grid gap-2.5 md:grid-cols-3">
        <StatCard label="Pemasukan Sesuai Filter" value={data.summary.totalIncome} icon={TrendingUp} tone="emerald" note="DSPT, SPP lama, dan pemasukan manual" />
        <StatCard label="Pemasukan Manual" value={data.summary.manualIncome} icon={ArrowUpRight} tone="blue" note="Dicatat langsung pada modul Arus Kas" />
        <StatCard label="Total Pengeluaran" value={data.summary.totalExpense} icon={TrendingDown} tone="rose" note="Pengeluaran manual & realisasi SPB" />
      </div>

      <search aria-label="Filter arus kas" className="space-y-2.5 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              className="h-8 pl-8 text-sm"
              placeholder="Cari sumber, penerima, no. bukti, keterangan..."
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              value={draftFilters.search || ''}
              onChange={e => setDraftFilters(f => ({ ...f, search: e.target.value || undefined }))}
              onKeyDown={e => { if (e.key === 'Enter') load({ ...draftFilters, page: 1 }) }}
            />
          </div>
          <Select value={draftFilters.direction || 'all'} onValueChange={v => setDraftFilters(f => ({ ...f, direction: v as any, categoryId: undefined }))}>
            <SelectTrigger aria-label="Arah kas" className="h-8 w-36 text-xs"><SelectValue placeholder="Arah" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Arah</SelectItem>
              <SelectItem value="income">Pemasukan</SelectItem>
              <SelectItem value="expense">Pengeluaran</SelectItem>
            </SelectContent>
          </Select>
          <Select value={draftFilters.source || 'all'} onValueChange={v => setDraftFilters(f => ({ ...f, source: v as any }))}>
            <SelectTrigger aria-label="Sumber asal" className="h-8 w-36 text-xs"><SelectValue placeholder="Sumber" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Sumber</SelectItem>
              <SelectItem value="dspt">DSPT</SelectItem>
              <SelectItem value="spp">SPP Lama</SelectItem>
              <SelectItem value="manual">Manual / SPB</SelectItem>
            </SelectContent>
          </Select>
          <Select value={draftFilters.categoryId || 'all'} onValueChange={v => setDraftFilters(f => ({ ...f, categoryId: v === 'all' ? undefined : v }))}>
            <SelectTrigger aria-label="Kategori kas" className="h-8 w-44 text-xs"><SelectValue placeholder="Kategori" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Kategori</SelectItem>
              {data.categories.filter(c => !draftFilters.direction || draftFilters.direction === 'all' || c.direction === draftFilters.direction).map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}{!c.isActive ? ' (nonaktif)' : ''}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="sm"
            variant={showAdvanced || advancedCount > 0 ? 'secondary' : 'ghost'}
            className="h-8 gap-1.5 px-2.5 text-xs"
            onClick={() => setShowAdvanced(prev => !prev)}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filter Lanjutan
            {advancedCount > 0 && <span className="rounded-full bg-emerald-600 px-1.5 text-[10px] font-bold text-white">{advancedCount}</span>}
          </Button>
          <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => load({ ...draftFilters, page: 1 })} disabled={isPending}>
            {isPending ? <RefreshCcw className="h-3.5 w-3.5 animate-spin" /> : <Filter className="h-3.5 w-3.5" />} Terapkan
          </Button>
          <Button size="sm" variant="ghost" className="h-8 px-2 text-xs text-slate-500" onClick={() => load({ page: 1, pageSize: 20 })}>
            Reset
          </Button>
        </div>

        {(showAdvanced || advancedCount > 0) && (
          <div className="grid gap-2 border-t border-slate-100 pt-2.5 dark:border-slate-800 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            <Input type="date" className="h-8 text-xs" value={draftFilters.dateFrom || ''} onChange={e => setDraftFilters(f => ({ ...f, dateFrom: e.target.value || undefined }))} aria-label="Tanggal awal" />
            <Input type="date" className="h-8 text-xs" value={draftFilters.dateTo || ''} onChange={e => setDraftFilters(f => ({ ...f, dateTo: e.target.value || undefined }))} aria-label="Tanggal akhir" />
            <Select value={draftFilters.method || 'all'} onValueChange={v => setDraftFilters(f => ({ ...f, method: v as any }))}>
              <SelectTrigger aria-label="Metode pembayaran" className="h-8 text-xs"><SelectValue placeholder="Metode" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Metode</SelectItem>
                <SelectItem value="tunai">Tunai</SelectItem>
                <SelectItem value="transfer">Transfer</SelectItem>
                <SelectItem value="qris">QRIS</SelectItem>
              </SelectContent>
            </Select>
            <Select value={draftFilters.recorderId || 'all'} onValueChange={v => setDraftFilters(f => ({ ...f, recorderId: v === 'all' ? undefined : v }))}>
              <SelectTrigger aria-label="Pencatat" className="h-8 text-xs"><SelectValue placeholder="Pencatat" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Pencatat</SelectItem>
                {data.recorders.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={draftFilters.status || 'active'} onValueChange={v => setDraftFilters(f => ({ ...f, status: v as any }))}>
              <SelectTrigger aria-label="Status transaksi" className="h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Aktif</SelectItem>
                <SelectItem value="void">Dibatalkan</SelectItem>
                <SelectItem value="all">Semua Status</SelectItem>
              </SelectContent>
            </Select>
            <Select value={draftFilters.studentScope || 'all'} onValueChange={v => setDraftFilters(f => ({ ...f, studentScope: v === 'active_students' ? 'active_students' : 'all' }))}>
              <SelectTrigger aria-label="Cakupan siswa" className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua status siswa</SelectItem>
                <SelectItem value="active_students">Siswa aktif</SelectItem>
              </SelectContent>
            </Select>
            <Select value={draftFilters.kelasId || 'all'} onValueChange={v => setDraftFilters(f => ({ ...f, kelasId: v === 'all' ? undefined : v }))}>
              <SelectTrigger aria-label="Kelas" className="h-8 text-xs"><SelectValue placeholder="Kelas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kelas</SelectItem>
                {data.classes.map(k => <SelectItem key={k.id} value={k.id}>{k.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </search>

      {message && (
        <div role="status" className={`rounded-lg px-3 py-2 text-xs font-medium ${message.toLowerCase().includes('berhasil') || message.toLowerCase().includes('dipetakan') ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'}`}>
          {message}
        </div>
      )}

      <Tabs defaultValue="transactions" className="space-y-3">
        <TabsList className="h-auto max-w-full justify-start overflow-x-auto bg-slate-100 p-1 dark:bg-slate-800 sm:w-auto">
          <TabsTrigger value="transactions" className="shrink-0 text-xs"><FileText className="mr-1.5 h-3.5 w-3.5" />Daftar Transaksi</TabsTrigger>
          <TabsTrigger value="income" className="shrink-0 text-xs"><ArrowUpRight className="mr-1.5 h-3.5 w-3.5" />Analitik Pemasukan</TabsTrigger>
          <TabsTrigger value="expense" className="shrink-0 text-xs"><ArrowDownRight className="mr-1.5 h-3.5 w-3.5" />Analitik Pengeluaran</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="mt-0">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            {/* Mobile Card List */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800 md:hidden">
              {!data.entries.length ? (
                <div className="py-12 text-center text-sm text-slate-400">Tidak ada transaksi sesuai filter.</div>
              ) : (
                data.entries.map(entry => {
                  const isUnmapped = entry.fundSource === 'unmapped'
                  const canEditRow = entry.origin === 'manual' && !entry.linkedSpb && entry.status === 'active'
                  return (
                    <div key={`m-${entry.id}`} className={`space-y-2 p-3.5 ${entry.status === 'void' ? 'opacity-55' : ''}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${entry.direction === 'income' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'}`}>
                              {entry.direction === 'income' ? 'Masuk' : 'Keluar'}
                            </span>
                            {isUnmapped && (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                                Belum Dipetakan
                              </span>
                            )}
                            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{entry.categoryName}</p>
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-xs text-slate-600 dark:text-slate-300">{entry.description}</p>
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            {formatDateWIB(entry.transactionDate, { day: '2-digit', month: 'short', year: 'numeric' })} · {SOURCE_LABEL[entry.source]} · {entry.fundSource?.split('|').map(komiteFundLabel).join(', ')}
                          </p>
                        </div>
                        <p className={`shrink-0 text-sm font-bold tabular-nums ${entry.direction === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {entry.direction === 'income' ? '+' : '-'}{formatRupiah(entry.amount)}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-slate-400">No. bukti: {entry.proofNumber || '-'}</span>
                        <div className="flex items-center gap-1">
                          {entry.proofUrl && (
                            <Button asChild variant="outline" size="sm" className="h-7 px-2 text-xs">
                              <a href={entry.proofUrl} target="_blank" rel="noreferrer"><Eye className="mr-1 h-3 w-3" /> Bukti</a>
                            </Button>
                          )}
                          {canEditRow && permissions.update && (
                            isUnmapped ? (
                              <Button size="sm" variant="outline" className="h-7 border-amber-300 bg-amber-50 px-2.5 text-xs text-amber-800" onClick={() => openEdit(entry)}>
                                <Tag className="mr-1 h-3 w-3" /> Petakan
                              </Button>
                            ) : (
                              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => openEdit(entry)}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                            )
                          )}
                          {canEditRow && permissions.delete && (
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-rose-600" onClick={() => setVoiding(entry)}>
                              <XCircle className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Desktop Table */}
            <div role="region" aria-label="Tabel transaksi arus kas" tabIndex={0} className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 dark:bg-slate-800/60">
                    <TableHead className="text-xs font-semibold">Tanggal</TableHead>
                    <TableHead className="text-xs font-semibold">Arus / Sumber Dana</TableHead>
                    <TableHead className="text-xs font-semibold">Kategori & Keterangan</TableHead>
                    <TableHead className="text-xs font-semibold">Pihak</TableHead>
                    <TableHead className="text-xs font-semibold">Metode</TableHead>
                    <TableHead className="text-xs font-semibold">Pencatat</TableHead>
                    <TableHead className="text-right text-xs font-semibold">Nominal</TableHead>
                    <TableHead className="w-32 text-xs font-semibold">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!data.entries.length && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-12 text-center text-sm text-slate-400">Tidak ada transaksi sesuai filter.</TableCell>
                    </TableRow>
                  )}
                  {data.entries.map(entry => {
                    const isUnmapped = entry.fundSource === 'unmapped'
                    const canEditRow = entry.origin === 'manual' && !entry.linkedSpb && entry.status === 'active'
                    return (
                      <TableRow key={entry.id} className={entry.status === 'void' ? 'opacity-55' : ''}>
                        <TableCell className="whitespace-nowrap text-xs text-slate-600 dark:text-slate-300">
                          {formatDateWIB(entry.transactionDate, { day: '2-digit', month: 'short', year: 'numeric' })}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-1">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${entry.direction === 'income' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'}`}>
                              {entry.direction === 'income' ? 'Masuk' : 'Keluar'}
                            </span>
                            {isUnmapped && (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                                Belum Dipetakan
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-slate-400">
                            {SOURCE_LABEL[entry.source]} · {entry.fundSource?.split('|').map(komiteFundLabel).join(', ')}
                          </p>
                        </TableCell>
                        <TableCell className="min-w-[220px]">
                          <p className="text-sm font-medium">{entry.categoryName}</p>
                          <p className="max-w-xs truncate text-xs text-slate-500">{entry.description}</p>
                          <p className="text-[11px] text-slate-400">No. bukti: {entry.proofNumber || '-'}</p>
                          {entry.status === 'void' && <p className="text-xs font-medium text-rose-600">Batal: {entry.voidReason}</p>}
                        </TableCell>
                        <TableCell className="text-sm">{entry.counterparty || '-'}</TableCell>
                        <TableCell className="text-xs">{METHOD_LABEL[entry.method] || entry.method}</TableCell>
                        <TableCell className="text-xs text-slate-500">{entry.recorderName}</TableCell>
                        <TableCell className={`text-right text-sm font-bold tabular-nums ${entry.direction === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {entry.direction === 'income' ? '+' : '-'}{formatRupiah(entry.amount)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {entry.proofUrl && (
                              <Button asChild variant="ghost" size="sm" className="h-7 w-7 p-0">
                                <a href={entry.proofUrl} target="_blank" rel="noreferrer" aria-label="Lihat bukti"><Eye className="h-3.5 w-3.5" /></a>
                              </Button>
                            )}
                            {canEditRow && (
                              <>
                                {permissions.update && (
                                  isUnmapped ? (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 gap-1 border-amber-300 bg-amber-50 px-2 text-xs text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
                                      onClick={() => openEdit(entry)}
                                    >
                                      <Tag className="h-3 w-3" /> Petakan
                                    </Button>
                                  ) : (
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(entry)} aria-label="Edit transaksi">
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                  )
                                )}
                                {permissions.delete && (
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-rose-600" onClick={() => setVoiding(entry)} aria-label="Batalkan transaksi">
                                    <XCircle className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-xs sm:text-sm">
              <span className="tabular-nums text-slate-500">{data.totalRows} transaksi · Halaman {filters.page || 1} dari {totalPages}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="h-8 text-xs" disabled={(filters.page || 1) <= 1 || isPending} onClick={() => load({ ...filters, page: Number(filters.page || 1) - 1 })}>Sebelumnya</Button>
                <Button size="sm" variant="outline" className="h-8 text-xs" disabled={(filters.page || 1) >= totalPages || isPending} onClick={() => load({ ...filters, page: Number(filters.page || 1) + 1 })}>Berikutnya</Button>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="income" className="mt-0"><AnalyticsTab data={data} direction="income" /></TabsContent>
        <TabsContent value="expense" className="mt-0"><AnalyticsTab data={data} direction="expense" /></TabsContent>
      </Tabs>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {historical ? 'Petakan Sumber Dana Transaksi' : editing ? 'Edit Transaksi Arus Kas' : form.direction === 'income' ? 'Catat Pemasukan Manual' : 'Catat Pengeluaran'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={saveEntry} className="space-y-4">
            <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900">
              <Label htmlFor="cash-fund">Sumber dana</Label>
              <FundSourceSelect id="cash-fund" required years={data.angkatan} value={form.fundSource} onValueChange={fundSource => setForm({ ...form, fundSource, groupId: '' })} />
              {form.direction === 'expense' && Number(form.fundSource) >= 2026 && (
                <>
                  <Label htmlFor="cash-pos" className="block pt-1">Pos RAPBM</Label>
                  <BudgetPositionSelect
                    id="cash-pos"
                    value={form.groupId}
                    positions={((historical ? data.historicalPositions : data.positions) ?? []).filter(p => p.cohort === Number(form.fundSource))}
                    onValueChange={groupId => setForm({ ...form, groupId })}
                  />
                </>
              )}
              {historical && (
                <div className="space-y-1.5 pt-1">
                  <Label htmlFor="cash-map-reason">Alasan pemetaan <span className="text-rose-500">*</span></Label>
                  <Input id="cash-map-reason" required minLength={3} maxLength={300} placeholder="Contoh: Pengeluaran operasional angkatan 2026" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} />
                </div>
              )}
            </div>

            <fieldset className="space-y-3.5" disabled={historical}>
              <legend className="sr-only">Rincian transaksi arus kas</legend>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Arah</Label>
                  <Select value={form.direction} onValueChange={v => changeDirection(v as CashDirection)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">Pemasukan</SelectItem>
                      <SelectItem value="expense">Pengeluaran</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cash-date">Tanggal</Label>
                  <Input id="cash-date" type="date" required value={form.transactionDate} onChange={e => setForm(f => ({ ...f, transactionDate: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Jenis / Kategori</Label>
                <Select value={form.categoryId} onValueChange={v => setForm(f => ({ ...f, categoryId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                  <SelectContent>{activeCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cash-amount">Nominal</Label>
                  <RupiahInput id="cash-amount" required min={1} disabled={historical} value={form.amount} onValueChange={raw => setForm(f => ({ ...f, amount: raw }))} placeholder="0" />
                </div>
                <div className="space-y-1.5">
                  <Label>Metode</Label>
                  <Select value={form.method} onValueChange={v => setForm(f => ({ ...f, method: v as CashMethod }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tunai">Tunai</SelectItem>
                      <SelectItem value="transfer">Transfer</SelectItem>
                      <SelectItem value="qris">QRIS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cash-proof-no">Nomor bukti</Label>
                <Input
                  id="cash-proof-no"
                  maxLength={80}
                  autoCorrect="off"
                  spellCheck={false}
                  disabled={proofNumberMode === 'automatic' || historical}
                  value={form.proofNumber}
                  onChange={e => setForm(f => ({ ...f, proofNumber: e.target.value }))}
                  placeholder={proofNumberMode === 'automatic' ? 'Dibuat otomatis saat disimpan' : proofNumberMode === 'manual' ? 'Wajib diisi' : 'Opsional; jika kosong dibuat otomatis'}
                />
                <p className="text-xs text-slate-400">Mode saat ini: {proofNumberMode === 'automatic' ? 'otomatis KM/KK' : proofNumberMode === 'manual' ? 'manual wajib' : 'nomor sumber, lalu otomatis'}.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cash-counterparty">{form.direction === 'income' ? 'Sumber / Pembayar' : 'Penerima'}</Label>
                <Input id="cash-counterparty" maxLength={150} value={form.counterparty} onChange={e => setForm(f => ({ ...f, counterparty: e.target.value }))} placeholder={form.direction === 'income' ? 'Contoh: Donatur atau instansi' : 'Nama penerima atau penyedia'} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cash-desc">Keterangan</Label>
                <Input id="cash-desc" required maxLength={500} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Uraian transaksi" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cash-proof-file">Bukti opsional</Label>
                <Input id="cash-proof-file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => setProof(e.target.files?.[0] || null)} />
                <p className="text-xs text-slate-400">JPG/PNG/WebP maksimal 2 MB atau PDF maksimal 5 MB.</p>
              </div>
            </fieldset>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Batal</Button>
              <Button type="submit" disabled={isPending}>{isPending ? 'Menyimpan...' : historical ? 'Simpan Pemetaan' : 'Simpan'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!voiding} onOpenChange={open => { if (!open) setVoiding(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Batalkan Transaksi</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600 dark:text-slate-300">Transaksi tetap tersimpan sebagai jejak audit dan tidak lagi dihitung dalam saldo kas.</p>
          <div className="space-y-1.5">
            <Label htmlFor="cash-void-reason">Alasan pembatalan</Label>
            <Input id="cash-void-reason" value={voidReason} maxLength={300} onChange={e => setVoidReason(e.target.value)} placeholder="Minimal 3 karakter" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setVoiding(null)}>Kembali</Button>
            <Button variant="destructive" disabled={isPending || voidReason.trim().length < 3} onClick={confirmVoid}>
              {isPending ? 'Membatalkan...' : 'Batalkan Transaksi'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
