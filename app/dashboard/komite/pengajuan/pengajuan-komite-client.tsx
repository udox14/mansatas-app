'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  ArrowLeft, CheckCircle2, ChevronDown, ChevronRight, CircleHelp, Download, FileText, HandCoins, Loader2,
  Pencil, Plus, RotateCcw, Search, Send, Trash2, XCircle,
} from 'lucide-react'
import {
  deleteKomiteAction, deleteKomiteDraftAction, reviewKomiteAction, saveKomiteDraftAction,
  saveKomiteRealisasiAction, setNamedKomiteSubmitterAction, submitKomiteAction,
} from './actions'

type Item = any
type RincianRow = { uraian: string; penerima_penyedia: string; jumlah: string }
type Props = {
  items: Item[]
  users: any[]
  currentUserId: string
  roles: string[]
  canCreate: boolean
  isSuper: boolean
  reviewCount: number
}

const MAX_TOTAL = 5 * 1024 * 1024
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
  draft: 'Draft', menunggu_bendahara: 'Menunggu Bendahara', menunggu_ketua: 'Menunggu Ketua',
  menunggu_kepala: 'Menunggu Kepala', perlu_revisi: 'Perlu Revisi', ditolak: 'Ditolak', disetujui: 'Disetujui',
}
const stageLabel: Record<string, string> = { bendahara: 'Bendahara Komite', ketua: 'Ketua Komite', kepala: 'Kepala Madrasah' }
const actionLabel: Record<string, string> = { setujui: 'Menyetujui', minta_revisi: 'Meminta revisi', tolak: 'Menolak' }

function money(value: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value || 0)
}
function date(value?: string) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(value.endsWith('Z') ? value : `${value.replace(' ', 'T')}Z`))
}
function dateOnly(value?: string) {
  if (!value) return ''
  return String(value).slice(0, 10)
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

export function PengajuanKomiteClient(props: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const canSeeReviewerTabs = props.roles.some(role => ['super_admin', 'bendahara_komite', 'ketua_komite', 'kepsek'].includes(role))
  const canRealize = props.roles.includes('super_admin') || props.roles.includes('bendahara_komite')
  const initialTab = canSeeReviewerTabs && props.reviewCount ? 'review' : 'mine'
  const [activeTab, setActiveTab] = useState(initialTab)
  const [detailId, setDetailId] = useState('')
  const [detailOriginTab, setDetailOriginTab] = useState(initialTab)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Item | null>(null)
  const [review, setReview] = useState<{ item: Item; action: string } | null>(null)
  const [realisasi, setRealisasi] = useState<Item | null>(null)
  const [message, setMessage] = useState('')
  const [query, setQuery] = useState('')

  const own = props.items.filter(item => item.pengaju_id === props.currentUserId)
  const queue = props.items.filter(item => item.pengaju_id !== props.currentUserId && isQueueFor(item, props.roles, props.isSuper))
  const history = props.items.filter(item => item.reviews.some((entry: any) => entry.actor_id === props.currentUserId))
  const approved = props.items.filter(item => item.status === 'disetujui')
  const detailItem = props.items.find(item => item.id === detailId)
  const namedUsers = props.users.filter(user => Boolean(user.is_named))
  const normalizedQuery = query.trim().toLowerCase()
  const searchResults = normalizedQuery.length >= 2
    ? props.users.filter(user => {
        const defaultRole = (user.roles || [user.role]).some((role: string) => ['super_admin','kepsek','wakamad','pembina_ekstrakurikuler'].includes(role))
        return !user.is_named && !defaultRole && `${user.name} ${user.email}`.toLowerCase().includes(normalizedQuery)
      }).slice(0, 8)
    : []
  const showOwnerActions = Boolean(detailItem && detailOriginTab === 'mine' && ['draft','perlu_revisi'].includes(detailItem.status))
  const showReviewActions = Boolean(detailItem && detailOriginTab === 'review' && ['menunggu_bendahara','menunggu_ketua','menunggu_kepala'].includes(detailItem.status))
  const showRealizationAction = Boolean(detailItem && detailItem.status === 'disetujui' && canRealize)
  const showSuperAdminDelete = Boolean(detailItem && props.isSuper)

  function openDetail(id: string) {
    setDetailOriginTab(activeTab)
    setDetailId(id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function run(task: () => Promise<any>, close?: () => void) {
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

  return (
    <>
      {message && (
        <div className={`rounded-lg border px-3 py-2 text-sm ${message.toLowerCase().includes('gagal') || message.toLowerCase().includes('tidak') || message.toLowerCase().includes('wajib') ? 'border-rose-200 bg-rose-50 text-rose-700 dark:bg-rose-950/40' : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40'}`}>
          {message}
        </div>
      )}
      {detailItem ? (
        <DetailPage item={detailItem} mode={detailOriginTab} onBack={() => { setActiveTab(detailOriginTab); setDetailId('') }}
          actions={(showOwnerActions || showReviewActions || showRealizationAction || showSuperAdminDelete) ? <>
            {showOwnerActions && <OwnerActions item={detailItem} pending={pending} hideDelete={props.isSuper} onEdit={() => { setEditing(detailItem); setFormOpen(true) }} onRun={task => run(task, () => setDetailId(''))} />}
            {showReviewActions && <ReviewActions item={detailItem} onReview={action => setReview({ item: detailItem, action })} />}
            {showRealizationAction && <Button variant="outline" className="mt-2 w-full sm:w-auto" disabled={pending} onClick={() => setRealisasi(detailItem)}><HandCoins className="mr-2 h-4 w-4" />Catat Realisasi</Button>}
            {showSuperAdminDelete && <Button variant="destructive" className="mt-2 w-full sm:w-auto" disabled={pending} onClick={() => {
              if (confirm(`Hapus pengajuan berstatus "${statusLabel[detailItem.status] || detailItem.status}" beserta seluruh versi dokumen dan riwayat review? Tindakan ini tidak dapat dibatalkan.`)) run(() => deleteKomiteAction(detailItem.id), () => setDetailId(''))
            }}><Trash2 className="mr-2 h-4 w-4" />Hapus Pengajuan</Button>}
          </> : null} />
      ) : <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="overflow-x-auto pb-1">
          <TabsList className="h-auto min-w-max justify-start">
            <TabsTrigger value="mine">Pengajuan Saya <Count value={own.length} /></TabsTrigger>
            {canSeeReviewerTabs && <TabsTrigger value="review">Perlu Direview <Count value={props.reviewCount} alert={props.reviewCount > 0} /></TabsTrigger>}
            {canSeeReviewerTabs && <TabsTrigger value="history">Riwayat Review <Count value={history.length} /></TabsTrigger>}
            {canSeeReviewerTabs && <TabsTrigger value="approved">Disetujui <Count value={approved.length} /></TabsTrigger>}
            {props.isSuper && <TabsTrigger value="settings">Pengaturan Pengaju</TabsTrigger>}
          </TabsList>
        </div>

        <TabsContent value="mine">
          <SectionToolbar title="Pengajuan milik Anda">
            {props.canCreate && <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true) }}><Plus className="mr-1.5 h-4 w-4" />Buat Pengajuan</Button>}
          </SectionToolbar>
          <HelpGuide type="submitter" />
          <DataList items={own} onOpen={openDetail} />
        </TabsContent>
        {canSeeReviewerTabs && <TabsContent value="review">
          <SectionToolbar title="Antrean tahap Anda" />
          <HelpGuide type="reviewer" isTreasurer={props.roles.includes('bendahara_komite') || props.isSuper} />
          <DataList items={queue} onOpen={openDetail} />
        </TabsContent>}
        {canSeeReviewerTabs && <TabsContent value="history">
          <SectionToolbar title="Pengajuan yang pernah Anda review" />
          <DataList items={history} onOpen={openDetail} />
        </TabsContent>}
        {canSeeReviewerTabs && <TabsContent value="approved">
          <SectionToolbar title="Dokumen yang telah disetujui" />
          <DataList items={approved} onOpen={openDetail} />
        </TabsContent>}
        {props.isSuper && (
          <TabsContent value="settings">
            <SectionToolbar title="Pengaju tambahan yang sudah diizinkan" />
            <div className="relative mb-4">
              <div className="flex items-center gap-2 rounded-lg border bg-white px-3 dark:bg-slate-900">
                <Search className="h-4 w-4 text-slate-400" /><Input className="border-0 px-0 shadow-none focus-visible:ring-0" placeholder="Ketik minimal 2 huruf untuk mencari user..." value={query} onChange={e => setQuery(e.target.value)} />
              </div>
              {normalizedQuery.length >= 2 && <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border bg-white p-1 shadow-lg dark:bg-slate-900">
                {searchResults.length ? searchResults.map(user => <div key={user.id} className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800">
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{user.name}</p><p className="truncate text-xs text-slate-500">{user.email}</p></div>
                  <Button size="sm" disabled={pending} onClick={() => run(() => setNamedKomiteSubmitterAction(user.id, true), () => setQuery(''))}>Izinkan</Button>
                </div>) : <p className="px-3 py-5 text-center text-sm text-slate-500">User tidak ditemukan atau sudah memiliki izin dari role.</p>}
              </div>}
            </div>
            {namedUsers.length ? <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {namedUsers.map(user => <Card key={user.id}><CardContent className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{user.name}</p><p className="truncate text-xs text-slate-500">{user.email}</p></div>
                  <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => setNamedKomiteSubmitterAction(user.id, false))}>Cabut</Button>
                </CardContent></Card>)}
            </div> : <div className="rounded-lg border border-dashed bg-white py-10 text-center dark:bg-slate-900"><p className="text-sm font-medium">Belum ada pengaju tambahan</p><p className="mt-1 text-xs text-slate-500">Gunakan kolom pencarian di atas untuk mengizinkan user.</p></div>}
          </TabsContent>
        )}
      </Tabs>}

      <DraftDialog open={formOpen} item={editing} pending={pending} onClose={() => setFormOpen(false)} onSubmit={formData => run(() => saveKomiteDraftAction(formData), () => setFormOpen(false))} />
      <ReviewDialog value={review} pending={pending} onClose={() => setReview(null)} onSubmit={formData => run(() => reviewKomiteAction(formData), () => { setReview(null); setDetailId(''); setActiveTab(detailOriginTab) })} />
      <RealisasiDialog item={realisasi} pending={pending} onClose={() => setRealisasi(null)} onSubmit={formData => run(() => saveKomiteRealisasiAction(formData), () => setRealisasi(null))} />
    </>
  )
}

function Count({ value, alert }: { value: number; alert?: boolean }) {
  return <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${alert ? 'bg-rose-500 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200'}`}>{value}</span>
}
function SectionToolbar({ title, children }: { title: string; children?: React.ReactNode }) {
  return <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium text-slate-600 dark:text-slate-300">{title}</p>{children}</div>
}
function isQueueFor(item: Item, roles: string[], isSuper: boolean) {
  if (isSuper) return ['menunggu_bendahara','menunggu_ketua','menunggu_kepala'].includes(item.status)
  return (item.status === 'menunggu_bendahara' && roles.includes('bendahara_komite')) ||
    (item.status === 'menunggu_ketua' && roles.includes('ketua_komite')) ||
    (item.status === 'menunggu_kepala' && roles.includes('kepsek'))
}

function DataList({ items, onOpen }: { items: Item[]; onOpen: (id: string) => void }) {
  if (!items.length) return <Empty />
  return <>
    <div className="hidden overflow-hidden rounded-xl border bg-white dark:bg-slate-900 md:block">
      <Table>
        <TableHeader><TableRow className="bg-slate-50/80 dark:bg-slate-800/60">
          <TableHead className="w-[34%] text-xs">Pengajuan</TableHead><TableHead className="text-xs">Pengaju</TableHead>
          <TableHead className="text-xs">Nominal</TableHead><TableHead className="text-xs">Status</TableHead>
          <TableHead className="text-xs">Diperbarui</TableHead><TableHead className="w-12" />
        </TableRow></TableHeader>
        <TableBody>{items.map(item => <TableRow key={item.id} role="button" tabIndex={0} className="cursor-pointer transition-colors hover:bg-slate-50 focus-visible:bg-blue-50 focus-visible:outline-none dark:hover:bg-slate-800/60 dark:focus-visible:bg-blue-950/30" onClick={() => onOpen(item.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') onOpen(item.id) }}>
          <TableCell><p className="line-clamp-1 text-sm font-semibold">{item.judul}</p><p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{item.kode_rkas_program || item.uraian}</p></TableCell>
          <TableCell className="max-w-[180px] truncate text-sm">{item.pengaju_name}</TableCell>
          <TableCell className="whitespace-nowrap text-sm font-semibold">{money(item.nominal)}</TableCell>
          <TableCell><Status status={item.status} /></TableCell>
          <TableCell className="whitespace-nowrap text-xs text-slate-500">{date(item.updated_at)}</TableCell>
          <TableCell><ChevronRight className="h-4 w-4 text-slate-400" /></TableCell>
        </TableRow>)}</TableBody>
      </Table>
    </div>
    <div className="space-y-2 md:hidden">
      {items.map(item => <button key={item.id} type="button" onClick={() => onOpen(item.id)} className="w-full rounded-xl border bg-white p-3 text-left transition active:scale-[0.99] dark:bg-slate-900">
        <div className="flex min-w-0 items-start gap-2"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.judul}</p><p className="mt-0.5 truncate text-xs text-slate-500">{item.pengaju_name}</p></div><Status status={item.status} /></div>
        <div className="mt-2 flex items-center justify-between gap-3 border-t pt-2"><span className="text-sm font-semibold">{money(item.nominal)}</span><span className="flex items-center gap-1 text-[11px] text-slate-500">v{item.current_version}<ChevronRight className="h-3.5 w-3.5" /></span></div>
      </button>)}
    </div>
  </>
}
function Empty() { return <div className="rounded-xl border border-dashed bg-white py-14 text-center dark:bg-slate-900"><FileText className="mx-auto mb-2 h-8 w-8 text-slate-300" /><p className="text-sm text-slate-500">Belum ada data pada bagian ini.</p></div> }
function Status({ status }: { status: string }) { return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusStyle[status] || ''}`}>{statusLabel[status] || status}</span> }

function DetailPage({ item, mode, onBack, actions }: { item: Item; mode: string; onBack: () => void; actions?: React.ReactNode }) {
  return <div className="animate-in fade-in slide-in-from-right-2 duration-200">
    <button type="button" onClick={onBack} className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"><ArrowLeft className="h-4 w-4" />Kembali ke daftar</button>
    <Card className="min-w-0 overflow-hidden"><CardHeader className="border-b p-4 sm:p-5">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><CardTitle className="break-words text-lg leading-snug sm:text-xl">{item.judul}</CardTitle><p className="mt-1 text-xs text-slate-500">{item.pengaju_name} - {date(item.created_at)}</p></div><Status status={item.status} /></div>
  </CardHeader><CardContent className="space-y-5 p-4 sm:p-5">
    <StatusHint item={item} mode={mode} />
    <dl className="grid grid-cols-2 overflow-hidden rounded-lg border sm:grid-cols-4">
      <CompactInfo label="Nominal" value={money(item.nominal)} />
      <CompactInfo label="Nomor SPB" value={item.nomor_spb || 'Belum ditetapkan'} />
      <CompactInfo label="Penerima" value={item.penerima_pembayaran || 'Belum ditetapkan'} />
      <CompactInfo label="Realisasi" value={item.realisasi_status === 'sudah' ? `${item.realisasi_metode || '-'} - ${dateOnly(item.realisasi_tanggal)}` : 'Belum dicatat'} />
    </dl>
    <div className="grid gap-3 sm:grid-cols-2">
      <InfoBlock label="Tahun Anggaran" value={item.tahun_anggaran || '-'} />
      <InfoBlock label="Kode RKAS/Program" value={item.kode_rkas_program || '-'} />
    </div>
    <div><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Uraian</p><p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700 dark:text-slate-200">{item.uraian}</p></div>
    <RincianTable rows={item.rincian || []} />
    {item.status === 'disetujui' && <Button asChild className="w-full sm:w-auto"><a href={`/api/komite/pengajuan/${item.id}/spb`} target="_blank"><Download className="mr-2 h-4 w-4" />Unduh SPB</a></Button>}
    <div><p className="mb-3 text-sm font-semibold">Dokumen per versi</p><div className="space-y-3">{item.versions.map((version: any) => <div key={version.id} className="rounded-lg border p-3"><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium">Versi {version.version_number}</p><span className="text-xs text-slate-500">{version.submitted_at ? `Dikirim ${date(version.submitted_at)}` : 'Belum dikirim'}</span></div><div className="space-y-1.5">{version.files.map((file: any) => <a key={file.id} href={`/api/komite/pengajuan/${item.id}/files/${file.id}`} target="_blank" className="flex min-w-0 items-center gap-2 rounded-md bg-slate-50 px-2.5 py-2 text-sm hover:bg-slate-100 dark:bg-slate-800"><FileText className="h-4 w-4 shrink-0 text-rose-500" /><span className="min-w-0 flex-1 truncate">{file.original_filename}</span><span className="shrink-0 text-xs text-slate-400">{size(file.size_bytes)}</span></a>)}</div></div>)}</div></div>
    <div><p className="mb-3 text-sm font-semibold">Riwayat review</p>{item.reviews.length ? <div className="relative space-y-4 border-l-2 border-slate-200 pl-4 dark:border-slate-700">{item.reviews.slice().reverse().map((entry: any) => <div key={entry.id} className="relative"><span className={`absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full ${entry.action === 'setujui' ? 'bg-emerald-500' : entry.action === 'tolak' ? 'bg-rose-500' : 'bg-orange-500'}`} /><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium">{entry.actor_name}</p><Badge variant="outline">{stageLabel[entry.stage]}</Badge>{entry.is_super_admin_bypass ? <Badge variant="secondary">Bypass Admin</Badge> : null}</div><p className="mt-0.5 text-xs text-slate-500">{actionLabel[entry.action]} - versi {entry.version_number} - {date(entry.created_at)}</p>{entry.catatan && <p className="mt-2 whitespace-pre-wrap break-words rounded-md bg-slate-50 p-2 text-sm leading-5 dark:bg-slate-800">{entry.catatan}</p>}</div>)}</div> : <p className="text-sm text-slate-500">Belum ada tindakan review.</p>}</div>
    {actions && <div className="sticky bottom-0 -mx-4 -mb-4 border-t bg-white/95 p-4 backdrop-blur dark:bg-slate-950/95">{actions}</div>}
  </CardContent></Card></div>
}
function CompactInfo({ label, value }: { label: string; value: string }) { return <div className="min-w-0 border-b border-r p-3 even:border-r-0 sm:border-b-0 sm:border-r sm:even:border-r sm:last:border-r-0"><dt className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-0.5 break-words text-sm font-semibold">{value}</dd></div> }
function InfoBlock({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border bg-slate-50 p-3 dark:bg-slate-900"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 break-words text-sm font-medium">{value}</p></div> }

function RincianTable({ rows }: { rows: any[] }) {
  if (!rows.length) return null
  return <div><p className="mb-2 text-sm font-semibold">Rincian pembayaran/pengadaan</p><div className="overflow-x-auto rounded-lg border">
    <Table><TableHeader><TableRow><TableHead className="w-12 text-xs">No</TableHead><TableHead className="text-xs">Uraian</TableHead><TableHead className="text-xs">Penerima/Penyedia</TableHead><TableHead className="text-right text-xs">Jumlah</TableHead></TableRow></TableHeader>
    <TableBody>{rows.map((row, index) => <TableRow key={row.id || index}><TableCell>{index + 1}</TableCell><TableCell>{row.uraian}</TableCell><TableCell>{row.penerima_penyedia}</TableCell><TableCell className="text-right font-semibold">{money(row.jumlah)}</TableCell></TableRow>)}</TableBody></Table>
  </div></div>
}

function HelpGuide({ type, isTreasurer = false }: { type: 'submitter' | 'reviewer'; isTreasurer?: boolean }) {
  const steps = type === 'submitter'
    ? [
        ['1', 'Buat pengajuan', 'Isi judul, metadata SPB, rincian pembayaran, lalu pilih dokumen PDF.'],
        ['2', 'Simpan draft', 'Total nominal dihitung dari rincian item pembayaran.'],
        ['3', 'Kirim ke Bendahara', 'Buka detail draft, lalu tekan "Kirim ke Bendahara".'],
      ]
    : [
        ['1', 'Buka pengajuan', 'Klik baris atau kartu untuk membaca detail dan membuka PDF.'],
        ['2', 'Periksa dokumen', 'Cocokkan uraian, rincian pembayaran, nominal, dan isi proposal.'],
        ['3', 'Pilih keputusan', 'Setujui bila benar, Minta Revisi bila perlu diperbaiki, atau Tolak bila final.'],
      ]
  return <details className="group mb-3 overflow-hidden rounded-lg border border-blue-200 bg-blue-50/60 dark:border-blue-900 dark:bg-blue-950/20">
    <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm font-semibold text-blue-900 dark:text-blue-200">
      <CircleHelp className="h-4 w-4 shrink-0" /><span className="flex-1">Petunjuk penggunaan</span><span className="text-xs font-normal text-blue-700 dark:text-blue-300">Klik untuk buka</span><ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
    </summary>
    <div className="grid gap-2 border-t border-blue-200 p-3 dark:border-blue-900 md:grid-cols-3">
      {steps.map(([number, title, description]) => <div key={number} className="flex gap-2.5 rounded-md bg-white/80 p-2.5 dark:bg-slate-900/70"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">{number}</span><div><p className="text-xs font-semibold text-slate-900 dark:text-white">{title}</p><p className="mt-0.5 text-xs leading-5 text-slate-600 dark:text-slate-300">{description}</p></div></div>)}
    </div>
    {type === 'submitter' && <p className="border-t border-blue-200 px-3 py-2 text-xs leading-5 text-blue-900 dark:border-blue-900 dark:text-blue-200"><strong>Jika diminta revisi:</strong> buka pengajuan berstatus "Perlu Revisi", baca catatan reviewer, pilih "Upload Revisi", lalu kirim kembali.</p>}
    {type === 'reviewer' && <p className="border-t border-blue-200 px-3 py-2 text-xs leading-5 text-blue-900 dark:border-blue-900 dark:text-blue-200"><strong>Perhatian:</strong> Minta Revisi mengembalikan dokumen kepada pengaju. Tolak menutup pengajuan dan tidak dapat dilanjutkan.{isTreasurer ? ' Saat menyetujui, Bendahara wajib mengisi nomor SPB, penerima pembayaran, dan boleh merapikan rincian SPB.' : ''}</p>}
  </details>
}

function StatusHint({ item, mode }: { item: Item; mode: string }) {
  let title = 'Informasi status'
  let message = 'Baca detail dan riwayat pengajuan di bawah ini.'
  let color = 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200'
  if (mode === 'review' && ['menunggu_bendahara','menunggu_ketua','menunggu_kepala'].includes(item.status)) {
    title = 'Tugas Anda sekarang'
    message = 'Buka semua dokumen PDF, periksa isinya, lalu gunakan tombol keputusan di bagian bawah halaman.'
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
    title = item.realisasi_status === 'sudah' ? 'Pengajuan sudah dicairkan' : 'Pengajuan sudah disetujui'
    message = item.realisasi_status === 'sudah' ? 'SPB dan bukti realisasi final dapat diunduh.' : 'SPB tersedia. Halaman kedua masih berupa bukti realisasi draft sampai Bendahara mencatat pencairan.'
    color = 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200'
  } else if (item.status.startsWith('menunggu_')) {
    title = 'Sedang menunggu pemeriksaan'
    message = `Pengajuan sedang diproses oleh ${statusLabel[item.status]?.replace('Menunggu ', '')}. Anda tidak perlu mengunggah ulang dokumen.`
  }
  return <div className={`flex gap-2.5 rounded-lg border p-3 ${color}`}><CircleHelp className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="text-sm font-semibold">{title}</p><p className="mt-0.5 text-xs leading-5 opacity-90">{message}</p></div></div>
}

function OwnerActions({ item, pending, hideDelete = false, onEdit, onRun }: { item: Item; pending: boolean; hideDelete?: boolean; onEdit: () => void; onRun: (task: () => Promise<any>) => void }) {
  if (!['draft','perlu_revisi'].includes(item.status)) return null
  return <div className="flex flex-col gap-2 sm:flex-row">
    <Button variant="outline" className="sm:flex-1" onClick={onEdit}><Pencil className="mr-2 h-4 w-4" />{item.status === 'draft' ? 'Edit Draft' : 'Upload Revisi'}</Button>
    <Button className="sm:flex-1" disabled={pending || (item.status === 'perlu_revisi' && item.versions[0]?.submitted_at)} onClick={() => onRun(() => submitKomiteAction(item.id))}><Send className="mr-2 h-4 w-4" />Kirim ke Bendahara</Button>
    {item.status === 'draft' && !hideDelete && <Button variant="destructive" disabled={pending} onClick={() => { if (confirm('Hapus draft ini beserta dokumennya?')) onRun(() => deleteKomiteDraftAction(item.id)) }}><Trash2 className="h-4 w-4" /></Button>}
  </div>
}
function ReviewActions({ onReview }: { item: Item; onReview: (action: string) => void }) {
  return <div className="grid grid-cols-1 gap-2 sm:grid-cols-3"><Button variant="outline" onClick={() => onReview('minta_revisi')}><RotateCcw className="mr-2 h-4 w-4" />Minta Revisi</Button><Button variant="destructive" onClick={() => onReview('tolak')}><XCircle className="mr-2 h-4 w-4" />Tolak</Button><Button onClick={() => onReview('setujui')}><CheckCircle2 className="mr-2 h-4 w-4" />Setujui</Button></div>
}

function DetailRowsEditor({ rows, setRows }: { rows: RincianRow[]; setRows: (rows: RincianRow[]) => void }) {
  const total = detailTotal(rows)
  function update(index: number, key: keyof RincianRow, value: string) {
    setRows(rows.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row))
  }
  return <div className="space-y-2">
    <div className="flex items-center justify-between gap-2"><Label>Rincian pembayaran/pengadaan</Label><span className="text-xs font-semibold text-slate-600">{money(total)}</span></div>
    <input type="hidden" name="nominal" value={total} />
    <div className="space-y-2">
      {rows.map((row, index) => <div key={index} className="rounded-lg border p-3">
        <div className="mb-2 flex items-center justify-between gap-2"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Baris {index + 1}</p>{rows.length > 1 && <Button type="button" size="sm" variant="ghost" onClick={() => setRows(rows.filter((_, rowIndex) => rowIndex !== index))}><Trash2 className="h-4 w-4" /></Button>}</div>
        <div className="grid gap-2 sm:grid-cols-[1fr_180px]">
          <Input name="detail_uraian" placeholder="Uraian pembayaran/pengadaan" value={row.uraian} onChange={event => update(index, 'uraian', event.target.value)} maxLength={240} required />
          <Input name="detail_jumlah" type="number" min="1" step="1" placeholder="Jumlah" value={row.jumlah} onChange={event => update(index, 'jumlah', event.target.value)} required />
        </div>
        <Input className="mt-2" name="detail_penerima_penyedia" placeholder="Penerima/penyedia" value={row.penerima_penyedia} onChange={event => update(index, 'penerima_penyedia', event.target.value)} maxLength={180} required />
      </div>)}
    </div>
    <Button type="button" size="sm" variant="outline" disabled={rows.length >= MAX_DETAIL_ROWS} onClick={() => setRows([...rows, { uraian: '', penerima_penyedia: '', jumlah: '' }])}><Plus className="mr-1.5 h-4 w-4" />Tambah Baris</Button>
  </div>
}

function DraftDialog({ open, item, pending, onClose, onSubmit }: { open: boolean; item: Item | null; pending: boolean; onClose: () => void; onSubmit: (data: FormData) => void }) {
  const [total, setTotal] = useState(0)
  const [rows, setRows] = useState<RincianRow[]>(rowsFromItem(item))
  const needsFiles = !item || item.status === 'perlu_revisi'
  useEffect(() => {
    if (open) {
      setRows(rowsFromItem(item))
      setTotal(0)
    }
  }, [open, item])
  return <Dialog open={open} onOpenChange={value => !value && onClose()}><DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>{!item ? 'Buat Pengajuan' : item.status === 'perlu_revisi' ? 'Upload Revisi' : 'Edit Draft'}</DialogTitle></DialogHeader><form action={onSubmit} className="space-y-4">
    {item && <input type="hidden" name="id" value={item.id} />}
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5"><Label htmlFor="judul">Judul kegiatan</Label><Input id="judul" name="judul" maxLength={180} defaultValue={item?.judul || ''} required /></div>
      <div className="space-y-1.5"><Label htmlFor="tahun_anggaran">Tahun Anggaran</Label><Input id="tahun_anggaran" name="tahun_anggaran" maxLength={30} defaultValue={item?.tahun_anggaran || defaultTahunAnggaran()} required /></div>
    </div>
    <div className="space-y-1.5"><Label htmlFor="kode_rkas_program">Kode RKAS/Program (opsional)</Label><Input id="kode_rkas_program" name="kode_rkas_program" maxLength={220} defaultValue={item?.kode_rkas_program === '-' ? '' : item?.kode_rkas_program || ''} placeholder="Contoh: 3.2.1 (Pengembangan Sarana & Prasarana Pembelajaran)" /></div>
    <div className="space-y-1.5"><Label htmlFor="uraian">Uraian umum</Label><Textarea id="uraian" name="uraian" maxLength={4000} rows={4} defaultValue={item?.uraian || ''} required /></div>
    <DetailRowsEditor rows={rows} setRows={setRows} />
    <div className="space-y-1.5"><Label htmlFor="files">Dokumen PDF {needsFiles ? '' : '(kosongkan bila tidak diganti)'}</Label><Input id="files" name="files" type="file" accept="application/pdf,.pdf" multiple required={needsFiles} onChange={e => setTotal(Array.from(e.target.files || []).reduce((sum, file) => sum + file.size, 0))} /><div className="flex justify-between gap-2 text-xs"><span className="text-slate-500">Maksimal 10 PDF, total 5 MB.</span><span className={total > MAX_TOTAL ? 'font-semibold text-rose-600' : 'text-slate-500'}>{size(total)} / 5 MB</span></div></div>
    <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={onClose}>Batal</Button><Button type="submit" disabled={pending || total > MAX_TOTAL || detailTotal(rows) <= 0}>{pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Simpan Draft</Button></div>
  </form></DialogContent></Dialog>
}

function ReviewDialog({ value, pending, onClose, onSubmit }: { value: { item: Item; action: string } | null; pending: boolean; onClose: () => void; onSubmit: (data: FormData) => void }) {
  const isTreasurerApprove = value?.action === 'setujui' && value.item.status === 'menunggu_bendahara'
  const [rows, setRows] = useState<RincianRow[]>(rowsFromItem(value?.item))
  useEffect(() => {
    if (value) setRows(rowsFromItem(value.item))
  }, [value])
  return <Dialog open={!!value} onOpenChange={open => !open && onClose()}><DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>{value ? actionLabel[value.action] : 'Review'} pengajuan</DialogTitle></DialogHeader>{value && <form action={onSubmit} className="space-y-4"><input type="hidden" name="id" value={value.item.id} /><input type="hidden" name="action" value={value.action} />
    <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800"><p className="text-sm font-semibold">{value.item.judul}</p><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{money(detailTotal(rows) || value.item.nominal)}</p></div>
    {isTreasurerApprove && <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor="nomor_spb">Nomor SPB</Label><Input id="nomor_spb" name="nomor_spb" defaultValue={value.item.nomor_spb || ''} maxLength={100} required /></div>
        <div className="space-y-1.5"><Label htmlFor="penerima_pembayaran">Penerima pembayaran utama</Label><Input id="penerima_pembayaran" name="penerima_pembayaran" defaultValue={value.item.penerima_pembayaran || ''} maxLength={180} required /></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor="review_tahun_anggaran">Tahun Anggaran</Label><Input id="review_tahun_anggaran" name="tahun_anggaran" defaultValue={value.item.tahun_anggaran || defaultTahunAnggaran()} maxLength={30} required /></div>
        <div className="space-y-1.5"><Label htmlFor="review_kode_rkas_program">Kode RKAS/Program</Label><Input id="review_kode_rkas_program" name="kode_rkas_program" defaultValue={value.item.kode_rkas_program || ''} maxLength={220} required /></div>
      </div>
      <DetailRowsEditor rows={rows} setRows={setRows} />
    </>}
    <div className="space-y-1.5"><Label htmlFor="catatan">Catatan {value.action === 'setujui' ? '(opsional)' : '(wajib)'}</Label><Textarea id="catatan" name="catatan" rows={4} required={value.action !== 'setujui'} placeholder={value.action === 'minta_revisi' ? 'Jelaskan bagian yang harus diperbaiki...' : value.action === 'tolak' ? 'Tuliskan alasan penolakan final...' : 'Catatan persetujuan...'} /></div>
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={onClose}>Batal</Button><Button type="submit" variant={value.action === 'tolak' ? 'destructive' : 'default'} disabled={pending || (isTreasurerApprove && detailTotal(rows) <= 0)}>{pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Konfirmasi</Button></div>
  </form>}</DialogContent></Dialog>
}

function RealisasiDialog({ item, pending, onClose, onSubmit }: { item: Item | null; pending: boolean; onClose: () => void; onSubmit: (data: FormData) => void }) {
  return <Dialog open={!!item} onOpenChange={open => !open && onClose()}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Catat Realisasi Pencairan</DialogTitle></DialogHeader>{item && <form action={onSubmit} className="space-y-4"><input type="hidden" name="id" value={item.id} />
    <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800"><p className="text-sm font-semibold">{item.judul}</p><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{money(item.nominal)}</p></div>
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5"><Label htmlFor="realisasi_tanggal">Tanggal realisasi</Label><Input id="realisasi_tanggal" name="realisasi_tanggal" type="date" defaultValue={dateOnly(item.realisasi_tanggal) || new Date().toISOString().slice(0, 10)} required /></div>
      <div className="space-y-1.5"><Label>Metode</Label><Select name="realisasi_metode" defaultValue={item.realisasi_metode || 'Tunai'} required><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Tunai">Tunai</SelectItem><SelectItem value="Transfer">Transfer</SelectItem></SelectContent></Select></div>
    </div>
    <div className="space-y-1.5"><Label htmlFor="realisasi_petugas">Diserahkan oleh</Label><Input id="realisasi_petugas" name="realisasi_petugas" defaultValue={item.realisasi_petugas || 'Bendahara Komite'} maxLength={180} required /></div>
    <div className="space-y-1.5"><Label htmlFor="realisasi_catatan">Catatan (opsional)</Label><Textarea id="realisasi_catatan" name="realisasi_catatan" rows={3} defaultValue={item.realisasi_catatan || ''} maxLength={1000} /></div>
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={onClose}>Batal</Button><Button type="submit" disabled={pending}>{pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Simpan Realisasi</Button></div>
  </form>}</DialogContent></Dialog>
}
