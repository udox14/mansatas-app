// Lokasi: app/dashboard/tka/components/cetak-rekap-modal.tsx
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useReactToPrint } from 'react-to-print'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { ChevronRight, FileText, Printer, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getRekapMapelPilihan, getSiswaRekapTka } from '../actions'
import type { TkaSiswaRekapRow, TkaRekapItem } from '../actions'
import { MAPEL_PILIHAN_OPTIONS_SORTED } from '../constants'
import { naturalSort } from '@/lib/natural-sort'
import { RENCANA_LABEL } from '@/lib/pendidikan-lanjutan'
import {
  TkaRekapJumlahTemplate,
  TkaRekapKelasTemplate,
  TkaRekapMapelTemplate,
  type TkaJumlahPrintData,
  type TkaKelasPrintData,
  type TkaMapelPrintData,
} from './tka-print-templates'

export type CetakMode = 'jumlah' | 'kelas' | 'mapel'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialMode: CetakMode
  tahunAjaranId: string
  tahunAjaranLabel: string
  initialKelas?: string
}

const kelasLabel = (k: { tingkat: number | null; nomor_kelas: string | null; kelompok: string | null }) =>
  k.tingkat ? `${k.tingkat}-${k.nomor_kelas} ${k.kelompok}` : '-'

export function CetakRekapModal({
  open,
  onOpenChange,
  initialMode,
  tahunAjaranId,
  tahunAjaranLabel,
  initialKelas = '',
}: Props) {
  const isMobile = typeof window !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(window.navigator.userAgent)

  const [mode, setMode] = useState<CetakMode>(initialMode)
  const [selKelas, setSelKelas] = useState(initialKelas)
  const [selMapel, setSelMapel] = useState('')

  const [loading, setLoading] = useState(true)
  const [jumlah, setJumlah] = useState<TkaRekapItem[] | null>(null)
  const [siswaSemua, setSiswaSemua] = useState<TkaSiswaRekapRow[]>([])

  const printRef = useRef<HTMLDivElement>(null)

  // Ambil data tiap kali dialog dibuka (komponen di-remount via key per sesi)
  useEffect(() => {
    if (!open) return
    let cancelled = false
    Promise.all([
      getRekapMapelPilihan(tahunAjaranId),
      getSiswaRekapTka(tahunAjaranId, {}),
    ]).then(([j, semua]) => {
      if (cancelled) return
      setJumlah(j)
      setSiswaSemua(semua)
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [open, tahunAjaranId])

  const kelasOptions = useMemo(() => {
    const seen = new Set<string>()
    const list: string[] = []
    for (const r of siswaSemua) {
      const label = kelasLabel(r)
      if (!seen.has(label)) {
        seen.add(label)
        list.push(label)
      }
    }
    return naturalSort(list, s => s)
  }, [siswaSemua])

  const mapelOptions = useMemo(() => {
    const seen = new Set<string>()
    for (const row of siswaSemua) {
      if (row.mapel_pilihan1) seen.add(row.mapel_pilihan1)
      if (row.mapel_pilihan2) seen.add(row.mapel_pilihan2)
    }
    return naturalSort(Array.from(seen), s => s)
  }, [siswaSemua])

  // ============================================================
  // Bangun data cetak sesuai mode
  // ============================================================
  const jumlahPrintData = useMemo<TkaJumlahPrintData | null>(() => {
    if (!jumlah) return null
    const rows = naturalSort(jumlah, item => item.mapel)
    return {
      tahun_ajaran_label: tahunAjaranLabel,
      rows,
      total_pemilihan: rows.reduce((sum, row) => sum + Number(row.jumlah || 0), 0),
    }
  }, [jumlah, tahunAjaranLabel])

  const kelasPrintDataList = useMemo<TkaKelasPrintData[]>(() => {
    const groups = new Map<string, TkaSiswaRekapRow[]>()
    for (const r of siswaSemua) {
      const label = kelasLabel(r)
      if (!groups.has(label)) groups.set(label, [])
      groups.get(label)!.push(r)
    }
    const keys = naturalSort(Array.from(groups.keys()), s => s)
    const list = keys
      .filter(k => !selKelas || k === selKelas)
      .map(key => {
        const rows = naturalSort(groups.get(key)!, r => r.nama_lengkap)
        return {
          group_label: key,
          tahun_ajaran_label: tahunAjaranLabel,
          siswa: rows.map(r => ({
            nisn: r.nisn || '-',
            nama_lengkap: r.nama_lengkap,
            jenis_kelamin: r.jenis_kelamin,
            kelas: key,
            mapel_tka: [r.mapel_pilihan1, r.mapel_pilihan2].filter(Boolean).join(' / ') || '-',
            rencana: RENCANA_LABEL[r.rencana_kategori ?? 'KULIAH'],
            pilihan_pendidikan1: [r.pilihan1_kampus_nama, r.pilihan1_prodi].filter(Boolean).join(' · ') || '-',
            pilihan_pendidikan2: [r.pilihan2_kampus_nama, r.pilihan2_prodi].filter(Boolean).join(' · ') || '-',
            catatan_rencana: r.rencana_catatan || '-',
          })),
          jumlah_l: rows.filter(r => r.jenis_kelamin === 'L').length,
          jumlah_p: rows.filter(r => r.jenis_kelamin === 'P').length,
        }
      })
    return list
  }, [siswaSemua, selKelas, tahunAjaranLabel])

  const mapelPrintDataList = useMemo<TkaMapelPrintData[]>(() => {
    const groups = new Map<string, TkaSiswaRekapRow[]>()
    for (const row of siswaSemua) {
      const mapels = new Set([row.mapel_pilihan1, row.mapel_pilihan2].filter((value): value is string => Boolean(value)))
      for (const mapel of mapels) {
        if (!groups.has(mapel)) groups.set(mapel, [])
        groups.get(mapel)!.push(row)
      }
    }
    const keys = naturalSort(Array.from(groups.keys()), s => s)
    return keys
      .filter(k => !selMapel || k === selMapel)
      .map(key => ({
        group_label: key,
        tahun_ajaran_label: tahunAjaranLabel,
        siswa: naturalSort(groups.get(key)!, r => r.nama_lengkap).map(r => ({
          nisn: r.nisn || '-',
          nama_lengkap: r.nama_lengkap,
          jenis_kelamin: r.jenis_kelamin,
          kelas: kelasLabel(r),
        })),
      }))
  }, [siswaSemua, selMapel, tahunAjaranLabel])

  const previewDataList: { label: string; portrait: boolean; node: React.ReactNode }[] = useMemo(() => {
    const out: { label: string; portrait: boolean; node: React.ReactNode }[] = []
    if (mode === 'jumlah' && jumlahPrintData) {
      out.push({ label: 'Rekap Jumlah Siswa per Mapel', portrait: true, node: <TkaRekapJumlahTemplate data={jumlahPrintData} /> })
    }
    if (mode === 'kelas') {
      kelasPrintDataList.forEach((d, i) => out.push({
        label: `Kelas ${d.group_label}`,
        portrait: false,
        node: <TkaRekapKelasTemplate data={d} pageBreak={i > 0} />,
      }))
    }
    if (mode === 'mapel') {
      mapelPrintDataList.forEach((d, i) => out.push({
        label: d.group_label,
        portrait: true,
        node: <TkaRekapMapelTemplate data={d} pageBreak={i > 0} />,
      }))
    }
    return out
  }, [mode, jumlahPrintData, kelasPrintDataList, mapelPrintDataList])

  const printData = previewDataList.map(p => p.node)

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle:
      mode === 'jumlah' ? `Rekap Jumlah Mapel TKA ${tahunAjaranLabel}`
      : mode === 'kelas' ? `Rekap Per Kelas TKA ${tahunAjaranLabel}`
      : `Rekap Per Mapel TKA ${tahunAjaranLabel}`,
    pageStyle: `
      @page { size: ${mode === 'kelas' ? 'A4 landscape' : 'A4 portrait'}; margin: 0; }
      @media print {
        html, body { margin: 0; padding: 0; background: white; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      }
    `,
  })

  const handlePrintAction = () => {
    if (isMobile) {
      onOpenChange(false)
      setTimeout(() => handlePrint(), 250)
      return
    }
    handlePrint()
  }

  const previewLabel = previewDataList.length === 0
    ? 'Tidak ada data'
    : previewDataList.length === 1
      ? previewDataList[0].label
      : `${previewDataList.length} halaman`

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

      <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[96vw] max-w-5xl rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-violet-50 dark:bg-violet-950/40 border border-violet-100 dark:border-violet-900">
                  <FileText className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Cetak Rekapitulasi TKA</h2>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    {tahunAjaranLabel} · <span className="text-violet-500 font-medium">{previewLabel}</span>
                  </p>
                </div>
              </div>
              <DialogPrimitive.Close className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 transition-colors">
                <X className="h-4 w-4" />
              </DialogPrimitive.Close>
            </div>

            <div className="flex flex-col sm:flex-row" style={{ height: '80vh' }}>
              {/* Sidebar kontrol */}
              <div className="shrink-0 w-full sm:w-64 border-b sm:border-b-0 sm:border-r border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 p-3 flex flex-col gap-2 overflow-y-auto">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Jenis Cetak</p>
                  <div className="space-y-1">
                    {([
                      { key: 'jumlah', label: 'Rekap Jumlah per Mapel', desc: 'Jumlah gabungan pemilih mapel' },
                      { key: 'kelas', label: 'Rekap per Kelas', desc: 'Daftar siswa per kelas' },
                      { key: 'mapel', label: 'Rekap per Mapel', desc: 'Daftar siswa per mapel' },
                    ] as const).map(m => (
                      <button
                        key={m.key}
                        onClick={() => { setMode(m.key); setSelMapel('') }}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-colors text-xs ${
                          mode === m.key ? 'bg-violet-600 text-white' : 'bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <div>
                          <div className="font-medium leading-tight">{m.label}</div>
                          <div className={`text-[10px] mt-0.5 ${mode === m.key ? 'text-violet-200' : 'text-slate-400 dark:text-slate-500'}`}>{m.desc}</div>
                        </div>
                        {mode === m.key && <ChevronRight className="h-3 w-3 shrink-0 ml-1" />}
                      </button>
                    ))}
                  </div>
                </div>

                {mode === 'kelas' && (
                  <div className="mt-1">
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Pilih Kelas</p>
                    <div className="space-y-0.5 max-h-52 overflow-y-auto pr-0.5">
                      <button
                        onClick={() => setSelKelas('')}
                        className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                          selKelas === ''
                            ? 'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 font-semibold border border-violet-200 dark:border-violet-800'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        Semua Kelas
                        <span className="ml-1 text-[10px] text-slate-400 dark:text-slate-500">({kelasPrintDataList.length})</span>
                      </button>
                      {kelasOptions.map(kelas => {
                        const count = siswaSemua.filter(r => kelasLabel(r) === kelas).length
                        return (
                          <button
                            key={kelas}
                            onClick={() => setSelKelas(kelas)}
                            className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                              selKelas === kelas
                                ? 'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 font-semibold border border-violet-200 dark:border-violet-800'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
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

                {mode === 'mapel' && (
                  <div className="mt-1">
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Pilih Mapel</p>
                    <div className="space-y-0.5 max-h-52 overflow-y-auto pr-0.5">
                      <button
                        onClick={() => setSelMapel('')}
                        className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                          selMapel === ''
                            ? 'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 font-semibold border border-violet-200 dark:border-violet-800'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        Semua Mapel
                        <span className="ml-1 text-[10px] text-slate-400 dark:text-slate-500">({mapelOptions.length})</span>
                      </button>
                      {mapelOptions.map(mapel => {
                        const count = siswaSemua.filter(row => row.mapel_pilihan1 === mapel || row.mapel_pilihan2 === mapel).length
                        return (
                          <button
                            key={mapel}
                            onClick={() => setSelMapel(mapel)}
                            className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                              selMapel === mapel
                                ? 'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 font-semibold border border-violet-200 dark:border-violet-800'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            <span className="line-clamp-1">{mapel}</span>
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
                    disabled={loading || previewDataList.length === 0}
                    className="w-full h-9 text-xs gap-2 bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-40"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    {loading ? 'Memuat...'
                      : previewDataList.length > 1
                        ? (isMobile ? `Simpan PDF ${previewDataList.length} Halaman` : `Cetak ${previewDataList.length} Halaman`)
                        : (isMobile ? 'Simpan PDF' : 'Cetak Sekarang')}
                  </Button>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center">Kertas A4 {mode === 'kelas' ? 'Landscape' : 'Portrait'}</p>
                </div>
              </div>

              {/* Preview */}
              <div className="flex-1 overflow-auto bg-slate-100 dark:bg-slate-900 p-4">
                {loading ? (
                  <div className="h-full flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                  </div>
                ) : previewDataList.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-400 dark:text-slate-600">
                    <div className="p-4 rounded-full bg-slate-200 dark:bg-slate-800">
                      <FileText className="h-8 w-8" />
                    </div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Tidak ada data untuk dicetak</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {previewDataList.map((p, idx) => (
                      <div key={idx}>
                        {previewDataList.length > 1 && (
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded">
                              Halaman {idx + 1} · {p.label}
                            </span>
                          </div>
                        )}
                        <div
                          className="bg-white dark:bg-slate-900 shadow-xl ring-1 ring-black/10 origin-top"
                          style={{
                            width: p.portrait ? '210mm' : '297mm',
                            transform: p.portrait ? 'scale(0.68)' : 'scale(0.5)',
                            transformOrigin: 'top left',
                            marginBottom: p.portrait
                              ? 'calc((210mm * 0.68 * 1.414) - (210mm * 1.414) + 16px)'
                              : 'calc((297mm * 0.5 * 0.707) - (297mm * 0.707) + 16px)',
                          }}
                        >
                          {p.node}
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

      {/* Print root (di luar dialog, disembunyikan di layar) */}
      <div
        ref={printRef}
        className="absolute -left-[100000px] top-0 print:static print:left-auto"
      >
        {printData}
      </div>
    </>
  )
}
