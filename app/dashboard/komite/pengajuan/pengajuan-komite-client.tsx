'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { RupiahInput } from '@/components/ui/rupiah-input'
import {
  ArrowLeft, CheckCircle2, ChevronDown, ChevronRight, CircleHelp, Download, FileText, Loader2,
  Pencil, Plus, Printer, RotateCcw, Search, Send, Trash2, XCircle,
} from 'lucide-react'
import {
  deleteKomiteAction, deleteKomiteDraftAction, reviewKomiteAction,
  setNamedKomiteSubmitterAction, submitKomiteAction,
  setKomiteReviewerSettingAction, setKomiteActivityReportAction,
  changeKomiteSpbAction, mapHistoricalKomiteSpb, recordKomiteRealization,
} from './actions'
import { FundAllocationFields, FundSourceSelect } from '@/components/dashboard/komite-fund-fields'
import { komiteFundLabel, type BudgetPosition } from '@/lib/komite-funds'
import { formatRupiah } from '@/lib/utils'
import { todayWIB } from '@/lib/time'
import { ApprovalSheetButton } from './approval-sheet-button'
import { KuitansiPrintDialog } from '@/components/dashboard/kuitansi-print-dialog'

type Item = any
type RincianRow = { uraian: string; penerima_penyedia: string; jumlah: string }
type Props = {
  initialId?: string
  initialFund?: string
  initialTab?: string
  pendingOnly?: boolean
  historicalCash: readonly { id: string; amount: number; transaction_date: string; proof_number: string | null; description: string }[]
  fundOptions: { years: number[]; positions: BudgetPosition[]; historicalPositions: BudgetPosition[] }
  items: Item[]
  users: any[]
  committeeMembers: any[]
  currentUserId: string
  roles: string[]
  canCreate: boolean
  isSuper: boolean
  reviewCount: number
  nextNomorSpb?: string
  verifier: { id: string; name: string } | null
  chairman: { id: string; name: string } | null
  chairmen: { id: string; name: string }[]
}

const MAX_TOTAL = 6 * 1024 * 1024
const MAX_DETAIL_ROWS = 10
const statusStyle: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  menunggu_bendahara: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  menunggu_ketua: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  menunggu_kepala: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300',
  perlu_revisi: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
  ditolak: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
  disetujui: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
}
const statusLabel: Record<string, string> = {
  draft: 'Draft', menunggu_bendahara: 'Menunggu Bendahara', menunggu_ketua: 'Menunggu Verifikator',
  menunggu_kepala: 'Menunggu Kepala', perlu_revisi: 'Perlu Revisi', ditolak: 'Ditolak', disetujui: 'Disetujui',
}
const stageLabel: Record<string, string> = { bendahara: 'Bendahara Komite', ketua: 'Ketua Komite', kepala: 'Kepala Madrasah' }
const actionLabel: Record<string, string> = { setujui: 'Menyetujui', minta_revisi: 'Meminta revisi', tolak: 'Menolak' }

function money(value: number) {
  return formatRupiah(value || 0)
}
function date(value?: string) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(value.endsWith('Z') ? value : `${value.replace(' ', 'T')}Z`))
}
function size(value: number) {
  return value >= 1024 * 1024 ? `${(value / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(value / 1024)} KB`
}
function numberFrom(value: string | number) {
  return Number(String(value || '').replace(/[^0-9]/g, '')) || 0
}
function defaultTahunAnggaran() {
  const year = new Date().getFullYear()
  return `${year}/${year + 1}`
}
function rowsFromItem(item?: Item | null): RincianRow[] {
  const rows = (item?.rincian || []).map((row: any) => ({
    uraian: row.uraian || '',
    penerima_penyedia: row.penerima_penyedia || '',
    jumlah: String(row.jumlah || ''),
  }))
  if (rows.length) return rows.slice(0, MAX_DETAIL_ROWS)
  return [{ uraian: item?.uraian || '', penerima_penyedia: item?.penerima_pembayaran || '', jumlah: String(item?.nominal || '') }]
}
function detailTotal(rows: RincianRow[]) {
  return rows.reduce((sum, row) => sum + numberFrom(row.jumlah), 0)
}

function spbFollowUpBadge(item: Item): { label: string; className: string } | null {
  if (item.status !== 'disetujui') return null
  if (item.komite_cancelled_at) {
    return { label: 'SPB Dibatalkan', className: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300' }
  }
  if (!item.fundAllocations?.length) {
    return { label: 'Belum Dipetakan', className: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' }
  }
  if (item.realisasi_status === 'sudah') {
    return { label: 'Sudah Cair', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' }
  }
  return { label: 'Siap Dicairkan', className: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300' }
}

export function PengajuanKomiteClient(props: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const canSeeReviewerTabs = props.roles.some(role => ['super_admin', 'bendahara_komite', 'ketua_komite', 'anggota_komite', 'kepsek'].includes(role))
  const validInitialTabs = ['mine', 'review', 'history', 'approved', 'all', ...(props.isSuper ? ['settings'] : [])]
  const resolvedInitialTab = props.initialTab && validInitialTabs.includes(props.initialTab) && (canSeeReviewerTabs || ['mine', 'all'].includes(props.initialTab))
    ? props.initialTab
    : canSeeReviewerTabs && props.reviewCount
      ? 'review'
      : 'mine'

  const [fundFilter, setFundFilter] = useState(props.initialFund ?? 'all')
  const [pendingOnly, setPendingOnly] = useState(props.pendingOnly ?? false)
  const [proposalSearch, setProposalSearch] = useState('')
  const [activeTab, setActiveTab] = useState(resolvedInitialTab)
  const [detailId, setDetailId] = useState(props.initialId ?? '')
  const [detailOriginTab, setDetailOriginTab] = useState(resolvedInitialTab)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Item | null>(null)
  const [review, setReview] = useState<{ item: Item; action: string } | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; description: string; confirmLabel: string; destructive?: boolean; onConfirm: () => void } | null>(null)
  const [message, setMessage] = useState('')
  const [query, setQuery] = useState('')
  const [reportFilter, setReportFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const canManageReports = props.isSuper || props.roles.includes('bendahara_komite')

  const searchTerm = proposalSearch.trim().toLowerCase()
  const matchesSearch = (item: Item) =>
    !searchTerm ||
    `${item.judul || ''} ${item.nomor_spb || ''} ${item.pengaju_name || ''} ${item.penerima_pembayaran || ''} ${item.uraian || ''}`
      .toLowerCase()
      .includes(searchTerm)

  const matchesFund = (item: Item) =>
    fundFilter === 'all' ||
    (fundFilter === 'unmapped'
      ? !item.fundAllocations?.length
      : item.fundAllocations?.some((row: { source: string }) => row.source === fundFilter))

  const years = [...new Set([
    ...props.fundOptions.years,
    ...props.items.flatMap(item => item.fundAllocations?.map((row: { source: string }) => Number(row.source)) ?? []),
  ])].filter(year => year >= 2000 && year <= 2199).sort((a, b) => b - a)

  // Antrean aktif (Pengajuan Saya, Perlu Direview, Riwayat Review) tidak disembunyikan oleh filter Sumber Dana
  const own = props.items.filter(item => item.pengaju_id === props.currentUserId && matchesSearch(item))
  const queue = props.items.filter(item => isQueueFor(item, props.roles, props.isSuper, props.currentUserId, props.verifier?.id) && matchesSearch(item))
  const history = props.items.filter(item => item.reviews.some((entry: any) => entry.actor_id === props.currentUserId) && matchesSearch(item))
  const approved = props.items.filter(item =>
    item.status === 'disetujui' &&
    matchesFund(item) &&
    matchesSearch(item) &&
    (!pendingOnly || (item.realisasi_status === 'belum' && !item.komite_cancelled_at)),
  )
  const allFiltered = props.items.filter(item =>
    matchesFund(item) &&
    matchesSearch(item) &&
    (statusFilter === 'all' || item.status === statusFilter),
  )

  const detailItem = props.items.find(item => item.id === detailId)
  const namedUsers = props.users.filter(user => Boolean(user.is_named))
  const normalizedQuery = query.trim().toLowerCase()
  const searchResults = normalizedQuery.length >= 2
    ? props.users.filter(user => {
        const defaultRole = (user.roles || [user.role]).some((role: string) => ['super_admin', 'kepsek', 'wakamad', 'pembina_ekstrakurikuler', 'bendahara_komite'].includes(role))
        return !user.is_named && !defaultRole && `${user.name} ${user.email}`.toLowerCase().includes(normalizedQuery)
      }).slice(0, 8)
    : []

  // Evaluasi tombol aksi berdasarkan status dokumen & kewenangan (tidak terkunci tab asal)
  const showOwnerActions = Boolean(detailItem && detailItem.pengaju_id === props.currentUserId && ['draft', 'perlu_revisi'].includes(detailItem.status))
  const showReviewActions = Boolean(detailItem && canReviewItem(detailItem, props.roles, props.isSuper, props.currentUserId, props.verifier?.id))
  const showSpbFunds = Boolean(
    detailItem &&
      ((detailItem.status === 'disetujui' && canManageReports) ||
        (showReviewActions && detailItem.status === 'menunggu_ketua')),
  )
  const showSuperAdminDelete = Boolean(detailItem && props.isSuper && detailItem.status === 'draft' && !detailItem.submitted_at)
  const hasDetailActions = showSpbFunds || showOwnerActions || showReviewActions || showSuperAdminDelete

  function openDetail(id: string) {
    setDetailOriginTab(activeTab)
    setDetailId(id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function run(task: () => Promise<any>, close?: () => void) {
    setMessage('')
    startTransition(async () => {
      try {
        const result = await task()
        setMessage(result?.error || result?.success || '')
        if (!result?.error) {
          close?.()
          router.refresh()
        }
      } catch (error) {
        console.error('Pengajuan gagal diproses', error)
        setMessage('Gagal terhubung ke server. Muat ulang aplikasi agar memakai versi terbaru, lalu coba lagi.')
      }
    })
  }

  const isErrorMessage = message && (
    message.toLowerCase().includes('gagal') ||
    message.toLowerCase().includes('tidak') ||
    message.toLowerCase().includes('wajib') ||
    message.toLowerCase().includes('kurang') ||
    message.toLowerCase().includes('belum')
  )

  return (
    <>
      {!detailItem && (
        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <span className="font-semibold text-slate-900 dark:text-white">Alur Persetujuan:</span>
              <span>Bendahara → Verifikator → SPB</span>
              <span className="text-slate-300 dark:text-slate-700">·</span>
              <span>Verifikator aktif: <strong className="font-medium text-slate-800 dark:text-slate-100">{props.verifier?.name || 'Belum diatur'}</strong></span>
            </div>
            {!props.chairman && (
              <p className="text-xs text-amber-700 dark:text-amber-400">Ketua Komite untuk SPB belum ditentukan. Hubungi Super Admin.</p>
            )}
          </div>
          {props.canCreate && (
            <div className="flex flex-wrap gap-2">
              <ApprovalSheetButton key={props.currentUserId} userId={props.currentUserId} />
              <Button size="sm" onClick={() => { setMessage(''); setEditing(null); setFormOpen(true) }}>
                <Plus className="mr-1.5 h-4 w-4" />Buat Pengajuan
              </Button>
            </div>
          )}
        </div>
      )}

      {message && (
        <div
          role={isErrorMessage ? 'alert' : 'status'}
          className={`mb-3 rounded-lg border px-3 py-2 text-sm ${
            isErrorMessage
              ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200'
          }`}
        >
          {message}
        </div>
      )}

      {detailItem ? (
        <DetailPage
          item={detailItem}
          isReviewer={showReviewActions}
          onBack={() => { setActiveTab(detailOriginTab); setDetailId('') }}
          reportControls={
            detailItem.status === 'disetujui' ? (
              <ReportStatus
                item={detailItem}
                canManage={canManageReports}
                pending={pending}
                onRequestUnmark={() =>
                  setConfirmDialog({
                    title: 'Batalkan tanda laporan diterima?',
                    description: 'Status laporan kegiatan akan dikembalikan menjadi Belum diterima.',
                    confirmLabel: 'Batalkan Tanda',
                    onConfirm: () => run(() => setKomiteActivityReportAction(detailItem.id, false, detailItem.laporan_revision)),
                  })
                }
                onMarkReceived={() => run(() => setKomiteActivityReportAction(detailItem.id, true, detailItem.laporan_revision))}
              />
            ) : null
          }
          actions={
            hasDetailActions ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                {showSpbFunds && (
                  <SpbFunds
                    item={detailItem}
                    options={props.fundOptions}
                    historicalCash={props.historicalCash}
                    pending={pending}
                    onRun={task => run(task)}
                  />
                )}
                {showOwnerActions && (
                  <OwnerActions
                    item={detailItem}
                    pending={pending}
                    hideDelete={props.isSuper}
                    onEdit={() => { setMessage(''); setEditing(detailItem); setFormOpen(true) }}
                    onRequestDelete={() =>
                      setConfirmDialog({
                        title: 'Hapus draft pengajuan?',
                        description: 'Draft pengajuan beserta berkas PDF yang belum dikirim ini akan dihapus permanen.',
                        confirmLabel: 'Hapus Draft',
                        destructive: true,
                        onConfirm: () => run(() => deleteKomiteDraftAction(detailItem.id), () => setDetailId('')),
                      })
                    }
                    onRun={task => run(task, () => setDetailId(''))}
                  />
                )}
                {showReviewActions && (
                  <div className="w-full sm:w-auto sm:flex-1">
                    <ReviewActions item={detailItem} onReview={action => setReview({ item: detailItem, action })} />
                  </div>
                )}
                {showSuperAdminDelete && (
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      setConfirmDialog({
                        title: 'Hapus draft yang belum dikirim?',
                        description: `Draft "${detailItem.judul}" beserta dokumennya akan dihapus.`,
                        confirmLabel: 'Hapus Pengajuan',
                        destructive: true,
                        onConfirm: () => run(() => deleteKomiteAction(detailItem.id), () => setDetailId('')),
                      })
                    }
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" />Hapus Draft
                  </Button>
                )}
              </div>
            ) : null
          }
        />
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-3">
          <div className="overflow-x-auto pb-1">
            <TabsList className="h-auto min-w-max justify-start">
              <TabsTrigger value="mine" className="shrink-0">Pengajuan Saya <Count value={own.length} /></TabsTrigger>
              {canSeeReviewerTabs && <TabsTrigger value="review" className="shrink-0">Perlu Direview <Count value={props.reviewCount} alert={props.reviewCount > 0} /></TabsTrigger>}
              {canSeeReviewerTabs && <TabsTrigger value="approved" className="shrink-0">SPB Disetujui <Count value={approved.length} /></TabsTrigger>}
              {canSeeReviewerTabs && <TabsTrigger value="history" className="shrink-0">Riwayat Review <Count value={history.length} /></TabsTrigger>}
              <TabsTrigger value="all" className="shrink-0">Semua Pengajuan <Count value={allFiltered.length} /></TabsTrigger>
              {props.isSuper && <TabsTrigger value="settings" className="shrink-0">Pengaturan Pengaju</TabsTrigger>}
            </TabsList>
          </div>

          {activeTab !== 'settings' && (
            <search className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  aria-label="Cari judul, nomor SPB, atau nama pengaju"
                  placeholder="Cari judul kegiatan, nomor SPB, atau nama pengaju..."
                  value={proposalSearch}
                  onChange={event => setProposalSearch(event.target.value)}
                  autoCorrect="off"
                  spellCheck={false}
                  className="h-9 pl-9 text-sm"
                />
              </div>
              {(activeTab === 'approved' || activeTab === 'all') && (
                <div className="w-full sm:w-48">
                  <FundSourceSelect id="spb-filter-fund" className="h-9 text-xs" value={fundFilter} onValueChange={setFundFilter} years={years} report />
                </div>
              )}
              {activeTab === 'approved' && (
                <>
                  <Select value={reportFilter} onValueChange={setReportFilter}>
                    <SelectTrigger className="h-9 w-full text-xs sm:w-44" aria-label="Filter laporan kegiatan"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua laporan</SelectItem>
                      <SelectItem value="no">Laporan belum diterima</SelectItem>
                      <SelectItem value="yes">Laporan sudah diterima</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex h-9 items-center gap-2 rounded-md border border-slate-200 px-3 dark:border-slate-800">
                    <Checkbox id="spb-pending-only" checked={pendingOnly} onCheckedChange={value => setPendingOnly(value === true)} />
                    <Label htmlFor="spb-pending-only" className="cursor-pointer text-xs font-normal">Belum dicairkan</Label>
                  </div>
                </>
              )}
              {activeTab === 'all' && (
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9 w-full text-xs sm:w-44" aria-label="Filter status pengajuan"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua status</SelectItem>
                    {Object.entries(statusLabel).filter(([key]) => key !== 'menunggu_kepala').map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </search>
          )}

          <TabsContent value="mine" className="mt-0 space-y-3">
            <HelpGuide type="submitter" />
            <DataList items={own} onOpen={openDetail} />
          </TabsContent>

          {canSeeReviewerTabs && (
            <TabsContent value="review" className="mt-0 space-y-3">
              <HelpGuide type="reviewer" isTreasurer={props.roles.includes('bendahara_komite') || props.isSuper} />
              <DataList items={queue} onOpen={openDetail} />
            </TabsContent>
          )}

          {canSeeReviewerTabs && (
            <TabsContent value="approved" className="mt-0 space-y-3">
              <DataList
                items={approved.filter(item => reportFilter === 'all' || Boolean(item.laporan_received_at) === (reportFilter === 'yes'))}
                onOpen={openDetail}
                renderReport={item => (
                  <ReportStatus
                    item={item}
                    canManage={canManageReports}
                    pending={pending}
                    onRequestUnmark={() =>
                      setConfirmDialog({
                        title: 'Batalkan tanda laporan diterima?',
                        description: `Tanda penerimaan laporan untuk "${item.judul}" akan dibatalkan.`,
                        confirmLabel: 'Batalkan Tanda',
                        onConfirm: () => run(() => setKomiteActivityReportAction(item.id, false, item.laporan_revision)),
                      })
                    }
                    onMarkReceived={() => run(() => setKomiteActivityReportAction(item.id, true, item.laporan_revision))}
                  />
                )}
              />
            </TabsContent>
          )}

          {canSeeReviewerTabs && (
            <TabsContent value="history" className="mt-0 space-y-3">
              <DataList items={history} onOpen={openDetail} />
            </TabsContent>
          )}

          <TabsContent value="all" className="mt-0 space-y-3">
            <DataList items={allFiltered} onOpen={openDetail} />
          </TabsContent>

          {props.isSuper && (
            <TabsContent value="settings" className="mt-0">
              <div className="mb-6 grid gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-2">
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Verifikator Pengajuan</h3>
                  <p className="text-xs text-muted-foreground">Pilih satu anggota komite untuk persetujuan akhir. Pergantian berlaku untuk pengajuan yang belum diputuskan.</p>
                  <Label htmlFor="komite-verifier" className="text-xs">Verifikator aktif</Label>
                  <Select value={props.verifier?.id || ''} disabled={pending} onValueChange={id => run(() => setKomiteReviewerSettingAction('verifier', id))}>
                    <SelectTrigger id="komite-verifier"><SelectValue placeholder="Pilih anggota komite" /></SelectTrigger>
                    <SelectContent>{props.committeeMembers.map(member => <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>)}</SelectContent>
                  </Select>
                  {!props.committeeMembers.length && <p className="text-xs text-amber-700">Belum ada akun anggota komite aktif.</p>}
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Ketua Komite pada SPB</h3>
                  <p className="text-xs text-muted-foreground">Nama disimpan saat persetujuan akhir. Ketua tidak mereview pengajuan di aplikasi.</p>
                  <Label htmlFor="komite-spb-chairman" className="text-xs">Penandatangan Ketua Komite</Label>
                  <Select value={props.chairman?.id || ''} disabled={pending} onValueChange={id => run(() => setKomiteReviewerSettingAction('chairman', id))}>
                    <SelectTrigger id="komite-spb-chairman"><SelectValue placeholder="Pilih Ketua Komite" /></SelectTrigger>
                    <SelectContent>{props.chairmen.map(member => <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              <SectionToolbar title="Pengaju tambahan yang sudah diizinkan" />
              <div className="relative mb-4">
                <div className="flex items-center gap-2 rounded-lg border bg-white px-3 dark:bg-slate-900">
                  <Search className="h-4 w-4 text-slate-400" />
                  <Input
                    className="border-0 px-0 shadow-none focus-visible:ring-0"
                    placeholder="Ketik minimal 2 huruf untuk mencari user..."
                    value={query}
                    autoCorrect="off"
                    spellCheck={false}
                    onChange={e => setQuery(e.target.value)}
                  />
                </div>
                {normalizedQuery.length >= 2 && (
                  <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border bg-white p-1 shadow-lg dark:bg-slate-900">
                    {searchResults.length ? searchResults.map(user => (
                      <div key={user.id} className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800">
                        <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{user.name}</p><p className="truncate text-xs text-slate-500">{user.email}</p></div>
                        <Button size="sm" disabled={pending} onClick={() => run(() => setNamedKomiteSubmitterAction(user.id, true), () => setQuery(''))}>Izinkan</Button>
                      </div>
                    )) : <p className="px-3 py-5 text-center text-sm text-slate-500">User tidak ditemukan atau sudah memiliki izin dari role.</p>}
                  </div>
                )}
              </div>
              {namedUsers.length ? (
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {namedUsers.map(user => (
                    <Card key={user.id}><CardContent className="flex items-center gap-3 p-3">
                      <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{user.name}</p><p className="truncate text-xs text-slate-500">{user.email}</p></div>
                      <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => setNamedKomiteSubmitterAction(user.id, false))}>Cabut</Button>
                    </CardContent></Card>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed bg-white py-10 text-center dark:bg-slate-900">
                  <p className="text-sm font-medium">Belum ada pengaju tambahan</p>
                  <p className="mt-1 text-xs text-slate-500">Gunakan kolom pencarian di atas untuk mengizinkan user.</p>
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>
      )}

      <DraftDialog
        key={`${editing?.id || 'new'}:${formOpen}`}
        open={formOpen}
        item={editing}
        pending={pending}
        message={message}
        onClose={() => setFormOpen(false)}
        onSubmit={formData =>
          run(async () => {
            const response = await fetch('/api/komite/pengajuan/draft', { method: 'POST', body: formData, credentials: 'include' })
            const result = await response.json().catch(() => ({ error: 'Respons upload tidak valid.' }))
            return response.ok ? result : { error: result.error || 'Gagal mengunggah dokumen.' }
          }, () => setFormOpen(false))
        }
      />

      <ReviewDialog
        fundOptions={props.fundOptions}
        key={`${review?.item.id || 'none'}:${review?.action || 'none'}`}
        value={review}
        nextNomorSpb={props.nextNomorSpb}
        pending={pending}
        onClose={() => setReview(null)}
        onSubmit={formData =>
          run(() => reviewKomiteAction(formData), () => {
            setReview(null)
            setDetailId('')
            setActiveTab(detailOriginTab)
          })
        }
      />

      <Dialog open={!!confirmDialog} onOpenChange={open => { if (!open) setConfirmDialog(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{confirmDialog?.title}</DialogTitle>
            <DialogDescription>{confirmDialog?.description}</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" disabled={pending} onClick={() => setConfirmDialog(null)}>Batal</Button>
            <Button
              type="button"
              variant={confirmDialog?.destructive ? 'destructive' : 'default'}
              disabled={pending}
              onClick={() => {
                const fn = confirmDialog?.onConfirm
                setConfirmDialog(null)
                fn?.()
              }}
            >
              {confirmDialog?.confirmLabel}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function Count({ value, alert }: { value: number; alert?: boolean }) {
  return <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${alert ? 'bg-rose-500 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200'}`}>{value}</span>
}
function SectionToolbar({ title, children }: { title: string; children?: React.ReactNode }) {
  return <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium text-slate-600 dark:text-slate-300">{title}</p>{children}</div>
}
function isQueueFor(item: Item, roles: string[], isSuper: boolean, currentUserId: string, verifierId?: string) {
  if (item.status === 'menunggu_bendahara') return isSuper || roles.includes('bendahara_komite')
  return item.status === 'menunggu_ketua' && Boolean(verifierId) &&
    (isSuper || (verifierId === currentUserId && item.pengaju_id !== currentUserId))
}
function canReviewItem(item: Item, roles: string[], isSuper: boolean, currentUserId: string, verifierId?: string) {
  return isQueueFor(item, roles, isSuper, currentUserId, verifierId)
}

function ReportStatus({
  item,
  canManage,
  pending,
  onMarkReceived,
  onRequestUnmark,
}: {
  item: Item
  canManage: boolean
  pending: boolean
  onMarkReceived: () => void
  onRequestUnmark: () => void
}) {
  const received = Boolean(item.laporan_received_at)
  return (
    <div className="space-y-1" onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
      <p className={`text-xs font-medium ${received ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'}`}>
        {received ? 'Sudah diterima' : 'Belum diterima'}
      </p>
      {received && <p className="text-xs text-muted-foreground">{item.laporan_received_name || '-'} · {date(item.laporan_received_at)}</p>}
      {canManage && (
        <Button size="sm" variant="outline" className="h-7 text-xs" disabled={pending} onClick={() => (received ? onRequestUnmark() : onMarkReceived())}>
          {received ? 'Batalkan tanda' : 'Tandai diterima'}
        </Button>
      )}
    </div>
  )
}

function DataList({ items, onOpen, renderReport }: { items: Item[]; onOpen: (id: string) => void; renderReport?: (item: Item) => React.ReactNode }) {
  if (!items.length) return <Empty />
  return <>
    <div role="region" aria-label="Daftar pengajuan dana komite" tabIndex={0} className="hidden overflow-x-auto rounded-xl border bg-white dark:bg-slate-900 md:block">
      <Table>
        <TableHeader><TableRow className="bg-slate-50/80 dark:bg-slate-800/60">
          <TableHead className="w-[34%] text-xs">Pengajuan</TableHead>
          <TableHead className="text-xs">Pengaju</TableHead>
          <TableHead className="text-right text-xs">Nominal</TableHead>
          <TableHead className="text-xs">Status & Tindak Lanjut</TableHead>
          {renderReport && <TableHead className="text-xs">Laporan Kegiatan</TableHead>}
          <TableHead className="text-xs">Diperbarui</TableHead>
          <TableHead className="w-10" />
        </TableRow></TableHeader>
        <TableBody>{items.map(item => {
          const followUp = spbFollowUpBadge(item)
          return (
            <TableRow
              key={item.id}
              role="button"
              tabIndex={0}
              className="cursor-pointer transition-colors hover:bg-slate-50 focus-visible:bg-blue-50 focus-visible:outline-none dark:hover:bg-slate-800/60 dark:focus-visible:bg-blue-950/30"
              onClick={() => onOpen(item.id)}
              onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen(item.id) } }}
            >
              <TableCell>
                <p className="line-clamp-1 text-sm font-semibold">{item.judul}</p>
                <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">
                  {item.nomor_spb ? `${item.nomor_spb} · ` : ''}{item.uraian}
                </p>
              </TableCell>
              <TableCell className="max-w-[180px] truncate text-sm">{item.pengaju_name}</TableCell>
              <TableCell className="whitespace-nowrap text-right text-sm font-semibold tabular-nums">{money(item.nominal)}</TableCell>
              <TableCell>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Status status={item.status} />
                  {followUp && <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${followUp.className}`}>{followUp.label}</span>}
                </div>
                {item.fundAllocations?.length > 0 && (
                  <p className="mt-1 truncate text-[11px] text-slate-500">
                    {item.fundAllocations.map((row: { source: string }) => komiteFundLabel(row.source)).join(', ')}
                  </p>
                )}
              </TableCell>
              {renderReport && <TableCell>{renderReport(item)}</TableCell>}
              <TableCell className="whitespace-nowrap text-xs text-slate-500">{date(item.updated_at)}</TableCell>
              <TableCell><ChevronRight className="h-4 w-4 text-slate-400" /></TableCell>
            </TableRow>
          )
        })}</TableBody>
      </Table>
    </div>
    <div className="space-y-2 md:hidden">
      {items.map(item => {
        const followUp = spbFollowUpBadge(item)
        return (
          <div
            key={item.id}
            role="button"
            tabIndex={0}
            onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen(item.id) } }}
            onClick={() => onOpen(item.id)}
            className="w-full rounded-xl border bg-white p-3 text-left transition active:scale-[0.99] dark:bg-slate-900"
          >
            <div className="flex min-w-0 items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{item.judul}</p>
                <p className="mt-0.5 truncate text-xs text-slate-500">{item.nomor_spb ? `${item.nomor_spb} · ` : ''}{item.pengaju_name}</p>
              </div>
              <Status status={item.status} />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 border-t pt-2">
              <span className="text-sm font-semibold tabular-nums">{money(item.nominal)}</span>
              <div className="flex items-center gap-1.5">
                {followUp && <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${followUp.className}`}>{followUp.label}</span>}
                <span className="flex items-center gap-1 text-[11px] text-slate-500">v{item.current_version}<ChevronRight className="h-3.5 w-3.5" /></span>
              </div>
            </div>
            {renderReport && <div className="mt-3 border-t pt-2"><p className="mb-1 text-xs text-muted-foreground">Laporan kegiatan</p>{renderReport(item)}</div>}
          </div>
        )
      })}
    </div>
  </>
}
function Empty() { return <div className="rounded-xl border border-dashed bg-white py-12 text-center dark:bg-slate-900"><FileText className="mx-auto mb-2 h-8 w-8 text-slate-300" /><p className="text-sm text-slate-500">Tidak ada pengajuan yang sesuai filter.</p></div> }
function Status({ status }: { status: string }) { return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusStyle[status] || ''}`}>{statusLabel[status] || status}</span> }

function DetailPage({ item, isReviewer, onBack, actions, reportControls }: { item: Item; isReviewer: boolean; onBack: () => void; actions?: React.ReactNode; reportControls?: React.ReactNode }) {
  const [kuitansiOpen, setKuitansiOpen] = useState(false)
  const followUp = spbFollowUpBadge(item)
  return <div className="animate-in fade-in slide-in-from-right-2 duration-200">
    <button type="button" onClick={onBack} className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"><ArrowLeft className="h-4 w-4" />Kembali ke daftar</button>
    <Card className="min-w-0 overflow-hidden"><CardHeader className="border-b p-4 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <CardTitle className="break-words text-lg leading-snug sm:text-xl">{item.judul}</CardTitle>
          <p className="mt-1 text-xs text-slate-500">{item.pengaju_name} · {date(item.created_at)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Status status={item.status} />
          {followUp && <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${followUp.className}`}>{followUp.label}</span>}
        </div>
      </div>
    </CardHeader><CardContent className="space-y-5 p-4 sm:p-5">
      <StatusHint item={item} isReviewer={isReviewer} />
      <dl className="grid grid-cols-2 overflow-hidden rounded-lg border sm:grid-cols-4">
        <CompactInfo label="Nominal" value={money(item.nominal)} />
        <CompactInfo label="Nomor SPB" value={item.nomor_spb || 'Belum ditetapkan'} />
        <CompactInfo label="Penerima" value={item.penerima_pembayaran || 'Belum ditetapkan'} />
        <CompactInfo label="Pencairan" value={item.realisasi_status === 'sudah' ? `${item.realisasi_metode || 'Lunas'} · ${item.realisasi_tanggal || '-'}` : 'Belum dicairkan'} />
      </dl>
      <div className="grid gap-3 sm:grid-cols-2">
        <InfoBlock label="Tahun Anggaran" value={item.tahun_anggaran || '-'} />
        <InfoBlock label="Sumber Dana & Pos RAPBM" value={detailFundingLabel(item)} />
      </div>
      {item.workflow_version !== 2 && item.ketua_delegate_id && <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200"><p className="text-xs font-semibold uppercase tracking-wide">Delegasi Review Ketua Komite</p><p className="mt-1 text-sm">Ditugaskan kepada <strong>{item.ketua_delegate_name || 'Anggota Komite'}</strong>. Persetujuan pada SPB tetap atas nama Ketua Komite.</p></div>}
      <div><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Uraian</p><p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700 dark:text-slate-200">{item.uraian}</p></div>
      <RincianTable rows={item.rincian || []} />
      {reportControls && <div className="space-y-2 border-t pt-4"><p className="text-sm font-semibold">Laporan kegiatan</p>{reportControls}</div>}
      {item.status === 'disetujui' && !item.komite_cancelled_at && (
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={`/api/komite/pengajuan/${item.id}/spb`} target="_blank" rel="noreferrer"><Download className="mr-2 h-4 w-4" />Unduh / Cetak SPB</a>
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setKuitansiOpen(true)}>
            <Printer className="mr-2 h-4 w-4" />Cetak Kuitansi
          </Button>
          <KuitansiPrintDialog
            open={kuitansiOpen}
            onOpenChange={setKuitansiOpen}
            hrefBase={`/api/komite/pengajuan/${item.id}/kuitansi`}
            title="Cetak Kuitansi SPB"
            subtitle={[item.nomor_spb, money(item.nominal), item.penerima_pembayaran || item.judul].filter(Boolean).join(' · ')}
            defaultAttachment
          />
        </div>
      )}
      <div><p className="mb-3 text-sm font-semibold">Dokumen per versi</p><div className="space-y-3">{item.versions.map((version: any) => <div key={version.id} className="rounded-lg border p-3"><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium">Versi {version.version_number}</p><span className="text-xs text-slate-500">{version.submitted_at ? `Dikirim ${date(version.submitted_at)}` : 'Belum dikirim'}</span></div><div className="space-y-1.5">{version.files.map((file: any) => <a key={file.id} href={`/api/komite/pengajuan/${item.id}/files/${file.id}`} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2 rounded-md bg-slate-50 px-2.5 py-2 text-sm hover:bg-slate-100 dark:bg-slate-800"><FileText className="h-4 w-4 shrink-0 text-rose-500" /><span className="min-w-0 flex-1 truncate">{file.original_filename}</span><span className="shrink-0 text-xs text-slate-400">{size(file.size_bytes)}</span></a>)}</div></div>)}</div></div>
      <div><p className="mb-3 text-sm font-semibold">Riwayat review</p>{item.reviews.length ? <div className="relative space-y-4 border-l-2 border-slate-200 pl-4 dark:border-slate-700">{item.reviews.slice().reverse().map((entry: any) => <div key={entry.id} className="relative"><span className={`absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full ${entry.action === 'setujui' ? 'bg-emerald-500' : entry.action === 'tolak' ? 'bg-rose-500' : 'bg-orange-500'}`} /><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium">{entry.actor_name}</p><Badge variant="outline">{entry.workflow_version === 2 && entry.stage === 'ketua' ? 'Verifikator' : stageLabel[entry.stage]}</Badge>{entry.workflow_version !== 2 && entry.stage === 'ketua' && entry.actor_role === 'anggota_komite' ? <Badge variant="secondary">Delegasi Ketua</Badge> : null}{entry.is_super_admin_bypass ? <Badge variant="secondary">Bypass Admin</Badge> : null}</div><p className="mt-0.5 text-xs text-slate-500">{actionLabel[entry.action]} · versi {entry.version_number} · {date(entry.created_at)}</p>{entry.catatan && <p className="mt-2 whitespace-pre-wrap break-words rounded-md bg-slate-50 p-2 text-sm leading-5 dark:bg-slate-800">{entry.catatan}</p>}</div>)}</div> : <p className="text-sm text-slate-500">Belum ada tindakan review.</p>}</div>
      {actions && <div className="sticky bottom-0 -mx-4 -mb-4 border-t bg-white/95 p-4 backdrop-blur dark:bg-slate-950/95 sm:-mx-5 sm:-mb-5">{actions}</div>}
    </CardContent></Card></div>
}
function CompactInfo({ label, value }: { label: string; value: string }) { return <div className="min-w-0 border-b border-r p-3 even:border-r-0 sm:border-b-0 sm:border-r sm:even:border-r sm:last:border-r-0"><dt className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-0.5 break-words text-sm font-semibold tabular-nums">{value}</dd></div> }
function InfoBlock({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border bg-slate-50 p-3 dark:bg-slate-900"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 break-words text-sm font-medium">{value}</p></div> }

function RincianTable({ rows }: { rows: any[] }) {
  if (!rows.length) return null
  return <div><p className="mb-2 text-sm font-semibold">Rincian pembayaran/pengadaan</p><div role="region" aria-label="Rincian pembayaran pengajuan" tabIndex={0} className="overflow-x-auto rounded-lg border">
    <Table><TableHeader><TableRow><TableHead className="w-12 text-xs">No</TableHead><TableHead className="text-xs">Uraian</TableHead><TableHead className="text-xs">Penerima/Penyedia</TableHead><TableHead className="text-right text-xs">Jumlah</TableHead></TableRow></TableHeader>
    <TableBody>{rows.map((row, index) => <TableRow key={row.id || index}><TableCell>{index + 1}</TableCell><TableCell>{row.uraian}</TableCell><TableCell>{row.penerima_penyedia}</TableCell><TableCell className="text-right font-semibold tabular-nums">{money(row.jumlah)}</TableCell></TableRow>)}</TableBody></Table>
  </div></div>
}

function HelpGuide({ type, isTreasurer = false }: { type: 'submitter' | 'reviewer'; isTreasurer?: boolean }) {
  const steps = type === 'submitter'
    ? [
        ['1', 'Buat pengajuan', 'Isi judul, rincian pembayaran, lalu pilih berkas proposal PDF.'],
        ['2', 'Simpan draft', 'Total nominal dihitung otomatis dari rincian item pembayaran.'],
        ['3', 'Kirim ke Bendahara', 'Buka detail draft, lalu tekan "Kirim ke Bendahara".'],
      ]
    : [
        ['1', 'Buka pengajuan', 'Klik baris atau kartu untuk membaca detail dan membuka PDF.'],
        ['2', 'Periksa dokumen', 'Cocokkan uraian, rincian pembayaran, nominal, dan isi proposal.'],
        ['3', 'Pilih keputusan', 'Setujui bila benar, Minta Revisi bila perlu diperbaiki, atau Tolak bila final.'],
      ]
  return <details className="group overflow-hidden rounded-lg border border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/50">
    <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
      <CircleHelp className="h-4 w-4 shrink-0 text-slate-400" /><span className="flex-1">Panduan alur singkat</span><span className="font-normal text-slate-500">Buka</span><ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
    </summary>
    <div className="grid gap-2 border-t border-slate-200 p-3 dark:border-slate-800 md:grid-cols-3">
      {steps.map(([number, title, description]) => <div key={number} className="flex gap-2.5 rounded-md bg-white p-2.5 dark:bg-slate-900"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white">{number}</span><div><p className="text-xs font-semibold text-slate-900 dark:text-white">{title}</p><p className="mt-0.5 text-xs leading-5 text-slate-600 dark:text-slate-300">{description}</p></div></div>)}
    </div>
    {type === 'reviewer' && isTreasurer && <p className="border-t border-slate-200 px-3 py-2 text-xs leading-5 text-slate-600 dark:border-slate-800 dark:text-slate-300">Saat menyetujui, Bendahara menetapkan nomor SPB, penerima pembayaran, serta alokasi Sumber Dana dan Pos RAPBM.</p>}
  </details>
}

function StatusHint({ item, isReviewer }: { item: Item; isReviewer: boolean }) {
  let title = 'Informasi status'
  let message = 'Baca detail dan riwayat pengajuan di bawah ini.'
  let color = 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200'
  if (isReviewer && ['menunggu_bendahara', 'menunggu_ketua', 'menunggu_kepala'].includes(item.status)) {
    title = 'Menunggu keputusan Anda'
    message = 'Periksa berkas PDF dan rincian pembayaran, lalu pilih tombol keputusan di bagian bawah halaman.'
  } else if (item.status === 'draft') {
    title = 'Draft belum dikirim'
    message = 'Periksa data, rincian, dan dokumen. Jika sudah benar, tekan "Kirim ke Bendahara" di bagian bawah.'
  } else if (item.status === 'perlu_revisi') {
    title = 'Pengajuan perlu diperbaiki'
    message = 'Baca catatan reviewer pada Riwayat Review, lalu tekan "Upload Revisi" dan unggah dokumen yang sudah diperbaiki.'
    color = 'border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-200'
  } else if (item.status === 'ditolak') {
    title = 'Pengajuan ditolak'
    message = 'Pengajuan ini sudah ditutup. Lihat alasan penolakan pada Riwayat Review.'
    color = 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200'
  } else if (item.status === 'disetujui') {
    if (item.komite_cancelled_at) {
      title = 'SPB telah dibatalkan'
      message = item.komite_cancel_reason || 'SPB ini telah dibatalkan dan pagunya dilepas kembali.'
      color = 'border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200'
    } else if (!item.fundAllocations?.length) {
      title = 'SPB terbit · Sumber dana belum dipetakan'
      message = 'Gunakan tombol "Petakan sumber dana lama" di bawah untuk menghubungkan SPB ini ke angkatan/pos RAPBM sebelum mencatat pencairan.'
      color = 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200'
    } else if (item.realisasi_status === 'sudah') {
      title = 'SPB sudah dicairkan'
      message = `Dana telah dicairkan pada ${item.realisasi_tanggal || '-'} (${item.realisasi_metode || '-'}) dan tercatat di Arus Kas.`
      color = 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200'
    } else {
      title = 'SPB terbit · Siap dicairkan'
      message = 'SPB dapat diunduh. Setelah pembayaran dilakukan, tekan "Catat pencairan" di bagian bawah agar otomatis masuk ke Arus Kas.'
      color = 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200'
    }
  } else if (item.status.startsWith('menunggu_')) {
    title = 'Sedang menunggu pemeriksaan'
    message = `Pengajuan sedang diproses oleh ${statusLabel[item.status]?.replace('Menunggu ', '')}. Anda tidak perlu mengunggah ulang dokumen.`
  }
  return <div className={`flex gap-2.5 rounded-lg border p-3 ${color}`}><CircleHelp className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="text-sm font-semibold">{title}</p><p className="mt-0.5 text-xs leading-5 opacity-90">{message}</p></div></div>
}

function OwnerActions({ item, pending, hideDelete = false, onEdit, onRequestDelete, onRun }: { item: Item; pending: boolean; hideDelete?: boolean; onEdit: () => void; onRequestDelete: () => void; onRun: (task: () => Promise<any>) => void }) {
  if (!['draft', 'perlu_revisi'].includes(item.status)) return null
  return <div className="flex w-full flex-col gap-2 sm:flex-row">
    <Button variant="outline" className="sm:flex-1" onClick={onEdit}><Pencil className="mr-2 h-4 w-4" />{item.status === 'draft' ? 'Edit Draft' : 'Upload Revisi'}</Button>
    <Button className="sm:flex-1" disabled={pending || (item.status === 'perlu_revisi' && item.versions[0]?.submitted_at)} onClick={() => onRun(() => submitKomiteAction(item.id))}><Send className="mr-2 h-4 w-4" />Kirim ke Bendahara</Button>
    {item.status === 'draft' && !item.submitted_at && !hideDelete && <Button variant="destructive" disabled={pending} onClick={onRequestDelete} aria-label="Hapus draft"><Trash2 className="h-4 w-4" /></Button>}
  </div>
}
function ReviewActions({ onReview }: { item: Item; onReview: (action: string) => void }) {
  return <div className="grid grid-cols-1 gap-2 sm:grid-cols-3"><Button onClick={() => onReview('setujui')}><CheckCircle2 className="mr-2 h-4 w-4" />Setujui</Button><Button variant="outline" onClick={() => onReview('minta_revisi')}><RotateCcw className="mr-2 h-4 w-4" />Minta Revisi</Button><Button variant="destructive" onClick={() => onReview('tolak')}><XCircle className="mr-2 h-4 w-4" />Tolak</Button></div>
}

function DetailRowsEditor({ rows, setRows }: { rows: RincianRow[]; setRows: (rows: RincianRow[]) => void }) {
  const total = detailTotal(rows)
  function update(index: number, key: keyof RincianRow, value: string) {
    setRows(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: value } : row)))
  }
  return <fieldset className="space-y-2.5 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
    <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Rincian Pembayaran / Pengadaan</legend>
    <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
      <span>Maksimal {MAX_DETAIL_ROWS} baris item</span>
      <span className="font-bold tabular-nums text-slate-900 dark:text-white">Total: {money(total)}</span>
    </div>
    <input type="hidden" name="nominal" value={total} />
    <div className="space-y-2">
      {rows.map((row, index) => (
        <div key={index} className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-900/40">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Item {index + 1}</p>
            {rows.length > 1 && (
              <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs text-rose-600" onClick={() => setRows(rows.filter((_, rowIndex) => rowIndex !== index))}>
                <Trash2 className="mr-1 h-3.5 w-3.5" />Hapus
              </Button>
            )}
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_200px]">
            <Input
              name="detail_uraian"
              aria-label={`Uraian item ${index + 1}`}
              placeholder="Uraian pembayaran / pengadaan"
              value={row.uraian}
              onChange={event => update(index, 'uraian', event.target.value)}
              maxLength={240}
              required
            />
            <RupiahInput
              name="detail_jumlah"
              aria-label={`Nominal item ${index + 1}`}
              min={1}
              placeholder="0"
              value={row.jumlah}
              onValueChange={digits => update(index, 'jumlah', digits)}
              required
            />
          </div>
          <Input
            className="mt-2"
            name="detail_penerima_penyedia"
            aria-label={`Penerima atau penyedia item ${index + 1}`}
            placeholder="Nama penerima / penyedia / toko"
            value={row.penerima_penyedia}
            onChange={event => update(index, 'penerima_penyedia', event.target.value)}
            maxLength={180}
            required
          />
        </div>
      ))}
    </div>
    <Button type="button" size="sm" variant="outline" disabled={rows.length >= MAX_DETAIL_ROWS} onClick={() => setRows([...rows, { uraian: '', penerima_penyedia: '', jumlah: '' }])}>
      <Plus className="mr-1.5 h-4 w-4" />Tambah Item
    </Button>
  </fieldset>
}

function DraftDialog({ open, item, pending, message, onClose, onSubmit }: { open: boolean; item: Item | null; pending: boolean; message: string; onClose: () => void; onSubmit: (data: FormData) => void }) {
  const [total, setTotal] = useState(0)
  const [rows, setRows] = useState<RincianRow[]>(rowsFromItem(item))
  const needsFiles = !item || item.status === 'perlu_revisi'
  return <Dialog open={open} onOpenChange={value => !value && onClose()}><DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>{!item ? 'Buat Pengajuan' : item.status === 'perlu_revisi' ? 'Upload Revisi' : 'Edit Draft'}</DialogTitle></DialogHeader><form onSubmit={event => {
    event.preventDefault()
    onSubmit(new FormData(event.currentTarget))
  }} className="space-y-4">
    {message && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">{message}</div>}
    {item && <input type="hidden" name="id" value={item.id} />}
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5"><Label htmlFor="judul">Judul kegiatan</Label><Input id="judul" name="judul" maxLength={180} defaultValue={item?.judul || ''} required /></div>
      <div className="space-y-1.5"><Label htmlFor="tahun_anggaran">Tahun Anggaran</Label><Input id="tahun_anggaran" name="tahun_anggaran" maxLength={30} defaultValue={item?.tahun_anggaran || defaultTahunAnggaran()} required /></div>
    </div>
    <div className="space-y-1.5"><Label htmlFor="uraian">Uraian umum</Label><Textarea id="uraian" name="uraian" maxLength={4000} rows={3} defaultValue={item?.uraian || ''} required /></div>
    <DetailRowsEditor rows={rows} setRows={setRows} />
    <div className="space-y-1.5"><Label htmlFor="files">Dokumen PDF {needsFiles ? '' : '(kosongkan bila tidak diganti)'}</Label><Input id="files" name="files" type="file" accept="application/pdf,.pdf" multiple required={needsFiles} onChange={e => setTotal(Array.from(e.target.files || []).reduce((sum, file) => sum + file.size, 0))} /><div className="flex justify-between gap-2 text-xs"><span className="text-slate-500">Maksimal 10 PDF, total ukuran maksimal 6 MB.</span><span className={total > MAX_TOTAL ? 'font-semibold text-rose-600' : 'text-slate-500'}>{size(total)} / 6 MB</span></div></div>
    <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={onClose}>Batal</Button><Button type="submit" disabled={pending || total > MAX_TOTAL || detailTotal(rows) <= 0}>{pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Simpan Draft</Button></div>
  </form></DialogContent></Dialog>
}

function ReviewDialog({ fundOptions, value, nextNomorSpb, pending, onClose, onSubmit }: { fundOptions: Props['fundOptions']; value: { item: Item; action: string } | null; nextNomorSpb?: string; pending: boolean; onClose: () => void; onSubmit: (data: FormData) => void }) {
  const isTreasurerApprove = value?.action === 'setujui' && value.item.status === 'menunggu_bendahara'
  const [rows, setRows] = useState<RincianRow[]>(rowsFromItem(value?.item))
  const [rejectConfirmation, setRejectConfirmation] = useState('')
  function closeDialog() {
    setRejectConfirmation('')
    onClose()
  }
  return <Dialog open={!!value} onOpenChange={open => !open && closeDialog()}><DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>{value ? actionLabel[value.action] : 'Review'} Pengajuan</DialogTitle></DialogHeader>{value && <form action={formData => { setRejectConfirmation(''); onSubmit(formData) }} className="space-y-4"><input type="hidden" name="id" value={value.item.id} /><input type="hidden" name="action" value={value.action} />
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-slate-50 p-3 dark:bg-slate-900">
      <p className="text-sm font-semibold">{value.item.judul}</p>
      <p className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">{money(detailTotal(rows) || value.item.nominal)}</p>
    </div>
    {value?.action === 'setujui' && value.item.status === 'menunggu_ketua' && (
      <p className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
        Persetujuan Verifikator merupakan tahap akhir. SPB langsung diterbitkan dan mengunci pagu RAPBM terkait.
      </p>
    )}
    {isTreasurerApprove && <>
      <fieldset className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Identitas Surat Perintah Bayar (SPB)</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="nomor_spb" className="text-xs">Nomor SPB</Label>
              {nextNomorSpb && (
                <button
                  type="button"
                  className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                  onClick={() => {
                    const el = document.getElementById('nomor_spb') as HTMLInputElement
                    if (el) el.value = nextNomorSpb
                  }}
                >
                  Isi otomatis
                </button>
              )}
            </div>
            <Input id="nomor_spb" name="nomor_spb" defaultValue={value.item.nomor_spb || nextNomorSpb || ''} maxLength={100} autoCorrect="off" spellCheck={false} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="penerima_pembayaran" className="text-xs">Penerima pembayaran utama</Label>
            <Input id="penerima_pembayaran" name="penerima_pembayaran" defaultValue={value.item.penerima_pembayaran || ''} maxLength={180} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="review_tahun_anggaran" className="text-xs">Tahun Anggaran</Label>
            <Input id="review_tahun_anggaran" name="tahun_anggaran" defaultValue={value.item.tahun_anggaran || defaultTahunAnggaran()} maxLength={30} required />
          </div>
        </div>
      </fieldset>
      <FundAllocationFields years={fundOptions.years} positions={fundOptions.positions} amount={detailTotal(rows)} />
      <DetailRowsEditor rows={rows} setRows={setRows} />
    </>}
    <div className="space-y-1.5"><Label htmlFor="catatan">Catatan {value.action === 'setujui' ? '(opsional)' : '(wajib)'}</Label><Textarea id="catatan" name="catatan" rows={3} required={value.action !== 'setujui'} placeholder={value.action === 'minta_revisi' ? 'Jelaskan bagian yang harus diperbaiki...' : value.action === 'tolak' ? 'Tuliskan alasan penolakan final...' : 'Catatan persetujuan...'} /></div>
    {value.action === 'tolak' && <div className="space-y-1.5"><Label htmlFor="reject_confirmation">Ketik <strong>TOLAK</strong> untuk mengonfirmasi penolakan permanen</Label><Input id="reject_confirmation" name="reject_confirmation" value={rejectConfirmation} onChange={event => setRejectConfirmation(event.target.value)} autoComplete="off" autoCorrect="off" spellCheck={false} placeholder="TOLAK" required /></div>}
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={closeDialog}>Batal</Button><Button type="submit" variant={value.action === 'tolak' ? 'destructive' : 'default'} disabled={pending || (isTreasurerApprove && detailTotal(rows) <= 0) || (value.action === 'tolak' && rejectConfirmation !== 'TOLAK')}>{pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Konfirmasi {value.action === 'setujui' ? 'Setujui' : value.action === 'minta_revisi' ? 'Revisi' : 'Tolak'}</Button></div>
  </form>}</DialogContent></Dialog>
}

function detailFundingLabel(item: Item) {
  if (!item.fundAllocations?.length) return item.status === 'disetujui' ? 'Belum Dipetakan' : 'Menunggu penetapan Bendahara'
  return item.fundAllocations.map((row: { source: string; label?: string; amount: number }) =>
    [komiteFundLabel(row.source), row.label, formatRupiah(row.amount)].filter(Boolean).join(' · '),
  ).join(' / ')
}

function SpbFunds({ item, options, historicalCash, pending, onRun }: {
  item: Item; options: Props['fundOptions']; historicalCash: Props['historicalCash']; pending: boolean
  onRun: (task: () => Promise<{ success?: string; error?: string }>) => void
}) {
  const [operation, setOperation] = useState('')
  const [fundError, setFundError] = useState('')
  if (item.komite_cancelled_at) return <p className="text-sm text-slate-600 dark:text-slate-300">SPB dibatalkan: {item.komite_cancel_reason}</p>
  const needsMapping = !item.fundAllocations?.length
  const choices: Array<[string, string, 'default' | 'outline' | 'destructive']> = item.status === 'menunggu_ketua'
    ? [['return', 'Kembalikan ke Bendahara', 'outline']]
    : needsMapping
      ? [['map', 'Petakan sumber dana lama', 'default']]
      : item.realisasi_status === 'sudah'
        ? [['reverse', 'Koreksi / Batalkan Pencairan', 'outline']]
        : [
            ['pay', 'Catat Pencairan SPB', 'default'],
            ['cancel', 'Batalkan SPB', 'destructive'],
          ]
  return <>
    <div className="flex flex-wrap gap-2">
      {choices.map(([value, label, variant]) => (
        <Button key={value} type="button" size="sm" variant={variant} onClick={() => { setFundError(''); setOperation(value) }}>
          {label}
        </Button>
      ))}
    </div>
    <Dialog open={Boolean(operation)} onOpenChange={open => !open && setOperation('')}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{choices.find(([value]) => value === operation)?.[1]}</DialogTitle>
          <DialogDescription>
            {item.nomor_spb ? `${item.nomor_spb} · ` : ''}{item.judul} ({money(Number(item.nominal || 0))})
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={event => {
          event.preventDefault()
          const form = new FormData(event.currentTarget)
          if (form.get('cash_id') === 'none') form.delete('cash_id')
          setFundError('')
          onRun(async () => {
            const result = await (operation === 'pay' ? recordKomiteRealization(form) : operation === 'map' ? mapHistoricalKomiteSpb(form) : changeKomiteSpbAction(form))
            if (result.success) setOperation('')
            else if (result.error) setFundError(result.error)
            return result
          })
        }}>
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="operation" value={operation} />
          {operation === 'pay' ? (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="spb-date">Tanggal pembayaran</Label>
                  <Input id="spb-date" name="date" required type="date" defaultValue={todayWIB()} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="spb-method">Metode pembayaran</Label>
                  <SpbMethodSelect id="spb-method" defaultValue="tunai" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="spb-proof">Bukti pembayaran (Foto / PDF)</Label>
                <Input id="spb-proof" name="proof" required type="file" accept="image/*,application/pdf" />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="spb-fund-reason">Catatan / Alasan</Label>
              <Input id="spb-fund-reason" name="reason" placeholder="Contoh: Pemetaan anggaran SPB ke RAPBM 2026" required minLength={3} maxLength={300} />
            </div>
          )}
          {operation === 'map' && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="spb-cash-id">Tautkan dengan Transaksi Arus Kas (jika sudah dibayar)</Label>
                <Select name="cash_id" defaultValue="none">
                  <SelectTrigger id="spb-cash-id"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{item.realisasi_status === 'sudah' ? 'Belum dicatat di Arus Kas' : 'Belum dibayar (masih menunggu pencairan)'}</SelectItem>
                    {historicalCash.filter(row => row.amount === Number(item.nominal)).map(row => (
                      <SelectItem key={row.id} value={row.id}>{row.transaction_date} · {row.proof_number || row.id} · {row.description}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {item.realisasi_status === 'sudah' && !item.realisasi_tanggal && (
                <div className="space-y-1.5">
                  <Label htmlFor="spb-hist-date">Tanggal bayar historis</Label>
                  <Input id="spb-hist-date" name="date" type="date" />
                </div>
              )}
              {item.realisasi_status === 'sudah' && !item.realisasi_metode && (
                <div className="space-y-1.5">
                  <Label htmlFor="spb-map-method">Metode bayar historis</Label>
                  <SpbMethodSelect id="spb-map-method" />
                </div>
              )}
              <FundAllocationFields historical years={options.years} positions={options.historicalPositions} amount={Number(item.nominal)} />
            </div>
          )}
          {fundError && <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">{fundError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" disabled={pending} onClick={() => setOperation('')}>Batal</Button>
            <Button disabled={pending} type="submit" variant={operation === 'cancel' ? 'destructive' : 'default'}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Simpan
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  </>
}

function SpbMethodSelect({ id, defaultValue }: { id: string; defaultValue?: string }) {
  return <Select name="method" defaultValue={defaultValue}>
    <SelectTrigger id={id}><SelectValue placeholder="Pilih metode" /></SelectTrigger>
    <SelectContent><SelectItem value="tunai">Tunai</SelectItem><SelectItem value="transfer">Transfer</SelectItem></SelectContent>
  </Select>
}
