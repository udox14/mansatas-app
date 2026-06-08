'use client'

import { useMemo, useState } from 'react'
import { Download, FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { todayWIB } from '@/lib/time'

export type ExportSource = 'DSPT' | 'SPP'

export type FinanceExportRow = {
  source: ExportSource
  siswa_id: string
  nama_lengkap: string
  nisn?: string | null
  tahun_masuk?: number | null
  kelas?: string | null
  dspt_target?: number | null
  dspt_dibayar?: number | null
  dspt_diskon?: number | null
  dspt_sisa?: number | null
  dspt_status?: string | null
  dspt_catatan?: string | null
  metode_bayar?: string | null
  spp_tunggakan?: number | null
  spp_dibayar?: number | null
  spp_sisa?: number | null
  spp_status?: string | null
  spp_keterangan?: string | null
}

type ExportField = {
  key: keyof FinanceExportRow
  label: string
  sources?: ExportSource[]
}

const EXPORT_FIELDS: ExportField[] = [
  { key: 'source', label: 'Sumber' },
  { key: 'nama_lengkap', label: 'Nama Siswa' },
  { key: 'nisn', label: 'NISN' },
  { key: 'kelas', label: 'Kelas' },
  { key: 'tahun_masuk', label: 'Angkatan' },
  { key: 'metode_bayar', label: 'Metode Bayar' },
  { key: 'dspt_target', label: 'DSPT Target', sources: ['DSPT'] },
  { key: 'dspt_dibayar', label: 'DSPT Dibayar', sources: ['DSPT'] },
  { key: 'dspt_diskon', label: 'DSPT Diskon', sources: ['DSPT'] },
  { key: 'dspt_sisa', label: 'DSPT Sisa', sources: ['DSPT'] },
  { key: 'dspt_status', label: 'DSPT Status', sources: ['DSPT'] },
  { key: 'dspt_catatan', label: 'DSPT Catatan', sources: ['DSPT'] },
  { key: 'spp_tunggakan', label: 'SPP Tunggakan', sources: ['SPP'] },
  { key: 'spp_dibayar', label: 'SPP Dibayar', sources: ['SPP'] },
  { key: 'spp_sisa', label: 'SPP Sisa', sources: ['SPP'] },
  { key: 'spp_status', label: 'SPP Status', sources: ['SPP'] },
  { key: 'spp_keterangan', label: 'SPP Keterangan', sources: ['SPP'] },
]

const DEFAULT_FIELDS = new Set<keyof FinanceExportRow>([
  'source', 'nama_lengkap', 'nisn', 'kelas', 'tahun_masuk',
  'dspt_target', 'dspt_dibayar', 'dspt_diskon', 'dspt_sisa', 'dspt_status',
  'spp_tunggakan', 'spp_dibayar', 'spp_sisa', 'spp_status',
])

function normalizeStatus(status?: string | null) {
  if (!status) return ''
  const labels: Record<string, string> = {
    lunas: 'Lunas',
    nyicil: 'Nyicil',
    belum_bayar: 'Belum Bayar',
    tidak_ada: 'Belum Diinput',
  }
  return labels[status] ?? status
}

function cleanSheetName(name: string) {
  return name.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31) || 'Export'
}

function todayId() {
  return todayWIB().replaceAll('-', '')
}

export function FinanceExportExcelDialog({
  rows,
  currentRows,
  sources,
  defaultSources,
  triggerLabel = 'Export Excel',
  filePrefix = 'MANSATAS_Keuangan',
}: {
  rows: FinanceExportRow[]
  currentRows?: FinanceExportRow[]
  sources: ExportSource[]
  defaultSources?: ExportSource[]
  triggerLabel?: string
  filePrefix?: string
}) {
  const [open, setOpen] = useState(false)
  const [scope, setScope] = useState(currentRows ? 'current' : 'all')
  const [selectedSources, setSelectedSources] = useState<ExportSource[]>(defaultSources?.length ? defaultSources : sources)
  const [selectedFields, setSelectedFields] = useState<(keyof FinanceExportRow)[]>(EXPORT_FIELDS.filter(f => DEFAULT_FIELDS.has(f.key)).map(f => f.key))
  const [selectedSiswa, setSelectedSiswa] = useState('')
  const [selectedKelas, setSelectedKelas] = useState('')
  const [selectedAngkatan, setSelectedAngkatan] = useState('')

  const sourceFilteredRows = useMemo(
    () => rows.filter(row => selectedSources.includes(row.source)),
    [rows, selectedSources],
  )

  const currentSourceFilteredRows = useMemo(
    () => (currentRows ?? rows).filter(row => selectedSources.includes(row.source)),
    [currentRows, rows, selectedSources],
  )

  const siswaOptions = useMemo(() => {
    const map = new Map<string, FinanceExportRow>()
    sourceFilteredRows.forEach(row => {
      if (!map.has(row.siswa_id)) map.set(row.siswa_id, row)
    })
    return [...map.values()].sort((a, b) => a.nama_lengkap.localeCompare(b.nama_lengkap))
  }, [sourceFilteredRows])

  const kelasOptions = useMemo(() => (
    [...new Set(sourceFilteredRows.map(row => row.kelas).filter(Boolean) as string[])]
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
  ), [sourceFilteredRows])

  const angkatanOptions = useMemo(() => (
    [...new Set(sourceFilteredRows.map(row => row.tahun_masuk).filter(Boolean) as number[])]
      .sort((a, b) => b - a)
  ), [sourceFilteredRows])

  const visibleFields = EXPORT_FIELDS.filter(field => !field.sources || field.sources.some(source => selectedSources.includes(source)))

  const exportRows = useMemo(() => {
    const base = scope === 'current' ? currentSourceFilteredRows : sourceFilteredRows
    if (scope === 'siswa') return base.filter(row => row.siswa_id === selectedSiswa)
    if (scope === 'kelas') return base.filter(row => row.kelas === selectedKelas)
    if (scope === 'angkatan') return base.filter(row => String(row.tahun_masuk ?? '') === selectedAngkatan)
    return base
  }, [currentSourceFilteredRows, scope, selectedAngkatan, selectedKelas, selectedSiswa, sourceFilteredRows])

  function toggleSource(source: ExportSource, checked: boolean) {
    setSelectedSources(prev => {
      const next = checked ? [...prev, source] : prev.filter(item => item !== source)
      return next.length ? next : prev
    })
  }

  function toggleField(key: keyof FinanceExportRow, checked: boolean) {
    setSelectedFields(prev => {
      const next = checked ? [...prev, key] : prev.filter(item => item !== key)
      return next.length ? next : prev
    })
  }

  async function handleExport() {
    if (!exportRows.length || !selectedFields.length) return
    const XLSX = await import('xlsx')
    const fields = visibleFields.filter(field => selectedFields.includes(field.key))
    const data = exportRows.map(row => {
      const item: Record<string, string | number> = {}
      fields.forEach(field => {
        const value = row[field.key]
        item[field.label] = field.key === 'dspt_status' || field.key === 'spp_status'
          ? normalizeStatus(value as string | null)
          : typeof value === 'number'
            ? value
            : value ?? ''
      })
      return item
    })
    const ws = XLSX.utils.json_to_sheet(data)
    ws['!cols'] = fields.map(field => ({ wch: field.label.includes('Nama') ? 32 : field.label.includes('Catatan') || field.label.includes('Keterangan') ? 28 : 16 }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, cleanSheetName(selectedSources.join(' + ')))
    XLSX.writeFile(wb, `${filePrefix}_${selectedSources.join('_')}_${todayId()}.xlsx`)
    setOpen(false)
  }

  return (
    <>
      <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => setOpen(true)}>
        <FileSpreadsheet className="h-3.5 w-3.5" />
        {triggerLabel}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl rounded-xl p-0 overflow-hidden">
          <DialogHeader className="border-b bg-slate-50 px-5 py-4 dark:bg-slate-800/50">
            <DialogTitle className="text-sm font-semibold">Export Data Keuangan ke Excel</DialogTitle>
          </DialogHeader>
          <div className="max-h-[80vh] space-y-4 overflow-y-auto p-5">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Cakupan Data</Label>
                <Select value={scope} onValueChange={setScope}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {currentRows && <SelectItem value="current">Sesuai filter halaman</SelectItem>}
                    <SelectItem value="all">Semua data</SelectItem>
                    <SelectItem value="siswa">Per siswa</SelectItem>
                    <SelectItem value="kelas">Per kelas</SelectItem>
                    <SelectItem value="angkatan">Per angkatan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {scope === 'siswa' && (
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs font-medium">Pilih Siswa</Label>
                  <Select value={selectedSiswa} onValueChange={setSelectedSiswa}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Pilih siswa..." /></SelectTrigger>
                    <SelectContent>
                      {siswaOptions.map(row => <SelectItem key={row.siswa_id} value={row.siswa_id}>{row.nama_lengkap}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {scope === 'kelas' && (
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs font-medium">Pilih Kelas</Label>
                  <Select value={selectedKelas} onValueChange={setSelectedKelas}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Pilih kelas..." /></SelectTrigger>
                    <SelectContent>
                      {kelasOptions.map(kelas => <SelectItem key={kelas} value={kelas}>Kelas {kelas}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {scope === 'angkatan' && (
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs font-medium">Pilih Angkatan</Label>
                  <Select value={selectedAngkatan} onValueChange={setSelectedAngkatan}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Pilih angkatan..." /></SelectTrigger>
                    <SelectContent>
                      {angkatanOptions.map(year => <SelectItem key={year} value={String(year)}>Angkatan {year}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-[220px_1fr]">
              <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                <p className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-200">Sumber Data</p>
                <div className="space-y-2">
                  {sources.map(source => (
                    <label key={source} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                      <Checkbox checked={selectedSources.includes(source)} onCheckedChange={checked => toggleSource(source, checked === true)} />
                      {source}
                    </label>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Kolom yang Diexport</p>
                  <div className="flex gap-1">
                    <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setSelectedFields(visibleFields.map(field => field.key))}>Semua</Button>
                    <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setSelectedFields(visibleFields.filter(field => DEFAULT_FIELDS.has(field.key)).map(field => field.key))}>Default</Button>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {visibleFields.map(field => (
                    <label key={field.key} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                      <Checkbox checked={selectedFields.includes(field.key)} onCheckedChange={checked => toggleField(field.key, checked === true)} />
                      {field.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
              <Input readOnly value={`${exportRows.length} baris siap diexport`} className="h-9 w-full bg-slate-50 text-sm md:w-56 dark:bg-slate-900" />
              <div className="ml-auto flex gap-2">
                <Button type="button" variant="outline" size="sm" className="h-9 text-sm" onClick={() => setOpen(false)}>Batal</Button>
                <Button type="button" size="sm" className="h-9 gap-1.5 text-sm" disabled={!exportRows.length} onClick={handleExport}>
                  <Download className="h-3.5 w-3.5" />
                  Export Excel
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
