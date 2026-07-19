'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  CheckCircle2, Clock3, Download, FileText, History, Loader2, Pencil, Plus,
  RotateCcw, Search, Send, Settings2, Trash2, UserCheck, XCircle,
} from 'lucide-react'
import {
  deleteKomiteDraftAction, reviewKomiteAction, saveKomiteDraftAction,
  setNamedKomiteSubmitterAction, submitKomiteAction,
} from './actions'

type Item = any
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
const actionLabel: Record<string, string> = { setujui: 'Menyetujui', minta_revisi: 'Meminta revisi', tolak: 'Menolak final' }

function money(value: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value || 0)
}
function date(value?: string) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(value.endsWith('Z') ? value : `${value.replace(' ', 'T')}Z`))
}
function size(value: number) {
  return value >= 1024 * 1024 ? `${(value / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(value / 1024)} KB`
}

export function PengajuanKomiteClient(props: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [selectedId, setSelectedId] = useState(props.items[0]?.id || '')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Item | null>(null)
  const [review, setReview] = useState<{ item: Item; action: string } | null>(null)
  const [message, setMessage] = useState('')
  const [query, setQuery] = useState('')

  const own = props.items.filter(item => item.pengaju_id === props.currentUserId)
  const queue = props.items.filter(item => item.pengaju_id !== props.currentUserId && isQueueFor(item, props.roles, props.isSuper))
  const history = props.items.filter(item => item.reviews.some((entry: any) => entry.actor_id === props.currentUserId))
  const approved = props.items.filter(item => item.status === 'disetujui')

  function run(task: () => Promise<any>, close?: () => void) {
    startTransition(async () => {
      const result = await task()
      setMessage(result?.error || result?.success || '')
      if (!result?.error) {
        close?.()
        router.refresh()
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
      <Tabs defaultValue={queue.length ? 'review' : 'mine'} className="w-full">
        <div className="overflow-x-auto pb-1">
          <TabsList className="h-auto min-w-max justify-start">
            <TabsTrigger value="mine">Pengajuan Saya <Count value={own.length} /></TabsTrigger>
            <TabsTrigger value="review">Perlu Direview <Count value={props.reviewCount} alert={props.reviewCount > 0} /></TabsTrigger>
            <TabsTrigger value="history">Riwayat Review <Count value={history.length} /></TabsTrigger>
            <TabsTrigger value="approved">Disetujui <Count value={approved.length} /></TabsTrigger>
            {props.isSuper && <TabsTrigger value="settings">Pengaturan Pengaju</TabsTrigger>}
          </TabsList>
        </div>

        <TabsContent value="mine">
          <SectionToolbar title="Pengajuan milik Anda">
            {props.canCreate && <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true) }}><Plus className="mr-1.5 h-4 w-4" />Buat Pengajuan</Button>}
          </SectionToolbar>
          <ListDetail items={own} selectedId={selectedId} onSelect={setSelectedId} currentUserId={props.currentUserId}
            actions={item => <OwnerActions item={item} pending={pending} onEdit={() => { setEditing(item); setFormOpen(true) }} onRun={run} />} />
        </TabsContent>
        <TabsContent value="review">
          <SectionToolbar title="Antrean tahap Anda" />
          <ListDetail items={queue} selectedId={selectedId} onSelect={setSelectedId} currentUserId={props.currentUserId}
            actions={item => <ReviewActions item={item} onReview={action => setReview({ item, action })} />} />
        </TabsContent>
        <TabsContent value="history">
          <SectionToolbar title="Pengajuan yang pernah Anda review" />
          <ListDetail items={history} selectedId={selectedId} onSelect={setSelectedId} currentUserId={props.currentUserId} />
        </TabsContent>
        <TabsContent value="approved">
          <SectionToolbar title="Dokumen yang telah disetujui" />
          <ListDetail items={approved} selectedId={selectedId} onSelect={setSelectedId} currentUserId={props.currentUserId} />
        </TabsContent>
        {props.isSuper && (
          <TabsContent value="settings">
            <SectionToolbar title="Akun yang diizinkan mengajukan" />
            <div className="mb-3 flex items-center gap-2 rounded-lg border bg-white px-3 dark:bg-slate-900">
              <Search className="h-4 w-4 text-slate-400" /><Input className="border-0 px-0 shadow-none focus-visible:ring-0" placeholder="Cari nama atau email..." value={query} onChange={e => setQuery(e.target.value)} />
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {props.users.filter(user => `${user.name} ${user.email}`.toLowerCase().includes(query.toLowerCase())).map(user => {
                const defaultRole = (user.roles || [user.role]).some((role: string) => ['super_admin','kepsek','wakamad','pembina_ekstrakurikuler'].includes(role))
                return <Card key={user.id}><CardContent className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{user.name}</p><p className="truncate text-xs text-slate-500">{user.email}</p></div>
                  {defaultRole ? <Badge variant="secondary">Dari role</Badge> : <Button size="sm" variant={user.is_named ? 'outline' : 'default'} disabled={pending}
                    onClick={() => run(() => setNamedKomiteSubmitterAction(user.id, !user.is_named))}>{user.is_named ? 'Cabut' : 'Izinkan'}</Button>}
                </CardContent></Card>
              })}
            </div>
          </TabsContent>
        )}
      </Tabs>

      <DraftDialog open={formOpen} item={editing} pending={pending} onClose={() => setFormOpen(false)} onSubmit={formData => run(() => saveKomiteDraftAction(formData), () => setFormOpen(false))} />
      <ReviewDialog value={review} pending={pending} onClose={() => setReview(null)} onSubmit={formData => run(() => reviewKomiteAction(formData), () => setReview(null))} />
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

function ListDetail({ items, selectedId, onSelect, currentUserId, actions }: { items: Item[]; selectedId: string; onSelect: (id: string) => void; currentUserId: string; actions?: (item: Item) => React.ReactNode }) {
  const selected = items.find(item => item.id === selectedId) || items[0]
  if (!items.length) return <Empty />
  return <div className="grid gap-3 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.5fr)]">
    <div className="space-y-2">
      {items.map(item => <button key={item.id} type="button" onClick={() => onSelect(item.id)} className={`w-full rounded-xl border p-3 text-left transition ${selected?.id === item.id ? 'border-blue-400 bg-blue-50/60 dark:bg-blue-950/20' : 'bg-white hover:border-slate-300 dark:bg-slate-900'}`}>
        <div className="flex items-start justify-between gap-2"><p className="line-clamp-2 min-w-0 text-sm font-semibold leading-snug">{item.judul}</p><Status status={item.status} /></div>
        <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-200">{money(item.nominal)}</p>
        <div className="mt-1 flex min-w-0 items-center justify-between gap-2 text-xs text-slate-500"><span className="truncate">{item.pengaju_name}</span><span className="shrink-0">v{item.current_version}</span></div>
      </button>)}
    </div>
    {selected && <Detail item={selected} currentUserId={currentUserId} actions={actions?.(selected)} />}
  </div>
}
function Empty() { return <div className="rounded-xl border border-dashed bg-white py-14 text-center dark:bg-slate-900"><FileText className="mx-auto mb-2 h-8 w-8 text-slate-300" /><p className="text-sm text-slate-500">Belum ada data pada bagian ini.</p></div> }
function Status({ status }: { status: string }) { return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusStyle[status] || ''}`}>{statusLabel[status] || status}</span> }

function Detail({ item, currentUserId, actions }: { item: Item; currentUserId: string; actions?: React.ReactNode }) {
  return <Card className="min-w-0 overflow-hidden"><CardHeader className="border-b bg-slate-50/70 p-4 dark:bg-slate-900">
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><CardTitle className="break-words text-base leading-snug">{item.judul}</CardTitle><p className="mt-1 text-xs text-slate-500">Diajukan oleh {item.pengaju_name} · {date(item.created_at)}</p></div><Status status={item.status} /></div>
  </CardHeader><CardContent className="space-y-5 p-4">
    <div className="grid gap-3 sm:grid-cols-2"><Info label="Nominal" value={money(item.nominal)} /><Info label="Nomor SPB" value={item.nomor_spb || 'Belum ditetapkan'} /><Info label="Penerima pembayaran" value={item.penerima_pembayaran || 'Belum ditetapkan'} /><Info label="Versi aktif" value={`Versi ${item.current_version}`} /></div>
    <div><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Uraian</p><p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700 dark:text-slate-200">{item.uraian}</p></div>
    {item.status === 'disetujui' && <Button asChild className="w-full sm:w-auto"><a href={`/api/komite/pengajuan/${item.id}/spb`} target="_blank"><Download className="mr-2 h-4 w-4" />Unduh SPB</a></Button>}
    <div><p className="mb-3 text-sm font-semibold">Dokumen per versi</p><div className="space-y-3">{item.versions.map((version: any) => <div key={version.id} className="rounded-lg border p-3"><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium">Versi {version.version_number}</p><span className="text-xs text-slate-500">{version.submitted_at ? `Dikirim ${date(version.submitted_at)}` : 'Belum dikirim'}</span></div><div className="space-y-1.5">{version.files.map((file: any) => <a key={file.id} href={`/api/komite/pengajuan/${item.id}/files/${file.id}`} target="_blank" className="flex min-w-0 items-center gap-2 rounded-md bg-slate-50 px-2.5 py-2 text-sm hover:bg-slate-100 dark:bg-slate-800"><FileText className="h-4 w-4 shrink-0 text-rose-500" /><span className="min-w-0 flex-1 truncate">{file.original_filename}</span><span className="shrink-0 text-xs text-slate-400">{size(file.size_bytes)}</span></a>)}</div></div>)}</div></div>
    <div><p className="mb-3 text-sm font-semibold">Riwayat review</p>{item.reviews.length ? <div className="relative space-y-4 border-l-2 border-slate-200 pl-4 dark:border-slate-700">{item.reviews.slice().reverse().map((entry: any) => <div key={entry.id} className="relative"><span className={`absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full ${entry.action === 'setujui' ? 'bg-emerald-500' : entry.action === 'tolak' ? 'bg-rose-500' : 'bg-orange-500'}`} /><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium">{entry.actor_name}</p><Badge variant="outline">{stageLabel[entry.stage]}</Badge>{entry.is_super_admin_bypass ? <Badge variant="secondary">Bypass Admin</Badge> : null}</div><p className="mt-0.5 text-xs text-slate-500">{actionLabel[entry.action]} · versi {entry.version_number} · {date(entry.created_at)}</p>{entry.catatan && <p className="mt-2 whitespace-pre-wrap break-words rounded-md bg-slate-50 p-2 text-sm leading-5 dark:bg-slate-800">{entry.catatan}</p>}</div>)}</div> : <p className="text-sm text-slate-500">Belum ada tindakan review.</p>}</div>
    {actions && <div className="sticky bottom-0 -mx-4 -mb-4 border-t bg-white/95 p-4 backdrop-blur dark:bg-slate-950/95">{actions}</div>}
  </CardContent></Card>
}
function Info({ label, value }: { label: string; value: string }) { return <div className="min-w-0 rounded-lg bg-slate-50 p-3 dark:bg-slate-800"><p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p><p className="mt-0.5 break-words text-sm font-semibold">{value}</p></div> }

function OwnerActions({ item, pending, onEdit, onRun }: { item: Item; pending: boolean; onEdit: () => void; onRun: (task: () => Promise<any>) => void }) {
  if (!['draft','perlu_revisi'].includes(item.status)) return null
  return <div className="flex flex-col gap-2 sm:flex-row">
    <Button variant="outline" className="sm:flex-1" onClick={onEdit}><Pencil className="mr-2 h-4 w-4" />{item.status === 'draft' ? 'Edit Draft' : 'Upload Revisi'}</Button>
    <Button className="sm:flex-1" disabled={pending || (item.status === 'perlu_revisi' && item.versions[0]?.submitted_at)} onClick={() => onRun(() => submitKomiteAction(item.id))}><Send className="mr-2 h-4 w-4" />Kirim ke Bendahara</Button>
    {item.status === 'draft' && <Button variant="destructive" disabled={pending} onClick={() => { if (confirm('Hapus draft ini beserta dokumennya?')) onRun(() => deleteKomiteDraftAction(item.id)) }}><Trash2 className="h-4 w-4" /></Button>}
  </div>
}
function ReviewActions({ item, onReview }: { item: Item; onReview: (action: string) => void }) {
  return <div className="grid grid-cols-1 gap-2 sm:grid-cols-3"><Button variant="outline" onClick={() => onReview('minta_revisi')}><RotateCcw className="mr-2 h-4 w-4" />Minta Revisi</Button><Button variant="destructive" onClick={() => onReview('tolak')}><XCircle className="mr-2 h-4 w-4" />Tolak Final</Button><Button onClick={() => onReview('setujui')}><CheckCircle2 className="mr-2 h-4 w-4" />Setujui</Button></div>
}

function DraftDialog({ open, item, pending, onClose, onSubmit }: { open: boolean; item: Item | null; pending: boolean; onClose: () => void; onSubmit: (data: FormData) => void }) {
  const [total, setTotal] = useState(0)
  const needsFiles = !item || item.status === 'perlu_revisi'
  return <Dialog open={open} onOpenChange={value => !value && onClose()}><DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>{!item ? 'Buat Pengajuan' : item.status === 'perlu_revisi' ? 'Upload Revisi' : 'Edit Draft'}</DialogTitle></DialogHeader><form action={onSubmit} className="space-y-4">
    {item && <input type="hidden" name="id" value={item.id} />}
    <div className="space-y-1.5"><Label htmlFor="judul">Judul kegiatan</Label><Input id="judul" name="judul" maxLength={180} defaultValue={item?.judul || ''} required /></div>
    <div className="space-y-1.5"><Label htmlFor="uraian">Uraian</Label><Textarea id="uraian" name="uraian" maxLength={4000} rows={5} defaultValue={item?.uraian || ''} required /></div>
    <div className="space-y-1.5"><Label htmlFor="nominal">Nominal pengajuan (Rp)</Label><Input id="nominal" name="nominal" type="number" min="1" step="1" defaultValue={item?.nominal || ''} required /></div>
    <div className="space-y-1.5"><Label htmlFor="files">Dokumen PDF {needsFiles ? '' : '(kosongkan bila tidak diganti)'}</Label><Input id="files" name="files" type="file" accept="application/pdf,.pdf" multiple required={needsFiles} onChange={e => setTotal(Array.from(e.target.files || []).reduce((sum, file) => sum + file.size, 0))} /><div className="flex justify-between gap-2 text-xs"><span className="text-slate-500">Maksimal 10 PDF, total 5 MB.</span><span className={total > MAX_TOTAL ? 'font-semibold text-rose-600' : 'text-slate-500'}>{size(total)} / 5 MB</span></div></div>
    <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={onClose}>Batal</Button><Button type="submit" disabled={pending || total > MAX_TOTAL}>{pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Simpan Draft</Button></div>
  </form></DialogContent></Dialog>
}

function ReviewDialog({ value, pending, onClose, onSubmit }: { value: { item: Item; action: string } | null; pending: boolean; onClose: () => void; onSubmit: (data: FormData) => void }) {
  const isTreasurerApprove = value?.action === 'setujui' && value.item.status === 'menunggu_bendahara'
  return <Dialog open={!!value} onOpenChange={open => !open && onClose()}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>{value ? actionLabel[value.action] : 'Review'} pengajuan</DialogTitle></DialogHeader>{value && <form action={onSubmit} className="space-y-4"><input type="hidden" name="id" value={value.item.id} /><input type="hidden" name="action" value={value.action} />
    <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800"><p className="text-sm font-semibold">{value.item.judul}</p><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{money(value.item.nominal)}</p></div>
    {isTreasurerApprove && <><div className="space-y-1.5"><Label htmlFor="nomor_spb">Nomor SPB</Label><Input id="nomor_spb" name="nomor_spb" defaultValue={value.item.nomor_spb || ''} maxLength={100} required /></div><div className="space-y-1.5"><Label htmlFor="penerima_pembayaran">Penerima pembayaran</Label><Input id="penerima_pembayaran" name="penerima_pembayaran" defaultValue={value.item.penerima_pembayaran || ''} maxLength={180} required /></div></>}
    <div className="space-y-1.5"><Label htmlFor="catatan">Catatan {value.action === 'setujui' ? '(opsional)' : '(wajib)'}</Label><Textarea id="catatan" name="catatan" rows={4} required={value.action !== 'setujui'} placeholder={value.action === 'minta_revisi' ? 'Jelaskan bagian yang harus diperbaiki...' : value.action === 'tolak' ? 'Tuliskan alasan penolakan final...' : 'Catatan persetujuan...'} /></div>
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={onClose}>Batal</Button><Button type="submit" variant={value.action === 'tolak' ? 'destructive' : 'default'} disabled={pending}>{pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Konfirmasi</Button></div>
  </form>}</DialogContent></Dialog>
}
