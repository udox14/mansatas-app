// Lokasi: app/dashboard/kelas/components/cetak-absensi-modal.tsx
'use client'

import { useState, useRef } from 'react'
import { useReactToPrint } from 'react-to-print'
import { Printer, Loader2, X, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getDataBlankAbsensi, type BlankAbsensiData } from '../actions-print'
import { BlankoAbsensiTemplate } from './blanko-absensi-template'

type KelasOption = {
  id: string
  tingkat: number
  nomor_kelas: string
  kelompok: string
  jumlah_siswa: number
}

interface CetakAbsensiModalProps {
  daftarKelas: KelasOption[]
}

export function CetakAbsensiModal({ daftarKelas }: CetakAbsensiModalProps) {
  const [open, setOpen] = useState(false)
  const [selectedKelasId, setSelectedKelasId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [previewData, setPreviewData] = useState<BlankAbsensiData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const printRef = useRef<HTMLDivElement>(null)

  const tanggalCetak = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const sortedKelas = [...daftarKelas].sort((a, b) => {
    if (a.tingkat !== b.tingkat) return a.tingkat - b.tingkat
    return a.nomor_kelas.localeCompare(b.nomor_kelas, undefined, { numeric: true })
  })
  const grouped = sortedKelas.reduce<Record<number, KelasOption[]>>((acc, k) => {
    if (!acc[k.tingkat]) acc[k.tingkat] = []
    acc[k.tingkat].push(k)
    return acc
  }, {})

  const handleSelectKelas = async (kelasId: string) => {
    setSelectedKelasId(kelasId)
    setPreviewData(null)
    setError(null)
    if (!kelasId) return
    setIsLoading(true)
    try {
      const data = await getDataBlankAbsensi(kelasId)
      if (!data) setError('Data kelas tidak ditemukan.')
      else setPreviewData(data)
    } catch {
      setError('Gagal memuat data. Coba lagi.')
    } finally {
      setIsLoading(false)
    }
  }

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: previewData
      ? `Blanko Absensi Kelas ${previewData.kelas.tingkat}.${previewData.kelas.nomor_kelas}`
      : 'Blanko Absensi',
    pageStyle: `
      @page {
        size: 215mm 330mm;
        margin: 0;
      }
      @media print {
        html, body { margin: 0; padding: 0; background: white; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      }
    `,
  })

  const handleOpen = () => {
    setOpen(true)
    setSelectedKelasId('')
    setPreviewData(null)
    setError(null)
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleOpen}
        className="h-8 text-xs gap-1.5 border-surface bg-surface hover:bg-surface-2"
      >
        <Printer className="h-3.5 w-3.5 text-indigo-500" />
        Cetak Absensi
      </Button>

      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[95vw] max-w-5xl rounded-xl border border-surface bg-background shadow-2xl overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-surface-2 bg-surface shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900">
                  <FileText className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Cetak Blanko Absensi</h2>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">Format F4 · Pilih kelas lalu klik Cetak</p>
                </div>
              </div>
              <DialogPrimitive.Close className="p-1.5 rounded-md hover:bg-surface-2 text-slate-400 dark:text-slate-500 transition-colors">
                <X className="h-4 w-4" />
              </DialogPrimitive.Close>
            </div>

            {/* Body */}
            <div className="flex flex-col sm:flex-row" style={{ height: '78vh' }}>

              {/* Sidebar */}
              <div className="shrink-0 w-full sm:w-60 border-b sm:border-b-0 sm:border-r border-surface-2 bg-surface-2/40 p-4 flex flex-col gap-3 overflow-y-auto">
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1.5">
                    Pilih Kelas
                  </label>
                  <Select value={selectedKelasId} onValueChange={handleSelectKelas}>
                    <SelectTrigger className="h-8 text-xs bg-surface border-surface">
                      <SelectValue placeholder="— Pilih kelas —" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(grouped).map(([tingkat, kelasList]) => (
                        <div key={tingkat}>
                          <div className="px-2 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                            Kelas {tingkat}
                          </div>
                          {kelasList.map(k => (
                            <SelectItem key={k.id} value={k.id} className="text-xs">
                              {k.tingkat}.{k.nomor_kelas}
                              {k.kelompok !== 'UMUM' ? ` · ${k.kelompok}` : ''}
                              <span className="ml-1 text-slate-400 dark:text-slate-500">({k.jumlah_siswa})</span>
                            </SelectItem>
                          ))}
                        </div>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {previewData && !isLoading && (
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Info Kelas</div>
                    <div className="text-xs text-slate-700 dark:text-slate-200 bg-surface border border-surface rounded-lg p-3 space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-slate-400 dark:text-slate-500">Kelas</span>
                        <span className="font-semibold">{previewData.kelas.tingkat}.{previewData.kelas.nomor_kelas}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 dark:text-slate-500">Total siswa</span>
                        <span className="font-semibold">{previewData.siswa.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 dark:text-slate-500">L / P</span>
                        <span className="font-semibold">{previewData.jumlah_l} / {previewData.jumlah_p}</span>
                      </div>
                      <div className="pt-1.5 border-t border-surface-2 text-[10px] text-slate-400 dark:text-slate-500 leading-snug">
                        Wali Kelas:<br />
                        <span className="font-medium text-slate-600 dark:text-slate-300">{previewData.kelas.wali_kelas_nama}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-auto pt-2">
                  <Button
                    onClick={() => handlePrint()}
                    disabled={!previewData || isLoading}
                    className="w-full h-9 text-xs gap-2 bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50"
                  >
                    {isLoading
                      ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Memuat...</>
                      : <><Printer className="h-3.5 w-3.5" />Cetak Sekarang</>
                    }
                  </Button>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center mt-1.5">
                    Pastikan ukuran kertas F4 (215×330 mm)
                  </p>
                </div>
              </div>

              {/* Preview area */}
              <div className="flex-1 overflow-auto bg-slate-100 dark:bg-slate-900 p-5">

                {!selectedKelasId && (
                  <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-400 dark:text-slate-600">
                    <div className="p-5 rounded-full bg-slate-200 dark:bg-slate-800">
                      <FileText className="h-9 w-9" />
                    </div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Pilih kelas untuk melihat preview</p>
                    <p className="text-xs text-center max-w-xs text-slate-400 dark:text-slate-600">
                      Blanko akan ditampilkan sesuai format daftar hadir resmi MAN 1 Tasikmalaya
                    </p>
                  </div>
                )}

                {selectedKelasId && isLoading && (
                  <div className="h-full flex flex-col items-center justify-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                    <p className="text-sm text-slate-500 dark:text-slate-400">Memuat data siswa...</p>
                  </div>
                )}

                {error && !isLoading && (
                  <div className="h-full flex items-center justify-center">
                    <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 text-rose-600 text-sm">{error}</div>
                  </div>
                )}

                {previewData && !isLoading && (
                  <div className="flex justify-center">
                    {/* Hidden target untuk react-to-print */}
                    <div className="sr-only">
                      <BlankoAbsensiTemplate ref={printRef} data={previewData} tanggalCetak={tanggalCetak} />
                    </div>

                    {/* Preview on-screen (scale down agar fit di modal) */}
                    <div
                      className="bg-white shadow-xl ring-1 ring-black/10 origin-top"
                      style={{
                        width: '210mm',
                        transform: 'scale(0.7)',
                        transformOrigin: 'top center',
                        marginBottom: '-30%',
                      }}
                    >
                      <BlankoAbsensiTemplate data={previewData} tanggalCetak={tanggalCetak} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  )
}