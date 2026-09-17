'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Clock3, Eye, History, LockKeyhole, ShieldCheck, UnlockKeyhole } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DataPagination } from '@/components/ui/data-pagination'
import {
  blockAgendaAccess,
  runHistoricalAgendaAccessScan,
  unblockAgendaAccess,
  type AuditAccessFilters,
  type AuditAlertRow,
} from './actions'
import type { AgendaAccessEvidence, AgendaAccessReason } from '@/lib/agenda-access-audit'

type Props = {
  alerts: AuditAlertRow[]
  total: number
  summary: { low: number; medium: number; high: number; blocked: number }
  canManage: boolean
  page?: number
  pageSize?: number
  lastScan: { start_date: string; end_date: string; finished_at: string | null; alerts_created: number; status: string } | null
  filters: AuditAccessFilters
}

const REASON_LABELS: Record<AgendaAccessReason, string> = {
  ACCOUNT_SWITCH_SAME_DEVICE: 'Akun berbeda digunakan pada perangkat yang sama',
  LOGOUT_THEN_OTHER_LOGIN: 'Logout lalu akun lain login dalam 10 menit',
  AGENDA_AFTER_SWITCH: 'Agenda diisi dalam 30 menit setelah pergantian akun',
  REPEATED_ON_DIFFERENT_DAY: 'Pola yang sama berulang pada hari berbeda',
  HISTORICAL_IP_BROWSER_MATCH: 'Indikasi historis berdasarkan IP dan browser',
}

export function AuditAksesAgendaClient(props: Props) {
  const { alerts, total, summary, canManage, filters, lastScan } = props
  const router = useRouter()
  const [selected, setSelected] = useState<AuditAlertRow | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const page = Number(filters.page) || 1
  const pageSize = Number(filters.pageSize) || 25

  function updateParams(next: Record<string, string | number | null>) {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries({ ...filters, ...next })) {
      if (value === null || value === undefined || value === '' || (key === 'pageSize' && Number(value) === 25)) continue
      params.set(key, String(value))
    }
    router.push(`/dashboard/audit-akses-agenda?${params.toString()}`)
  }

  function changeBlock(userId: string, name: string, blocked: boolean) {
    const verb = blocked ? 'membuka blokir' : 'memblokir pengisian Agenda'
    const reason = window.prompt(`Alasan ${verb} untuk ${name} (minimal 10 karakter):`)
    if (!reason) return
    setMessage(null)
    startTransition(async () => {
      const result = blocked
        ? await unblockAgendaAccess(userId, reason)
        : await blockAgendaAccess(userId, reason)
      setMessage('error' in result ? result.error || null : result.success || null)
      router.refresh()
    })
  }

  function runScan() {
    if (!window.confirm('Jalankan analisis historis sejak 1 September 2026? Data lama hanya menjadi indikasi dan tidak dapat menghasilkan risiko tinggi.')) return
    setMessage(null)
    startTransition(async () => {
      const result = await runHistoricalAgendaAccessScan()
      setMessage('error' in result ? result.error || null : result.success || null)
      router.refresh()
    })
  }

  const evidence = useMemo(() => parseArray<AgendaAccessEvidence>(selected?.evidence_json), [selected])
  const reasons = useMemo(() => parseArray<AgendaAccessReason>(selected?.reasons_json), [selected])

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Risiko tinggi" value={summary.high} tone="rose" />
        <SummaryCard label="Risiko sedang" value={summary.medium} tone="amber" />
        <SummaryCard label="Risiko rendah" value={summary.low} tone="slate" />
        <SummaryCard label="Agenda diblokir" value={summary.blocked} tone="rose" />
      </div>

      <form action="/dashboard/audit-akses-agenda" className="rounded-xl border bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="grid gap-3 md:grid-cols-4">
          <Input type="date" name="startDate" defaultValue={filters.startDate || '2026-09-01'} />
          <Input type="date" name="endDate" defaultValue={filters.endDate || ''} />
          <Input name="teacher" placeholder="Cari nama guru" defaultValue={filters.teacher || ''} />
          <Select name="riskLevel" defaultValue={filters.riskLevel || 'all'}>
            <SelectTrigger><SelectValue placeholder="Tingkat risiko" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua risiko</SelectItem>
              <SelectItem value="high">Tinggi</SelectItem>
              <SelectItem value="medium">Sedang</SelectItem>
              <SelectItem value="low">Rendah</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <input type="hidden" name="pageSize" value={pageSize} />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-slate-500">
            {lastScan ? `Analisis historis: ${lastScan.status} · ${lastScan.alerts_created} indikasi` : 'Analisis historis belum dijalankan.'}
          </div>
          <div className="flex gap-2">
            {canManage && <Button type="button" variant="outline" onClick={runScan} disabled={isPending}><History className="mr-2 h-4 w-4" />Analisis Historis</Button>}
            <Button type="submit" disabled={isPending}>Terapkan Filter</Button>
          </div>
        </div>
        {message && <p role="status" className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-slate-900">{message}</p>}
      </form>

      <div className="overflow-hidden rounded-xl border bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900">
              <tr>
                <th className="px-4 py-3 text-left">Waktu</th>
                <th className="px-4 py-3 text-left">Akun terkait</th>
                <th className="px-4 py-3 text-left">Risiko</th>
                <th className="px-4 py-3 text-left">Sumber</th>
                <th className="px-4 py-3 text-left">Perangkat/IP</th>
                <th className="px-4 py-3 text-right">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-slate-800">
              {alerts.map(alert => (
                <tr key={alert.id} className="align-top hover:bg-slate-50 dark:hover:bg-slate-900/60">
                  <td className="whitespace-nowrap px-4 py-3">{formatDate(alert.last_event_at)}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{alert.user_a_name}</div>
                    <div className="text-slate-500">{alert.user_b_name}</div>
                  </td>
                  <td className="px-4 py-3"><RiskBadge level={alert.risk_level} score={alert.risk_score} /></td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{alert.source === 'historical' ? 'Indikasi historis' : 'ID perangkat'}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                    <div>{alert.device_id ? `Perangkat ${alert.device_id.slice(0, 8)}` : 'Perangkat tidak tersedia'}</div>
                    <div>{alert.ip_address || '-'}</div>
                  </td>
                  <td className="px-4 py-3 text-right"><Button type="button" variant="outline" size="sm" onClick={() => setSelected(alert)}><Eye className="mr-2 h-4 w-4" />Lihat</Button></td>
                </tr>
              ))}
              {alerts.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">Belum ada indikator pada filter ini.</td></tr>}
            </tbody>
          </table>
        </div>
        <DataPagination
          total={total} page={page} pageSize={pageSize} entityLabel="alert"
          onPageChange={next => updateParams({ page: next })}
          onPageSizeChange={next => updateParams({ page: 1, pageSize: next === 'semua' ? 100 : next })}
        />
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={open => !open && setSelected(null)}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detail indikator akses</DialogTitle>
            <DialogDescription>Periksa kronologi dan konfirmasi dengan data kehadiran fisik sebelum mengambil tindakan.</DialogDescription>
          </DialogHeader>
          {selected && <div className="space-y-4">
            <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
              <Info label="Akun pertama" value={selected.user_a_name} />
              <Info label="Akun kedua" value={selected.user_b_name} />
              <Info label="Risiko" value={`${selected.risk_level.toUpperCase()} · skor ${selected.risk_score}`} />
              <Info label="Sumber" value={selected.source === 'historical' ? 'Indikasi historis IP + browser' : 'ID perangkat anonim'} />
              <Info label="IP" value={selected.ip_address || '-'} />
              <Info label="Browser" value={selected.user_agent || '-'} />
            </div>
            <div>
              <h3 className="mb-2 font-semibold">Alasan skor</h3>
              <ul className="space-y-2">
                {reasons.map(reason => <li key={reason} className="flex gap-2 rounded-lg bg-slate-50 p-2 text-sm dark:bg-slate-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />{REASON_LABELS[reason] || reason}</li>)}
              </ul>
            </div>
            <div>
              <h3 className="mb-2 font-semibold">Kronologi</h3>
              <ol className="space-y-2">
                {evidence.map((item, index) => <li key={`${item.type}-${item.at}-${index}`} className="flex gap-3 rounded-lg border p-3 text-sm">
                  <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                  <div>
                    <div className="font-medium">{labelEvent(item.type)} · {item.userName || 'Pengguna'}</div>
                    <div className="text-slate-500">{formatDate(item.at)}</div>
                    <div className="mt-1">{item.summary || '-'}</div>
                    {(item.sessionId || item.agendaId) && <div className="mt-1 text-xs text-slate-500">
                      {item.sessionId ? `Session ${item.sessionId}` : ''}{item.sessionId && item.agendaId ? ' · ' : ''}{item.agendaId ? `Agenda ${item.agendaId}` : ''}
                    </div>}
                  </div>
                </li>)}
              </ol>
            </div>
            {canManage && <div className="grid gap-2 border-t pt-4 sm:grid-cols-2">
              <UserBlockControl name={selected.user_a_name} userId={selected.user_a_id} blocked={Boolean(selected.user_a_blocked)} pending={isPending} onChange={changeBlock} />
              <UserBlockControl name={selected.user_b_name} userId={selected.user_b_id} blocked={Boolean(selected.user_b_blocked)} pending={isPending} onChange={changeBlock} />
            </div>}
          </div>}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: 'rose' | 'amber' | 'slate' }) {
  const colors = tone === 'rose' ? 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-100' : tone === 'amber' ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-100' : 'border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100'
  return <div className={`rounded-xl border p-4 ${colors}`}><p className="text-xs font-medium opacity-70">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div>
}

function RiskBadge({ level, score }: { level: string; score: number }) {
  const label = level === 'high' ? 'Tinggi' : level === 'medium' ? 'Sedang' : 'Rendah'
  return <Badge className={level === 'high' ? 'bg-rose-600' : level === 'medium' ? 'bg-amber-500' : 'bg-slate-500'}>{label} · {score}</Badge>
}

function UserBlockControl({ name, userId, blocked, pending, onChange }: { name: string; userId: string; blocked: boolean; pending: boolean; onChange: (id: string, name: string, blocked: boolean) => void }) {
  return <div className="rounded-lg border p-3"><div className="mb-2 flex items-center gap-2"><ShieldCheck className="h-4 w-4" /><span className="font-medium">{name}</span></div><Button type="button" size="sm" variant={blocked ? 'outline' : 'destructive'} disabled={pending} onClick={() => onChange(userId, name, blocked)}>{blocked ? <UnlockKeyhole className="mr-2 h-4 w-4" /> : <LockKeyhole className="mr-2 h-4 w-4" />}{blocked ? 'Buka blokir Agenda' : 'Blokir Agenda'}</Button></div>
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><div className="text-xs text-slate-500">{label}</div><div className="break-words text-sm font-medium">{value}</div></div>
}

function parseArray<T>(value?: string | null): T[] {
  try { const parsed = JSON.parse(value || '[]'); return Array.isArray(parsed) ? parsed : [] } catch { return [] }
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(date)
}

function labelEvent(type: AgendaAccessEvidence['type']) {
  if (type === 'login') return 'Login'
  if (type === 'logout') return 'Logout'
  return 'Mengisi Agenda'
}
