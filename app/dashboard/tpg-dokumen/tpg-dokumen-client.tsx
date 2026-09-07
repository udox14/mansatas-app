'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  AlertCircle,
  CheckCircle2,
  Download,
  ExternalLink,
  FileCheck,
  FileText,
  FileUp,
  Loader2,
  Printer,
  Search,
  Upload,
  UserCheck,
  X,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import {
  isS36RequiredForRoles,
  monthLabel,
  isTpgProfileComplete,
  getTpgMissingProfileFields,
  type TpgUserStatus,
} from '@/lib/tpg'
import { downloadAndOpenNativeFile } from '@/lib/pdf/download'
import { uploadS36Action } from './actions'

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

type TpgData = {
  currentUserId: string
  currentUser?: TpgUserStatus | null
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

function s36Required(row: TpgUserStatus) {
  return isS36RequiredForRoles(row.role, row.roles)
}

function getGuruLabel(row: TpgUserStatus) {
  if (row.jabatan_cetak && row.jabatan_cetak.trim()) {
    return row.jabatan_cetak
  }
  return 'Guru Mata Pelajaran'
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
      ok ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
    )}>
      {ok ? <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" /> : <XCircle className="h-3 w-3 text-slate-400" />}
      {label}
    </span>
  )
}

export function TpgDokumenClient({ initialData }: { initialData: TpgData }) {
  const router = useRouter()
  const data = initialData
  const [s36Year, setS36Year] = useState(String(initialData.s36Year))
  const [s36Month, setS36Month] = useState(String(initialData.s36Month))
  const [uploadYear, setUploadYear] = useState(String(initialData.s36Year))
  const [uploadMonth, setUploadMonth] = useState(String(initialData.s36Month))
  const [ckhYear, setCkhYear] = useState(String(initialData.ckhYear))
  const [ckhMonth, setCkhMonth] = useState(String(initialData.ckhMonth))
  const [selected, setSelected] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState('20')
  const [searchQuery, setSearchQuery] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  // Modal State
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [modalError, setModalError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Modal Print Ceklis State
  const [isCeklisModalOpen, setIsCeklisModalOpen] = useState(false)
  const [ceklisPrintMode, setCeklisPrintMode] = useState<'selected' | 'all' | 'self'>('selected')
  const [ceklisYear, setCeklisYear] = useState(String(initialData.s36Year))
  const [ceklisMonth, setCeklisMonth] = useState(String(initialData.s36Month))
  const [ceklisDate, setCeklisDate] = useState('')
  const [ceklisCity, setCeklisCity] = useState('Tasikmalaya')

  useEffect(() => {
    try {
      const saved = localStorage.getItem('tpg_ceklis_print_config')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.year) setCeklisYear(String(parsed.year))
        if (parsed.month) setCeklisMonth(String(parsed.month))
        if (parsed.date !== undefined) setCeklisDate(String(parsed.date))
        if (parsed.city) setCeklisCity(String(parsed.city))
      } else {
        const todayStr = new Date().toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
        setCeklisDate(todayStr)
      }
    } catch {
      // ignore
    }
  }, [])

  const currentUser = data.currentUser || data.users.find(user => user.id === data.currentUserId) || null
  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear()
    return Array.from({ length: 6 }, (_, index) => current - 3 + index)
  }, [])

  const userCkhReady = currentUser ? isCkhFinal(currentUser) : false
  const userSignatureActive = Boolean(currentUser?.signature_url && currentUser?.signature_enabled)
  const userS36Required = currentUser ? s36Required(currentUser) : false

  // Filter users by search query
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return data.users
    const q = searchQuery.toLowerCase().trim()
    return data.users.filter(u =>
      (u.nama_lengkap && u.nama_lengkap.toLowerCase().includes(q)) ||
      (u.nip && u.nip.toLowerCase().includes(q)) ||
      (u.jabatan_cetak && u.jabatan_cetak.toLowerCase().includes(q))
    )
  }, [data.users, searchQuery])

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / Number(pageSize)))
  const currentPage = Math.min(page, totalPages)
  const paginatedUsers = useMemo(() => {
    const size = Number(pageSize)
    const start = (currentPage - 1) * size
    return filteredUsers.slice(start, start + size)
  }, [currentPage, filteredUsers, pageSize])

  const finalSelected = data.users.filter(row => selected.includes(row.id) && isCkhFinal(row))
  const s36Selected = data.users.filter(row => selected.includes(row.id) && hasS36(row))
  const pageSelected = paginatedUsers.length > 0 && paginatedUsers.every(user => selected.includes(user.id))

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1)
      setSelected([])
    }, 0)
    return () => window.clearTimeout(timer)
  }, [data.s36Year, data.s36Month, data.ckhYear, data.ckhMonth, pageSize, searchQuery])

  const applyFilters = () => {
    router.push(`/dashboard/tpg-dokumen?s36Year=${s36Year}&s36Month=${s36Month}&ckhYear=${ckhYear}&ckhMonth=${ckhMonth}`)
  }

  const handleOpenUploadModal = () => {
    setUploadYear(s36Year)
    setUploadMonth(s36Month)
    setSelectedFile(null)
    setModalError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setIsUploadOpen(true)
  }

  const handleFile = (file: File | null) => {
    setModalError(null)
    if (!file) {
      setSelectedFile(null)
      return
    }
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    if (!isPdf) {
      setModalError('Format berkas harus PDF.')
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setModalError(`Ukuran berkas melebihi batas 5 MB (${(file.size / 1024 / 1024).toFixed(2)} MB).`)
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    setSelectedFile(file)
  }

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFile) {
      setModalError('Pilih file PDF S36 terlebih dahulu.')
      return
    }

    const formData = new FormData()
    formData.set('period_year', uploadYear)
    formData.set('period_month', uploadMonth)
    formData.set('s36', selectedFile)

    startTransition(async () => {
      setModalError(null)
      const res = await uploadS36Action(formData)
      if (res?.error) {
        setModalError(res.error)
        return
      }
      setIsUploadOpen(false)
      setSelectedFile(null)
      setMessage({ type: 'success', text: res?.success || 'S36 berhasil diupload.' })
      if (uploadYear !== s36Year || uploadMonth !== s36Month) {
        router.push(`/dashboard/tpg-dokumen?s36Year=${uploadYear}&s36Month=${uploadMonth}&ckhYear=${ckhYear}&ckhMonth=${ckhMonth}`)
      } else {
        router.refresh()
      }
    })
  }

  const togglePage = (checked: boolean) => {
    const pageIds = paginatedUsers.map(user => user.id)
    setSelected(prev => {
      if (checked) return Array.from(new Set([...prev, ...pageIds]))
      return prev.filter(id => !pageIds.includes(id))
    })
  }

  const toggleUser = (id: string, checked: boolean) => {
    setSelected(prev => checked ? Array.from(new Set([...prev, id])) : prev.filter(item => item !== id))
  }

  const openS36Download = async (mode: 'selected' | 'all') => {
    const ids = mode === 'all' ? data.users.filter(hasS36).map(row => row.id) : s36Selected.map(row => row.id)
    if (ids.length === 0) {
      setMessage({ type: 'error', text: 'Belum ada S36 yang bisa didownload.' })
      return
    }
    setMessage(null)
    try {
      await downloadAndOpenNativeFile(`/api/tpg/s36/download?year=${data.s36Year}&month=${data.s36Month}&users=${ids.join(',')}`)
    } catch (cause) {
      setMessage({ type: 'error', text: cause instanceof Error ? cause.message : 'Gagal mengunduh S36.' })
    }
  }

  const openCkhPrint = (mode: 'selected' | 'all') => {
    const ids = mode === 'all' ? data.users.filter(isCkhFinal).map(row => row.id) : finalSelected.map(row => row.id)
    if (ids.length === 0) {
      setMessage({ type: 'error', text: 'Belum ada CKH yang disimpan.' })
      return
    }
    window.open(`/dashboard/tpg-dokumen/print-ckh?year=${data.ckhYear}&month=${data.ckhMonth}&users=${ids.join(',')}`, '_blank', 'noopener,noreferrer')
  }

  const openCeklisPrintModal = (mode: 'selected' | 'all' | 'self') => {
    if (mode === 'selected' && selected.length === 0) {
      setMessage({ type: 'error', text: 'Pilih minimal satu guru untuk mencetak lembar ceklis.' })
      return
    }
    setCeklisPrintMode(mode)
    setIsCeklisModalOpen(true)
  }

  const handleCeklisPrintSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    try {
      localStorage.setItem(
        'tpg_ceklis_print_config',
        JSON.stringify({
          year: ceklisYear,
          month: ceklisMonth,
          date: ceklisDate,
          city: ceklisCity,
        })
      )
    } catch {
      // ignore
    }

    let usersParam = ''
    if (ceklisPrintMode === 'self') {
      if (currentUser) {
        usersParam = `&users=${currentUser.id}`
      }
    } else if (ceklisPrintMode === 'selected') {
      usersParam = `&users=${selected.join(',')}`
    }

    const url = `/dashboard/tpg-dokumen/print-ceklis?year=${ceklisYear}&month=${ceklisMonth}&date=${encodeURIComponent(ceklisDate)}&city=${encodeURIComponent(ceklisCity)}${usersParam}`
    window.open(url, '_blank', 'noopener,noreferrer')
    setIsCeklisModalOpen(false)
  }

  const periodFilters = (
    <div className="rounded-xl border border-surface bg-surface p-4">
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
        {data.canManage ? 'Periode Monitoring Dokumen' : 'Periode Dokumen Saya'}
      </p>
      <div className="mt-3 grid grid-cols-2 items-end gap-3 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor="period-s36Month" className="text-xs">Bulan S36</Label>
          <Select value={s36Month} onValueChange={setS36Month}>
            <SelectTrigger id="period-s36Month"><SelectValue /></SelectTrigger>
            <SelectContent>{MONTHS.map((month, index) => <SelectItem key={month} value={String(index + 1)}>{month}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor="period-s36Year" className="text-xs">Tahun S36</Label>
          <Select value={s36Year} onValueChange={setS36Year}>
            <SelectTrigger id="period-s36Year"><SelectValue /></SelectTrigger>
            <SelectContent>{yearOptions.map(year => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor="period-ckhMonth" className="text-xs">Bulan CKH</Label>
          <Select value={ckhMonth} onValueChange={setCkhMonth}>
            <SelectTrigger id="period-ckhMonth"><SelectValue /></SelectTrigger>
            <SelectContent>{MONTHS.map((month, index) => <SelectItem key={month} value={String(index + 1)}>{month}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor="period-ckhYear" className="text-xs">Tahun CKH</Label>
          <Select value={ckhYear} onValueChange={setCkhYear}>
            <SelectTrigger id="period-ckhYear"><SelectValue /></SelectTrigger>
            <SelectContent>{yearOptions.map(year => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Button type="button" variant="outline" onClick={applyFilters} className="col-span-2 lg:col-span-1">
          Terapkan Periode
        </Button>
      </div>
    </div>
  )

  const uploadModal = (
    <Dialog open={isUploadOpen} onOpenChange={open => { if (!isPending) setIsUploadOpen(open) }}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-lg p-0 overflow-hidden rounded-2xl border-surface shadow-2xl max-h-[90dvh] flex flex-col bg-surface">
        <DialogHeader className="border-b border-surface-2 bg-surface-2/60 px-5 py-4 sm:px-6 text-left">
          <DialogTitle className="flex items-center gap-2.5 text-base sm:text-lg font-semibold text-slate-800 dark:text-slate-100">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
              <Upload className="h-4 w-4" />
            </div>
            Upload Dokumen S36
          </DialogTitle>
          <DialogDescription className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Unggah berkas S36 format PDF untuk verifikasi kelengkapan Dokumen TPG.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleUploadSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
            {modalError && (
              <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-500" />
                <span>{modalError}</span>
              </div>
            )}

            {/* Periode S36 Selection */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Periode Dokumen S36</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <span className="text-[11px] text-slate-500">Bulan</span>
                  <Select value={uploadMonth} onValueChange={setUploadMonth}>
                    <SelectTrigger className="h-10 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((month, index) => (
                        <SelectItem key={month} value={String(index + 1)}>{month}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] text-slate-500">Tahun</span>
                  <Select value={uploadYear} onValueChange={setUploadYear}>
                    <SelectTrigger className="h-10 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {yearOptions.map(year => (
                        <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* File Picker Dropzone */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Berkas PDF S36</Label>
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={e => {
                  e.preventDefault()
                  setIsDragging(false)
                  if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0])
                }}
                className={cn(
                  'relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-all duration-200 select-none min-h-[140px]',
                  isDragging
                    ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20'
                    : selectedFile
                    ? 'border-emerald-400 bg-emerald-50/30 dark:border-emerald-800 dark:bg-emerald-950/20'
                    : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100/60 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/40 dark:hover:bg-slate-900/80',
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={e => handleFile(e.target.files?.[0] || null)}
                />

                {selectedFile ? (
                  <div className="flex w-full items-center justify-between gap-3 text-left">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 font-bold text-xs shadow-sm">
                        <FileCheck className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{selectedFile.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB • Berkas siap diunggah
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={e => {
                        e.stopPropagation()
                        setSelectedFile(null)
                        if (fileInputRef.current) fileInputRef.current.value = ''
                      }}
                      className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 rounded-lg"
                      title="Hapus berkas"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 shadow-sm">
                      <FileUp className="h-6 w-6" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        Ketuk untuk memilih berkas PDF
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        atau tarik berkas ke sini
                      </p>
                    </div>
                    <span className="mt-1 inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                      Maksimal 5 MB • Format PDF (.pdf)
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-surface-2 bg-surface-2/40 p-3 text-xs text-slate-600 dark:text-slate-400">
              <p className="font-semibold text-slate-700 dark:text-slate-200">Informasi Penting:</p>
              <ul className="mt-1 list-disc list-inside space-y-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                <li>Pastikan surat S36 sesuai dengan periode bulan pencairan yang dipilih.</li>
                <li>Berkas digital resmi dari Simpatika/Kemenag dapat langsung diunggah.</li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 border-t border-surface-2 bg-surface-2/40 px-5 py-3.5 sm:px-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsUploadOpen(false)}
              disabled={isPending}
              className="h-11 sm:h-10 text-sm w-full sm:w-auto"
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={isPending || !selectedFile}
              className="h-11 sm:h-10 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white gap-2 w-full sm:w-auto"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Mengunggah...</span>
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  <span>Upload S36</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )

  const ceklisPrintModal = (
    <Dialog open={isCeklisModalOpen} onOpenChange={setIsCeklisModalOpen}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-lg p-0 overflow-hidden rounded-2xl border-surface shadow-2xl max-h-[90dvh] flex flex-col bg-surface">
        <DialogHeader className="border-b border-surface-2 bg-surface-2/60 px-5 py-4 sm:px-6 text-left">
          <DialogTitle className="flex items-center gap-2.5 text-base sm:text-lg font-semibold text-slate-800 dark:text-slate-100">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400">
              <Printer className="h-4 w-4" />
            </div>
            Pengaturan Cetak Lembar Ceklis
          </DialogTitle>
          <DialogDescription className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Atur periode, tanggal, dan informasi penerimaan sebelum mencetak (format A4 Portrait, rangkap ASLI &amp; SALINAN).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleCeklisPrintSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
            {/* Print Scope Info Banner */}
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-3.5 text-xs text-indigo-800 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-300">
              <p className="font-semibold flex items-center gap-1.5">
                <FileCheck className="h-3.5 w-3.5 text-indigo-600" />
                Target Cetak:
              </p>
              <p className="mt-1 text-indigo-700 dark:text-indigo-300">
                {ceklisPrintMode === 'self'
                  ? 'Mencetak Lembar Ceklis untuk profil Anda (2 lembar: ASLI & SALINAN).'
                  : ceklisPrintMode === 'selected'
                  ? `Mencetak Lembar Ceklis untuk ${selected.length} Guru terpilih (${selected.length * 2} lembar: ASLI & SALINAN).`
                  : `Mencetak Lembar Ceklis untuk seluruh Guru Mata Pelajaran (${data.users.length} Guru, ${data.users.length * 2} lembar).`}
              </p>
            </div>

            {/* Periode Selection */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Periode Pencairan TPG
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <span className="text-[11px] text-slate-500">Bulan</span>
                  <Select value={ceklisMonth} onValueChange={setCeklisMonth}>
                    <SelectTrigger className="h-10 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((month, index) => (
                        <SelectItem key={month} value={String(index + 1)}>
                          {month}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] text-slate-500">Tahun</span>
                  <Select value={ceklisYear} onValueChange={setCeklisYear}>
                    <SelectTrigger className="h-10 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {yearOptions.map(year => (
                        <SelectItem key={year} value={String(year)}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Tanggal Penerimaan Berkas */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="ceklis-date" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Tanggal Penerimaan Berkas
                </Label>
                <button
                  type="button"
                  onClick={() => {
                    const todayStr = new Date().toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })
                    setCeklisDate(todayStr)
                  }}
                  className="text-[11px] text-emerald-600 hover:text-emerald-700 font-medium"
                >
                  Gunakan Hari Ini
                </button>
              </div>
              <Input
                id="ceklis-date"
                placeholder="Contoh: 10 Maret 2026 (atau kosongkan untuk titik-titik)"
                value={ceklisDate}
                onChange={e => setCeklisDate(e.target.value)}
                className="h-10 text-sm"
              />
              <p className="text-[11px] text-slate-500">
                Akan tertulis pada bagian tanda tangan (misal: <em>{ceklisCity || 'Tasikmalaya'}, {ceklisDate || `................ 2026`}</em>).
              </p>
            </div>

            {/* Tempat / Kota */}
            <div className="space-y-1.5">
              <Label htmlFor="ceklis-city" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Tempat / Kota
              </Label>
              <Input
                id="ceklis-city"
                placeholder="Tasikmalaya"
                value={ceklisCity}
                onChange={e => setCeklisCity(e.target.value)}
                className="h-10 text-sm"
              />
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 border-t border-surface-2 bg-surface-2/40 px-5 py-3.5 sm:px-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCeklisModalOpen(false)}
              className="h-10 text-sm w-full sm:w-auto"
            >
              Batal
            </Button>
            <Button
              type="submit"
              className="h-10 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white gap-2 w-full sm:w-auto"
            >
              <Printer className="h-4 w-4" />
              <span>Buka Format Cetak</span>
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )

  const dokumenSayaContent = (
    <div className="space-y-4">
      {periodFilters}

      {currentUser ? (
        <div className="rounded-xl border border-surface bg-surface shadow-sm overflow-hidden">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-surface-2 px-4 py-3.5 bg-surface-2/30">
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Status Dokumen TPG Bulan {monthLabel(data.ckhYear, data.ckhMonth)}
              </p>
              <p className="text-xs text-slate-500">
                S36: {monthLabel(data.s36Year, data.s36Month)} • CKH: {monthLabel(data.ckhYear, data.ckhMonth)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={() => openCeklisPrintModal('self')}
                size="sm"
                variant="outline"
                className="w-full sm:w-auto gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300 text-xs h-9 font-medium"
              >
                <Printer className="h-3.5 w-3.5" />
                Cetak Lembar Ceklis
              </Button>
              {userS36Required && (
                <Button
                  onClick={handleOpenUploadModal}
                  size="sm"
                  className="w-full sm:w-auto gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 font-medium shadow-sm"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Upload S36
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-3.5 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {/* Card 1: Profil TPG */}
            <div className="rounded-xl border border-surface-2 bg-surface-2/50 p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Profil TPG</p>
                  <StatusPill
                    ok={isTpgProfileComplete(currentUser)}
                    label={isTpgProfileComplete(currentUser) ? 'Lengkap' : 'Belum Lengkap'}
                  />
                </div>

                <div className="mt-3 text-xs text-slate-500 space-y-1">
                  {isTpgProfileComplete(currentUser) ? (
                    <>
                      <p className="font-medium text-slate-700 dark:text-slate-200">
                        No. Urut: {currentUser.no_urut} • NRG: {currentUser.nrg}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Pangkat: {currentUser.pangkat_golongan || '-'}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        NUPTK: {currentUser.nuptk || '-'} • WA: {currentUser.nomor_whatsapp || '-'}
                      </p>
                    </>
                  ) : (
                    <div>
                      <p className="text-rose-600 dark:text-rose-400 font-medium">
                        Data belum lengkap untuk cetak ceklis.
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Kurang: {getTpgMissingProfileFields(currentUser).join(', ')}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <Button
                asChild
                variant="outline"
                size="sm"
                className="mt-4 w-full text-xs h-9 gap-1.5 border-slate-300 dark:border-slate-700"
              >
                <Link href="/dashboard/settings/profile">
                  <UserCheck className="h-3.5 w-3.5" />
                  {isTpgProfileComplete(currentUser) ? 'Lihat Profil Saya' : 'Lengkapi di Profil Saya'}
                </Link>
              </Button>
            </div>

            {/* Card 2: S36 Card */}
            <div className="rounded-xl border border-surface-2 bg-surface-2/50 p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Dokumen S36</p>
                  {userS36Required
                    ? <StatusPill ok={hasS36(currentUser)} label={hasS36(currentUser) ? 'Sudah upload' : 'Belum upload'} />
                    : <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">Tidak wajib</span>}
                </div>

                <div className="mt-3 text-xs text-slate-500 space-y-1">
                  {!userS36Required ? (
                    <p>S36 hanya diwajibkan untuk Guru Mata Pelajaran.</p>
                  ) : hasS36(currentUser) ? (
                    <>
                      <p className="font-medium text-slate-700 dark:text-slate-200 truncate" title={currentUser.s36_original_filename || 'S36.pdf'}>
                        {currentUser.s36_original_filename}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {formatSize(currentUser.s36_file_size)} • {formatDateTime(currentUser.s36_uploaded_at)}
                      </p>
                    </>
                  ) : (
                    <p>Belum ada berkas S36 yang diunggah untuk periode {monthLabel(data.s36Year, data.s36Month)}.</p>
                  )}
                </div>
              </div>

              {userS36Required && (
                <Button
                  type="button"
                  variant={hasS36(currentUser) ? 'outline' : 'default'}
                  size="sm"
                  onClick={handleOpenUploadModal}
                  className={cn(
                    'mt-4 w-full gap-1.5 text-xs h-9 font-medium',
                    hasS36(currentUser)
                      ? 'border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm',
                  )}
                >
                  <Upload className="h-3.5 w-3.5" />
                  {hasS36(currentUser) ? 'Ganti / Upload Ulang' : 'Upload Berkas S36'}
                </Button>
              )}
            </div>

            {/* Card 3: CKH Card */}
            <div className="rounded-xl border border-surface-2 bg-surface-2/50 p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">CKH Kinerja Harian</p>
                  <StatusPill ok={userCkhReady} label={userCkhReady ? 'Sudah dikirim' : 'Belum dikirim'} />
                </div>

                <div className="mt-3 text-xs text-slate-500 space-y-1">
                  {userCkhReady ? (
                    <>
                      <p className="font-medium text-slate-700 dark:text-slate-200">
                        Tersimpan {currentUser.ckh_row_count} baris kegiatan
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Update: {formatDateTime(currentUser.ckh_updated_at)}
                      </p>
                    </>
                  ) : (
                    <p>Isi catatan harian Anda lalu klik Kirim CKH di menu CKH Generator.</p>
                  )}
                </div>
              </div>

              <Button
                asChild
                variant="outline"
                size="sm"
                className="mt-4 w-full text-xs h-9 gap-1.5"
              >
                <Link href="/dashboard/ckh-generator">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Buka CKH Generator
                </Link>
              </Button>
            </div>

            {/* Card 4: Lembar Ceklis Card */}
            <div className="rounded-xl border border-surface-2 bg-surface-2/50 p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Lembar Ceklis</p>
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                    A4 Portrait
                  </span>
                </div>

                <div className="mt-3 text-xs text-slate-500 space-y-1">
                  <p className="font-medium text-slate-700 dark:text-slate-200">
                    Ceklis Berkas TPG
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Dicetak 2 lembar identik (ASLI &amp; SALINAN) untuk pencairan TPG.
                  </p>
                </div>
              </div>

              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => openCeklisPrintModal('self')}
                className="mt-4 w-full text-xs h-9 gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
              >
                <Printer className="h-3.5 w-3.5" />
                Cetak Lembar Ceklis
              </Button>
            </div>

            {/* Card 5: Signature Card */}
            <div className="rounded-xl border border-surface-2 bg-surface-2/50 p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Tanda Tangan Digital</p>
                  <StatusPill ok={userSignatureActive} label={userSignatureActive ? 'Aktif' : 'Tidak aktif'} />
                </div>

                <div className="mt-3 text-xs text-slate-500">
                  <p>
                    {userSignatureActive
                      ? 'Tanda tangan digital Anda akan otomatis muncul saat berkas CKH dicetak.'
                      : 'Tanda tangan belum aktif. Anda dapat mengaturnya di CKH Generator.'}
                  </p>
                </div>
              </div>

              <Button
                asChild
                variant="outline"
                size="sm"
                className="mt-4 w-full text-xs h-9 gap-1.5"
              >
                <Link href="/dashboard/ckh-generator">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Atur Tanda Tangan
                </Link>
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-surface bg-surface p-6 text-center text-sm text-slate-500">
          Data pengguna tidak ditemukan.
        </div>
      )}

      {!userS36Required && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300">
          <p className="font-semibold">Informasi Kewajiban S36:</p>
          <p className="mt-1">
            Akun Anda saat ini tidak memiliki role Guru Mata Pelajaran. Pengunggahan dokumen S36 hanya diwajibkan bagi Guru Mata Pelajaran penerima Tunjangan Profesi Guru (TPG).
          </p>
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-4">
      {message && (
        <div className={cn(
          'rounded-xl border px-4 py-3 text-sm flex items-center justify-between',
          message.type === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300'
            : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300',
        )}>
          <span>{message.text}</span>
          <button type="button" onClick={() => setMessage(null)} className="text-slate-400 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Modal Upload S36 */}
      {uploadModal}

      {/* Modal Cetak Lembar Ceklis */}
      {ceklisPrintModal}

      {data.canManage ? (
        <Tabs defaultValue="monitoring" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <TabsList aria-label="Dokumen TPG" className="h-auto w-full justify-start gap-1 border border-surface bg-surface-2 p-1 sm:w-auto">
              <TabsTrigger value="monitoring" className="flex-1 sm:flex-initial gap-2 px-4 py-2 text-xs sm:text-sm">
                <FileText className="h-4 w-4" />
                Monitoring Guru
              </TabsTrigger>
              <TabsTrigger value="saya" className="flex-1 sm:flex-initial gap-2 px-4 py-2 text-xs sm:text-sm">
                <UserCheck className="h-4 w-4" />
                Dokumen Saya
              </TabsTrigger>
            </TabsList>

            {userS36Required && (
              <Button
                onClick={handleOpenUploadModal}
                size="sm"
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 font-medium shadow-sm w-full sm:w-auto"
              >
                <Upload className="h-3.5 w-3.5" />
                Upload S36 Saya
              </Button>
            )}
          </div>

          {/* TAB 1: MONITORING GURU */}
          <TabsContent value="monitoring" className="min-w-0 space-y-4">
            {periodFilters}

            <div className="rounded-xl border border-surface bg-surface shadow-sm overflow-hidden">
              <div className="flex flex-col gap-3 border-b border-surface-2 px-4 py-3.5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    Monitoring TPG — Guru Mata Pelajaran
                  </p>
                  <p className="text-xs text-slate-500">
                    S36: {monthLabel(data.s36Year, data.s36Month)} • CKH: {monthLabel(data.ckhYear, data.ckhMonth)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative w-full sm:w-56">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <Input
                      placeholder="Cari nama guru..."
                      value={searchQuery}
                      onChange={e => {
                        setSearchQuery(e.target.value)
                        setPage(1)
                      }}
                      className="h-8 pl-8 text-xs bg-surface-2/40"
                    />
                  </div>

                  <Select value={pageSize} onValueChange={setPageSize}>
                    <SelectTrigger className="h-8 w-24 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10 / hal</SelectItem>
                      <SelectItem value="20">20 / hal</SelectItem>
                      <SelectItem value="50">50 / hal</SelectItem>
                      <SelectItem value="100">100 / hal</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openS36Download('selected')}
                    disabled={selected.length === 0}
                    className="gap-1.5 text-xs h-8"
                  >
                    <Download className="h-3.5 w-3.5" /> S36 Terpilih
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openS36Download('all')}
                    className="gap-1.5 text-xs h-8"
                  >
                    <Download className="h-3.5 w-3.5" /> Semua S36
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => openCkhPrint('selected')}
                    disabled={selected.length === 0}
                    className="gap-1.5 text-xs h-8 bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
                  >
                    <Printer className="h-3.5 w-3.5" /> CKH Terpilih
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => openCkhPrint('all')}
                    className="gap-1.5 text-xs h-8 bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    <Printer className="h-3.5 w-3.5" /> Semua CKH
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openCeklisPrintModal('selected')}
                    disabled={selected.length === 0}
                    className="gap-1.5 text-xs h-8 border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300"
                  >
                    <Printer className="h-3.5 w-3.5" /> Ceklis Terpilih
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => openCeklisPrintModal('all')}
                    className="gap-1.5 text-xs h-8 bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
                  >
                    <Printer className="h-3.5 w-3.5" /> Semua Ceklis
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px] text-left text-sm">
                  <thead className="bg-slate-50/80 dark:bg-slate-900/40 text-xs uppercase text-slate-500 border-b border-surface-2">
                    <tr>
                      <th className="w-10 px-4 py-3">
                        <input
                          type="checkbox"
                          checked={pageSelected}
                          onChange={e => togglePage(e.target.checked)}
                          title="Pilih semua guru di halaman ini"
                          className="rounded border-slate-300"
                        />
                      </th>
                      <th className="px-4 py-3">Guru Mata Pelajaran</th>
                      <th className="px-4 py-3">Profil TPG</th>
                      <th className="px-4 py-3">S36 Upload</th>
                      <th className="px-4 py-3">CKH Disimpan</th>
                      <th className="px-4 py-3">Tanda Tangan</th>
                      <th className="px-4 py-3">Update CKH</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-2">
                    {paginatedUsers.map(row => (
                      <tr key={row.id} className="bg-white dark:bg-transparent hover:bg-surface-2/30 transition-colors">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selected.includes(row.id)}
                            onChange={e => toggleUser(row.id, e.target.checked)}
                            className="rounded border-slate-300"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-800 dark:text-slate-100">{row.nama_lengkap}</p>
                          <p className="text-xs text-slate-500">
                            {row.nip ? `NIP. ${row.nip} • ` : ''}{getGuruLabel(row)}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          {isTpgProfileComplete(row) ? (
                            <div>
                              <StatusPill ok={true} label="Lengkap" />
                              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                No. {row.no_urut || '-'} &bull; NRG. {row.nrg || '-'}
                              </p>
                            </div>
                          ) : (
                            <div>
                              <StatusPill ok={false} label="Belum Lengkap" />
                              <p className="mt-1 text-[11px] text-rose-500 font-medium">
                                Kurang: {getTpgMissingProfileFields(row).join(', ')}
                              </p>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {s36Required(row)
                            ? <StatusPill ok={hasS36(row)} label={hasS36(row) ? 'Sudah upload' : 'Belum'} />
                            : <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">Tidak wajib</span>}
                          {hasS36(row) && (
                            <p className="mt-1 text-xs text-slate-400">
                              {formatSize(row.s36_file_size)} • {formatDateTime(row.s36_uploaded_at)}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill ok={isCkhFinal(row)} label={isCkhFinal(row) ? 'Tuntas' : 'Belum save'} />
                          <p className="mt-1 text-xs text-slate-400">{row.ckh_row_count || 0} baris</p>
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill
                            ok={Boolean(row.signature_url && row.signature_enabled)}
                            label={row.signature_url && row.signature_enabled ? 'Aktif' : 'Tidak'}
                          />
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">{formatDateTime(row.ckh_updated_at)}</td>
                      </tr>
                    ))}
                    {paginatedUsers.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-400">
                          {searchQuery.trim()
                            ? `Tidak ditemukan guru yang cocok dengan pencarian "${searchQuery}".`
                            : 'Tidak ada data Guru Mata Pelajaran.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {filteredUsers.length > 0 && (
                <div className="flex flex-col gap-2 border-t border-surface-2 px-4 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    Menampilkan {(currentPage - 1) * Number(pageSize) + 1}-{Math.min(currentPage * Number(pageSize), filteredUsers.length)} dari {filteredUsers.length} Guru Mata Pelajaran.
                    {selected.length > 0 ? ` (${selected.length} dipilih)` : ''}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage <= 1}
                      className="h-8 text-xs"
                    >
                      Sebelumnya
                    </Button>
                    <span className="min-w-20 text-center font-medium">Hal {currentPage} / {totalPages}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage >= totalPages}
                      className="h-8 text-xs"
                    >
                      Berikutnya
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* TAB 2: DOKUMEN SAYA (TU VIEW) */}
          <TabsContent value="saya" className="space-y-4">
            {dokumenSayaContent}
          </TabsContent>
        </Tabs>
      ) : (
        /* TEACHER VIEW (NON-MANAGE): DIRECT DOKUMEN SAYA */
        dokumenSayaContent
      )}
    </div>
  )
}
