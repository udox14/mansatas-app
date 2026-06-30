'use client'

import { useState } from 'react'
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { getPlottingExportData } from '../actions'

type SortBy = 'kelas_lama' | 'kelas_baru'

const TINGKAT_OPTIONS = [
  { value: 10, label: 'Kelas 10', desc: 'Siswa baru → Kelas 10' },
  { value: 11, label: 'Kelas 11', desc: 'Penjurusan → Kelas 11' },
  { value: 12, label: 'Kelas 12', desc: 'Kenaikan → Kelas 12' },
]

const collator = new Intl.Collator('id', { numeric: true, sensitivity: 'base' })

function todayId() {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

function sortData(
  data: Awaited<ReturnType<typeof getPlottingExportData>>['data'],
  sortBy: SortBy
) {
  return [...data].sort((a, b) => {
    const ka = sortBy === 'kelas_lama' ? (a.kelas_lama || '￿') : (a.kelas_baru || '￿')
    const kb = sortBy === 'kelas_lama' ? (b.kelas_lama || '￿') : (b.kelas_baru || '￿')
    const kc = collator.compare(ka, kb)
    if (kc !== 0) return kc
    return collator.compare(a.nama_lengkap, b.nama_lengkap)
  })
}

export function ExportPlottingModal({
  targetTaId,
  targetTaLabel,
}: {
  targetTaId: string
  targetTaLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedTingkat, setSelectedTingkat] = useState<number[]>([10, 11, 12])
  const [sortBy, setSortBy] = useState<SortBy>('kelas_baru')

  function toggleTingkat(val: number) {
    setSelectedTingkat(prev =>
      prev.includes(val) ? prev.filter(t => t !== val) : [...prev, val]
    )
  }

  function toggleAll() {
    setSelectedTingkat(prev => (prev.length === 3 ? [] : [10, 11, 12]))
  }

  async function handleDownload() {
    if (!selectedTingkat.length) return
    setLoading(true)
    setError('')
    try {
      const res = await getPlottingExportData(targetTaId, selectedTingkat)
      if (!res.data.length) {
        setError('Tidak ada data plotting ditemukan untuk tingkat yang dipilih.')
        return
      }

      const sorted = sortData(res.data, sortBy)
      const XLSX = await import('xlsx')
      const wb = XLSX.utils.book_new()

      const tingkatToExport = selectedTingkat.slice().sort((a, b) => a - b)

      if (tingkatToExport.length === 1) {
        const rows = sorted.map(r => ({
          NISN: r.nisn,
          Nama: r.nama_lengkap,
          'JK': r.jenis_kelamin,
          'Kelas Lama': r.kelas_lama || '-',
          'Kelas Tujuan': r.kelas_baru || '-',
        }))
        const ws = XLSX.utils.json_to_sheet(rows)
        ws['!cols'] = [{ wch: 14 }, { wch: 32 }, { wch: 4 }, { wch: 12 }, { wch: 16 }]
        XLSX.utils.book_append_sheet(wb, ws, `Kelas ${tingkatToExport[0]}`)
      } else {
        for (const t of tingkatToExport) {
          const rows = sorted
            .filter(r => r.tingkat === t)
            .map(r => ({
              NISN: r.nisn,
              Nama: r.nama_lengkap,
              'JK': r.jenis_kelamin,
              'Kelas Lama': r.kelas_lama || '-',
              'Kelas Tujuan': r.kelas_baru || '-',
            }))
          if (!rows.length) continue
          const ws = XLSX.utils.json_to_sheet(rows)
          ws['!cols'] = [{ wch: 14 }, { wch: 32 }, { wch: 4 }, { wch: 12 }, { wch: 16 }]
          XLSX.utils.book_append_sheet(wb, ws, `Kelas ${t}`)
        }
      }

      const taLabel = targetTaLabel ? `_${targetTaLabel.replace(/[/\\:*?"<>|\s]+/g, '-')}` : ''
      XLSX.writeFile(wb, `MANSATAS_Plotting${taLabel}_${todayId()}.xlsx`)
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengunduh data.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-surface rounded-md px-2.5">
          <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" />
          <span>Download Excel</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md rounded-xl p-0 overflow-hidden">
        <DialogHeader className="border-b bg-slate-50 px-5 py-4 dark:bg-slate-800/50">
          <DialogTitle className="text-sm font-semibold">Download Hasil Plotting ke Excel</DialogTitle>
        </DialogHeader>

        <div className="p-5 space-y-5">
          {error && (
            <div className="rounded-lg border border-rose-100 bg-rose-50 p-3 text-xs text-rose-600 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400">
              {error}
            </div>
          )}

          {/* Pilih Tingkat */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Pilih Tingkat
              </Label>
              <button
                type="button"
                onClick={toggleAll}
                className="text-[11px] text-blue-600 hover:underline dark:text-blue-400"
              >
                {selectedTingkat.length === 3 ? 'Batal Semua' : 'Pilih Semua'}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {TINGKAT_OPTIONS.map(opt => (
                <label
                  key={opt.value}
                  className={`flex cursor-pointer flex-col gap-1 rounded-lg border p-3 transition-colors ${
                    selectedTingkat.includes(opt.value)
                      ? 'border-blue-400 bg-blue-50 dark:border-blue-600 dark:bg-blue-950/30'
                      : 'border-surface bg-surface-2 hover:bg-surface'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedTingkat.includes(opt.value)}
                      onCheckedChange={() => toggleTingkat(opt.value)}
                    />
                    <span className="text-sm font-semibold">{opt.label}</span>
                  </div>
                  <span className="ml-5 text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                    {opt.desc}
                  </span>
                </label>
              ))}
            </div>
            {selectedTingkat.length > 1 && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Setiap tingkat akan dipisah dalam sheet masing-masing.
              </p>
            )}
          </div>

          {/* Sort */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Urutkan Berdasarkan
            </Label>
            <div className="flex gap-3">
              {([
                { value: 'kelas_baru', label: 'Kelas Tujuan' },
                { value: 'kelas_lama', label: 'Kelas Lama' },
              ] as const).map(opt => (
                <label
                  key={opt.value}
                  className={`flex flex-1 cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm transition-colors ${
                    sortBy === opt.value
                      ? 'border-blue-400 bg-blue-50 font-medium dark:border-blue-600 dark:bg-blue-950/30'
                      : 'border-surface bg-surface-2 hover:bg-surface'
                  }`}
                >
                  <input
                    type="radio"
                    name="sort_by"
                    value={opt.value}
                    checked={sortBy === opt.value}
                    onChange={() => setSortBy(opt.value)}
                    className="accent-blue-600"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              Dalam setiap kelas, siswa diurutkan A–Z (natural sort).
            </p>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 text-sm"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-9 gap-1.5 text-sm"
              disabled={loading || !selectedTingkat.length}
              onClick={handleDownload}
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              {loading ? 'Menyiapkan...' : 'Download XLSX'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
