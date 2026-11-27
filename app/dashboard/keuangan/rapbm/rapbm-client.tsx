'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, ArrowRight, ChevronDown, Download, FileSpreadsheet, Info, Loader2, Search, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { RupiahInput } from '@/components/ui/rupiah-input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatRupiah } from '@/lib/utils'
import {
  filterRapbmBySource,
  filterRapbmGroups,
  hasKomiteAllocation,
  rapbmStatusLabel,
  type RapbmActionResult,
  type RapbmAmounts,
  type RapbmFundingView,
  type RapbmGroup,
  type RapbmItem,
  type RapbmNote,
  type RapbmPageData,
} from '@/lib/rapbm'
import { activateKomiteRapbm, configureKomiteRapbm, importInitialRapbmAction, publishRapbmAction } from './actions'

const money = (value: number | null) => (value === null ? '—' : formatRupiah(value))
const date = (value: string) =>
  new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeZone: 'Asia/Jakarta' }).format(
    new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`),
  )

type BudgetData = {
  groups: { id: string; label: string; account: string | null; komite: number | null; detail: number }[]
  positions: { group_id: string; label: string; account: string | null; amount: number; available: number; locked: number; realized: number }[]
  history: { id: string; group_id: string; amount: number; state: string; cashflow_id: string | null; pengajuan_id: string | null; created_at: string; proof: string | null; description: string }[]
  associations: { id: string; year: number; cohort: number | null; enabled: number | null; carry_forward: number | null; revision_reason: string | null }[]
  remaining: { version_id: string; cohort: number; available: number }[]
}

export function RapbmClient({ data, budget }: { data: RapbmPageData; budget: BudgetData }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [importOpen, setImportOpen] = useState(false)
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)
  const [komiteQuery, setKomiteQuery] = useState('')
  const [komiteSection, setKomiteSection] = useState<'expense' | 'income'>('expense')
  const [apbnQuery, setApbnQuery] = useState('')
  const [apbnSection, setApbnSection] = useState<'expense' | 'income'>('expense')
  const [combinedQuery, setCombinedQuery] = useState('')
  const [combinedFunding, setCombinedFunding] = useState('all')
  const [combinedSection, setCombinedSection] = useState<'expense' | 'income'>('expense')
  const { selected, document, versions, canManage } = data

  const activeKomitePositions = budget.positions.filter(p => p.amount > 0 || p.locked > 0 || p.realized > 0)
  const showPaguTab = Boolean(budget.positions.length || (canManage && selected && selected.status !== 'draft'))
  const [tab, setTab] = useState(() => (budget.positions.length > 0 ? 'pagu' : 'komite'))
  const activeTab = tab === 'pagu' && !showPaguTab ? 'komite' : tab

  const komiteExpensesAll = document ? filterRapbmBySource(document.expenses, 'komite') : []
  const komiteExpenses = document ? filterRapbmBySource(document.expenses, 'komite', komiteQuery) : []
  const komiteIncome = document ? filterRapbmBySource(document.income, 'komite') : []

  const apbnExpensesAll = document ? filterRapbmBySource(document.expenses, 'apbn') : []
  const apbnExpenses = document ? filterRapbmBySource(document.expenses, 'apbn', apbnQuery) : []
  const apbnIncome = document ? filterRapbmBySource(document.income, 'apbn') : []

  const combinedGroups = document ? filterRapbmGroups(document.expenses, combinedQuery, combinedFunding) : []
  const combinedFiltered = combinedQuery.trim() !== '' || combinedFunding !== 'all'

  const [cohortFilter, setCohortFilter] = useState('all')
  const cohorts = [...new Set(budget.associations.flatMap(row => (row.cohort ? [row.cohort] : [])))].sort((a, b) => b - a)
  const filteredVersions = cohortFilter === 'all' ? versions : versions.filter(v => budget.associations.some(row => row.id === v.id && row.cohort === Number(cohortFilter)))
  const years = [...new Set(filteredVersions.map(v => v.year))]
  const has2026 = versions.some(v => v.year === 2026)

  function navigate(year: number, version?: string) {
    const params = new URLSearchParams({ year: String(year) })
    if (version) params.set('version', version)
    router.push(`/dashboard/keuangan/rapbm?${params}`)
  }

  function run(task: () => Promise<RapbmActionResult>, close?: () => void) {
    setMessage(null)
    startTransition(async () => {
      try {
        const result = await task()
        if (result.error !== undefined) throw new Error(result.error)
        setMessage({ text: result.success, error: false })
        close?.()
        navigate(result.year, result.id)
        router.refresh()
      } catch (error) {
        setMessage({ text: error instanceof Error ? error.message : 'RAPBM belum dapat diproses. Silakan coba lagi.', error: true })
      }
    })
  }

  return (
    <div className="space-y-4 pb-8">
      <div className="flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
          <div className="space-y-1.5">
            <Label htmlFor="rapbm-cohort" className="text-xs">Angkatan</Label>
            <Select
              value={cohortFilter}
              onValueChange={cohort => {
                setCohortFilter(cohort)
                const version = versions.find(v => cohort === 'all' || budget.associations.some(row => row.id === v.id && row.cohort === Number(cohort)))
                if (version) navigate(version.year, version.id)
              }}
            >
              <SelectTrigger id="rapbm-cohort" className="h-9 w-full text-xs sm:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Angkatan</SelectItem>
                {cohorts.map(year => <SelectItem key={year} value={String(year)}>Angkatan {year}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rapbm-year" className="text-xs">Tahun anggaran</Label>
            <Select
              value={selected ? String(selected.year) : ''}
              disabled={pending || !years.length}
              onValueChange={year => {
                const candidates = filteredVersions.filter(v => v.year === Number(year))
                const version = candidates.find(v => v.status === 'published') ?? candidates[0]
                navigate(Number(year), version?.id)
              }}
            >
              <SelectTrigger id="rapbm-year" className="h-9 w-full text-xs sm:w-32"><SelectValue placeholder="Pilih tahun" /></SelectTrigger>
              <SelectContent>{years.map(year => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1.5 sm:col-span-1">
            <Label htmlFor="rapbm-version" className="text-xs">Versi dokumen</Label>
            <Select value={selected?.id || ''} disabled={pending || !selected} onValueChange={id => selected && navigate(selected.year, id)}>
              <SelectTrigger id="rapbm-version" className="h-9 w-full text-xs sm:w-56"><SelectValue placeholder="Pilih versi" /></SelectTrigger>
              <SelectContent>
                {filteredVersions.filter(v => v.year === selected?.year).map(v => (
                  <SelectItem key={v.id} value={v.id}>
                    Versi {v.version} · {v.status === 'draft' ? 'Draft' : v.status === 'published' ? 'Terbit' : 'Arsip'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {selected && (
            <Button asChild variant="outline" size="sm" className="h-9 text-xs">
              <a href={`/api/keuangan/rapbm/${selected.id}/source`}><Download className="mr-1.5 h-3.5 w-3.5" />Excel Sumber</a>
            </Button>
          )}
          {canManage && (
            <Button size="sm" className="h-9 text-xs" disabled={pending} onClick={() => { setMessage(null); setImportOpen(true) }}>
              <Upload className="mr-1.5 h-3.5 w-3.5" />Impor Versi Baru
            </Button>
          )}
        </div>
      </div>

      {message && (
        <div role={message.error ? 'alert' : 'status'} className={`rounded-lg border px-4 py-3 text-sm ${message.error ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200' : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200'}`}>
          {message.text}
        </div>
      )}

      {document && selected ? (
        <>
          <div className="flex flex-wrap items-start justify-between gap-2 text-sm">
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">{document.institution}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {rapbmStatusLabel(selected.status)} · Versi {selected.version} · {selected.published_at ? `Diterbitkan ${date(selected.published_at)}` : `Diimpor ${date(selected.created_at)}`}
              </p>
            </div>
            {selected.status === 'superseded' && (
              <p className="rounded-md bg-amber-50 px-2.5 py-1 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                Sedang melihat versi arsip. Pilih versi terbit untuk dokumen aktif.
              </p>
            )}
          </div>

          <div className="space-y-2.5">
            <KomiteBudgetSummary income={document.incomeTotal} expense={document.expenseTotal} />
            <ApbnReferenceStrip
              income={document.incomeTotal}
              expense={document.expenseTotal}
              onOpenApbn={() => setTab('apbn')}
            />
          </div>
          <p className="-mt-1 text-xs text-muted-foreground">Nominal mengikuti dokumen sumber Excel. Tanda — menandakan sel kosong (bukan nol).</p>

          {document.notes.length > 0 && <Notes notes={document.notes} />}
          {canManage && selected.status === 'draft' && (
            <PublishPanel key={selected.id} noteCount={document.notes.length} pending={pending} onPublish={ack => run(() => publishRapbmAction(selected.id, data.publicationRevision, ack))} />
          )}

          <Tabs value={activeTab} onValueChange={setTab} className="space-y-4">
            <TabsList className="h-auto max-w-full justify-start overflow-x-auto p-1">
              {showPaguTab && (
                <TabsTrigger value="pagu" className="shrink-0 text-xs">
                  Pagu Komite {activeKomitePositions.length ? `(${activeKomitePositions.length} Pos)` : ''}
                </TabsTrigger>
              )}
              <TabsTrigger value="komite" className="shrink-0 text-xs">
                Anggaran Komite ({komiteExpensesAll.length})
              </TabsTrigger>
              <TabsTrigger value="apbn" className="shrink-0 text-xs">
                Info APBN ({apbnExpensesAll.length})
              </TabsTrigger>
              <TabsTrigger value="combined" className="shrink-0 text-xs">
                Dokumen Gabungan ({document.expenses.length})
              </TabsTrigger>
            </TabsList>

            {showPaguTab && (
              <TabsContent value="pagu" className="mt-0">
                <OperationalBudget key={selected.id} version={selected.id} ready={selected.status !== 'draft'} budget={budget} canManage={canManage} />
              </TabsContent>
            )}

            <TabsContent value="komite" className="mt-0 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <SectionToggle
                  section={komiteSection}
                  onChange={setKomiteSection}
                  expenseLabel={`Belanja Komite (${komiteExpensesAll.length})`}
                  incomeLabel={`Pendapatan Komite (${komiteIncome.length})`}
                />
                <p className="text-xs text-muted-foreground">
                  Menampilkan khusus rencana anggaran yang bersumber dari dana Komite.
                </p>
              </div>

              {komiteSection === 'expense' ? (
                <>
                  <search aria-label="Filter rincian belanja Komite" className="relative">
                    <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      aria-label="Cari uraian atau kode akun belanja Komite"
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                      value={komiteQuery}
                      onChange={event => setKomiteQuery(event.target.value)}
                      placeholder="Cari uraian kegiatan atau kode akun belanja Komite..."
                      className="h-9 pl-9 text-sm"
                    />
                  </search>
                  <p className="text-xs text-muted-foreground">
                    {komiteExpenses.length} kelompok · {komiteExpenses.reduce((sum, g) => sum + g.items.length, 0)} rincian Komite{komiteQuery.trim() ? ' cocok dengan pencarian (subtotal tetap mengikuti dokumen lengkap).' : ''}
                  </p>
                  <div className="space-y-3 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200" key={`komite:${komiteQuery}`}>
                    {komiteExpenses.map(group => (
                      <Group key={group.reference} group={group} mode="komite" filtered={komiteQuery.trim() !== ''} />
                    ))}
                    {!komiteExpenses.length && (
                      <div className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
                        Tidak ada rincian belanja Komite yang sesuai.
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">Sumber pendapatan Komite yang direncanakan untuk tahun anggaran {document.year}.</p>
                  {komiteIncome.map(group => <Group key={group.reference} group={group} mode="komite" income />)}
                  {!komiteIncome.length && (
                    <div className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
                      Belum ada rincian pendapatan Komite pada dokumen ini.
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="apbn" className="mt-0 space-y-3">
              <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-3 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">Informasi Referensi APBN (Hanya Baca)</p>
                  <p className="mt-0.5 leading-5 text-slate-600 dark:text-slate-400">
                    Data APBN di bawah ini berasal dari dokumen RAPBM madrasah hanya sebagai referensi. Pengeluaran, SPB, dan pencatatan Arus Kas di aplikasi ini khusus mengelola anggaran Komite.
                  </p>
                </div>
              </div>

              <SectionToggle
                section={apbnSection}
                onChange={setApbnSection}
                expenseLabel={`Belanja APBN (${apbnExpensesAll.length})`}
                incomeLabel={`Pendapatan APBN (${apbnIncome.length})`}
              />

              {apbnSection === 'expense' ? (
                <>
                  <search aria-label="Filter rincian belanja APBN" className="relative">
                    <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      aria-label="Cari uraian atau kode akun belanja APBN"
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                      value={apbnQuery}
                      onChange={event => setApbnQuery(event.target.value)}
                      placeholder="Cari uraian kegiatan atau kode akun referensi APBN..."
                      className="h-9 pl-9 text-sm"
                    />
                  </search>
                  <p className="text-xs text-muted-foreground">
                    {apbnExpenses.length} kelompok · {apbnExpenses.reduce((sum, g) => sum + g.items.length, 0)} rincian APBN{apbnQuery.trim() ? ' cocok dengan pencarian (subtotal tetap mengikuti dokumen lengkap).' : ''}
                  </p>
                  <div className="space-y-3 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200" key={`apbn:${apbnQuery}`}>
                    {apbnExpenses.map(group => (
                      <Group key={group.reference} group={group} mode="apbn" filtered={apbnQuery.trim() !== ''} />
                    ))}
                    {!apbnExpenses.length && (
                      <div className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
                        Tidak ada rincian APBN yang sesuai.
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">Referensi sumber pendapatan APBN untuk tahun anggaran {document.year}.</p>
                  {apbnIncome.map(group => <Group key={group.reference} group={group} mode="apbn" income />)}
                  {!apbnIncome.length && (
                    <div className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
                      Tidak ada rincian pendapatan APBN pada dokumen ini.
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="combined" className="mt-0 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <SectionToggle
                  section={combinedSection}
                  onChange={setCombinedSection}
                  expenseLabel={`Rincian Belanja (${document.expenses.length})`}
                  incomeLabel={`Rencana Pendapatan (${document.income.length})`}
                />
                <p className="text-xs text-muted-foreground">
                  Tampilan dokumen utuh APBN + Komite sesuai kolom Excel sumber.
                </p>
              </div>

              {combinedSection === 'expense' ? (
                <>
                  <search aria-label="Filter dokumen gabungan RAPBM" className="flex flex-col gap-2.5 sm:flex-row">
                    <div className="relative flex-1">
                      <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        aria-label="Cari uraian atau kode akun"
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck={false}
                        value={combinedQuery}
                        onChange={event => setCombinedQuery(event.target.value)}
                        placeholder="Cari uraian kegiatan atau kode akun..."
                        className="h-9 pl-9 text-sm"
                      />
                    </div>
                    <Select value={combinedFunding} onValueChange={setCombinedFunding}>
                      <SelectTrigger className="h-9 w-full text-xs sm:w-48" aria-label="Filter sumber dana"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua sumber dana</SelectItem>
                        <SelectItem value="komite">Komite</SelectItem>
                        <SelectItem value="apbn">APBN</SelectItem>
                      </SelectContent>
                    </Select>
                  </search>
                  <p className="text-xs text-muted-foreground">
                    {combinedGroups.length} kelompok · {combinedGroups.reduce((sum, g) => sum + g.items.length, 0)} rincian{combinedFiltered ? ' cocok dengan pencarian (subtotal tetap mengikuti dokumen lengkap).' : ''}
                  </p>
                  <div className="space-y-3 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200" key={`all:${combinedFunding}:${combinedQuery}`}>
                    {combinedGroups.map(group => <Group key={group.reference} group={group} mode="all" filtered={combinedFiltered} />)}
                    {!combinedGroups.length && (
                      <div className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
                        Tidak ada rincian yang sesuai. Coba kata kunci atau sumber dana lain.
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">Seluruh sumber pendapatan (APBN dan Komite) sesuai dokumen RAPBM tahun {document.year}.</p>
                  {document.income.map(group => <Group key={group.reference} group={group} mode="all" income />)}
                </div>
              )}
            </TabsContent>
          </Tabs>

          <p className="border-t pt-4 text-xs text-muted-foreground">
            Sumber: {selected.original_filename} · Lembar {document.sheet} · Diimpor oleh {selected.created_by_name}. Arsip tahun dan versi sebelumnya tetap tersimpan.
          </p>
        </>
      ) : (
        <div className="rounded-xl border border-dashed px-5 py-14 text-center">
          <FileSpreadsheet className="mx-auto mb-3 h-9 w-9 text-slate-300" />
          <h2 className="text-base font-semibold">{versions.length ? 'Pilih tahun dan versi RAPBM' : 'Belum ada RAPBM yang tersedia'}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {canManage ? 'Impor Excel sebagai draft, periksa angka, lalu terbitkan agar dapat dibaca pengurus.' : 'RAPBM akan tampil setelah diterbitkan oleh Bendahara atau Super Admin.'}
          </p>
          {canManage && !has2026 && (
            <Button className="mt-5" variant="outline" disabled={pending} onClick={() => run(importInitialRapbmAction)}>
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}Siapkan RAPBM 2026
            </Button>
          )}
        </div>
      )}

      <Dialog open={importOpen} onOpenChange={open => !pending && setImportOpen(open)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Impor Versi RAPBM</DialogTitle>
            <DialogDescription>
              Gunakan format Excel RAPBM yang sama dengan dokumen 2026. Tahun anggaran dibaca otomatis dari isi dokumen.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={event => {
              event.preventDefault()
              const form = new FormData(event.currentTarget)
              run(async () => {
                const response = await fetch('/api/keuangan/rapbm/import', { method: 'POST', body: form, credentials: 'include' })
                const result = await response.json().catch(() => ({ error: 'Respons impor tidak dapat dibaca. Silakan coba kembali.' }))
                if (!response.ok) throw new Error(result.error || 'Impor gagal.')
                return result
              }, () => setImportOpen(false))
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="rapbm-import-cohort">Angkatan sumber dana</Label>
              <Input id="rapbm-import-cohort" name="cohort" required type="number" min={2026} max={2199} defaultValue={cohortFilter === 'all' ? 2026 : Number(cohortFilter)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rapbm-file">File Excel (.xlsx)</Label>
              <Input id="rapbm-file" name="file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required disabled={pending} />
              <p className="text-xs text-muted-foreground">Maksimal 6 MB. Setiap impor menjadi versi baru; dokumen lama tidak ditimpa.</p>
            </div>
            {canManage && !has2026 && (
              <Button variant="outline" type="button" disabled={pending} onClick={() => run(importInitialRapbmAction, () => setImportOpen(false))}>
                Gunakan dokumen awal 2026
              </Button>
            )}
            {message?.error && <p role="alert" className="text-sm text-rose-700">{message.text}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" disabled={pending} onClick={() => setImportOpen(false)}>Batal</Button>
              <Button type="submit" disabled={pending}>{pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Impor sebagai draft</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function KomiteBudgetSummary({ income, expense }: { income: RapbmAmounts; expense: RapbmAmounts }) {
  return (
    <div className="grid divide-y rounded-xl border bg-card text-card-foreground md:grid-cols-2 md:divide-x md:divide-y-0">
      <section className="space-y-1 p-3.5 sm:p-4">
        <p className="text-xs font-medium text-muted-foreground">Rencana Pendapatan Komite</p>
        <p className="text-xl font-bold tracking-tight tabular-nums text-emerald-700 dark:text-emerald-400 sm:text-2xl">
          {money(income.komite)}
        </p>
        <p className="text-[11px] text-muted-foreground">Anggaran dikelola melalui kas &amp; pembayaran Komite</p>
      </section>
      <section className="space-y-1 p-3.5 sm:p-4">
        <p className="text-xs font-medium text-muted-foreground">Rencana Belanja Komite</p>
        <p className="text-xl font-bold tracking-tight tabular-nums text-slate-900 dark:text-white sm:text-2xl">
          {money(expense.komite)}
        </p>
        <p className="text-[11px] text-muted-foreground">Acuan pagu SPB dan pengeluaran Arus Kas Komite</p>
      </section>
    </div>
  )
}

function ApbnReferenceStrip({
  income,
  expense,
  onOpenApbn,
}: {
  income: RapbmAmounts
  expense: RapbmAmounts
  onOpenApbn: () => void
}) {
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-slate-200 bg-slate-50/75 px-3.5 py-2.5 text-xs dark:border-slate-800 dark:bg-slate-900/50 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2.5">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="font-semibold text-slate-800 dark:text-slate-200">Referensi APBN (Info Saja)</span>
            <span className="text-slate-500 dark:text-slate-400">· Tidak dikelola dan tidak memengaruhi pengeluaran Komite</span>
          </div>
          <dl className="flex flex-wrap gap-x-5 gap-y-1 tabular-nums text-slate-600 dark:text-slate-300">
            <div className="flex gap-1.5">
              <dt className="text-slate-500">Pendapatan APBN:</dt>
              <dd className="font-medium">{money(income.apbn)}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="text-slate-500">Belanja APBN:</dt>
              <dd className="font-medium">{money(expense.apbn)}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="text-slate-500">Total RAPBM Gabungan:</dt>
              <dd className="font-medium">{money(expense.total)}</dd>
            </div>
          </dl>
        </div>
      </div>
      <Button type="button" variant="ghost" size="sm" className="h-7 shrink-0 self-start gap-1 px-2 text-xs text-slate-600 hover:text-slate-900 dark:text-slate-300 sm:self-center" onClick={onOpenApbn}>
        Lihat Info APBN <ArrowRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

function SectionToggle({
  section,
  onChange,
  expenseLabel,
  incomeLabel,
}: {
  section: 'expense' | 'income'
  onChange: (next: 'expense' | 'income') => void
  expenseLabel: string
  incomeLabel: string
}) {
  return (
    <div className="inline-flex rounded-lg border bg-muted/40 p-0.5 text-xs">
      <button
        type="button"
        onClick={() => onChange('expense')}
        className={`rounded-md px-3 py-1.5 font-medium transition ${section === 'expense' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
      >
        {expenseLabel}
      </button>
      <button
        type="button"
        onClick={() => onChange('income')}
        className={`rounded-md px-3 py-1.5 font-medium transition ${section === 'income' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
      >
        {incomeLabel}
      </button>
    </div>
  )
}

function formatVolumeUnit(item: RapbmItem): string {
  const vol = item.volume !== null && item.volume !== undefined ? String(item.volume) : ''
  const unit = item.unit ? item.unit.trim() : ''
  if (vol && unit) return `${vol} ${unit}`
  return vol || unit || '—'
}

function Group({
  group,
  mode,
  income = false,
  filtered = false,
}: {
  group: RapbmGroup
  mode: RapbmFundingView
  income?: boolean
  filtered?: boolean
}) {
  const singleSource = mode !== 'all'
  const sourceValue = (amounts: RapbmAmounts) => (mode === 'komite' ? amounts.komite : mode === 'apbn' ? amounts.apbn : amounts.total)
  const subtotalValue = singleSource ? sourceValue(group.amounts) : group.amounts.total
  const subtotalCaption = mode === 'komite' ? 'Subtotal Komite' : mode === 'apbn' ? 'Subtotal APBN' : 'Subtotal'
  const columnHeading = mode === 'komite' ? 'Anggaran Komite' : mode === 'apbn' ? 'Anggaran APBN' : 'Jumlah'

  return (
    <details className="overflow-hidden rounded-xl border bg-card text-card-foreground" open={filtered || undefined}>
      <summary className="flex cursor-pointer list-none items-start gap-3 p-3.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900 sm:p-4">
        <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">{group.label}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {group.account ? `${group.account} · ` : ''}{group.items.length} rincian
            {mode === 'all' && !income && group.amounts.komite !== null ? ` · Komite ${money(group.amounts.komite)}` : ''}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className={`text-sm font-semibold tabular-nums ${mode === 'komite' ? 'text-emerald-700 dark:text-emerald-400' : ''}`}>
            {money(subtotalValue)}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{subtotalCaption}</p>
        </div>
      </summary>
      <div className="border-t motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150">
        <div role="region" aria-label={group.label} tabIndex={0} className="hidden overflow-x-auto md:block">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className={singleSource ? 'w-[56%] text-xs font-semibold' : 'w-[42%] text-xs font-semibold'}>Uraian &amp; Kode Akun</TableHead>
                <TableHead className="w-[16%] text-xs font-semibold">Vol / Satuan</TableHead>
                {mode === 'all' && !income && (
                  <>
                    <TableHead className="text-right text-xs font-semibold">APBN</TableHead>
                    <TableHead className="text-right text-xs font-semibold">Komite</TableHead>
                  </>
                )}
                <TableHead className="text-right text-xs font-semibold">{columnHeading}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {group.items.map(item => (
                <TableRow key={item.reference}>
                  <TableCell>
                    <p className="text-sm leading-snug text-slate-900 dark:text-slate-100">{item.description}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {item.account ? `Akun ${item.account}` : 'Tanpa kode akun'}
                    </p>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-slate-600 dark:text-slate-300">
                    {formatVolumeUnit(item)}
                  </TableCell>
                  {mode === 'all' && !income && (
                    <>
                      <TableCell className="whitespace-nowrap text-right text-sm tabular-nums">{money(item.amounts.apbn)}</TableCell>
                      <TableCell className="whitespace-nowrap text-right text-sm font-medium tabular-nums text-emerald-700 dark:text-emerald-400">{money(item.amounts.komite)}</TableCell>
                    </>
                  )}
                  <TableCell className={`whitespace-nowrap text-right text-sm font-semibold tabular-nums ${mode === 'komite' ? 'text-emerald-700 dark:text-emerald-400' : ''}`}>
                    {money(sourceValue(item.amounts))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="divide-y md:hidden">
          {group.items.map(item => (
            <div className="space-y-2 p-3.5" key={item.reference}>
              <div>
                <p className="text-sm font-medium leading-snug">{item.description}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {item.account ? `${item.account} · ` : ''}Vol: {formatVolumeUnit(item)}
                </p>
              </div>
              {singleSource ? (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{columnHeading}</span>
                  <span className={`font-semibold tabular-nums ${mode === 'komite' ? 'text-emerald-700 dark:text-emerald-400' : ''}`}>
                    {money(sourceValue(item.amounts))}
                  </span>
                </div>
              ) : (
                <dl className={`grid gap-2 text-xs ${income ? 'grid-cols-1' : 'grid-cols-3'}`}>
                  {(income ? [['Jumlah', item.amounts.total]] : [['APBN', item.amounts.apbn], ['Komite', item.amounts.komite], ['Jumlah', item.amounts.total]]).map(([label, value]) => (
                    <div key={String(label)}>
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="mt-0.5 break-words font-medium tabular-nums">{money(value as number | null)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          ))}
        </div>

        <p className="border-t bg-slate-50/50 px-4 py-2 text-xs text-muted-foreground dark:bg-slate-900/30">
          {mode === 'komite' ? (
            <>
              Subtotal Komite: {money(group.amounts.komite)}
              {!income && (group.amounts.apbn ?? 0) > 0 && ` · Catatan referensi: kelompok ini juga memiliki porsi APBN ${money(group.amounts.apbn)} di dokumen sumber`}
            </>
          ) : mode === 'apbn' ? (
            <>Subtotal referensi APBN: {money(group.amounts.apbn)}</>
          ) : (
            <>Subtotal dokumen: APBN {money(group.amounts.apbn)} · Komite {money(group.amounts.komite)} · Jumlah {money(group.amounts.total)}</>
          )}
          <span className="mt-0.5 block text-[11px]">Referensi sel: {group.subtotalReference}</span>
        </p>
      </div>
    </details>
  )
}

function Notes({ notes }: { notes: RapbmNote[] }) {
  return (
    <details className="rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-amber-900 dark:text-amber-200">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span className="flex-1">Catatan Angka · {notes.length} perlu diperhatikan</span>
        <ChevronDown className="h-4 w-4" />
      </summary>
      <div className="space-y-3 border-t border-amber-200 px-4 py-3 dark:border-amber-900">
        <p className="text-xs text-muted-foreground">Perbandingan ini tidak mengubah angka dokumen. Penjumlahan hanya memakai sel numerik yang tersedia; sel kosong tetap ditandai kosong.</p>
        {notes.map((note, index) => (
          <div key={`${note.reference}:${index}`} className="border-b border-amber-200/70 pb-3 last:border-b-0 last:pb-0 dark:border-amber-900">
            <p className="text-sm leading-6">{note.message}</p>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium tabular-nums text-foreground">
              <span>Dokumen: {money(note.source)}</span>
              <span>Penjumlahan: {money(note.calculated)}</span>
              <span className="basis-full break-all text-xs font-normal text-muted-foreground">{note.reference}</span>
            </div>
          </div>
        ))}
      </div>
    </details>
  )
}

function PublishPanel({ noteCount, pending, onPublish }: { noteCount: number; pending: boolean; onPublish: (acknowledged: boolean) => void }) {
  const [acknowledged, setAcknowledged] = useState(false)
  return (
    <section className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
      <div>
        <h2 className="text-sm font-semibold">Periksa draft sebelum diterbitkan</h2>
        <p className="mt-1 text-sm text-muted-foreground">Versi terbit dapat dibaca pengurus dan tidak dapat diubah. Koreksi berikutnya dilakukan melalui impor versi baru.</p>
      </div>
      {noteCount > 0 && (
        <div className="flex items-start gap-2">
          <Checkbox id="rapbm-ack" className="mt-0.5" checked={acknowledged} disabled={pending} onCheckedChange={value => setAcknowledged(value === true)} />
          <Label htmlFor="rapbm-ack" className="text-sm font-normal leading-5">Saya telah membaca Catatan Angka dan akan menerbitkan nominal sesuai dokumen sumber.</Label>
        </div>
      )}
      <Button size="sm" disabled={pending || (noteCount > 0 && !acknowledged)} onClick={() => onPublish(acknowledged)}>
        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Terbitkan versi ini
      </Button>
    </section>
  )
}

function OperationalBudget({ version, ready, budget, canManage }: { version: string; ready: boolean; budget: BudgetData; canManage: boolean }) {
  const router = useRouter()
  const association = budget.associations.find(row => row.id === version)
  const [cohort, setCohort] = useState(association?.cohort ?? 2026)
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(budget.groups.map(g => [g.id, String(g.komite ?? 0)])))
  const [message, setMessage] = useState('')
  const [pending, start] = useTransition()
  const [reconciled, setReconciled] = useState(false)
  const total = Object.values(values).reduce((sum, value) => sum + Number(value || 0), 0)
  const prior = budget.remaining.find(r => r.cohort === cohort)

  const activePositions = budget.positions.filter(p => p.amount > 0 || p.locked > 0 || p.realized > 0)
  const zeroPositions = budget.positions.filter(p => p.amount === 0 && p.locked === 0 && p.realized === 0)
  const komiteGroups = budget.groups.filter(hasKomiteAllocation)
  const apbnOnlyGroups = budget.groups.filter(g => !hasKomiteAllocation(g))

  const totalPagu = budget.positions.reduce((s, p) => s + p.amount, 0)
  const totalLocked = budget.positions.reduce((s, p) => s + p.locked, 0)
  const totalRealized = budget.positions.reduce((s, p) => s + p.realized, 0)
  const totalAvailable = budget.positions.reduce((s, p) => s + p.available, 0)

  function submit(action: () => Promise<{ success?: string; error?: string }>) {
    start(async () => {
      const result = await action()
      setMessage(result.error ?? result.success ?? '')
      if (result.success) router.refresh()
    })
  }

  if (!budget.positions.length && (!canManage || !ready)) return null

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">
            Pagu Operasional Komite {association?.cohort ? `Angkatan ${association.cohort}` : ''}
          </CardTitle>
          {association && (
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${association.enabled ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'}`}>
              {association.enabled ? 'Pagu Aktif' : 'Menunggu Aktivasi'}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {budget.positions.length ? (
          <>
            <div className="grid grid-cols-2 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-slate-50/60 dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900/60 sm:grid-cols-4 sm:divide-x sm:divide-y-0">
              <div className="px-3.5 py-2.5">
                <p className="text-[11px] text-slate-500">Total Pagu Komite</p>
                <p className="mt-0.5 text-sm font-bold tabular-nums">{formatRupiah(totalPagu)}</p>
              </div>
              <div className="px-3.5 py-2.5">
                <p className="text-[11px] text-slate-500">Terkunci (SPB)</p>
                <p className="mt-0.5 text-sm font-bold tabular-nums text-amber-600 dark:text-amber-400">{formatRupiah(totalLocked)}</p>
              </div>
              <div className="px-3.5 py-2.5">
                <p className="text-[11px] text-slate-500">Realisasi Cair</p>
                <p className="mt-0.5 text-sm font-bold tabular-nums text-blue-600 dark:text-blue-400">{formatRupiah(totalRealized)}</p>
              </div>
              <div className="px-3.5 py-2.5">
                <p className="text-[11px] text-slate-500">Sisa Pagu Tersedia</p>
                <p className="mt-0.5 text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{formatRupiah(totalAvailable)}</p>
              </div>
            </div>

            {association?.carry_forward !== null && association?.carry_forward !== undefined && (
              <p className="text-xs text-muted-foreground">
                Sisa dari versi sebelumnya: <span className="font-medium tabular-nums">{formatRupiah(association.carry_forward)}</span>
                {association.revision_reason ? ` · ${association.revision_reason}` : ''}
              </p>
            )}

            <Accordion type="multiple" className="space-y-2">
              {activePositions.map(position => {
                const used = position.locked + position.realized
                const pct = position.amount > 0 ? Math.min(100, Math.round((used / position.amount) * 100)) : 0
                const posHistory = budget.history.filter(row => row.group_id === position.group_id)
                return (
                  <AccordionItem value={position.group_id} key={position.group_id} className="rounded-lg border px-3">
                    <AccordionTrigger className="gap-3 py-3 text-left text-sm hover:no-underline">
                      <div className="min-w-0 flex-1 space-y-1.5 pr-2">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="font-medium text-slate-900 dark:text-slate-100">
                            {position.account ? `${position.account} · ` : ''}{position.label}
                          </span>
                          <span className="shrink-0 text-xs font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                            Sisa {formatRupiah(position.available)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-10 text-right text-[11px] tabular-nums text-slate-400">{pct}%</span>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-2 border-t pt-2.5 text-xs">
                      <p className="tabular-nums text-slate-600 dark:text-slate-300">
                        Pagu: <strong>{formatRupiah(position.amount)}</strong> · Terkunci SPB: <strong>{formatRupiah(position.locked)}</strong> · Realisasi: <strong>{formatRupiah(position.realized)}</strong>
                      </p>
                      {posHistory.length === 0 ? (
                        <p className="text-slate-400">Belum ada riwayat penggunaan pada pos ini.</p>
                      ) : (
                        posHistory.map(row => (
                          <p key={row.id} className="border-t border-slate-100 py-1.5 tabular-nums dark:border-slate-800">
                            <a
                              className="font-medium text-emerald-700 underline hover:text-emerald-800 dark:text-emerald-400"
                              href={row.pengajuan_id ? `/dashboard/komite/pengajuan?id=${row.pengajuan_id}` : `/dashboard/keuangan/kas-keluar?fund=${cohort}&entry=${row.cashflow_id}`}
                            >
                              {row.description} {row.proof}
                            </a>{' '}
                            · {row.created_at.slice(0, 10)} · {formatRupiah(row.amount)} · {row.state === 'locked' ? 'Terkunci' : row.state === 'realized' ? 'Realisasi' : 'Dilepas'}
                          </p>
                        ))
                      )}
                    </AccordionContent>
                  </AccordionItem>
                )
              })}
            </Accordion>

            {zeroPositions.length > 0 && (
              <details className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
                <summary className="cursor-pointer font-medium">
                  {zeroPositions.length} pos khusus APBN / tanpa pagu Komite (Rp 0) disembunyikan dari daftar operasional
                </summary>
                <ul className="mt-2 space-y-1 border-t pt-2">
                  {zeroPositions.map(pos => (
                    <li key={pos.group_id} className="flex justify-between gap-2">
                      <span>{pos.account ? `${pos.account} · ` : ''}{pos.label}</span>
                      <span className="tabular-nums">{formatRupiah(pos.amount)}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {canManage && association?.enabled === 0 && (
              <div className="space-y-2.5 rounded-lg border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900/60 dark:bg-amber-950/20">
                <div className="flex items-start gap-2">
                  <Checkbox id="rapbm-reconciled" checked={reconciled} onCheckedChange={value => setReconciled(value === true)} />
                  <Label htmlFor="rapbm-reconciled" className="text-xs font-normal leading-5">
                    Histori SPB dan Arus Kas sudah dipetakan dan saldo sudah direkonsiliasi.
                  </Label>
                </div>
                <Button size="sm" disabled={!reconciled || pending} onClick={() => submit(() => activateKomiteRapbm(version, reconciled))}>
                  Aktifkan Pagu Operasional
                </Button>
              </div>
            )}
          </>
        ) : (
          <form className="space-y-3" action={form => submit(() => configureKomiteRapbm(form))}>
            <input type="hidden" name="version" value={version} />
            <input type="hidden" name="prior_version" value={prior?.version_id ?? ''} />
            <input type="hidden" name="prior_snapshot" value={prior?.available ?? ''} />
            <div className="max-w-xs space-y-1.5">
              <Label htmlFor="pagu-cohort">Angkatan</Label>
              <Input id="pagu-cohort" name="cohort" required type="number" min={2026} max={2199} value={cohort} readOnly={!!association?.cohort} onChange={e => setCohort(Number(e.target.value))} />
            </div>
            {prior && (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs tabular-nums dark:bg-slate-900">
                Sisa sebelumnya {formatRupiah(prior.available)} · Pagu baru {formatRupiah(total)} · Selisih {formatRupiah(total - prior.available)}
              </p>
            )}
            {komiteGroups.map(group => (
              <div key={group.id} className="grid items-end gap-2.5 border-b pb-3 sm:grid-cols-3">
                <div className="text-sm">
                  <p className="font-medium">{group.account} · {group.label}</p>
                  <p className="text-xs tabular-nums text-muted-foreground">Subtotal Komite {money(group.komite)} · Rincian {money(group.detail)}</p>
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`pagu-val-${group.id}`} className="text-xs">Pagu operasional</Label>
                  <RupiahInput id={`pagu-val-${group.id}`} name={`pagu:${group.id}`} required min={0} value={values[group.id]} onValueChange={raw => setValues({ ...values, [group.id]: raw })} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`pagu-reason-${group.id}`} className="text-xs">Alasan selisih</Label>
                  <Input id={`pagu-reason-${group.id}`} name={`alasan:${group.id}`} required={Number(values[group.id] || 0) !== (group.komite ?? 0) || Number(values[group.id] || 0) !== group.detail} maxLength={300} placeholder="Wajib jika berbeda dari dokumen" />
                </div>
              </div>
            ))}
            {apbnOnlyGroups.length > 0 && (
              <details className="rounded-lg border border-dashed px-3 py-2.5">
                <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                  {apbnOnlyGroups.length} pos khusus APBN (pagu Komite bawaan Rp 0) — klik jika ingin meninjau
                </summary>
                <div className="mt-3 space-y-3 border-t pt-3">
                  {apbnOnlyGroups.map(group => (
                    <div key={group.id} className="grid items-end gap-2.5 border-b pb-3 last:border-b-0 last:pb-0 sm:grid-cols-3">
                      <div className="text-sm">
                        <p className="font-medium text-slate-700 dark:text-slate-300">{group.account} · {group.label}</p>
                        <p className="text-xs tabular-nums text-muted-foreground">Khusus APBN · Komite {money(group.komite)}</p>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`pagu-val-${group.id}`} className="text-xs">Pagu operasional</Label>
                        <RupiahInput id={`pagu-val-${group.id}`} name={`pagu:${group.id}`} required min={0} value={values[group.id]} onValueChange={raw => setValues({ ...values, [group.id]: raw })} />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`pagu-reason-${group.id}`} className="text-xs">Alasan selisih</Label>
                        <Input id={`pagu-reason-${group.id}`} name={`alasan:${group.id}`} required={Number(values[group.id] || 0) !== (group.komite ?? 0) || Number(values[group.id] || 0) !== group.detail} maxLength={300} placeholder="Wajib jika berbeda dari dokumen" />
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            )}
            {prior && (
              <div className="space-y-1.5">
                <Label htmlFor="pagu-rev-reason">Alasan perubahan total</Label>
                <Input id="pagu-rev-reason" name="revision_reason" required={prior.available !== total} maxLength={300} />
              </div>
            )}
            <Button disabled={pending}>{prior ? 'Terbitkan Revisi Pagu' : 'Konfirmasi Pagu untuk Pemetaan'}</Button>
          </form>
        )}
        {message && <p role="status" className="text-xs font-medium text-emerald-700 dark:text-emerald-400">{message}</p>}
      </CardContent>
    </Card>
  )
}
