'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Eye, Filter, RotateCcw, Search, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { DataPagination } from '@/components/ui/data-pagination'
import {
  getActivityLogTargets,
  previewActivityLogPurge,
  purgeActivityLogs,
  type ActivityLogRow,
  type ActivityLogFilters,
} from './actions'

type Props = {
  logs: ActivityLogRow[]
  total: number
  modules: string[]
  actions: string[]
  entityTypes: string[]
  filters: ActivityLogFilters
}

type DetailTarget = {
  target_type: string
  target_id: string | null
  target_label: string | null
  metadata_json: string | null
}

export function LogAktivitasClient({ logs, total, modules, actions, entityTypes, filters }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<ActivityLogRow | null>(null)
  const [targets, setTargets] = useState<DetailTarget[]>([])
  const [purgeOpen, setPurgeOpen] = useState(false)
  const [purgeStart, setPurgeStart] = useState('')
  const [purgeEnd, setPurgeEnd] = useState('')
  const [purgeReason, setPurgeReason] = useState('')
  const [purgeConfirmation, setPurgeConfirmation] = useState('')
  const [preview, setPreview] = useState<{ logsCount: number; targetsCount: number } | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const page = Number(filters.page) || 1
  const pageSize = Number(filters.pageSize) || 25

  function updateParams(next: Record<string, string | number | null>) {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries({ ...filters, ...next })) {
      if (value === null || value === undefined || value === '' || key === 'pageSize') continue
      params.set(key, String(value))
    }
    if ((next.pageSize ?? filters.pageSize) && Number(next.pageSize ?? filters.pageSize) !== 25) {
      params.set('pageSize', String(next.pageSize ?? filters.pageSize))
    }
    router.push(`/dashboard/log-aktivitas${params.size ? `?${params.toString()}` : ''}`)
  }

  async function openDetail(log: ActivityLogRow) {
    setSelected(log)
    setTargets([])
    if (log.target_count > 0) {
      const result = await getActivityLogTargets(log.id)
      if (!result.error) setTargets(result.targets)
    }
  }

  function handlePreview() {
    setMessage(null)
    startTransition(async () => {
      const result = await previewActivityLogPurge(purgeStart, purgeEnd)
      if (result.error) {
        setPreview(null)
        setMessage(result.error)
      } else {
        setPreview({ logsCount: result.logsCount, targetsCount: result.targetsCount })
      }
    })
  }

  function handlePurge() {
    setMessage(null)
    const form = new FormData()
    form.set('startDate', purgeStart)
    form.set('endDate', purgeEnd)
    form.set('reason', purgeReason)
    form.set('confirmation', purgeConfirmation)
    startTransition(async () => {
      const result = await purgeActivityLogs(form)
      if ('error' in result && result.error) {
        setMessage(result.error)
      } else {
        setMessage(result.success || 'Log berhasil dibersihkan.')
        setPreview(null)
        setPurgeReason('')
        setPurgeConfirmation('')
        router.refresh()
      }
    })
  }

  const rows = useMemo(() => logs, [logs])

  return (
    <div className="space-y-4">
      <form action="/dashboard/log-aktivitas" className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <Filter className="h-4 w-4" />
          Filter
        </div>
        <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
          <Input type="date" name="startDate" defaultValue={filters.startDate || ''} />
          <Input type="date" name="endDate" defaultValue={filters.endDate || ''} />
          <Input name="actor" placeholder="Aktor" defaultValue={filters.actor || ''} />
          <Select name="module" defaultValue={filters.module || 'all'}>
            <SelectTrigger><SelectValue placeholder="Modul" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua modul</SelectItem>
              {modules.map(module => <SelectItem key={module} value={module}>{module}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select name="action" defaultValue={filters.action || 'all'}>
            <SelectTrigger><SelectValue placeholder="Aksi" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua aksi</SelectItem>
              {actions.map(action => <SelectItem key={action} value={action}>{action}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select name="entityType" defaultValue={filters.entityType || 'all'}>
            <SelectTrigger><SelectValue placeholder="Entity" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua entity</SelectItem>
              {entityTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select name="severity" defaultValue={filters.severity || 'all'}>
            <SelectTrigger><SelectValue placeholder="Severity" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="danger">Danger</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Input name="q" placeholder="Cari..." defaultValue={filters.q || ''} />
            <Button type="submit" size="icon" title="Cari"><Search className="h-4 w-4" /></Button>
          </div>
        </div>
        <input type="hidden" name="pageSize" value={pageSize} />
        <div className="mt-3 flex justify-between gap-2">
          <Button type="button" variant="outline" onClick={() => router.push('/dashboard/log-aktivitas')}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset
          </Button>
          <Button type="button" variant="destructive" onClick={() => setPurgeOpen(true)}>
            <Trash2 className="mr-2 h-4 w-4" />
            Bersihkan Log
          </Button>
        </div>
      </form>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left">Waktu</th>
                <th className="px-4 py-3 text-left">Aktor</th>
                <th className="px-4 py-3 text-left">Modul</th>
                <th className="px-4 py-3 text-left">Aksi</th>
                <th className="px-4 py-3 text-left">Ringkasan</th>
                <th className="px-4 py-3 text-left">Target</th>
                <th className="px-4 py-3 text-right">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map(log => (
                <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/70">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300">{formatDate(log.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800 dark:text-slate-100">{log.actor_name || '-'}</div>
                    <div className="text-xs text-slate-500">{log.actor_email || '-'}</div>
                  </td>
                  <td className="px-4 py-3"><Badge variant="outline">{log.module}</Badge></td>
                  <td className="px-4 py-3"><SeverityBadge log={log} /></td>
                  <td className="max-w-sm px-4 py-3 text-slate-700 dark:text-slate-200">{log.summary}</td>
                  <td className="px-4 py-3">
                    <div className="text-slate-700 dark:text-slate-200">{log.entity_label || log.entity_id || '-'}</div>
                    {log.target_count > 0 && <div className="text-xs text-slate-500">{log.target_count} target massal</div>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button type="button" variant="outline" size="sm" onClick={() => openDetail(log)}>
                      <Eye className="mr-2 h-4 w-4" />
                      Lihat
                    </Button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">Belum ada log pada filter ini.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <DataPagination
          total={total}
          page={page}
          pageSize={pageSize}
          onPageChange={next => updateParams({ page: next })}
          onPageSizeChange={next => updateParams({ page: 1, pageSize: next === 'semua' ? 100 : next })}
          entityLabel="log"
        />
      </div>

      <Dialog open={!!selected} onOpenChange={open => !open && setSelected(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Detail Log Aktivitas</DialogTitle>
            <DialogDescription>{selected?.summary}</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
              <div className="space-y-3 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
                <Info label="Waktu" value={formatDate(selected.created_at)} />
                <Info label="Aktor" value={selected.actor_name || '-'} />
                <Info label="Email" value={selected.actor_email || '-'} />
                <Info label="Modul" value={selected.module} />
                <Info label="Aksi" value={selected.action} />
                <Info label="Entity" value={[selected.entity_type, selected.entity_label || selected.entity_id].filter(Boolean).join(' - ') || '-'} />
                <Info label="IP" value={selected.ip_address || '-'} />
              </div>
              <div className="space-y-3">
                <JsonPanel title="Perubahan" value={selected.diff_json} />
                <div className="grid gap-3 md:grid-cols-2">
                  <JsonPanel title="Sebelum" value={selected.before_json} />
                  <JsonPanel title="Sesudah" value={selected.after_json} />
                </div>
                <JsonPanel title="Metadata" value={selected.metadata_json} />
                {targets.length > 0 && (
                  <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                    <h3 className="mb-2 text-sm font-semibold">Target Massal</h3>
                    <div className="max-h-56 overflow-auto">
                      {targets.map((target, index) => (
                        <div key={`${target.target_type}-${target.target_id}-${index}`} className="border-b border-slate-100 py-2 text-sm last:border-0 dark:border-slate-800">
                          <span className="font-medium">{target.target_label || target.target_id || '-'}</span>
                          <span className="ml-2 text-xs text-slate-500">{target.target_type}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={purgeOpen} onOpenChange={setPurgeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bersihkan Log</DialogTitle>
            <DialogDescription>
              Penghapusan log akan tercatat di riwayat pembersihan dan tidak menghapus catatan pembersihan sebelumnya.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="purge-start">Mulai</Label>
                <Input id="purge-start" type="date" value={purgeStart} onChange={e => setPurgeStart(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="purge-end">Sampai</Label>
                <Input id="purge-end" type="date" value={purgeEnd} onChange={e => setPurgeEnd(e.target.value)} />
              </div>
            </div>
            <div>
              <Label htmlFor="purge-reason">Alasan</Label>
              <Textarea id="purge-reason" value={purgeReason} onChange={e => setPurgeReason(e.target.value)} placeholder="Contoh: pembersihan log lama setelah arsip internal." />
            </div>
            <Button type="button" variant="outline" onClick={handlePreview} disabled={isPending || !purgeStart || !purgeEnd}>
              Preview Jumlah Log
            </Button>
            {preview && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="h-4 w-4" />
                  {preview.logsCount} log dan {preview.targetsCount} target akan dihapus.
                </div>
              </div>
            )}
            <div>
              <Label htmlFor="purge-confirmation">Ketik HAPUS LOG</Label>
              <Input id="purge-confirmation" value={purgeConfirmation} onChange={e => setPurgeConfirmation(e.target.value)} />
            </div>
            {message && <p className="text-sm text-slate-600 dark:text-slate-300">{message}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPurgeOpen(false)}>Batal</Button>
            <Button type="button" variant="destructive" onClick={handlePurge} disabled={isPending || !preview}>
              Bersihkan Log
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SeverityBadge({ log }: { log: ActivityLogRow }) {
  if (log.severity === 'danger') return <Badge variant="destructive">{log.action}</Badge>
  if (log.severity === 'warning') return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">{log.action}</Badge>
  return <Badge variant="secondary">{log.action}</Badge>
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="break-words font-medium text-slate-800 dark:text-slate-100">{value}</div>
    </div>
  )
}

function JsonPanel({ title, value }: { title: string; value: string | null }) {
  if (!value) return null
  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <pre className="max-h-72 overflow-auto rounded-md bg-slate-950 p-3 text-xs text-slate-100">
        {formatJson(value)}
      </pre>
    </div>
  )
}

function formatJson(value: string) {
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    return value
  }
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}
