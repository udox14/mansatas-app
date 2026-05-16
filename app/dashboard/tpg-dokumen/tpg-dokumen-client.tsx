'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Download, FileText, Loader2, Printer, Upload, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { monthLabel, type TpgUserStatus } from '@/lib/tpg'
import { uploadS36Action } from './actions'

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

type TpgData = {
  currentUserId: string
  canManage: boolean
  s36Year: number
  s36Month: number
  ckhYear: number
  ckhMonth: number
  users: TpgUserStatus[]
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '-'
  return new Date(value.replace(' ', 'T') + 'Z').toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatSize(value: number | null | undefined) {
  if (!value) return '-'
  return `${(value / 1024 / 1024).toFixed(2)} MB`
}

function isCkhFinal(row: TpgUserStatus) {
  return row.ckh_status === 'FINAL' && Number(row.ckh_row_count || 0) > 0
}

function hasS36(row: TpgUserStatus) {
  return Boolean(row.s36_uploaded_at)
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold',
      ok ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500',
    )}>
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {label}
    </span>
  )
}

export function TpgDokumenClient({ initialData }: { initialData: TpgData }) {
  const router = useRouter()
  const data = initialData
  const [s36Year, setS36Year] = useState(String(initialData.s36Year))
  const [s36Month, setS36Month] = useState(String(initialData.s36Month))
  const [ckhYear, setCkhYear] = useState(String(initialData.ckhYear))
  const [ckhMonth, setCkhMonth] = useState(String(initialData.ckhMonth))
  const [selected, setSelected] = useState<string[]>([])
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()
  const currentUser = data.users.find(user => user.id === data.currentUserId) || data.users[0]
  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear()
    return Array.from({ length: 6 }, (_, index) => current - 3 + index)
  }, [])
  const finalSelected = data.users.filter(row => selected.includes(row.id) && isCkhFinal(row))
  const s36Selected = data.users.filter(row => selected.includes(row.id) && hasS36(row))
  const userCkhReady = currentUser ? isCkhFinal(currentUser) : false
  const userSignatureActive = Boolean(currentUser?.signature_url && currentUser?.signature_enabled)

  const applyFilters = () => {
    router.push(`/dashboard/tpg-dokumen?s36Year=${s36Year}&s36Month=${s36Month}&ckhYear=${ckhYear}&ckhMonth=${ckhMonth}`)
  }

  const uploadS36 = (formData: FormData) => {
    startTransition(async () => {
      setMessage(null)
      const res = await uploadS36Action(formData)
      if (res?.error) {
        setMessage({ type: 'error', text: res.error })
        return
      }
      setMessage({ type: 'success', text: res?.success || 'S36 berhasil diupload.' })
      router.refresh()
    })
  }

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? data.users.map(user => user.id) : [])
  }

  const toggleUser = (id: string, checked: boolean) => {
    setSelected(prev => checked ? Array.from(new Set([...prev, id])) : prev.filter(item => item !== id))
  }

  const openS36Download = (mode: 'selected' | 'all') => {
    const ids = mode === 'all' ? data.users.filter(hasS36).map(row => row.id) : s36Selected.map(row => row.id)
    if (ids.length === 0) {
      setMessage({ type: 'error', text: 'Belum ada S36 yang bisa didownload.' })
      return
    }
    window.location.href = `/api/tpg/s36/download?year=${data.s36Year}&month=${data.s36Month}&users=${ids.join(',')}`
  }

  const openCkhPrint = (mode: 'selected' | 'all') => {
    const ids = mode === 'all' ? data.users.filter(isCkhFinal).map(row => row.id) : finalSelected.map(row => row.id)
    if (ids.length === 0) {
      setMessage({ type: 'error', text: 'Belum ada CKH yang disimpan.' })
      return
    }
    window.open(`/dashboard/tpg-dokumen/print-ckh?year=${data.ckhYear}&month=${data.ckhMonth}&users=${ids.join(',')}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="space-y-4">
      {message && (
        <div className={cn(
          'rounded-lg border px-4 py-3 text-sm',
          message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700',
        )}>
          {message.text}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="rounded-xl border border-surface bg-surface p-4">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Upload S36</p>
            <p className="mt-1 text-xs text-slate-500">File PDF baru akan menimpa S36 sebelumnya.</p>
            <form action={uploadS36} className="mt-4 space-y-3">
              <input type="hidden" name="period_year" value={s36Year} />
              <input type="hidden" name="period_month" value={s36Month} />
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Bulan S36</Label>
                  <Select value={s36Month} onValueChange={setS36Month}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((month, index) => <SelectItem key={month} value={String(index + 1)}>{month}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Tahun</Label>
                  <Select value={s36Year} onValueChange={setS36Year}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {yearOptions.map(year => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Input name="s36" type="file" accept="application/pdf,.pdf" required />
              <Button disabled={isPending} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Upload S36
              </Button>
            </form>
            {currentUser ? (
              <div className="mt-4 rounded-lg border border-surface-2 bg-surface-2 p-3 text-xs text-slate-600">
                <p className="font-semibold text-slate-800 dark:text-slate-100">Status S36 Saya</p>
                <p className="mt-1">{hasS36(currentUser) ? `${currentUser.s36_original_filename} (${formatSize(currentUser.s36_file_size)})` : 'Belum upload untuk periode ini.'}</p>
                <p className="mt-1 text-slate-400">{hasS36(currentUser) ? formatDateTime(currentUser.s36_uploaded_at) : monthLabel(data.s36Year, data.s36Month)}</p>
              </div>
            ) : null}
          </div>

          <div className="rounded-xl border border-surface bg-surface p-4">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Periode Monitoring</p>
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Bulan CKH</Label>
                  <Select value={ckhMonth} onValueChange={setCkhMonth}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{MONTHS.map((month, index) => <SelectItem key={month} value={String(index + 1)}>{month}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Tahun CKH</Label>
                  <Select value={ckhYear} onValueChange={setCkhYear}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{yearOptions.map(year => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <Button type="button" variant="outline" onClick={applyFilters} className="w-full">Terapkan Periode</Button>
            </div>
          </div>
        </div>

        {!data.canManage && currentUser ? (
          <div className="rounded-xl border border-surface bg-surface">
            <div className="border-b border-surface-2 px-4 py-3">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Status Dokumen Saya Bulan {monthLabel(data.ckhYear, data.ckhMonth)}
              </p>
              <p className="text-xs text-slate-500">
                S36 {monthLabel(data.s36Year, data.s36Month)} | CKH {monthLabel(data.ckhYear, data.ckhMonth)}
              </p>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-3">
              <div className="rounded-lg border border-surface-2 bg-surface-2 p-3">
                <p className="text-xs font-semibold text-slate-500">S36</p>
                <div className="mt-2"><StatusPill ok={hasS36(currentUser)} label={hasS36(currentUser) ? 'Sudah upload' : 'Belum upload'} /></div>
                <p className="mt-2 text-xs text-slate-500">
                  {hasS36(currentUser)
                    ? `${currentUser.s36_original_filename} | ${formatDateTime(currentUser.s36_uploaded_at)}`
                    : 'Upload PDF S36 melalui form di sebelah kiri.'}
                </p>
              </div>
              <div className="rounded-lg border border-surface-2 bg-surface-2 p-3">
                <p className="text-xs font-semibold text-slate-500">CKH</p>
                <div className="mt-2"><StatusPill ok={userCkhReady} label={userCkhReady ? 'Sudah dikirim' : 'Belum dikirim'} /></div>
                <p className="mt-2 text-xs text-slate-500">
                  {userCkhReady
                    ? `Terakhir update: ${formatDateTime(currentUser.ckh_updated_at)}`
                    : 'Klik Kirim CKH di CKH Generator setelah data benar.'}
                </p>
              </div>
              <div className="rounded-lg border border-surface-2 bg-surface-2 p-3">
                <p className="text-xs font-semibold text-slate-500">Tanda Tangan CKH</p>
                <div className="mt-2"><StatusPill ok={userSignatureActive} label={userSignatureActive ? 'Aktif' : 'Tidak aktif'} /></div>
                <p className="mt-2 text-xs text-slate-500">
                  {userSignatureActive ? 'Tanda tangan akan tampil saat CKH dicetak.' : 'Opsional, bisa diatur di CKH Generator.'}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-surface bg-surface">
          <div className="flex flex-col gap-3 border-b border-surface-2 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Monitoring TU</p>
              <p className="text-xs text-slate-500">S36 {monthLabel(data.s36Year, data.s36Month)} | CKH {monthLabel(data.ckhYear, data.ckhMonth)}</p>
            </div>
            {data.canManage && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => openS36Download('selected')} disabled={selected.length === 0} className="gap-1.5">
                  <Download className="h-3.5 w-3.5" /> S36 Terpilih
                </Button>
                <Button variant="outline" size="sm" onClick={() => openS36Download('all')} className="gap-1.5">
                  <Download className="h-3.5 w-3.5" /> Semua S36
                </Button>
                <Button size="sm" onClick={() => openCkhPrint('selected')} disabled={selected.length === 0} className="gap-1.5 bg-slate-900 text-white hover:bg-slate-800">
                  <Printer className="h-3.5 w-3.5" /> CKH Terpilih
                </Button>
                <Button size="sm" onClick={() => openCkhPrint('all')} className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700">
                  <Printer className="h-3.5 w-3.5" /> Semua CKH
                </Button>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  {data.canManage && (
                    <th className="w-10 px-4 py-3">
                      <input type="checkbox" checked={selected.length === data.users.length && data.users.length > 0} onChange={e => toggleAll(e.target.checked)} />
                    </th>
                  )}
                  <th className="px-4 py-3">Pegawai</th>
                  <th className="px-4 py-3">S36 Upload</th>
                  <th className="px-4 py-3">CKH Disimpan</th>
                  <th className="px-4 py-3">Tanda Tangan</th>
                  <th className="px-4 py-3">Update CKH</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-2">
                {data.users.map(row => (
                  <tr key={row.id} className="bg-white dark:bg-transparent">
                    {data.canManage && (
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selected.includes(row.id)} onChange={e => toggleUser(row.id, e.target.checked)} />
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800 dark:text-slate-100">{row.nama_lengkap}</p>
                      <p className="text-xs text-slate-500">{row.jabatan_cetak || row.role}</p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill ok={hasS36(row)} label={hasS36(row) ? 'Sudah upload' : 'Belum'} />
                      {hasS36(row) && <p className="mt-1 text-xs text-slate-400">{formatSize(row.s36_file_size)} | {formatDateTime(row.s36_uploaded_at)}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill ok={isCkhFinal(row)} label={isCkhFinal(row) ? 'Siap diambil TU' : 'Belum save'} />
                      <p className="mt-1 text-xs text-slate-400">{row.ckh_row_count || 0} baris</p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill ok={Boolean(row.signature_url && row.signature_enabled)} label={row.signature_url && row.signature_enabled ? 'Aktif' : 'Tidak'} />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatDateTime(row.ckh_updated_at)}</td>
                  </tr>
                ))}
                {data.users.length === 0 && (
                  <tr>
                    <td colSpan={data.canManage ? 6 : 5} className="px-4 py-10 text-center text-sm text-slate-400">
                      Tidak ada data.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {!data.canManage && (
            <div className="border-t border-surface-2 px-4 py-3 text-xs text-slate-500">
              <FileText className="mr-1 inline h-3.5 w-3.5" />
              CKH akan terlihat oleh TU setelah Anda klik Kirim CKH di CKH Generator.
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  )
}
