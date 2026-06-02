'use client'

import { useMemo, useState } from 'react'
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getSiswaExportData } from '../actions'
import { formatNamaKelas } from '@/lib/utils'

type SiswaExportRow = Record<string, any>

type ExportField = {
  key: string
  label: string
  group: 'Identitas' | 'Akademik' | 'Alamat' | 'Orang Tua'
  default?: boolean
}

const EXPORT_FIELDS: ExportField[] = [
  { key: 'nama_lengkap', label: 'Nama Lengkap', group: 'Identitas', default: true },
  { key: 'nisn', label: 'NISN', group: 'Identitas', default: true },
  { key: 'nis_lokal', label: 'NIS Lokal', group: 'Identitas', default: true },
  { key: 'jenis_kelamin', label: 'JK', group: 'Identitas', default: true },
  { key: 'nik', label: 'NIK', group: 'Identitas' },
  { key: 'asal_sekolah', label: 'Asal Sekolah', group: 'Identitas', default: true },
  { key: 'tempat_lahir', label: 'Tempat Lahir', group: 'Identitas' },
  { key: 'tanggal_lahir', label: 'Tanggal Lahir', group: 'Identitas' },
  { key: 'agama', label: 'Agama', group: 'Identitas' },
  { key: 'status_anak', label: 'Status Anak', group: 'Identitas' },
  { key: 'anak_ke', label: 'Anak Ke', group: 'Identitas' },
  { key: 'jumlah_saudara', label: 'Jumlah Saudara Kandung', group: 'Identitas' },
  { key: 'kelas', label: 'Kelas (Info)', group: 'Akademik' },
  { key: 'tingkat', label: 'Tingkat Kelas', group: 'Akademik', default: true },
  { key: 'kelompok', label: 'Kelompok Kelas', group: 'Akademik', default: true },
  { key: 'nomor_kelas', label: 'Nomor Kelas', group: 'Akademik', default: true },
  { key: 'tahun_masuk', label: 'Tahun Masuk', group: 'Akademik', default: true },
  { key: 'status', label: 'Status Siswa', group: 'Akademik', default: true },
  { key: 'minat_jurusan', label: 'Minat Jurusan', group: 'Akademik' },
  { key: 'tempat_tinggal', label: 'Tempat Tinggal', group: 'Alamat', default: true },
  { key: 'asrama', label: 'Asrama', group: 'Alamat' },
  { key: 'kamar', label: 'Kamar', group: 'Alamat' },
  { key: 'alamat_lengkap', label: 'Alamat Lengkap', group: 'Alamat', default: true },
  { key: 'rt', label: 'RT', group: 'Alamat' },
  { key: 'rw', label: 'RW', group: 'Alamat' },
  { key: 'desa_kelurahan', label: 'Desa/Kelurahan', group: 'Alamat' },
  { key: 'kecamatan', label: 'Kecamatan', group: 'Alamat' },
  { key: 'kabupaten_kota', label: 'Kabupaten/Kota', group: 'Alamat' },
  { key: 'provinsi', label: 'Provinsi', group: 'Alamat' },
  { key: 'kode_pos', label: 'Kode Pos', group: 'Alamat' },
  { key: 'nomor_whatsapp', label: 'Nomor WhatsApp', group: 'Alamat', default: true },
  { key: 'nomor_kk', label: 'No KK', group: 'Orang Tua' },
  { key: 'nama_ayah', label: 'Nama Ayah', group: 'Orang Tua' },
  { key: 'nik_ayah', label: 'NIK Ayah', group: 'Orang Tua' },
  { key: 'tempat_lahir_ayah', label: 'Tempat Lahir Ayah', group: 'Orang Tua' },
  { key: 'tanggal_lahir_ayah', label: 'Tanggal Lahir Ayah', group: 'Orang Tua' },
  { key: 'status_ayah', label: 'Status Ayah', group: 'Orang Tua' },
  { key: 'pendidikan_ayah', label: 'Pendidikan Ayah', group: 'Orang Tua' },
  { key: 'pekerjaan_ayah', label: 'Pekerjaan Ayah', group: 'Orang Tua' },
  { key: 'penghasilan_ayah', label: 'Penghasilan Ayah', group: 'Orang Tua' },
  { key: 'nama_ibu', label: 'Nama Ibu', group: 'Orang Tua' },
  { key: 'nik_ibu', label: 'NIK Ibu', group: 'Orang Tua' },
  { key: 'tempat_lahir_ibu', label: 'Tempat Lahir Ibu', group: 'Orang Tua' },
  { key: 'tanggal_lahir_ibu', label: 'Tanggal Lahir Ibu', group: 'Orang Tua' },
  { key: 'status_ibu', label: 'Status Ibu', group: 'Orang Tua' },
  { key: 'pendidikan_ibu', label: 'Pendidikan Ibu', group: 'Orang Tua' },
  { key: 'pekerjaan_ibu', label: 'Pekerjaan Ibu', group: 'Orang Tua' },
  { key: 'penghasilan_ibu', label: 'Penghasilan Ibu', group: 'Orang Tua' },
]

const DEFAULT_FIELDS = EXPORT_FIELDS.filter(field => field.default).map(field => field.key)

function todayId() {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

function safeFilenamePart(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '_').slice(0, 50)
}

function valueFor(row: SiswaExportRow, key: string) {
  if (key === 'kelas') {
    return row.tingkat ? formatNamaKelas(row.tingkat, row.nomor_kelas, row.kelompok) : ''
  }
  if (key === 'jenis_kelamin') {
    return row.jenis_kelamin ?? ''
  }
  return row[key] ?? ''
}

export function ExportModalSiswa({
  allRows,
  currentFilteredRows,
  kelasList,
  filterKelas,
  filterAngkatan,
  filterStatus,
}: {
  allRows: any[]
  currentFilteredRows: any[]
  kelasList: any[]
  filterKelas: string
  filterAngkatan: string
  filterStatus: string
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [scope, setScope] = useState('current')
  const [selectedKelas, setSelectedKelas] = useState('')
  const [selectedAngkatan, setSelectedAngkatan] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('aktif')
  const [selectedDomisili, setSelectedDomisili] = useState('')
  const [selectedFields, setSelectedFields] = useState<string[]>(DEFAULT_FIELDS)

  async function loadRows() {
    setLoading(true)
    setError('')
    try {
      const res = await getSiswaExportData()
      if (res.error) {
        setError(res.error)
        return []
      }
      return res.data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data siswa untuk export.')
      return []
    } finally {
      setLoading(false)
    }
  }

  function openDialog(nextOpen: boolean) {
    setOpen(nextOpen)
  }

  const previewRows = useMemo<SiswaExportRow[]>(() => allRows.map(row => ({
    ...row,
    kelas_id: row.kelas_id ?? row.kelas?.id ?? null,
    kelas: row.kelas
      ? formatNamaKelas(row.kelas.tingkat, row.kelas.nomor_kelas, row.kelas.kelompok)
      : row.kelas_id && row.tingkat
        ? formatNamaKelas(row.tingkat, row.nomor_kelas, row.kelompok)
        : '',
  })), [allRows])

  const currentIds = useMemo(() => new Set(currentFilteredRows.map(row => row.id)), [currentFilteredRows])

  const kelasOptions = useMemo(() => (
    kelasList.map(kelas => [kelas.id, formatNamaKelas(kelas.tingkat, kelas.nomor_kelas, kelas.kelompok)] as const)
      .sort((a, b) => String(a[1]).localeCompare(String(b[1]), undefined, { numeric: true, sensitivity: 'base' }))
  ), [kelasList])

  const angkatanOptions = useMemo(() => (
    [...new Set(previewRows.map(row => row.tahun_masuk).filter(Boolean))]
      .sort((a, b) => Number(b) - Number(a))
  ), [previewRows])

  const domisiliOptions = useMemo(() => (
    [...new Set(previewRows.map(row => row.tempat_tinggal).filter(Boolean))]
      .sort((a, b) => String(a).localeCompare(String(b)))
  ), [previewRows])

  function applyScope(baseRows: SiswaExportRow[]) {
    let base = baseRows
    if (scope === 'current') base = base.filter(row => currentIds.has(row.id))
    if (scope === 'kelas') base = base.filter(row => selectedKelas === '__none' ? !row.kelas_id : row.kelas_id === selectedKelas)
    if (scope === 'angkatan') base = base.filter(row => String(row.tahun_masuk ?? '') === selectedAngkatan)
    if (scope === 'status') base = base.filter(row => row.status === selectedStatus)
    if (scope === 'domisili') base = base.filter(row => row.tempat_tinggal === selectedDomisili)
    return base
  }

  const exportRows = useMemo(() => {
    return applyScope(previewRows)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIds, previewRows, scope, selectedAngkatan, selectedDomisili, selectedKelas, selectedStatus])

  const groupedFields = useMemo(() => {
    return EXPORT_FIELDS.reduce<Record<string, ExportField[]>>((acc, field) => {
      acc[field.group] = acc[field.group] || []
      acc[field.group].push(field)
      return acc
    }, {})
  }, [])

  function toggleField(key: string, checked: boolean) {
    setSelectedFields(prev => {
      const next = checked ? [...prev, key] : prev.filter(item => item !== key)
      return next.length ? next : prev
    })
  }

  async function handleExport() {
    if (!selectedFields.length) return
    const rawRows = await loadRows()
    const normalizedExportRows = rawRows.map(row => ({
      ...row,
      kelas: row.tingkat ? formatNamaKelas(row.tingkat, row.nomor_kelas, row.kelompok) : '',
    }))
    const scopedRows = applyScope(normalizedExportRows)
    if (!scopedRows.length) return

    const XLSX = await import('xlsx')
    const fields = EXPORT_FIELDS.filter(field => selectedFields.includes(field.key))
    const data = scopedRows.map(row => {
      const item: Record<string, string | number> = {}
      fields.forEach(field => {
        item[field.label] = valueFor(row, field.key)
      })
      return item
    })

    const ws = XLSX.utils.json_to_sheet(data)
    ws['!cols'] = fields.map(field => ({ wch: field.label.includes('Nama') || field.label.includes('Alamat') ? 30 : 18 }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Data Siswa')

    const filterLabel =
      scope === 'current' ? `filter_${filterKelas}_${filterAngkatan}_${filterStatus}` :
      scope === 'kelas' ? `kelas_${selectedKelas === '__none' ? 'Tanpa_Kelas' : kelasOptions.find(([id]) => id === selectedKelas)?.[1] ?? selectedKelas}` :
      scope === 'angkatan' ? `angkatan_${selectedAngkatan}` :
      scope === 'status' ? `status_${selectedStatus}` :
      scope === 'domisili' ? `domisili_${selectedDomisili}` :
      'semua'

    XLSX.writeFile(wb, `MANSATAS_Data_Siswa_${safeFilenamePart(filterLabel)}_${todayId()}.xlsx`)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={openDialog}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-surface rounded-md px-2.5">
          <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden sm:inline">Export Siswa</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl rounded-xl p-0 overflow-hidden">
        <DialogHeader className="border-b bg-slate-50 px-5 py-4 dark:bg-slate-800/50">
          <DialogTitle className="text-sm font-semibold">Export Data Siswa ke XLSX</DialogTitle>
        </DialogHeader>

        <div className="max-h-[82vh] overflow-y-auto p-5 space-y-4">
          {error && <div className="rounded-lg border border-rose-100 bg-rose-50 p-3 text-xs text-rose-600">{error}</div>}

          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Cakupan Data</Label>
              <Select value={scope} onValueChange={setScope}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="current">Sesuai filter halaman</SelectItem>
                  <SelectItem value="all">Semua siswa</SelectItem>
                  <SelectItem value="kelas">Per kelas</SelectItem>
                  <SelectItem value="angkatan">Per angkatan</SelectItem>
                  <SelectItem value="status">Per status</SelectItem>
                  <SelectItem value="domisili">Per domisili</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {scope === 'kelas' && (
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs font-medium">Pilih Kelas</Label>
                <Select value={selectedKelas} onValueChange={setSelectedKelas}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Pilih kelas..." /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="__none">Tanpa Kelas</SelectItem>
                    {kelasOptions.map(([id, kelas]) => <SelectItem key={id} value={id}>Kelas {kelas}</SelectItem>)}
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

            {scope === 'status' && (
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs font-medium">Pilih Status</Label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aktif">Aktif</SelectItem>
                    <SelectItem value="lulus">Lulus</SelectItem>
                    <SelectItem value="pindah">Pindah</SelectItem>
                    <SelectItem value="keluar">Keluar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {scope === 'domisili' && (
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs font-medium">Pilih Domisili</Label>
                <Select value={selectedDomisili} onValueChange={setSelectedDomisili}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Pilih domisili..." /></SelectTrigger>
                  <SelectContent>
                    {domisiliOptions.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Kolom yang Diexport</p>
              <div className="flex gap-1">
                <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setSelectedFields(EXPORT_FIELDS.map(field => field.key))}>Semua</Button>
                <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setSelectedFields(DEFAULT_FIELDS)}>Default</Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {Object.entries(groupedFields).map(([group, fields]) => (
                <div key={group} className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{group}</p>
                  {fields.map(field => (
                    <label key={field.key} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                      <Checkbox checked={selectedFields.includes(field.key)} onCheckedChange={checked => toggleField(field.key, checked === true)} />
                      {field.label}
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <Input readOnly value={loading ? 'Menyiapkan export...' : `${exportRows.length} siswa siap diexport`} className="h-9 w-full bg-slate-50 text-sm md:w-56 dark:bg-slate-900" />
            <div className="ml-auto flex gap-2">
              <Button type="button" variant="outline" size="sm" className="h-9 text-sm" onClick={() => setOpen(false)}>Batal</Button>
              <Button type="button" size="sm" className="h-9 gap-1.5 text-sm" disabled={loading || !exportRows.length || !selectedFields.length} onClick={handleExport}>
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                Export XLSX
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
