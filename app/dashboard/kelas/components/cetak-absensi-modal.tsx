// Lokasi: app/dashboard/kelas/components/cetak-absensi-modal.tsx
'use client'

import { useState, useRef } from 'react'
import { useReactToPrint } from 'react-to-print'
import { Printer, Loader2, X, FileText, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { getDataBlankAbsensi, getDataBlankAbsensiByTingkat, type BlankAbsensiData } from '../actions-print'
import { BlankoAbsensiTemplate } from './blanko-absensi-template'

type KelasOption = {
  id: string
  tingkat: number
  nomor_kelas: string
  kelompok: string
  jumlah_siswa: number
}

type FilterMode = 'satu' | '10' | '11' | '12' | 'semua'

interface CetakAbsensiModalProps {
  daftarKelas: KelasOption[]
}

export function CetakAbsensiModal({ daftarKelas }: CetakAbsensiModalProps) {
  const [open, setOpen] = useState(false)
  const [filterMode, setFilterMode] = useState<FilterMode>('satu')
  const [selectedKelasId, setSelectedKelasId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [previewDataList, setPreviewDataList] = useState<BlankAbsensiData[]>([])
  const [error, setError] = useState<string | null>(null)
  const printRef = useRef<HTMLDivElement>(null)

  const tanggalCetak = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  // Sort kelas
  const sortedKelas = [...daftarKelas].sort((a, b) => {
    if (a.tingkat !== b.tingkat) return a.tingkat - b.tingkat
    return a.nomor_kelas.localeCompare(b.nomor_kelas, undefined, { numeric: true })
  })
  const grouped = sortedKelas.reduce<Record<number, KelasOption[]>>((acc, k) => {
    if (!acc[k.tingkat]) acc[k.tingkat] = []
    acc[k.tingkat].push(k)
    return acc
  }, {})

  // Hitung jumlah kelas per tingkat (untuk label tombol)
  const countByTingkat = (t: number) => sortedKelas.filter(k => k.tingkat === t).length

  const handleOpen = () => {
    setOpen(true)
    setFilterMode('satu')
    setSelectedKelasId('')
    setPreviewDataList([])
    setError(null)
  }

  const loadData = async (mode: FilterMode, kelasId?: string) => {
    setPreviewDataList([])
    setError(null)
    setIsLoading(true)
    try {
      if (mode === 'satu') {
        if (!kelasId) { setIsLoading(false); return }
        const data = await getDataBlankAbsensi(kelasId)
        if (!data) setError('Data kelas tidak ditemukan.')
        else setPreviewDataList([data])
      } else {
        const tingkat = mode === 'semua' ? 'semua' : mode
        const dataList = await getDataBlankAbsensiByTingkat(tingkat as any)
        if (dataList.length === 0) setError('Tidak ada kelas ditemukan.')
        else setPreviewDataList(dataList)
      }
    } catch {
      setError('Gagal memuat data. Coba lagi.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleFilterMode = (mode: FilterMode) => {
    setFilterMode(mode)
    setSelectedKelasId('')
    setPreviewDataList([])
    setError(null)
    if (mode !== 'satu') loadData(mode)
  }

  const handleSelectKelas = (kelasId: string) => {
    setSelectedKelasId(kelasId)
    loadData('satu', kelasId)
  }

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: previewDataList.length === 1
      ? `Blanko Absensi Kelas ${previewDataList[0].kelas.tingkat}.${previewDataList[0].kelas.nomor_kelas}`
      : `Blanko Absensi`,
    pageStyle: `
      @page { size: 215mm 330mm; margin: 0; }
      @media print {
        html, body { margin: 0; padding: 0; background: white; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      }
    `,
  })

  const previewLabel = (() => {
    if (previewDataList.length === 0) return null
    if (previewDataList.length === 1) {
      const k = previewDataList[0].kelas
      return `Kelas ${k.tingkat}.${k.nomor_kelas}`
    }
    return `${previewDataList.length} kelas`
  })()

  // Opsi filter
  const filterOptions: { mode: FilterMode; label: string; sub: string }[] = [
    { mode: 'satu', label: 'Pilih 1 Kelas', sub: 'Preview sebelum cetak' },
    { mode: '10', label: 'Semua Kelas 10', sub: `${countByTingkat(10)} kelas` },
    { mode: '11', label: 'Semua Kelas 11', sub: `${countByTingkat(11)} kelas` },
    { mode: '12', label: 'Semua Kelas 12', sub: `${countByTingkat(12)} kelas` },
    { mode: 'semua', label: 'Semua Kelas', sub: `${sortedKelas.length} kelas` },
  ]

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
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[96vw] max-w-5xl rounded-xl border border-surface bg-background shadow-2xl overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          >
            {/* ── Header ── */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-surface-2 bg-surface shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900">
                  <FileText className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Cetak Blanko Absensi</h2>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    Format F4 · {previewLabel ? <span className="text-indigo-500 font-medium">{previewLabel} siap cetak</span> : 'Pilih kelas atau tingkat'}
                  </p>
                </div>
              </div>
              <DialogPrimitive.Close className="p-1.5 rounded-md hover:bg-surface-2 text-slate-400 dark:text-slate-500 transition-colors">
                <X className="h-4 w-4" />
              </DialogPrimitive.Close>
            </div>

            {/* ── Body ── */}
            <div className="flex flex-col sm:flex-row" style={{ height: '80vh' }}>

              {/* ─ Sidebar ─ */}
              <div className="shrink-0 w-full sm:w-56 border-b sm:border-b-0 sm:border-r border-surface-2 bg-surface-2/40 p-3 flex flex-col gap-2 overflow-y-auto">

                {/* Filter mode buttons */}
                <div>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
                    Pilih Cetak
                  </p>
                  <div className="space-y-1">
                    {filterOptions.map(opt => (
                      <button
                        key={opt.mode}
                        onClick={() => handleFilterMode(opt.mode)}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-colors text-xs ${
                          filterMode === opt.mode
                            ? 'bg-indigo-600 text-white'
                            : 'bg-surface hover:bg-surface-2 text-slate-700 dark:text-slate-200 border border-surface'
                        }`}
                      >
                        <div>
                          <div className="font-medium leading-tight">{opt.label}</div>
                          <div className={`text-[10px] mt-0.5 ${filterMode === opt.mode ? 'text-indigo-200' : 'text-slate-400 dark:text-slate-500'}`}>
                            {opt.sub}
                          </div>
                        </div>
                        {filterMode === opt.mode && <ChevronRight className="h-3 w-3 shrink-0 ml-1" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pilih kelas individual (hanya muncul jika mode = 'satu') */}
                {filterMode === 'satu' && (
                  <div className="mt-1">
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
                      Pilih Kelas
                    </p>
                    <div className="space-y-0.5 max-h-52 overflow-y-auto pr-0.5">
                      {Object.entries(grouped).map(([tingkat, kelasList]) => (
                        <div key={tingkat}>
                          <div className="px-1 py-0.5 text-[9px] font-bold text-slate-300 dark:text-slate-600 uppercase tracking-wider">
                            Kelas {tingkat}
                          </div>
                          {kelasList.map(k => (
                            <button
                              key={k.id}
                              onClick={() => handleSelectKelas(k.id)}
                              className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                                selectedKelasId === k.id
                                  ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-200 dark:border-indigo-800'
                                  : 'hover:bg-surface-2 text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              {k.tingkat}.{k.nomor_kelas}
                              {k.kelompok !== 'UMUM' ? ` · ${k.kelompok}` : ''}
                              <span className="ml-1 text-[10px] text-slate-400 dark:text-slate-500">({k.jumlah_siswa})</span>
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Info setelah data loaded */}
                {previewDataList.length > 0 && !isLoading && filterMode !== 'satu' && (
                  <div className="mt-1 bg-surface border border-surface rounded-lg p-2.5 text-xs space-y-1">
                    <div className="flex justify-between text-slate-400 dark:text-slate-500">
                      <span>Jumlah kelas</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">{previewDataList.length}</span>
                    </div>
                    <div className="flex justify-between text-slate-400 dark:text-slate-500">
                      <span>Total siswa</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        {previewDataList.reduce((a, d) => a + d.siswa.length, 0)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Tombol cetak */}
                <div className="mt-auto pt-2 space-y-1.5">
                  <Button
                    onClick={() => handlePrint()}
                    disabled={previewDataList.length === 0 || isLoading}
                    className="w-full h-9 text-xs gap-2 bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40"
                  >
                    {isLoading
                      ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Memuat...</>
                      : <><Printer className="h-3.5 w-3.5" />
                          {previewDataList.length > 1 ? `Cetak ${previewDataList.length} Halaman` : 'Cetak Sekarang'}
                        </>
                    }
                  </Button>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center">
                    Atur kertas ke F4 (215×330 mm)
                  </p>
                </div>
              </div>

              {/* ─ Preview ─ */}
              <div className="flex-1 overflow-auto bg-slate-100 dark:bg-slate-900 p-4">

                {/* Kosong */}
                {!isLoading && previewDataList.length === 0 && !error && (
                  <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-400 dark:text-slate-600">
                    <div className="p-4 rounded-full bg-slate-200 dark:bg-slate-800">
                      <FileText className="h-8 w-8" />
                    </div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                      {filterMode === 'satu' ? 'Pilih kelas untuk melihat preview' : 'Memilih tingkat...'}
                    </p>
                  </div>
                )}

                {/* Loading */}
                {isLoading && (
                  <div className="h-full flex flex-col items-center justify-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                    <p className="text-sm text-slate-500 dark:text-slate-400">Memuat data siswa...</p>
                  </div>
                )}

                {/* Error */}
                {error && !isLoading && (
                  <div className="h-full flex items-center justify-center">
                    <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 text-rose-600 text-sm">{error}</div>
                  </div>
                )}

                {/* Preview */}
                {previewDataList.length > 0 && !isLoading && (
                  <div className="space-y-6">
                    {/* Hidden print targets */}
                    <div className="sr-only">
                      <div ref={printRef}>
                        {previewDataList.map((data, idx) => (
                          <BlankoAbsensiTemplate
                            key={data.kelas.id}
                            data={data}
                            tanggalCetak={tanggalCetak}
                            pageBreak={idx > 0}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Visible preview — scale down agar pas di layar */}
                    {previewDataList.map((data, idx) => (
                      <div key={data.kelas.id}>
                        {previewDataList.length > 1 && (
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded">
                              Halaman {idx + 1} — Kelas {data.kelas.tingkat}.{data.kelas.nomor_kelas}
                            </span>
                          </div>
                        )}
                        <div
                          className="bg-white shadow-xl ring-1 ring-black/10 origin-top"
                          style={{
                            width: '215mm',
                            transform: 'scale(0.68)',
                            transformOrigin: 'top left',
                            marginBottom: `calc((215mm * 0.68 * 1.535) - (215mm * 1.535) + 16px)`,
                          }}
                        >
                          <BlankoAbsensiTemplate data={data} tanggalCetak={tanggalCetak} pageBreak={false} />
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
    </>
  )
}