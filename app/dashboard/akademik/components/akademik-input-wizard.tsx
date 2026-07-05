'use client'

import { useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn, formatNamaKelas } from '@/lib/utils'
import {
  ArrowLeft, ArrowRight, CheckCircle2, ClipboardList, Download, FileSpreadsheet,
  Loader2, Plus, RefreshCw, Save, Trash2, Upload
} from 'lucide-react'
import {
  applyAkademikInputSession,
  createAkademikInputSession,
  discardAkademikInputSession,
  getAkademikInputSession,
  saveAkademikInputRows,
} from '../actions'

type StepKey = 'mapel' | 'penugasan' | 'jadwal' | 'bergilir' | 'review'
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
  { key: 'bergilir', label: 'Bergilir' },
  { key: 'review', label: 'Review' },
]

const STEP_COLUMNS: Record<Exclude<StepKey, 'review'>, string[]> = {
  mapel: ['KODE_ASC', 'NAMA_MAPEL', 'KODE_RDM', 'KELOMPOK', 'TINGKAT', 'KATEGORI'],
  penugasan: ['NAMA_GURU', 'NAMA_MAPEL', 'NAMA_KELAS', 'BERGILIR'],
  jadwal: ['NAMA_KELAS', 'HARI', 'JAM_KE', 'NAMA_MAPEL', 'NAMA_GURU'],
  bergilir: ['NAMA_MAPEL', 'NAMA_KELAS', 'NAMA_GURU', 'URUTAN', 'AKTIF_MINGGU_INI'],
}

const SAMPLE_ROWS: Record<Exclude<StepKey, 'review'>, Record<string, any>[]> = {
  mapel: [
    { KODE_ASC: 'MTK', NAMA_MAPEL: 'Matematika', KODE_RDM: 'MTK', KELOMPOK: 'UMUM', TINGKAT: 'Semua', KATEGORI: 'Kelompok Mata Pelajaran Umum' },
  ],
  penugasan: [
    { NAMA_GURU: 'Nama Guru, S.Pd', NAMA_MAPEL: 'Matematika', NAMA_KELAS: 'X-01', BERGILIR: 'Tidak' },
  ],
  jadwal: [
    { NAMA_KELAS: 'X-01', HARI: 1, JAM_KE: 1, NAMA_MAPEL: 'Matematika', NAMA_GURU: 'Nama Guru, S.Pd' },
  ],
  bergilir: [
    { NAMA_MAPEL: 'RISET', NAMA_KELAS: 'X-01', NAMA_GURU: 'Nama Guru, S.Pd', URUTAN: 1, AKTIF_MINGGU_INI: 'Ya' },
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
  const [open, setOpen] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [activeStep, setActiveStep] = useState<StepKey>('mapel')
  const [rows, setRows] = useState<Record<string, Record<string, any>[]>>({})
  const [draftRows, setDraftRows] = useState<DraftRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const currentRows = rows[activeStep] || []
  const activeIndex = STEPS.findIndex(step => step.key === activeStep)
  const statusRows = useMemo(() => draftRows.filter(row => row.step_key === activeStep), [draftRows, activeStep])
  const summary = useMemo(() => {
    const grouped = groupRows(draftRows)
    return {
      mapel: grouped.mapel?.length || 0,
      penugasan: grouped.penugasan?.length || 0,
      jadwal: grouped.jadwal?.length || 0,
      bergilir: grouped.bergilir?.length || 0,
      errors: draftRows.filter(row => row.status === 'error').length,
    }
  }, [draftRows])

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
    setOpen(true)
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
    setOpen(false)
    setIsLoading(false)
  }

  const addRow = () => {
    if (activeStep === 'review') return
    setRows(prev => ({
      ...prev,
      [activeStep]: [...(prev[activeStep] || []), emptyRow(activeStep)],
    }))
  }

  const updateRow = (rowIndex: number, column: string, value: string) => {
    setRows(prev => {
      const next = [...(prev[activeStep] || [])]
      next[rowIndex] = { ...(next[rowIndex] || {}), [column]: value }
      return { ...prev, [activeStep]: next }
    })
  }

  const removeRow = (rowIndex: number) => {
    setRows(prev => ({
      ...prev,
      [activeStep]: (prev[activeStep] || []).filter((_, index) => index !== rowIndex),
    }))
  }

  const downloadTemplate = () => {
    if (activeStep === 'review') return
    const XLSX = (window as any).XLSX
    if (!XLSX) return alert('Library Excel belum siap, coba beberapa detik lagi.')

    const firstGuru = guruList[0]?.nama_lengkap || SAMPLE_ROWS.penugasan[0].NAMA_GURU
    const firstMapel = mapelData[0]?.nama_mapel || SAMPLE_ROWS.mapel[0].NAMA_MAPEL
    const firstBergilir = mapelData.find(m => /^(RISET|KSM|MUHADATSAH|SPEAKING|THEATER BAHASA)/i.test(m.nama_mapel))?.nama_mapel || firstMapel
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
        BERGILIR: 'Tidak',
      }],
      jadwal: [{
        NAMA_KELAS: firstKelas,
        HARI: 1,
        JAM_KE: polaDaftar[0]?.slots?.[0]?.id || 1,
        NAMA_MAPEL: firstMapel,
        NAMA_GURU: firstGuru,
      }],
      bergilir: [{
        NAMA_MAPEL: firstBergilir,
        NAMA_KELAS: firstKelas,
        NAMA_GURU: firstGuru,
        URUTAN: 1,
        AKTIF_MINGGU_INI: 'Ya',
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
      ['Untuk BERGILIR dan AKTIF_MINGGU_INI gunakan Ya/Tidak.'],
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

  if (!isSuperAdmin) return null

  return (
    <>
      <div className="bg-surface border border-surface rounded-lg px-3 py-2 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="h-8 w-8 rounded-md bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center shrink-0">
            <ClipboardList className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Input Bertahap Akademik</p>
            <p className="text-xs text-slate-400 truncate">Draft checkpoint untuk mapel, beban, jadwal, dan pelajaran bergilir.</p>
          </div>
        </div>
        <Button onClick={handleOpen} disabled={!taAktif} size="sm" className="h-8 text-xs rounded-md bg-blue-600 hover:bg-blue-700 text-white">
          <ClipboardList className="h-3.5 w-3.5 mr-1" /> Input Bertahap
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[96vw] sm:max-w-5xl rounded-xl p-0 overflow-hidden">
          <DialogHeader className="px-4 py-3 border-b border-surface-2 bg-surface">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-blue-600" /> Input Bertahap Pusat Akademik
            </DialogTitle>
          </DialogHeader>

          <div className="grid lg:grid-cols-[220px_1fr] max-h-[82vh]">
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
                      <p className="text-xs text-slate-400">{currentRows.length} baris draft di step ini</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={downloadTemplate} className="h-8 text-xs gap-1">
                      <Download className="h-3.5 w-3.5" /> Template
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="h-8 text-xs gap-1">
                      <Upload className="h-3.5 w-3.5" /> Import Excel
                    </Button>
                    <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={importExcel} className="hidden" />
                    <Button variant="outline" size="sm" onClick={addRow} className="h-8 text-xs gap-1">
                      <Plus className="h-3.5 w-3.5" /> Baris
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={isLoading} className="h-8 text-xs gap-1 bg-blue-600 hover:bg-blue-700 text-white">
                      {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Simpan Checkpoint
                    </Button>
                  </div>

                  <div className="rounded-lg border border-surface overflow-hidden">
                    <div className="overflow-x-auto">
                      <Table className="min-w-[820px]">
                        <TableHeader>
                          <TableRow className="bg-surface-2">
                            <TableHead className="w-16 text-xs">Status</TableHead>
                            {STEP_COLUMNS[activeStep].map(col => <TableHead key={col} className="text-xs">{col}</TableHead>)}
                            <TableHead className="w-12 text-right"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {currentRows.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={STEP_COLUMNS[activeStep].length + 2} className="h-28 text-center text-sm text-slate-400">
                                Belum ada baris. Tambah manual atau import Excel.
                              </TableCell>
                            </TableRow>
                          ) : currentRows.map((row, rowIndex) => {
                            const status = statusRows[rowIndex]?.status
                            const error = statusRows[rowIndex]?.error_message
                            return (
                              <TableRow key={rowIndex} className={status === 'error' ? 'bg-rose-50/50' : undefined}>
                                <TableCell className="align-top py-2">
                                  <Badge variant="outline" className={cn('rounded-md px-1.5 py-0 text-[10px]', statusClass(status))}>{status || 'draft'}</Badge>
                                  {error && <p className="text-[10px] text-rose-600 mt-1 leading-tight">{error}</p>}
                                </TableCell>
                                {STEP_COLUMNS[activeStep].map(col => (
                                  <TableCell key={col} className="py-2">
                                    <Input
                                      value={row[col] ?? ''}
                                      onChange={event => updateRow(rowIndex, col, event.target.value)}
                                      className="h-8 text-xs rounded-md min-w-[120px]"
                                    />
                                  </TableCell>
                                ))}
                                <TableCell className="py-2 text-right">
                                  <button onClick={() => removeRow(rowIndex)} className="h-8 w-8 inline-flex items-center justify-center rounded-md text-rose-500 hover:bg-rose-50">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
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
                      ['Bergilir', summary.bergilir],
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
        </DialogContent>
      </Dialog>
    </>
  )
}
