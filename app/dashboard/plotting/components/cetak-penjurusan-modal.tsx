'use client'

import { useMemo, useRef, useState } from 'react'
import { useReactToPrint } from 'react-to-print'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { ChevronRight, FileText, Loader2, Printer, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BlankoPenjurusanTemplate, type PenjurusanPrintData } from './blanko-penjurusan-template'

type SiswaPenjurusan = {
  id: string
  nisn: string
  nis_lokal?: string | null
  nama_lengkap: string
  jenis_kelamin: string
  kelas_lama: string
}

type Mode = 'satu' | 'semua'

type Props = {
  siswaList: SiswaPenjurusan[]
  penjurusan: Record<string, string>
  tahunAjaranLabel?: string
}

export function CetakPenjurusanModal({ siswaList, penjurusan, tahunAjaranLabel = '-' }: Props) {
  const isMobile = typeof window !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(window.navigator.userAgent)
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('satu')
  const [selectedKelas, setSelectedKelas] = useState('')
  const printRef = useRef<HTMLDivElement>(null)

  const tanggalCetak = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  const kelasOptions = useMemo(() =>
    Array.from(new Set(siswaList.map(s => s.kelas_lama).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })),
    [siswaList]
  )

  const buildData = (kelas: string): PenjurusanPrintData => {
    const rows = siswaList
      .filter(s => s.kelas_lama === kelas)
      .sort((a, b) => a.nama_lengkap.localeCompare(b.nama_lengkap))
      .map((s, i) => ({
        urut: i + 1,
        nis: s.nis_lokal || '-',
        nisn: s.nisn || '-',
        nama_lengkap: s.nama_lengkap,
        jenis_kelamin: s.jenis_kelamin,
        tiket_jurusan: penjurusan[s.id] || '-',
      }))

    return {
      kelas_lama: kelas,
      tahun_ajaran_label: tahunAjaranLabel,
      siswa: rows,
      jumlah_l: rows.filter(s => s.jenis_kelamin === 'L').length,
      jumlah_p: rows.filter(s => s.jenis_kelamin === 'P').length,
    }
  }

  const previewDataList = useMemo(() => {
    if (mode === 'semua') return kelasOptions.map(buildData)
    if (!selectedKelas) return []
    return [buildData(selectedKelas)]
  }, [mode, selectedKelas, kelasOptions, siswaList, penjurusan, tahunAjaranLabel])

  const handleOpen = () => {
    setOpen(true)
    setMode('satu')
    setSelectedKelas(kelasOptions[0] || '')
  }

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: previewDataList.length === 1
      ? `Tiket Jurusan Kelas ${previewDataList[0].kelas_lama}`
      : 'Tiket Jurusan Per Kelas',
    pageStyle: `
      @page { size: 215mm 330mm; margin: 0; }
      @media print {
        html, body { margin: 0; padding: 0; background: white; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      }
    `,
  })

  const handlePrintAction = () => {
    if (isMobile) {
      setOpen(false)
      setTimeout(() => handlePrint(), 250)
      return
    }
    handlePrint()
  }

  const previewLabel = previewDataList.length === 1
    ? `Kelas ${previewDataList[0].kelas_lama}`
    : previewDataList.length > 1
      ? `${previewDataList.length} kelas`
      : 'Pilih kelas'

  return (
    <>
      <style>{`
        @media print {
          [data-radix-dialog-overlay],
          [data-radix-dialog-content] {
            display: none !important;
            visibility: hidden !important;
          }
        }
      `}</style>
      <Button
        variant="outline"
        size="sm"
        onClick={handleOpen}
        className="h-8 text-xs gap-1.5 border-surface bg-surface hover:bg-surface-2"
      >
        <Printer className="h-3.5 w-3.5 text-indigo-500" />
        Cetak Mading
      </Button>

      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[96vw] max-w-5xl rounded-xl border border-surface bg-background shadow-2xl overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-surface-2 bg-surface shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900">
                  <FileText className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Cetak Tiket Jurusan</h2>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    Format F4 per kelas asal - <span className="text-indigo-500 font-medium">{previewLabel}</span>
                  </p>
                </div>
              </div>
              <DialogPrimitive.Close className="p-1.5 rounded-md hover:bg-surface-2 text-slate-400 dark:text-slate-500 transition-colors">
                <X className="h-4 w-4" />
              </DialogPrimitive.Close>
            </div>

            <div className="flex flex-col sm:flex-row" style={{ height: '80vh' }}>
              <div className="shrink-0 w-full sm:w-56 border-b sm:border-b-0 sm:border-r border-surface-2 bg-surface-2/40 p-3 flex flex-col gap-2 overflow-y-auto">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Pilih Cetak</p>
                  <div className="space-y-1">
                    <button
                      onClick={() => setMode('satu')}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-colors text-xs ${
                        mode === 'satu' ? 'bg-indigo-600 text-white' : 'bg-surface hover:bg-surface-2 text-slate-700 dark:text-slate-200 border border-surface'
                      }`}
                    >
                      <div>
                        <div className="font-medium leading-tight">Pilih 1 Kelas</div>
                        <div className={`text-[10px] mt-0.5 ${mode === 'satu' ? 'text-indigo-200' : 'text-slate-400 dark:text-slate-500'}`}>Preview sebelum cetak</div>
                      </div>
                      {mode === 'satu' && <ChevronRight className="h-3 w-3 shrink-0 ml-1" />}
                    </button>
                    <button
                      onClick={() => setMode('semua')}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-colors text-xs ${
                        mode === 'semua' ? 'bg-indigo-600 text-white' : 'bg-surface hover:bg-surface-2 text-slate-700 dark:text-slate-200 border border-surface'
                      }`}
                    >
                      <div>
                        <div className="font-medium leading-tight">Semua Kelas 10</div>
                        <div className={`text-[10px] mt-0.5 ${mode === 'semua' ? 'text-indigo-200' : 'text-slate-400 dark:text-slate-500'}`}>{kelasOptions.length} halaman</div>
                      </div>
                      {mode === 'semua' && <ChevronRight className="h-3 w-3 shrink-0 ml-1" />}
                    </button>
                  </div>
                </div>

                {mode === 'satu' && (
                  <div className="mt-1">
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Pilih Kelas</p>
                    <div className="space-y-0.5 max-h-64 overflow-y-auto pr-0.5">
                      {kelasOptions.map(kelas => {
                        const count = siswaList.filter(s => s.kelas_lama === kelas).length
                        return (
                          <button
                            key={kelas}
                            onClick={() => setSelectedKelas(kelas)}
                            className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                              selectedKelas === kelas
                                ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-200 dark:border-indigo-800'
                                : 'hover:bg-surface-2 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {kelas}
                            <span className="ml-1 text-[10px] text-slate-400 dark:text-slate-500">({count})</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div className="mt-auto pt-2 space-y-1.5">
                  <Button
                    onClick={handlePrintAction}
                    disabled={previewDataList.length === 0}
                    className="w-full h-9 text-xs gap-2 bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    {previewDataList.length > 1
                      ? (isMobile ? `Simpan PDF ${previewDataList.length} Halaman` : `Cetak ${previewDataList.length} Halaman`)
                      : (isMobile ? 'Simpan PDF' : 'Cetak Sekarang')}
                  </Button>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center">Atur kertas ke F4 (215x330 mm)</p>
                </div>
              </div>

              <div className="flex-1 overflow-auto bg-slate-100 dark:bg-slate-900 p-4">
                {previewDataList.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-400 dark:text-slate-600">
                    <div className="p-4 rounded-full bg-slate-200 dark:bg-slate-800">
                      <FileText className="h-8 w-8" />
                    </div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Pilih kelas untuk melihat preview</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {previewDataList.map((data, idx) => (
                      <div key={data.kelas_lama}>
                        {previewDataList.length > 1 && (
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded">
                              Halaman {idx + 1} - Kelas {data.kelas_lama}
                            </span>
                          </div>
                        )}
                        <div
                          className="bg-white dark:bg-slate-900 shadow-xl ring-1 ring-black/10 origin-top"
                          style={{
                            width: '215mm',
                            transform: 'scale(0.68)',
                            transformOrigin: 'top left',
                            marginBottom: `calc((215mm * 0.68 * 1.535) - (215mm * 1.535) + 16px)`,
                          }}
                        >
                          <BlankoPenjurusanTemplate data={data} tanggalCetak={tanggalCetak} />
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

      <div
        id="plotting-penjurusan-print-root"
        ref={printRef}
        className="absolute -left-[100000px] top-0 print:static print:left-auto"
      >
        {previewDataList.map((data, idx) => (
          <BlankoPenjurusanTemplate
            key={data.kelas_lama}
            data={data}
            tanggalCetak={tanggalCetak}
            pageBreak={idx > 0}
          />
        ))}
      </div>
    </>
  )
}
