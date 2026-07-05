'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn, formatNamaKelas } from '@/lib/utils'
import {
  ArrowLeft, ArrowRight, CheckCircle2, Download, Loader2, Plus, RefreshCw,
  Save, Trash2, Upload
} from 'lucide-react'
import {
  applyAkademikInputSession,
  createAkademikInputSession,
  discardAkademikInputSession,
  getAkademikInputSession,
  saveAkademikInputRows,
} from '../actions'

type StepKey = 'mapel' | 'penugasan' | 'jadwal' | 'review'
type KelasItem = { id: string; tingkat: number; nomor_kelas: string; kelompok: string }
type GuruItem = { id: string; nama_lengkap: string }
type MapelItem = { id: string; nama_mapel: string; kode_asc?: string | null }
type PolaJam = { id: string; nama: string; hari: number[]; slots: any[] }

type DraftRow = {
  step_key: StepKey
  row_key: string
  status: string
  error_message: string | null
  payload: Record<string, any>
}

const STEPS: Array<{ key: StepKey; label: string }> = [
  { key: 'mapel', label: 'Master Mapel' },
  { key: 'penugasan', label: 'Beban Mengajar' },
  { key: 'jadwal', label: 'Jadwal' },
  { key: 'review', label: 'Review' },
]

const STEP_COLUMNS: Record<Exclude<StepKey, 'review'>, string[]> = {
  mapel: ['KODE_ASC', 'NAMA_MAPEL', 'KODE_RDM', 'KELOMPOK', 'TINGKAT', 'KATEGORI'],
  penugasan: ['NAMA_GURU', 'NAMA_MAPEL', 'NAMA_KELAS'],
  jadwal: ['NAMA_KELAS', 'HARI', 'JAM_KE', 'NAMA_MAPEL', 'NAMA_GURU'],
}

const SAMPLE_ROWS: Record<Exclude<StepKey, 'review'>, Record<string, any>[]> = {
  mapel: [
    { KODE_ASC: 'MTK', NAMA_MAPEL: 'Matematika', KODE_RDM: 'MTK', KELOMPOK: 'UMUM', TINGKAT: 'Semua', KATEGORI: 'Kelompok Mata Pelajaran Umum' },
  ],
  penugasan: [
    { NAMA_GURU: 'Nama Guru, S.Pd', NAMA_MAPEL: 'Matematika', NAMA_KELAS: 'X-01' },
  ],
  jadwal: [
    { NAMA_KELAS: 'X-01', HARI: 1, JAM_KE: 1, NAMA_MAPEL: 'Matematika', NAMA_GURU: 'Nama Guru, S.Pd' },
  ],
}

const HARI_REFERENSI = [
  { HARI: 1, NAMA_HARI: 'Senin' },
  { HARI: 2, NAMA_HARI: 'Selasa' },
  { HARI: 3, NAMA_HARI: 'Rabu' },
  { HARI: 4, NAMA_HARI: 'Kamis' },
  { HARI: 5, NAMA_HARI: 'Jumat' },
  { HARI: 6, NAMA_HARI: 'Sabtu' },
]

const TINGKAT_OPTIONS = ['7', '8', '9', '10', '11', '12', 'Semua']
const KATEGORI_OPTIONS = ['Kelompok Mata Pelajaran Umum', 'Kelompok Mata Pelajaran Pilihan']

function kelasTemplateName(kelas?: KelasItem) {
  if (!kelas) return 'X-01'
  const roman: Record<number, string> = { 7: 'VII', 8: 'VIII', 9: 'IX', 10: 'X', 11: 'XI', 12: 'XII' }
  const prefix = roman[Number(kelas.tingkat)] || String(kelas.tingkat)
  const nomor = String(kelas.nomor_kelas || '1').padStart(2, '0')
  return `${prefix}-${nomor}`
}

function setSheetWidths(ws: any, widths: number[]) {
  ws['!cols'] = widths.map(wch => ({ wch }))
}

function emptyRow(step: Exclude<StepKey, 'review'>) {
  return Object.fromEntries(STEP_COLUMNS[step].map(col => [col, '']))
}

function groupRows(rows: DraftRow[]) {
  return rows.reduce<Record<string, Record<string, any>[]>>((acc, row) => {
    if (!acc[row.step_key]) acc[row.step_key] = []
    acc[row.step_key].push(row.payload || {})
    return acc
  }, {})
}

function statusClass(status?: string) {
  if (status === 'error') return 'bg-rose-50 text-rose-700 border-rose-200'
  if (status === 'new') return 'bg-blue-50 text-blue-700 border-blue-200'
  if (status === 'update') return 'bg-amber-50 text-amber-700 border-amber-200'
  if (status === 'duplicate') return 'bg-orange-50 text-orange-700 border-orange-200'
  if (status === 'valid') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  return 'bg-surface-2 text-slate-500 border-surface'
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

export function AkademikInputWizard({
  taAktif,
  kelasList,
  guruList,
  mapelData,
  polaDaftar,
  userRole,
}: {
  taAktif: { id: string; nama: string; semester: number } | null
  kelasList: KelasItem[]
  guruList: GuruItem[]
  mapelData: MapelItem[]
  polaDaftar: PolaJam[]
  userRole: string
}) {
  const isSuperAdmin = userRole === 'super_admin'
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [activeStep, setActiveStep] = useState<StepKey>('mapel')
  const [rows, setRows] = useState<Record<string, Record<string, any>[]>>({})
  const [draftRows, setDraftRows] = useState<DraftRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [selectedPenugasanKelas, setSelectedPenugasanKelas] = useState('')
  const [selectedJadwalKelas, setSelectedJadwalKelas] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const currentRows = rows[activeStep] || []
  const activeIndex = STEPS.findIndex(step => step.key === activeStep)
  const statusRows = useMemo(() => draftRows.filter(row => row.step_key === activeStep), [draftRows, activeStep])
  const kelasOptions = useMemo(
    () => kelasList.map(kelas => ({
      value: kelasTemplateName(kelas),
      label: formatNamaKelas(kelas.tingkat, kelas.nomor_kelas, kelas.kelompok),
    })),
    [kelasList]
  )
  const guruOptions = useMemo(
    () => guruList.map(guru => ({ value: guru.nama_lengkap, label: guru.nama_lengkap })),
    [guruList]
  )
  const mapelOptions = useMemo(
    () => mapelData.map(mapel => ({ value: mapel.nama_mapel, label: mapel.nama_mapel })),
    [mapelData]
  )
  const kelompokOptions = useMemo(
    () => uniqueValues(['UMUM', ...kelasList.map(kelas => kelas.kelompok), ...mapelData.map((mapel: any) => mapel.kelompok)]),
    [kelasList, mapelData]
  )
  const jamOptions = useMemo(() => {
    const slots = polaDaftar.flatMap(pola => (pola.slots || []).map(slot => ({
      value: String(slot.id),
      label: slot.nama ? `${slot.id} - ${slot.nama}` : `Jam ${slot.id}`,
    })))
    return slots.length ? slots : [{ value: '1', label: 'Jam 1' }]
  }, [polaDaftar])
  const draftAssignments = useMemo(() => {
    const sourceRows = activeStep === 'penugasan' ? currentRows : (rows.penugasan || [])
    return sourceRows
      .map(row => ({
        guru: String(row.NAMA_GURU || '').trim(),
        mapel: String(row.NAMA_MAPEL || '').trim(),
        kelas: String(row.NAMA_KELAS || '').trim(),
      }))
      .filter(row => row.guru && row.mapel && row.kelas)
  }, [activeStep, currentRows, rows.penugasan])
  const selectedClassAssignments = useMemo(
    () => draftAssignments.filter(item => item.kelas === selectedJadwalKelas),
    [draftAssignments, selectedJadwalKelas]
  )
  const summary = useMemo(() => {
    const grouped = groupRows(draftRows)
    return {
      mapel: grouped.mapel?.length || 0,
      penugasan: grouped.penugasan?.length || 0,
      jadwal: grouped.jadwal?.length || 0,
      errors: draftRows.filter(row => row.status === 'error').length,
    }
  }, [draftRows])

  useEffect(() => {
    if (!kelasOptions.length) return
    setSelectedPenugasanKelas(current => current || kelasOptions[0].value)
    setSelectedJadwalKelas(current => current || kelasOptions[0].value)
  }, [kelasOptions])

  const loadSession = async (id: string) => {
    const res = await getAkademikInputSession(id)
    if (res.error || !res.session) {
      setMessage(res.error || 'Draft tidak ditemukan.')
      return
    }
    setDraftRows(res.rows as DraftRow[])
    setRows(groupRows(res.rows as DraftRow[]))
    setActiveStep((res.session.active_step && res.session.active_step !== 'persiapan') ? res.session.active_step : 'mapel')
  }

  const handleOpen = async () => {
    if (!taAktif) return
    setIsLoading(true)
    setMessage(null)
    const res = await createAkademikInputSession(taAktif.id)
    if (res.sessionId) {
      setSessionId(res.sessionId)
      await loadSession(res.sessionId)
      setMessage(res.success || null)
    } else {
      setMessage(res.error || 'Gagal membuat draft.')
    }
    setIsLoading(false)
  }

  useEffect(() => {
    if (!isSuperAdmin || !taAktif || sessionId || isLoading) return
    handleOpen()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin, taAktif?.id, sessionId])

  const handleSave = async () => {
    if (!sessionId || activeStep === 'review') return
    setIsLoading(true)
    setMessage(null)
    const res = await saveAkademikInputRows(sessionId, activeStep, currentRows)
    if (res.error) setMessage(res.error)
    else {
      setMessage((res as any).success || 'Checkpoint tersimpan.')
      await loadSession(sessionId)
    }
    setIsLoading(false)
  }

  const handleApply = async () => {
    if (!sessionId) return
    if (!confirm('Terapkan final? Data penugasan dan jadwal semester aktif akan diganti dengan draft ini.')) return
    setIsLoading(true)
    setMessage(null)
    const res = await applyAkademikInputSession(sessionId)
    if (res.error) setMessage(`${res.error}${res.logs?.length ? ` (${res.logs.length} catatan)` : ''}`)
    else {
      setMessage(res.success || 'Draft berhasil diterapkan.')
      await loadSession(sessionId)
    }
    setIsLoading(false)
  }

  const handleDiscard = async () => {
    if (!sessionId) return
    if (!confirm('Batalkan draft input bertahap ini?')) return
    setIsLoading(true)
    await discardAkademikInputSession(sessionId)
    setRows({})
    setDraftRows([])
    setSessionId(null)
    setIsLoading(false)
  }

  const addRow = () => {
    if (activeStep === 'review') return
    const row = emptyRow(activeStep)
    if (activeStep === 'penugasan' && selectedPenugasanKelas) row.NAMA_KELAS = selectedPenugasanKelas
    setRows(prev => ({
      ...prev,
      [activeStep]: [...(prev[activeStep] || []), row],
    }))
  }

  const updateRow = (rowIndex: number, column: string, value: string) => {
    setRows(prev => {
      const next = [...(prev[activeStep] || [])]
      next[rowIndex] = { ...(next[rowIndex] || {}), [column]: value }
      return { ...prev, [activeStep]: next }
    })
  }

  const updateRowPatch = (rowIndex: number, patch: Record<string, any>) => {
    setRows(prev => {
      const next = [...(prev[activeStep] || [])]
      next[rowIndex] = { ...(next[rowIndex] || {}), ...patch }
      return { ...prev, [activeStep]: next }
    })
  }

  const removeRow = (rowIndex: number) => {
    setRows(prev => ({
      ...prev,
      [activeStep]: (prev[activeStep] || []).filter((_, index) => index !== rowIndex),
    }))
  }

  const findJadwalSlotIndex = (kelas: string, hari: number, jamKe: string | number) =>
    (rows.jadwal || []).findIndex(row =>
      String(row.NAMA_KELAS || '') === kelas &&
      String(row.HARI || '') === String(hari) &&
      String(row.JAM_KE || '') === String(jamKe)
    )

  const setJadwalSlot = (hari: number, jamKe: string, value: string) => {
    if (!selectedJadwalKelas || !value) return
    const [mapel, guru] = value.split('|||')
    setRows(prev => {
      const existingRows = [...(prev.jadwal || [])]
      const row = {
        NAMA_KELAS: selectedJadwalKelas,
        HARI: String(hari),
        JAM_KE: String(jamKe),
        NAMA_MAPEL: mapel,
        NAMA_GURU: guru,
      }
      const index = existingRows.findIndex(item =>
        String(item.NAMA_KELAS || '') === selectedJadwalKelas &&
        String(item.HARI || '') === String(hari) &&
        String(item.JAM_KE || '') === String(jamKe)
      )
      if (index >= 0) existingRows[index] = { ...(existingRows[index] || {}), ...row }
      else existingRows.push(row)
      return { ...prev, jadwal: existingRows }
    })
  }

  const clearJadwalSlot = (hari: number, jamKe: string) => {
    setRows(prev => ({
      ...prev,
      jadwal: (prev.jadwal || []).filter(row =>
        !(String(row.NAMA_KELAS || '') === selectedJadwalKelas &&
          String(row.HARI || '') === String(hari) &&
          String(row.JAM_KE || '') === String(jamKe))
      ),
    }))
  }

  const downloadTemplate = () => {
    if (activeStep === 'review') return
    const XLSX = (window as any).XLSX
    if (!XLSX) return alert('Library Excel belum siap, coba beberapa detik lagi.')

    const firstGuru = guruList[0]?.nama_lengkap || SAMPLE_ROWS.penugasan[0].NAMA_GURU
    const firstMapel = mapelData[0]?.nama_mapel || SAMPLE_ROWS.mapel[0].NAMA_MAPEL
    const firstKelas = kelasTemplateName(kelasList[0])
    const sampleByStep: Record<Exclude<StepKey, 'review'>, Record<string, any>[]> = {
      mapel: [{
        KODE_ASC: mapelData[0]?.kode_asc || 'MTK',
        NAMA_MAPEL: firstMapel,
        KODE_RDM: 'MTK',
        KELOMPOK: 'UMUM',
        TINGKAT: 'Semua',
        KATEGORI: 'Kelompok Mata Pelajaran Umum',
      }],
      penugasan: [{
        NAMA_GURU: firstGuru,
        NAMA_MAPEL: firstMapel,
        NAMA_KELAS: firstKelas,
      }],
      jadwal: [{
        NAMA_KELAS: firstKelas,
        HARI: 1,
        JAM_KE: polaDaftar[0]?.slots?.[0]?.id || 1,
        NAMA_MAPEL: firstMapel,
        NAMA_GURU: firstGuru,
      }],
    }

    const wb = XLSX.utils.book_new()

    const inputWs = XLSX.utils.json_to_sheet(sampleByStep[activeStep], { header: STEP_COLUMNS[activeStep] })
    setSheetWidths(inputWs, STEP_COLUMNS[activeStep].map(col => Math.max(12, col.length + 4)))
    XLSX.utils.book_append_sheet(wb, inputWs, `Input_${activeStep}`)

    const guruWs = XLSX.utils.json_to_sheet(
      guruList.map(g => ({ NAMA_GURU: g.nama_lengkap }))
    )
    setSheetWidths(guruWs, [42])
    XLSX.utils.book_append_sheet(wb, guruWs, 'Referensi_Guru')

    const mapelWs = XLSX.utils.json_to_sheet(
      mapelData.map(m => ({ NAMA_MAPEL: m.nama_mapel, KODE_ASC: m.kode_asc || '' }))
    )
    setSheetWidths(mapelWs, [36, 14])
    XLSX.utils.book_append_sheet(wb, mapelWs, 'Referensi_Mapel')

    const kelasWs = XLSX.utils.json_to_sheet(
      kelasList.map(k => ({
        NAMA_KELAS: kelasTemplateName(k),
        NAMA_TAMPIL: formatNamaKelas(k.tingkat, k.nomor_kelas, k.kelompok),
        TINGKAT: k.tingkat,
        NOMOR: k.nomor_kelas,
        KELOMPOK: k.kelompok,
      }))
    )
    setSheetWidths(kelasWs, [14, 24, 10, 10, 18])
    XLSX.utils.book_append_sheet(wb, kelasWs, 'Referensi_Kelas')

    if (activeStep === 'jadwal') {
      const jamRows = polaDaftar.flatMap(pola =>
        (pola.slots || []).map(slot => ({
          POLA: pola.nama,
          HARI_AKTIF: pola.hari.join(','),
          JAM_KE: slot.id,
          NAMA_JAM: slot.nama || `Jam ${slot.id}`,
          MULAI: slot.mulai || '',
          SELESAI: slot.selesai || '',
        }))
      )
      const hariWs = XLSX.utils.json_to_sheet(HARI_REFERENSI)
      setSheetWidths(hariWs, [10, 16])
      XLSX.utils.book_append_sheet(wb, hariWs, 'Referensi_Hari')

      const jamWs = XLSX.utils.json_to_sheet(jamRows.length ? jamRows : [{ POLA: 'Default', HARI_AKTIF: '1,2,3,4,5,6', JAM_KE: 1, NAMA_JAM: 'Jam 1', MULAI: '', SELESAI: '' }])
      setSheetWidths(jamWs, [22, 14, 10, 16, 12, 12])
      XLSX.utils.book_append_sheet(wb, jamWs, 'Referensi_Jam')
    }

    const petunjukWs = XLSX.utils.aoa_to_sheet([
      ['Petunjuk'],
      ['Isi hanya sheet Input_* lalu import kembali dari wizard.'],
      ['NAMA_GURU, NAMA_MAPEL, dan NAMA_KELAS sebaiknya disalin dari sheet referensi agar validasi tidak gagal.'],
      ['Untuk HARI: 1=Senin, 2=Selasa, 3=Rabu, 4=Kamis, 5=Jumat, 6=Sabtu.'],
    ])
    setSheetWidths(petunjukWs, [110])
    XLSX.utils.book_append_sheet(wb, petunjukWs, 'Petunjuk')

    XLSX.writeFile(wb, `Template_Akademik_${activeStep}.xlsx`)
  }

  const importExcel = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (activeStep === 'review') return
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const XLSX = (window as any).XLSX
        const wb = XLSX.read(ev.target?.result, { type: 'binary' })
        const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' }) as Record<string, any>[]
        setRows(prev => ({ ...prev, [activeStep]: data }))
        setMessage(`${data.length} baris Excel dimuat. Tekan Simpan Checkpoint untuk menyimpan.`)
      } catch {
        setMessage('Gagal membaca file Excel.')
      } finally {
        event.target.value = ''
      }
    }
    reader.readAsBinaryString(file)
  }

  const renderSelectCell = (
    value: any,
    placeholder: string,
    options: Array<{ value: string; label: string }>,
    onChange: (value: string) => void
  ) => (
    <Select value={value ? String(value) : undefined} onValueChange={onChange}>
      <SelectTrigger className="h-8 min-w-[160px] rounded-md text-xs">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {options.map(option => (
          <SelectItem key={option.value} value={option.value} className="text-xs">
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  const renderCellInput = (row: Record<string, any>, rowIndex: number, column: string) => {
    const value = row[column] ?? ''

    if (activeStep === 'mapel') {
      if (column === 'KELOMPOK') {
        return renderSelectCell(value, 'Pilih kelompok', kelompokOptions.map(item => ({ value: item, label: item })), selected => updateRow(rowIndex, column, selected))
      }
      if (column === 'TINGKAT') {
        return renderSelectCell(value, 'Pilih tingkat', TINGKAT_OPTIONS.map(item => ({ value: item, label: item === 'Semua' ? 'Semua tingkat' : `Kelas ${item}` })), selected => updateRow(rowIndex, column, selected))
      }
      if (column === 'KATEGORI') {
        return renderSelectCell(value, 'Pilih kategori', KATEGORI_OPTIONS.map(item => ({ value: item, label: item.replace('Kelompok Mata Pelajaran ', '') })), selected => updateRow(rowIndex, column, selected))
      }
    }

    if (activeStep === 'penugasan') {
      if (column === 'NAMA_GURU') return renderSelectCell(value, 'Pilih guru', guruOptions, selected => updateRow(rowIndex, column, selected))
      if (column === 'NAMA_MAPEL') return renderSelectCell(value, 'Pilih mapel', mapelOptions, selected => updateRow(rowIndex, column, selected))
      if (column === 'NAMA_KELAS') return renderSelectCell(value, 'Pilih kelas', kelasOptions, selected => updateRow(rowIndex, column, selected))
    }

    if (activeStep === 'jadwal') {
      const kelasValue = String(row.NAMA_KELAS || '')
      const mapelValue = String(row.NAMA_MAPEL || '')
      const assignmentsForClass = kelasValue ? draftAssignments.filter(item => item.kelas === kelasValue) : draftAssignments
      const mapelFromAssignments = uniqueValues(assignmentsForClass.map(item => item.mapel))
      const mapelSelectOptions = mapelFromAssignments.length
        ? mapelFromAssignments.map(item => ({ value: item, label: item }))
        : mapelOptions
      const assignmentsForGuru = assignmentsForClass.filter(item => !mapelValue || item.mapel === mapelValue)
      const guruFromAssignments = uniqueValues(assignmentsForGuru.map(item => item.guru))
      const guruSelectOptions = guruFromAssignments.length
        ? guruFromAssignments.map(item => ({ value: item, label: item }))
        : guruOptions

      if (column === 'NAMA_KELAS') {
        return renderSelectCell(value, 'Pilih kelas', kelasOptions, selected => {
          const matches = draftAssignments.filter(item => item.kelas === selected)
          const mapels = uniqueValues(matches.map(item => item.mapel))
          const patch: Record<string, any> = { NAMA_KELAS: selected }
          if (!row.NAMA_MAPEL && mapels.length === 1) patch.NAMA_MAPEL = mapels[0]
          const guruMatches = matches.filter(item => item.mapel === (patch.NAMA_MAPEL || row.NAMA_MAPEL))
          const gurus = uniqueValues(guruMatches.map(item => item.guru))
          if (!row.NAMA_GURU && gurus.length === 1) patch.NAMA_GURU = gurus[0]
          updateRowPatch(rowIndex, patch)
        })
      }
      if (column === 'NAMA_MAPEL') {
        return renderSelectCell(value, 'Pilih mapel', mapelSelectOptions, selected => {
          const matches = draftAssignments.filter(item => (!kelasValue || item.kelas === kelasValue) && item.mapel === selected)
          const gurus = uniqueValues(matches.map(item => item.guru))
          const patch: Record<string, any> = { NAMA_MAPEL: selected }
          if (gurus.length === 1) patch.NAMA_GURU = gurus[0]
          updateRowPatch(rowIndex, patch)
        })
      }
      if (column === 'NAMA_GURU') return renderSelectCell(value, 'Pilih guru', guruSelectOptions, selected => updateRow(rowIndex, column, selected))
      if (column === 'HARI') {
        return renderSelectCell(
          value,
          'Pilih hari',
          HARI_REFERENSI.map(item => ({ value: String(item.HARI), label: item.NAMA_HARI })),
          selected => updateRow(rowIndex, column, selected)
        )
      }
      if (column === 'JAM_KE') return renderSelectCell(value, 'Pilih jam', jamOptions, selected => updateRow(rowIndex, column, selected))
    }

    return (
      <Input
        value={value}
        onChange={event => updateRow(rowIndex, column, event.target.value)}
        className="h-8 min-w-[120px] rounded-md text-xs"
      />
    )
  }

  const renderStatus = (rowIndex: number) => {
    const status = statusRows[rowIndex]?.status
    const error = statusRows[rowIndex]?.error_message
    return (
      <div className="min-w-[84px]">
        <Badge variant="outline" className={cn('rounded-md px-1.5 py-0 text-[10px]', statusClass(status))}>{status || 'draft'}</Badge>
        {error && <p className="mt-1 text-[10px] leading-tight text-rose-600">{error}</p>}
      </div>
    )
  }

  const renderMapelEditor = () => (
    <div className="space-y-2">
      {currentRows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-surface bg-surface-2 px-4 py-10 text-center text-sm text-slate-400">
          Belum ada mapel. Tambah mapel atau import Excel.
        </div>
      ) : currentRows.map((row, rowIndex) => (
        <div key={rowIndex} className={cn('rounded-lg border bg-surface p-3', statusRows[rowIndex]?.status === 'error' ? 'border-rose-200 bg-rose-50/50' : 'border-surface')}>
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-50 text-xs font-bold text-blue-700">{rowIndex + 1}</div>
              {renderStatus(rowIndex)}
            </div>
            <button onClick={() => removeRow(rowIndex)} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-rose-500 hover:bg-rose-50">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="grid gap-3 lg:grid-cols-[1fr_120px_120px_160px_140px_180px]">
            {STEP_COLUMNS.mapel.map(col => (
              <label key={col} className="space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-400">{col}</span>
                {renderCellInput(row, rowIndex, col)}
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  )

  const renderPenugasanEditor = () => {
    const selectedRows = currentRows
      .map((row, rowIndex) => ({ row, rowIndex }))
      .filter(item => String(item.row.NAMA_KELAS || '') === selectedPenugasanKelas)
    const selectedClassLabel = kelasOptions.find(item => item.value === selectedPenugasanKelas)?.label || selectedPenugasanKelas || '-'

    return (
      <div className="grid gap-3 lg:grid-cols-[260px_1fr]">
        <div className="rounded-lg border border-surface bg-surface p-3">
          <p className="mb-2 text-xs font-semibold text-slate-500">Pilih Kelas</p>
          <Select value={selectedPenugasanKelas || undefined} onValueChange={setSelectedPenugasanKelas}>
            <SelectTrigger className="h-9 rounded-md text-xs">
              <SelectValue placeholder="Pilih kelas" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {kelasOptions.map(option => (
                <SelectItem key={option.value} value={option.value} className="text-xs">{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="mt-3 space-y-1 text-xs text-slate-500">
            <p>Total beban kelas ini: <strong>{selectedRows.length}</strong></p>
            <p>Data disimpan sebagai baris beban mengajar untuk kelas terpilih.</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 rounded-lg border border-surface bg-surface px-3 py-2">
            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{selectedClassLabel}</p>
              <p className="text-xs text-slate-400">Pilih mapel dan guru pengampu untuk kelas ini.</p>
            </div>
            <Button variant="outline" size="sm" onClick={addRow} className="h-8 shrink-0 text-xs gap-1">
              <Plus className="h-3.5 w-3.5" /> Tambah Beban
            </Button>
          </div>
          {selectedRows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-surface bg-surface-2 px-4 py-10 text-center text-sm text-slate-400">
              Belum ada beban mengajar untuk kelas ini.
            </div>
          ) : selectedRows.map(({ row, rowIndex }, displayIndex) => (
            <div key={rowIndex} className={cn('rounded-lg border bg-surface p-3', statusRows[rowIndex]?.status === 'error' ? 'border-rose-200 bg-rose-50/50' : 'border-surface')}>
              <div className="grid gap-3 lg:grid-cols-[42px_1fr_1fr_92px_40px] lg:items-start">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-50 text-xs font-bold text-emerald-700">{displayIndex + 1}</div>
                <label className="space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Mapel</span>
                  {renderCellInput(row, rowIndex, 'NAMA_MAPEL')}
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Guru</span>
                  {renderCellInput(row, rowIndex, 'NAMA_GURU')}
                </label>
                {renderStatus(rowIndex)}
                <button onClick={() => removeRow(rowIndex)} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-rose-500 hover:bg-rose-50">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const renderJadwalEditor = () => {
    const selectedClassLabel = kelasOptions.find(item => item.value === selectedJadwalKelas)?.label || selectedJadwalKelas || '-'
    const assignmentOptions = selectedClassAssignments.map(item => ({
      value: `${item.mapel}|||${item.guru}`,
      label: `${item.mapel} - ${item.guru.split(',')[0]}`,
    }))
    const slotsForClass = (rows.jadwal || []).filter(row => String(row.NAMA_KELAS || '') === selectedJadwalKelas)

    return (
      <div className="space-y-3">
        <div className="grid gap-3 lg:grid-cols-[260px_1fr]">
          <div className="rounded-lg border border-surface bg-surface p-3">
            <p className="mb-2 text-xs font-semibold text-slate-500">Pilih Kelas</p>
            <Select value={selectedJadwalKelas || undefined} onValueChange={setSelectedJadwalKelas}>
              <SelectTrigger className="h-9 rounded-md text-xs">
                <SelectValue placeholder="Pilih kelas" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {kelasOptions.map(option => (
                  <SelectItem key={option.value} value={option.value} className="text-xs">{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-lg border border-surface bg-surface p-3">
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{selectedClassLabel}</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <div className="rounded-md bg-surface-2 px-3 py-2">
                <p className="text-[10px] uppercase text-slate-400">Beban kelas</p>
                <p className="text-lg font-bold text-slate-800 dark:text-slate-200">{selectedClassAssignments.length}</p>
              </div>
              <div className="rounded-md bg-surface-2 px-3 py-2">
                <p className="text-[10px] uppercase text-slate-400">Slot terisi</p>
                <p className="text-lg font-bold text-slate-800 dark:text-slate-200">{slotsForClass.length}</p>
              </div>
              <div className="rounded-md bg-surface-2 px-3 py-2">
                <p className="text-[10px] uppercase text-slate-400">Pola jam</p>
                <p className="text-lg font-bold text-slate-800 dark:text-slate-200">{jamOptions.length}</p>
              </div>
            </div>
          </div>
        </div>

        {assignmentOptions.length === 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Isi dulu Beban Mengajar untuk kelas ini. Setelah ada beban, slot jadwal akan menyediakan pilihan mapel dan guru otomatis.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-surface bg-surface">
            <div className="min-w-[980px]">
              <div className="grid grid-cols-[96px_repeat(6,minmax(140px,1fr))] border-b border-surface-2 bg-surface-2">
                <div className="px-3 py-2 text-xs font-bold text-slate-500">Jam</div>
                {HARI_REFERENSI.map(day => (
                  <div key={day.HARI} className="border-l border-surface px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300">{day.NAMA_HARI}</div>
                ))}
              </div>
              {jamOptions.map(jam => (
                <div key={jam.value} className="grid grid-cols-[96px_repeat(6,minmax(140px,1fr))] border-b border-surface-2 last:border-b-0">
                  <div className="bg-surface-2 px-3 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300">{jam.label}</div>
                  {HARI_REFERENSI.map(day => {
                    const slotIndex = findJadwalSlotIndex(selectedJadwalKelas, day.HARI, jam.value)
                    const slot = slotIndex >= 0 ? rows.jadwal?.[slotIndex] : null
                    const value = slot ? `${slot.NAMA_MAPEL}|||${slot.NAMA_GURU}` : undefined
                    const slotStatus = slotIndex >= 0 ? statusRows[slotIndex] : null
                    return (
                      <div key={`${day.HARI}-${jam.value}`} className={cn('min-h-[88px] border-l border-surface p-2', slotStatus?.status === 'error' ? 'bg-rose-50/50' : '')}>
                        <Select value={value} onValueChange={selected => setJadwalSlot(day.HARI, jam.value, selected)}>
                          <SelectTrigger className="h-8 w-full rounded-md text-[11px]">
                            <SelectValue placeholder="Kosong" />
                          </SelectTrigger>
                          <SelectContent className="max-h-72">
                            {assignmentOptions.map(option => (
                              <SelectItem key={option.value} value={option.value} className="text-xs">{option.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {slot && (
                          <div className="mt-2 flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-[11px] font-semibold text-slate-700 dark:text-slate-200">{slot.NAMA_MAPEL}</p>
                              <p className="truncate text-[10px] text-slate-400">{String(slot.NAMA_GURU || '').split(',')[0]}</p>
                              {slotStatus?.error_message && <p className="mt-1 text-[10px] leading-tight text-rose-600">{slotStatus.error_message}</p>}
                            </div>
                            <button onClick={() => clearJadwalSlot(day.HARI, jam.value)} className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-rose-500 hover:bg-rose-50">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderStepEditor = () => {
    if (activeStep === 'mapel') return renderMapelEditor()
    if (activeStep === 'penugasan') return renderPenugasanEditor()
    if (activeStep === 'jadwal') return renderJadwalEditor()
    return null
  }

  if (!isSuperAdmin) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">
        Halaman input bertahap hanya tersedia untuk super admin.
      </div>
    )
  }

  if (!taAktif) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">
        Tahun ajaran aktif belum diatur. Atur dulu di menu Pengaturan.
      </div>
    )
  }

  return (
    <div className="bg-surface border border-surface rounded-xl overflow-hidden">
          <div className="grid lg:grid-cols-[240px_1fr] min-h-[calc(100vh-220px)]">
            <aside className="border-r border-surface-2 bg-surface-2 p-3 space-y-3 overflow-y-auto">
              <div className="rounded-lg bg-surface border border-surface p-3 space-y-2">
                <p className="text-xs font-semibold text-slate-500">Tahun Ajaran</p>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{taAktif?.nama || '-'}</p>
                <p className="text-xs text-slate-400">Semester {taAktif?.semester || '-'}</p>
              </div>
              <div className="space-y-1">
                {STEPS.map((step, index) => (
                  <button
                    key={step.key}
                    onClick={() => setActiveStep(step.key)}
                    className={cn(
                      'w-full h-9 rounded-md px-3 text-left text-xs font-semibold flex items-center gap-2 transition-colors',
                      activeStep === step.key ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-surface'
                    )}
                  >
                    <span className={cn('h-5 w-5 rounded-full flex items-center justify-center text-[10px]', activeStep === step.key ? 'bg-white/20' : 'bg-surface border border-surface')}>{index + 1}</span>
                    {step.label}
                  </button>
                ))}
              </div>
              <div className="rounded-lg bg-surface border border-surface p-3 text-xs text-slate-500 space-y-1">
                <p>Kelas: <strong>{kelasList.length}</strong></p>
                <p>Guru: <strong>{guruList.length}</strong></p>
                <p>Mapel aktif: <strong>{mapelData.length}</strong></p>
                <p>Pola jam: <strong>{polaDaftar.length}</strong></p>
              </div>
            </aside>

            <main className="p-4 overflow-y-auto space-y-3">
              {isLoading && !sessionId && (
                <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-800 flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Menyiapkan draft input bertahap...
                </div>
              )}
              {message && (
                <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-800">
                  {message}
                </div>
              )}

              {activeStep !== 'review' ? (
                <>
                  <div className="flex flex-wrap gap-2 items-center">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">{STEPS[activeIndex]?.label}</h3>
                      <p className="text-xs text-slate-400">{currentRows.length} data draft di step ini</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={downloadTemplate} className="h-8 text-xs gap-1">
                      <Download className="h-3.5 w-3.5" /> Template
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="h-8 text-xs gap-1">
                      <Upload className="h-3.5 w-3.5" /> Import Excel
                    </Button>
                    <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={importExcel} className="hidden" />
                    {activeStep === 'mapel' && (
                      <Button variant="outline" size="sm" onClick={addRow} className="h-8 text-xs gap-1">
                        <Plus className="h-3.5 w-3.5" /> Tambah Mapel
                      </Button>
                    )}
                    <Button size="sm" onClick={handleSave} disabled={isLoading} className="h-8 text-xs gap-1 bg-blue-600 hover:bg-blue-700 text-white">
                      {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Simpan Checkpoint
                    </Button>
                  </div>

                  {renderStepEditor()}
                </>
              ) : (
                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Review & Terapkan</h3>
                    <p className="text-xs text-slate-400">Data aktif baru diganti setelah tombol Terapkan Final ditekan.</p>
                  </div>
                  <div className="grid sm:grid-cols-5 gap-2">
                    {[
                      ['Mapel', summary.mapel],
                      ['Beban', summary.penugasan],
                      ['Jadwal', summary.jadwal],
                      ['Error', summary.errors],
                    ].map(([label, count]) => (
                      <div key={label} className="rounded-lg border border-surface bg-surface p-3">
                        <p className="text-xs text-slate-400">{label}</p>
                        <p className="text-xl font-bold text-slate-800 dark:text-slate-200">{count}</p>
                      </div>
                    ))}
                  </div>
                  {summary.errors > 0 && (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                      Masih ada {summary.errors} error. Buka step terkait, perbaiki, lalu simpan checkpoint ulang.
                    </div>
                  )}
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    Checkpoint tersimpan aman di draft. Refresh halaman tidak menghapus data input.
                  </div>
                  <Button onClick={handleApply} disabled={isLoading || summary.errors > 0} className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white text-sm gap-2">
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Terapkan Final
                  </Button>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2 border-t border-surface-2">
                <Button variant="outline" size="sm" onClick={() => loadSession(sessionId!)} disabled={!sessionId || isLoading} className="h-8 text-xs gap-1">
                  <RefreshCw className="h-3.5 w-3.5" /> Muat Ulang
                </Button>
                <Button variant="outline" size="sm" onClick={handleDiscard} disabled={!sessionId || isLoading} className="h-8 text-xs text-rose-600 border-rose-200 hover:bg-rose-50">
                  Batalkan Draft
                </Button>
                <div className="flex-1" />
                <Button variant="outline" size="sm" onClick={() => setActiveStep(STEPS[Math.max(0, activeIndex - 1)].key)} disabled={activeIndex <= 0} className="h-8 text-xs gap-1">
                  <ArrowLeft className="h-3.5 w-3.5" /> Sebelumnya
                </Button>
                <Button size="sm" onClick={() => setActiveStep(STEPS[Math.min(STEPS.length - 1, activeIndex + 1)].key)} disabled={activeIndex >= STEPS.length - 1} className="h-8 text-xs gap-1 bg-slate-900 hover:bg-slate-800 text-white">
                  Lanjut <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </main>
          </div>
    </div>
  )
}
