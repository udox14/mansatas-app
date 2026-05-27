'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, FileText, Loader2, Printer, Search, X } from 'lucide-react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { AgendaKelasOption, AgendaKelasPageData } from '../actions'
import { getAdjacentAgendaKelasDate, getAgendaKelasCetakBulanan, getAgendaKelasHari, getAgendaKelasCetakJobs, getAgendaKelasCetakBatch } from '../actions'
import { AgendaKelasTemplate } from './agenda-kelas-template'

type Props = {
  daftarKelas: AgendaKelasOption[]
  today: string
}

function monthLabel(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) return month
  const [year, m] = month.split('-').map(Number)
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date(year, m - 1, 1))
}

function formatInfoDate(date: string) {
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(date + 'T00:00:00'))
}

function currentMonth() {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 7)
}

export function AgendaKelasClient({ daftarKelas, today }: Props) {
  const [selectedKelasId, setSelectedKelasId] = useState('')
  const [tanggal, setTanggal] = useState('')
  const [data, setData] = useState<AgendaKelasPageData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dayCacheRef = useRef<Map<string, AgendaKelasPageData | null>>(new Map())

  const selectedKelas = daftarKelas.find(k => k.id === selectedKelasId)

  const loadDay = async (kelasId: string, date: string) => {
    const cacheKey = `${kelasId}:${date}`
    if (dayCacheRef.current.has(cacheKey)) {
      setTanggal(date)
      setData(dayCacheRef.current.get(cacheKey) || null)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const res = await getAgendaKelasHari(kelasId, date)
      if (res.error) {
        setError(res.error)
        setData(null)
      } else {
        dayCacheRef.current.set(cacheKey, res.data)
        setTanggal(date)
        setData(res.data)
      }
    } catch {
      setError('Gagal memuat agenda kelas.')
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectKelas = (kelasId: string) => {
    setSelectedKelasId(kelasId)
    setTanggal('')
    setData(null)
    setError(null)
  }

  const handleDateChange = (value: string) => {
    setTanggal(value)
    if (selectedKelasId && value) loadDay(selectedKelasId, value)
  }

  const moveEffectiveDate = (direction: 'prev' | 'next') => {
    if (!tanggal || !selectedKelasId) return
    const cursor = new Date(tanggal + 'T00:00:00')
    cursor.setDate(cursor.getDate() + (direction === 'next' ? 1 : -1))
    const nextDate = cursor.toISOString().split('T')[0]
    handleDateChange(nextDate)
  }

  return (
    <div className="space-y-3">
      <style>{`
        @page {
          size: landscape;
          margin: 0;
        }
        @media print {
          [data-radix-dialog-overlay],
          [data-radix-dialog-content],
          .agenda-kelas-no-print {
            display: none !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
          }
        }
      `}</style>

      <div className="agenda-kelas-no-print bg-surface border border-surface rounded-lg p-3 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="p-1.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900">
            <FileText className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Preview Agenda Kelas</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {selectedKelas ? `${selectedKelas.label} ${tanggal ? '- ' + formatInfoDate(tanggal) : ''}` : 'Pilih kelas untuk memuat agenda'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedKelasId} onValueChange={handleSelectKelas}>
            <SelectTrigger className="h-9 w-full sm:w-64 text-xs">
              <SelectValue placeholder="Pilih kelas..." />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {daftarKelas.map(kelas => (
                <SelectItem key={kelas.id} value={kelas.id} className="text-xs">
                  {kelas.label} ({kelas.jumlah_siswa})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center rounded-md border border-surface bg-surface-2">
            <Button type="button" variant="ghost" size="sm" disabled={!selectedKelasId || !tanggal || loading} onClick={() => moveEffectiveDate('prev')} className="h-8 w-8 p-0">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input
              type="date"
              value={tanggal}
              onChange={e => handleDateChange(e.target.value)}
              disabled={!selectedKelasId || loading}
              className="h-8 w-36 border-0 bg-transparent text-xs shadow-none focus-visible:ring-0"
            />
            <Button type="button" variant="ghost" size="sm" disabled={!selectedKelasId || !tanggal || loading} onClick={() => moveEffectiveDate('next')} className="h-8 w-8 p-0">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <CetakAgendaKelasModal daftarKelas={daftarKelas} initialKelasId={selectedKelasId} />
        </div>
      </div>

      {error && (
        <div className="agenda-kelas-no-print rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {!selectedKelasId && (
        <div className="agenda-kelas-no-print h-72 rounded-lg border border-dashed border-surface bg-surface/60 flex flex-col items-center justify-center gap-3 text-slate-400">
          <CalendarDays className="h-10 w-10" />
          <p className="text-sm font-medium">Pilih kelas terlebih dahulu.</p>
        </div>
      )}

      {selectedKelasId && !tanggal && (
        <div className="agenda-kelas-no-print h-72 rounded-lg border border-dashed border-surface bg-surface/60 flex flex-col items-center justify-center gap-3 text-slate-400">
          <CalendarDays className="h-10 w-10 text-indigo-500 animate-pulse" />
          <p className="text-sm font-medium">Pilih tanggal terlebih dahulu untuk memuat agenda kelas.</p>
        </div>
      )}

      {loading && tanggal && (
        <div className="agenda-kelas-no-print h-72 rounded-lg border border-surface bg-surface flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Memuat agenda kelas...</p>
        </div>
      )}

      {!loading && tanggal && data && !data.calendarStatus.isEffective && (
        <div className="agenda-kelas-no-print rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {formatInfoDate(data.tanggal)} bukan hari efektif pembelajaran{data.calendarStatus.reason ? `: ${data.calendarStatus.reason}` : ''}.
        </div>
      )}

      {!loading && tanggal && data && data.calendarStatus.isEffective && !data.hasActiveBlocks && (
        <div className="agenda-kelas-no-print rounded-lg border border-slate-200 bg-surface p-4 text-sm text-slate-600 dark:text-slate-300">
          Tidak ada blok KBM aktif untuk kelas ini pada {formatInfoDate(data.tanggal)}.
        </div>
      )}

      {!loading && tanggal && data && data.calendarStatus.isEffective && data.hasActiveBlocks && (
        <div className="overflow-auto rounded-lg border border-surface bg-slate-100 dark:bg-slate-900 p-4">
          <div
            className="bg-white shadow-xl ring-1 ring-black/10 origin-top-left"
            style={{
              width: '330mm',
              transform: 'scale(0.58)',
              transformOrigin: 'top left',
              marginBottom: 'calc(215mm * -0.42 + 16px)',
            }}
          >
            <AgendaKelasTemplate data={data} />
          </div>
        </div>
      )}
    </div>
  )
}

function CetakAgendaKelasModal({ daftarKelas, initialKelasId }: { daftarKelas: AgendaKelasOption[]; initialKelasId: string }) {
  const [open, setOpen] = useState(false)
  const [selectedKelasIds, setSelectedKelasIds] = useState<string[]>([])
  const [selectedMonths, setSelectedMonths] = useState<string[]>([currentMonth()])
  const [monthInput, setMonthInput] = useState(currentMonth())
  const [pages, setPages] = useState<AgendaKelasPageData[]>([])
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressText, setProgressText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const printRef = useRef<HTMLDivElement>(null)

  const selectedLabel = useMemo(() => {
    if (pages.length) return `${pages.length} halaman siap cetak`
    const kelasCount = selectedKelasIds.length
    const monthCount = selectedMonths.length
    return `${kelasCount} kelas, ${monthCount} bulan`
  }, [pages.length, selectedKelasIds.length, selectedMonths.length])

  const handleOpen = () => {
    setOpen(true)
    setPages([])
    setError(null)
    setProgress(0)
    setProgressText('')
    if (initialKelasId) setSelectedKelasIds([initialKelasId])
  }

  const toggleKelas = (kelasId: string) => {
    setSelectedKelasIds(prev => prev.includes(kelasId) ? prev.filter(id => id !== kelasId) : [...prev, kelasId])
    setPages([])
  }

  const addMonth = () => {
    if (!monthInput) return
    setSelectedMonths(prev => prev.includes(monthInput) ? prev : [...prev, monthInput].sort())
    setPages([])
  }

  const removeMonth = (month: string) => {
    setSelectedMonths(prev => prev.filter(item => item !== month))
    setPages([])
  }

  const loadPrintData = async (shouldPrintAfterLoad = false) => {
    setLoading(true)
    setError(null)
    setPages([])
    setProgress(0)
    setProgressText('Menghubungkan...')
    try {
      const jobRes = await getAgendaKelasCetakJobs(selectedKelasIds, selectedMonths)
      if (jobRes.error) {
        setError(jobRes.error)
        setLoading(false)
        return
      }

      const jobs = jobRes.jobs
      if (jobs.length === 0) {
        setError('Tidak ada tanggal efektif KBM pada bulan yang dipilih.')
        setLoading(false)
        return
      }

      const allPages: AgendaKelasPageData[] = []
      const batchSize = 6
      
      for (let i = 0; i < jobs.length; i += batchSize) {
        const batch = jobs.slice(i, i + batchSize)
        const percent = Math.round((i / jobs.length) * 100)
        setProgress(percent)
        setProgressText(`Memuat ${i} dari ${jobs.length} hari...`)

        const batchRes = await getAgendaKelasCetakBatch(batch)
        if (batchRes.error) {
          setError(batchRes.error)
          setLoading(false)
          return
        }
        allPages.push(...batchRes.pages)
      }

      setProgress(100)
      setProgressText('Selesai memproses!')

      if (allPages.length === 0) {
        setError('Tidak ada halaman agenda dengan jam aktif pada bulan ini.')
      } else {
        setPages(allPages)
        if (shouldPrintAfterLoad) {
          setTimeout(() => {
            const el = printRef.current
            if (!el) return
            const w = window.open('', '_blank')
            if (!w) { alert('Popup diblokir browser. Izinkan popup untuk mencetak.'); return }
            w.document.write(`<!DOCTYPE html><html><head><title>Agenda Kelas</title>
<style>
@page { size: landscape; margin: 0; }
html, body { margin: 0; padding: 0; background: #fff; }
* { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
</style>
</head><body>${el.innerHTML}</body></html>`)
            w.document.close()
            const imgs = Array.from(w.document.images)
            const ready = imgs.length === 0
              ? Promise.resolve()
              : Promise.all(imgs.map(img => img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r })))
            ready.then(() => {
              w.focus()
              w.print()
            })
          }, 300)
        }
      }
    } catch {
      setError('Gagal memuat data cetak.')
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = useCallback(() => {
    const el = printRef.current
    if (!el) return
    const w = window.open('', '_blank')
    if (!w) { alert('Popup diblokir browser. Izinkan popup untuk mencetak.'); return }
    w.document.write(`<!DOCTYPE html><html><head><title>Agenda Kelas</title>
<style>
@page { size: landscape; margin: 0; }
html, body { margin: 0; padding: 0; background: #fff; }
* { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
</style>
</head><body>${el.innerHTML}</body></html>`)
    w.document.close()
    // Wait for images to load before printing
    const imgs = Array.from(w.document.images)
    const ready = imgs.length === 0
      ? Promise.resolve()
      : Promise.all(imgs.map(img => img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r })))
    ready.then(() => {
      w.focus()
      w.print()
    })
  }, [])

  const handlePrintClick = () => {
    if (pages.length > 0) {
      handlePrint()
    } else {
      loadPrintData(true)
    }
  }

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={handleOpen} className="h-9 gap-1.5 text-xs">
        <Printer className="h-3.5 w-3.5 text-indigo-500" />
        Cetak Bulanan
      </Button>

      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
          <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 h-[84vh] w-[96vw] max-w-6xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-surface bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b border-surface-2 bg-surface px-5 py-3">
              <div className="flex items-center gap-3">
                <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-1.5 dark:border-indigo-900 dark:bg-indigo-950/40">
                  <Printer className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Cetak Agenda Kelas</h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">F4 landscape - {selectedLabel}</p>
                </div>
              </div>
              <DialogPrimitive.Close className="rounded-md p-1.5 text-slate-400 hover:bg-surface-2">
                <X className="h-4 w-4" />
              </DialogPrimitive.Close>
            </div>

            <div className="flex h-[calc(84vh-53px)] flex-col sm:flex-row">
              <div className="w-full shrink-0 border-b border-surface-2 bg-surface-2/40 p-3 sm:w-72 sm:border-b-0 sm:border-r">
                <div className="space-y-3">
                  <div>
                    <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Pilih Kelas</p>
                    <div className="max-h-52 space-y-1 overflow-auto rounded-lg border border-surface bg-surface p-1.5">
                      {daftarKelas.map(kelas => (
                        <label key={kelas.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-surface-2">
                          <input type="checkbox" checked={selectedKelasIds.includes(kelas.id)} onChange={() => toggleKelas(kelas.id)} />
                          <span className="min-w-0 flex-1 truncate">{kelas.label}</span>
                          <span className="text-[10px] text-slate-400">{kelas.jumlah_siswa}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Pilih Bulan</p>
                    <div className="rounded-lg border border-surface bg-surface p-2">
                      <div className="flex gap-1.5">
                        <Input type="month" value={monthInput} onChange={e => setMonthInput(e.target.value)} className="h-8 text-xs" />
                        <Button type="button" variant="outline" size="sm" onClick={addMonth} className="h-8 px-2 text-xs">Tambah</Button>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {selectedMonths.map(month => (
                          <button key={month} type="button" onClick={() => removeMonth(month)} className="rounded border border-indigo-100 bg-indigo-50 px-2 py-1 text-[11px] text-indigo-700 hover:bg-indigo-100">
                            {monthLabel(month)} x
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {error && <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">{error}</div>}

                <div className="mt-3 space-y-1.5">
                  <Button type="button" onClick={() => loadPrintData(false)} disabled={loading || selectedKelasIds.length === 0 || selectedMonths.length === 0} className="h-9 w-full gap-2 text-xs">
                    {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                    Muat Preview
                  </Button>
                  <Button type="button" onClick={handlePrintClick} disabled={loading || selectedKelasIds.length === 0 || selectedMonths.length === 0} variant="outline" className="h-9 w-full gap-2 text-xs">
                    <Printer className="h-3.5 w-3.5" />
                    Cetak Sekarang
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-auto bg-slate-100 p-4 dark:bg-slate-900">
                {loading && (
                  <div className="flex h-full flex-col items-center justify-center max-w-sm mx-auto px-4 py-12">
                    <div className="relative flex items-center justify-center mb-5">
                      <div className="h-16 w-16 rounded-full border-4 border-indigo-200/50 dark:border-indigo-950 border-t-indigo-600 dark:border-t-indigo-400 animate-spin" />
                      <span className="absolute text-xs font-bold text-indigo-600 dark:text-indigo-400">{progress}%</span>
                    </div>
                    <div className="w-full space-y-3">
                      <div className="flex justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                        <span>{progressText}</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                        <div 
                          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-600 transition-all duration-300 ease-out"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}
                {!loading && pages.length === 0 && (
                  <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-400">
                    <FileText className="h-10 w-10" />
                    <p className="text-sm font-medium">Muat preview untuk melihat halaman cetak.</p>
                  </div>
                )}
                {!loading && pages.length > 0 && (
                  <div className="space-y-6">
                    {pages.map((page, index) => (
                      <div key={`${page.kelas.id}-${page.tanggal}`}>
                        <div className="mb-2 text-[11px] font-semibold text-slate-500">
                          Halaman {index + 1} - {page.kelas.label} - {formatInfoDate(page.tanggal)}
                        </div>
                        <div className="origin-top-left bg-white shadow-xl ring-1 ring-black/10" style={{ width: '330mm', transform: 'scale(0.44)', transformOrigin: 'top left', marginBottom: 'calc(215mm * -0.56 + 16px)' }}>
                          <AgendaKelasTemplate data={page} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <div ref={printRef} style={{ position: 'absolute', left: '-99999px', top: 0 }}>
        {pages.map((page, index) => (
          <AgendaKelasTemplate key={`${page.kelas.id}-${page.tanggal}-print`} data={page} pageBreak={index > 0} />
        ))}
      </div>
    </>
  )
}
