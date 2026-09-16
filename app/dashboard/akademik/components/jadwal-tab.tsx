// Lokasi: app/dashboard/akademik/components/jadwal-tab.tsx
'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Combobox } from '@/components/ui/combobox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Calendar, Upload, Loader2, AlertCircle, CheckCircle2, RefreshCw,
  BookOpen, User, Clock, Trash2, X, FileText, Info, Download,
  Settings2, Save, Search, RotateCcw
} from 'lucide-react'
import {
  importJadwalASC, getJadwalByKelas, getJadwalByGuru,
  hapusSlotJadwal, resetJadwalKelas, getGuruKodeSettings,
  saveGuruKodeSettings, getJadwalExportData
} from '../actions'
import { cn, formatNamaKelas } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────
type SlotJam = { id: number; nama: string; mulai: string; selesai: string }
type PolaJam = { id: string; nama: string; hari: number[]; slots: SlotJam[] }
type KelasItem = { id: string; tingkat: number; nomor_kelas: string; kelompok: string; wali_kelas_id?: string | null }
type GuruItem = { id: string; nama_lengkap: string }
type TeacherCodeSetting = {
  guruId: string
  nama: string
  kode: string
  mapels: string[]
  source: 'saved' | 'reference' | 'unmatched'
  referenceName: string | null
  referenceCode: string | null
}

type JadwalByKelasRow = {
  id: string; hari: number; jam_ke: number
  penugasan_id: string; guru_nama: string
  nama_mapel: string; mapel_id: string; guru_id: string
}
type JadwalByGuruRow = {
  id: string; hari: number; jam_ke: number
  penugasan_id: string; nama_mapel: string; mapel_id: string
  tingkat: number; nomor_kelas: string; kelas_kelompok: string; kelas_id: string
}

const HARI_LABELS = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const HARI_SHORT  = ['', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
const HARI_COLORS = [
  '',
  'bg-blue-50 dark:bg-blue-950/40 border-blue-100 text-blue-700 dark:text-blue-400',
  'bg-emerald-50 dark:bg-emerald-950/50 dark:bg-emerald-950/40 border-emerald-100 text-emerald-700 dark:text-emerald-400',
  'bg-teal-50 dark:bg-teal-950/40 border-teal-100 text-teal-700 dark:text-teal-400',
  'bg-violet-50 dark:bg-violet-950/40 border-violet-100 text-violet-700 dark:text-violet-400',
  'bg-rose-50 dark:bg-rose-950/40 border-rose-100 text-rose-700 dark:text-rose-400',
  'bg-amber-50 dark:bg-amber-950/40 border-amber-100 text-amber-700 dark:text-amber-400',
]

function dataSafeFilename(value: string) {
  return value
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function styleWorksheetRange(XLSX: any, worksheet: any, rangeRef: string, style: any) {
  const range = XLSX.utils.decode_range(rangeRef)
  for (let row = range.s.r; row <= range.e.r; row++) {
    for (let col = range.s.c; col <= range.e.c; col++) {
      const address = XLSX.utils.encode_cell({ r: row, c: col })
      if (!worksheet[address]) worksheet[address] = { t: 's', v: '' }
      worksheet[address].s = { ...(worksheet[address].s || {}), ...style }
    }
  }
}

function buildScheduleWorkbook(
  XLSX: any,
  data: NonNullable<Awaited<ReturnType<typeof getJadwalExportData>>['data']>,
  polaDaftar: PolaJam[],
) {
  const classColumns = [...data.classes].sort((left, right) =>
    left.tingkat - right.tingkat
      || Number(left.nomorKelas) - Number(right.nomorKelas)
      || left.nomorKelas.localeCompare(right.nomorKelas, 'id', { numeric: true }),
  )
  const configuredHoursByDay = new Map<number, number[]>()
  for (let day = 1; day <= 6; day++) {
    const hours = polaDaftar
      .find(pattern => pattern.hari.includes(day))
      ?.slots.map(slot => Number(slot.id)).filter(hour => Number.isInteger(hour) && hour > 0) || []
    configuredHoursByDay.set(day, hours)
  }

  const scheduleMax = Math.max(0, ...data.schedules.map(row => row.jamKe))
  const configuredMax = Math.max(0, ...Array.from(configuredHoursByDay.values()).flat())
  const globalMax = Math.max(scheduleMax, configuredMax)
  if (globalMax === 0) throw new Error('Jam pelajaran dan jadwal masih kosong.')

  const codeIndex = new Map<string, string[]>()
  for (const row of data.schedules) {
    const key = `${row.hari}|${row.jamKe}|${row.kelasId}`
    if (!codeIndex.has(key)) codeIndex.set(key, [])
    if (row.kodeGuru && !codeIndex.get(key)!.includes(row.kodeGuru)) codeIndex.get(key)!.push(row.kodeGuru)
  }

  const scheduleRows: Array<Array<string | number>> = [
    [`JADWAL PELAJARAN ${data.tahunAjaran.nama} - SEMESTER ${data.tahunAjaran.semester}`],
    ['Kode guru ditampilkan pada setiap sel jadwal. Lihat sheet "Kode Guru" untuk rinciannya.'],
    [],
    ['Hari', 'Jam ke', ...classColumns.map(item => `${item.tingkat}-${item.nomorKelas}`)],
  ]
  const scheduleMerges: any[] = []
  const scheduleDataStartRow = scheduleRows.length

  for (let day = 1; day <= 6; day++) {
    const dayConfiguredMax = Math.max(0, ...(configuredHoursByDay.get(day) || []))
    const dayScheduleMax = Math.max(
      0,
      ...data.schedules.filter(row => row.hari === day).map(row => row.jamKe),
    )
    const dayMax = Math.max(dayConfiguredMax, dayScheduleMax) || globalMax
    const startRow = scheduleRows.length
    for (let hour = 1; hour <= dayMax; hour++) {
      scheduleRows.push([
        hour === 1 ? HARI_LABELS[day] : '',
        hour,
        ...classColumns.map(item => (codeIndex.get(`${day}|${hour}|${item.id}`) || []).join('/')),
      ])
    }
    scheduleMerges.push({ s: { r: startRow, c: 0 }, e: { r: scheduleRows.length - 1, c: 0 } })
  }

  const scheduleSheet = XLSX.utils.aoa_to_sheet(scheduleRows)
  const lastScheduleColumn = Math.max(1, classColumns.length + 1)
  scheduleSheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: lastScheduleColumn } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: lastScheduleColumn } },
    ...scheduleMerges,
  ]
  scheduleSheet['!cols'] = [
    { wch: 12 },
    { wch: 8 },
    ...classColumns.map(() => ({ wch: 9 })),
  ]
  scheduleSheet['!rows'] = scheduleRows.map((_, index) => ({
    hpt: index === 0 ? 25 : index === 1 ? 20 : index === 2 ? 8 : 22,
  }))
  scheduleSheet['!autofilter'] = {
    ref: XLSX.utils.encode_range({ r: 3, c: 0 }, { r: scheduleRows.length - 1, c: lastScheduleColumn }),
  }

  const border = {
    top: { style: 'thin', color: { rgb: 'B8C2CC' } },
    bottom: { style: 'thin', color: { rgb: 'B8C2CC' } },
    left: { style: 'thin', color: { rgb: 'B8C2CC' } },
    right: { style: 'thin', color: { rgb: 'B8C2CC' } },
  }
  styleWorksheetRange(
    XLSX,
    scheduleSheet,
    `A1:${XLSX.utils.encode_col(lastScheduleColumn)}1`,
    { font: { bold: true, sz: 14, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1F4E78' } }, alignment: { horizontal: 'center', vertical: 'center' } },
  )
  styleWorksheetRange(
    XLSX,
    scheduleSheet,
    `A4:${XLSX.utils.encode_col(lastScheduleColumn)}4`,
    { font: { bold: true }, fill: { fgColor: { rgb: 'D9EAF7' } }, alignment: { horizontal: 'center', vertical: 'center' }, border },
  )
  styleWorksheetRange(
    XLSX,
    scheduleSheet,
    `A${scheduleDataStartRow + 1}:${XLSX.utils.encode_col(lastScheduleColumn)}${scheduleRows.length}`,
    { alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border },
  )
  for (const merge of scheduleMerges) {
    const address = XLSX.utils.encode_cell(merge.s)
    scheduleSheet[address].s = {
      ...(scheduleSheet[address].s || {}),
      font: { bold: true },
      fill: { fgColor: { rgb: 'E2F0D9' } },
      alignment: { horizontal: 'center', vertical: 'center', textRotation: 90 },
      border,
    }
  }

  const sortedTeachers = [...data.teachers].sort((left, right) => {
    const leftNumber = Number(left.kode)
    const rightNumber = Number(right.kode)
    if (left.kode && right.kode && Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return leftNumber - rightNumber
    if (left.kode !== right.kode) return left.kode ? -1 : 1
    return left.nama.localeCompare(right.nama, 'id')
  })
  const teacherRows: string[][] = [
    [`DAFTAR KODE GURU ${data.tahunAjaran.nama} - SEMESTER ${data.tahunAjaran.semester}`],
    [],
    ['Kode', 'Nama Guru', 'Mata Pelajaran'],
  ]
  const teacherMerges: any[] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
  ]
  for (const teacher of sortedTeachers) {
    const subjects = teacher.mapels.length > 0 ? teacher.mapels : ['']
    const startRow = teacherRows.length
    subjects.forEach((subject, index) => {
      teacherRows.push([index === 0 ? teacher.kode : '', index === 0 ? teacher.nama : '', subject])
    })
    if (subjects.length > 1) {
      teacherMerges.push(
        { s: { r: startRow, c: 0 }, e: { r: teacherRows.length - 1, c: 0 } },
        { s: { r: startRow, c: 1 }, e: { r: teacherRows.length - 1, c: 1 } },
      )
    }
  }

  const teacherSheet = XLSX.utils.aoa_to_sheet(teacherRows)
  teacherSheet['!merges'] = teacherMerges
  teacherSheet['!cols'] = [{ wch: 10 }, { wch: 38 }, { wch: 34 }]
  teacherSheet['!rows'] = teacherRows.map((_, index) => ({ hpt: index === 0 ? 25 : index === 1 ? 8 : 22 }))
  teacherSheet['!autofilter'] = { ref: `A3:C${teacherRows.length}` }
  styleWorksheetRange(
    XLSX,
    teacherSheet,
    'A1:C1',
    { font: { bold: true, sz: 14, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1F4E78' } }, alignment: { horizontal: 'center', vertical: 'center' } },
  )
  styleWorksheetRange(
    XLSX,
    teacherSheet,
    'A3:C3',
    { font: { bold: true }, fill: { fgColor: { rgb: 'D9EAF7' } }, alignment: { horizontal: 'center', vertical: 'center' }, border },
  )
  styleWorksheetRange(
    XLSX,
    teacherSheet,
    `A4:C${teacherRows.length}`,
    { alignment: { vertical: 'center', wrapText: true }, border },
  )

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, scheduleSheet, 'Jadwal')
  XLSX.utils.book_append_sheet(workbook, teacherSheet, 'Kode Guru')
  workbook.Props = {
    Title: `Jadwal ${data.tahunAjaran.nama} Semester ${data.tahunAjaran.semester}`,
    Subject: 'Jadwal pelajaran berdasarkan kode guru',
    Author: 'MANSATAS App',
  }
  return workbook
}

// Helper: cari slots untuk hari tertentu dari daftar pola
function getSlotsForHari(polaDaftar: PolaJam[], hari: number): SlotJam[] {
  const pola = polaDaftar.find(p => p.hari.includes(hari))
  return pola?.slots ?? []
}

// ── Cell Jadwal ────────────────────────────────────────────────────────
function JadwalCell({
  row, mode, onHapus, isDeleting, canManage,
}: {
  row: JadwalByKelasRow | JadwalByGuruRow
  mode: 'kelas' | 'guru'
  onHapus: (id: string) => void
  isDeleting: boolean
  canManage: boolean
}) {
  const [hover, setHover] = useState(false)
  const byKelas = row as JadwalByKelasRow
  const byGuru  = row as JadwalByGuruRow

  return (
    <div
      className="relative bg-surface border border-surface rounded-md px-2 py-1.5 min-h-[44px] flex flex-col gap-0.5"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 dark:text-slate-100 leading-tight truncate pr-3">
        {mode === 'kelas' ? byKelas.nama_mapel : byGuru.nama_mapel}
      </p>
      <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
        {mode === 'kelas'
          ? byKelas.guru_nama.split(',')[0]
          : formatNamaKelas(byGuru.tingkat, byGuru.nomor_kelas, byGuru.kelas_kelompok)}
      </p>
      {canManage && hover && (
        <button
          onClick={() => onHapus(row.id)}
          disabled={isDeleting}
          className="absolute top-0.5 right-0.5 p-0.5 rounded text-slate-300 dark:text-slate-600 hover:text-rose-500 hover:bg-rose-50 transition-colors"
        >
          {isDeleting ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <X className="h-2.5 w-2.5" />}
        </button>
      )}
    </div>
  )
}

// ── Grid Jadwal (pola-aware per hari) ─────────────────────────────────
// Layout: kolom = hari, baris = nomor jam
// Tiap cell header hari punya jam-nya sendiri sesuai polanya
// Waktu jam ditampilkan di dalam cell (bukan kolom kiri) karena tiap hari beda pola
function JadwalGrid({
  jadwal, polaDaftar, mode, onHapusSlot, deletingId, canManage,
}: {
  jadwal: (JadwalByKelasRow | JadwalByGuruRow)[]
  polaDaftar: PolaJam[]
  mode: 'kelas' | 'guru'
  onHapusSlot: (id: string) => void
  deletingId: string | null
  canManage: boolean
}) {
  const hariAktif = Array.from(new Set(jadwal.map(j => j.hari))).sort()
  if (hariAktif.length === 0) return null

  // index: "hari-jamKe" → rows
  const index = new Map<string, (JadwalByKelasRow | JadwalByGuruRow)[]>()
  for (const j of jadwal) {
    const key = `${j.hari}-${j.jam_ke}`
    if (!index.has(key)) index.set(key, [])
    index.get(key)!.push(j)
  }

  // Untuk tiap hari, ambil daftar jam dari polanya masing-masing
  // Fallback: kumpulkan nomor jam unik dari data kalau tidak ada pola
  const getJamForHari = (hari: number): SlotJam[] => {
    if (polaDaftar.length > 0) {
      const slots = getSlotsForHari(polaDaftar, hari)
      if (slots.length > 0) return slots
    }
    // Fallback: buat slot dummy dari data yang ada
    const jamKes = Array.from(new Set(
      jadwal.filter(j => j.hari === hari).map(j => j.jam_ke)
    )).sort((a, b) => a - b)
    return jamKes.map(id => ({ id, nama: `Jam ke-${id}`, mulai: '', selesai: '' }))
  }

  // Tinggi max jam per hari untuk menentukan jumlah baris
  const maxJam = Math.max(...hariAktif.map(h => getJamForHari(h).length))
  if (maxJam === 0) return null

  return (
    <div className="overflow-x-auto custom-scrollbar">
      <div className="flex gap-2" style={{ minWidth: `${hariAktif.length * 150}px` }}>
        {hariAktif.map(hari => {
          const jamList = getJamForHari(hari)
          return (
            <div key={hari} className="flex-1 min-w-[140px]">
              {/* Header hari */}
              <div className={cn(
                'px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wide rounded-t-lg border border-b-0',
                HARI_COLORS[hari]
              )}>
                {HARI_LABELS[hari]}
              </div>

              {/* Slot jam */}
              <div className="border border-surface rounded-b-lg overflow-hidden divide-y divide-surface-2">
                {jamList.map(jam => {
                  const cells = index.get(`${hari}-${jam.id}`) ?? []
                  return (
                    <div key={jam.id} className="flex gap-1.5 px-1.5 py-1.5 hover:bg-surface-2/40 transition-colors">
                      {/* Label jam kecil di kiri */}
                      <div className="shrink-0 w-[28px] flex flex-col items-center justify-start pt-0.5">
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 leading-tight">{jam.id}</span>
                        {jam.mulai && (
                          <span className="text-[8px] text-slate-300 dark:text-slate-600 font-mono leading-tight mt-0.5">{jam.mulai}</span>
                        )}
                      </div>

                      {/* Konten cell */}
                      <div className="flex-1 min-w-0">
                        {cells.length === 0 ? (
                          <div className="h-[40px] rounded border border-dashed border-surface-2 flex items-center justify-center">
                            <span className="text-[9px] text-slate-200 dark:text-slate-700">—</span>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {cells.map(cell => (
                              <JadwalCell
                                key={cell.id}
                                row={cell}
                                mode={mode}
                                onHapus={onHapusSlot}
                                isDeleting={deletingId === cell.id}
                                canManage={canManage}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Import XML Panel ───────────────────────────────────────────────────
function ImportXMLPanel({ onDone }: { onDone: () => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<{
    success: string | null; error: string | null
    logs: string[]; stats: { mapel: number; penugasan: number; jadwal: number }
  } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleImport = async () => {
    const file = fileRef.current?.files?.[0]
    if (!file) { alert('Pilih file XML terlebih dahulu.'); return }
    if (!file.name.endsWith('.xml')) { alert('File harus berformat .xml'); return }
    if (!confirm(`Import jadwal dari "${file.name}"?\n\nSEMUA penugasan & jadwal semester aktif akan DIHAPUS dan diganti dengan data dari file ini.`)) return

    setIsLoading(true)
    setResult(null)
    try {
      const text = await file.text()
      const res = await importJadwalASC(text)
      setResult(res)
      if (res.success) onDone()
    } catch (e: any) {
      setResult({ success: null, error: e.message, logs: [], stats: { mapel: 0, penugasan: 0, jadwal: 0 } })
    }
    setIsLoading(false)
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setIsOpen(true)}
        className="h-8 text-xs gap-1.5 border-surface text-slate-600 dark:text-slate-400 dark:text-slate-300 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 rounded-lg">
        <Upload className="h-3.5 w-3.5" /> Import XML ASC
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader className="border-b border-surface-2 pb-3">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Upload className="h-4 w-4 text-blue-600" /> Import Jadwal dari ASC Timetables
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed space-y-1">
                <p className="font-semibold">Import All-in-One</p>
                <p>Cukup upload file XML, maka <strong>master mapel</strong> (+ kode ASC), <strong>penugasan/beban mengajar</strong>, dan <strong>jadwal</strong> akan terisi sekaligus.</p>
                <p className="text-amber-700">Penugasan & jadwal semester aktif yang lama akan <strong>dihapus</strong> dan diganti.</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 dark:text-slate-300">File XML (aSc Timetables format)</label>
              <input
                ref={fileRef}
                type="file"
                accept=".xml"
                className="w-full h-9 text-xs file:mr-2 file:h-full file:border-0 file:bg-slate-100 dark:file:bg-slate-800/80 file:px-3 file:text-xs file:font-medium file:text-slate-700 dark:file:text-slate-300 hover:file:bg-slate-200 rounded-lg border border-surface bg-surface-2 cursor-pointer"
              />
            </div>

            {result && (
              <div className={cn(
                'p-3 rounded-lg text-xs border space-y-2',
                result.success ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-400' : 'bg-rose-50 border-rose-200 text-rose-800'
              )}>
                <div className="flex items-center gap-2 font-semibold">
                  {result.success ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                  {result.success || result.error}
                </div>
                {result.success && (
                  <div className="flex gap-3 text-[11px] flex-wrap">
                    <span>📚 {result.stats.mapel} mapel</span>
                    <span>✅ {result.stats.penugasan} penugasan</span>
                    <span>📅 {result.stats.jadwal} slot jadwal</span>
                  </div>
                )}
                {result.logs.length > 0 && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-[11px] font-medium opacity-70">
                      {result.logs.length} item tidak diproses
                    </summary>
                    <div className="mt-2 max-h-32 overflow-y-auto space-y-0.5">
                      {result.logs.slice(0, 30).map((l, i) => (
                        <p key={i} className="text-[10px] opacity-80 font-mono">• {l}</p>
                      ))}
                      {result.logs.length > 30 && (
                        <p className="text-[10px] opacity-60">...dan {result.logs.length - 30} lainnya</p>
                      )}
                    </div>
                  </details>
                )}
              </div>
            )}

            <Button onClick={handleImport} disabled={isLoading}
              className="w-full h-9 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium">
              {isLoading
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Memproses XML...</>
                : 'Mulai Import'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── MAIN: JadwalTab ────────────────────────────────────────────────────
export function JadwalTab({
  taAktif,
  kelasList,
  guruList,
  polaDaftar,
  userRole = 'guru',
  userId,
  canManageSchedule: canManageScheduleProp,
}: {
  taAktif: { id: string; nama: string; semester: number } | null
  kelasList: KelasItem[]
  guruList: GuruItem[]
  polaDaftar: PolaJam[]
  userRole?: string
  userId?: string
  canManageSchedule?: boolean
}) {
  const isSuperAdmin = userRole === 'super_admin'
  const isGuru = userRole === 'guru'
  const isWaliKelas = userRole === 'wali_kelas'
  const canManageSchedule = canManageScheduleProp ?? !(isGuru || isWaliKelas)
  const isTeacher = !canManageSchedule

  const [viewMode, setViewMode]       = useState<'kelas' | 'guru'>(isWaliKelas ? 'kelas' : 'guru')
  const [selectedKelas, setSelectedKelas] = useState('')
  const [selectedGuru,  setSelectedGuru]  = useState(isGuru && userId ? userId : '')

  const [jadwalKelas, setJadwalKelas] = useState<JadwalByKelasRow[]>([])
  const [jadwalGuru,  setJadwalGuru]  = useState<JadwalByGuruRow[]>([])

  const [isLoading,   setIsLoading]   = useState(false)
  const [deletingId,  setDeletingId]  = useState<string | null>(null)
  const [loaded,      setLoaded]      = useState(false)
  const [hasImported, setHasImported] = useState(false)
  const [codeDialogOpen, setCodeDialogOpen] = useState(false)
  const [codeRows, setCodeRows] = useState<TeacherCodeSetting[]>([])
  const [draftCodes, setDraftCodes] = useState<Record<string, string>>({})
  const [codeSearch, setCodeSearch] = useState('')
  const [isLoadingCodes, setIsLoadingCodes] = useState(false)
  const [isSavingCodes, setIsSavingCodes] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const loadTeacherCodes = async () => {
    if (!taAktif) return
    setIsLoadingCodes(true)
    try {
      const result = await getGuruKodeSettings(taAktif.id)
      if (result.error) {
        alert(result.error)
        return
      }
      setCodeRows(result.teachers)
      setDraftCodes(Object.fromEntries(result.teachers.map(teacher => [teacher.guruId, teacher.kode])))
    } finally {
      setIsLoadingCodes(false)
    }
  }

  const handleCodeDialogChange = (open: boolean) => {
    setCodeDialogOpen(open)
    if (open) {
      setCodeSearch('')
      void loadTeacherCodes()
    }
  }

  const handleSaveTeacherCodes = async () => {
    if (!taAktif) return
    setIsSavingCodes(true)
    try {
      const result = await saveGuruKodeSettings(
        taAktif.id,
        codeRows.map(teacher => ({
          guruId: teacher.guruId,
          kode: draftCodes[teacher.guruId] ?? '',
        })),
      )
      if (result.error) {
        alert(result.error)
        return
      }
      alert(result.success)
      await loadTeacherCodes()
    } finally {
      setIsSavingCodes(false)
    }
  }

  const handleRestoreReferenceCodes = () => {
    setDraftCodes(current => Object.fromEntries(codeRows.map(teacher => [
      teacher.guruId,
      teacher.referenceCode ?? current[teacher.guruId] ?? '',
    ])))
  }

  const handleExportExcel = async () => {
    if (!taAktif) return
    const XLSX = (window as any).XLSX
    if (!XLSX) {
      alert('Library Excel belum siap. Tunggu beberapa detik lalu coba lagi.')
      return
    }

    setIsExporting(true)
    try {
      const result = await getJadwalExportData(taAktif.id)
      if (result.error || !result.data) {
        alert(result.error || 'Data ekspor tidak tersedia.')
        return
      }

      const missing = result.data.teachers.filter(teacher => !teacher.kode.trim())
      if (missing.length > 0) {
        alert(
          `${missing.length} guru belum memiliki kode: ${missing.slice(0, 5).map(teacher => teacher.nama).join(', ')}`
          + (missing.length > 5 ? ', dan lainnya.' : '.')
          + '\n\nLengkapi melalui tombol Kode Guru sebelum mengekspor.',
        )
        setCodeDialogOpen(true)
        setCodeRows(result.data.teachers)
        setDraftCodes(Object.fromEntries(result.data.teachers.map(teacher => [teacher.guruId, teacher.kode])))
        return
      }

      const teachersByCode = new Map<string, string[]>()
      for (const teacher of result.data.teachers) {
        if (!teachersByCode.has(teacher.kode)) teachersByCode.set(teacher.kode, [])
        teachersByCode.get(teacher.kode)!.push(teacher.nama)
      }
      const duplicateCodes = Array.from(teachersByCode.entries()).filter(([, names]) => names.length > 1)
      if (
        duplicateCodes.length > 0
        && !confirm(
          `Ada ${duplicateCodes.length} kode yang dipakai lebih dari satu guru:\n`
          + duplicateCodes.slice(0, 5).map(([code, names]) => `${code}: ${names.join(', ')}`).join('\n')
          + '\n\nTetap ekspor?',
        )
      ) return

      const workbook = buildScheduleWorkbook(XLSX, result.data, polaDaftar)
      const safeYear = dataSafeFilename(`${result.data.tahunAjaran.nama}-S${result.data.tahunAjaran.semester}`)
      XLSX.writeFile(workbook, `Jadwal-Kode-Guru-${safeYear}.xlsx`, { compression: true })
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Gagal membuat file Excel.')
    } finally {
      setIsExporting(false)
    }
  }

  const filteredCodeRows = useMemo(() => {
    const query = codeSearch.toLowerCase().trim()
    if (!query) return codeRows
    return codeRows.filter(teacher =>
      teacher.nama.toLowerCase().includes(query)
      || (draftCodes[teacher.guruId] || '').toLowerCase().includes(query)
      || teacher.mapels.some(mapel => mapel.toLowerCase().includes(query)),
    )
  }, [codeRows, codeSearch, draftCodes])

  const loadJadwal = useCallback(async (id: string, mode: 'kelas' | 'guru') => {
    if (!taAktif || !id) return
    setIsLoading(true)
    setLoaded(false)
    try {
      if (mode === 'kelas') {
        const data = await getJadwalByKelas(id, taAktif.id)
        setJadwalKelas(data as JadwalByKelasRow[])
      } else {
        const data = await getJadwalByGuru(id, taAktif.id)
        setJadwalGuru(data as JadwalByGuruRow[])
      }
      setLoaded(true)
    } catch { setLoaded(true) }
    setIsLoading(false)
  }, [taAktif])

  const handleSelectKelas = (id: string) => { setSelectedKelas(id); setLoaded(false); loadJadwal(id, 'kelas') }
  const handleSelectGuru  = (id: string) => { setSelectedGuru(id);  setLoaded(false); loadJadwal(id, 'guru') }

  const handleHapusSlot = async (id: string) => {
    if (!confirm('Hapus slot jadwal ini?')) return
    setDeletingId(id)
    const res = await hapusSlotJadwal(id)
    if (res.error) { alert(res.error); setDeletingId(null); return }
    if (viewMode === 'kelas' && selectedKelas) await loadJadwal(selectedKelas, 'kelas')
    else if (viewMode === 'guru' && selectedGuru)  await loadJadwal(selectedGuru,  'guru')
    setDeletingId(null)
  }

  const handleHapusJadwalKelas = async () => {
    if (!selectedKelas || !taAktif) return
    const kelas = kelasList.find(k => k.id === selectedKelas)
    if (!confirm(`Reset semua jadwal kelas ${kelas ? formatNamaKelas(kelas.tingkat, kelas.nomor_kelas, kelas.kelompok) : ''}?`)) return
    const res = await resetJadwalKelas(selectedKelas, taAktif.id)
    if (res.error) { alert(res.error); return }
    setJadwalKelas([])
  }

  const handleImportDone = () => {
    setHasImported(true)
    setLoaded(false)
    setJadwalKelas([])
    setJadwalGuru([])
    setSelectedKelas('')
    setSelectedGuru('')
  }

  useEffect(() => {
    if (!taAktif || !userId) return
    if (isGuru) {
      setSelectedGuru(userId)
      setViewMode('guru')
      loadJadwal(userId, 'guru')
    } else if (isWaliKelas) {
      const waliClass = kelasList.find(k => k.wali_kelas_id === userId)
      if (waliClass) {
        setSelectedKelas(waliClass.id)
        setViewMode('kelas')
        loadJadwal(waliClass.id, 'kelas')
      }
    }
  }, [taAktif, userId, isGuru, isWaliKelas, kelasList, loadJadwal])

  // Kelompokkan kelas per tingkat, sort nomor kelas secara numerik
  const kelasByTingkat = kelasList.reduce((acc, k) => {
    const t = String(k.tingkat)
    if (!acc[t]) acc[t] = []
    acc[t].push(k)
    return acc
  }, {} as Record<string, KelasItem[]>)
  // Natural sort: 1, 2, 3, ... 10, 11 (bukan 1, 10, 11, 2, ...)
  for (const t of Object.keys(kelasByTingkat)) {
    kelasByTingkat[t].sort((a, b) => {
      const na = parseInt(a.nomor_kelas) || 0
      const nb = parseInt(b.nomor_kelas) || 0
      return na - nb
    })
  }

  const activeJadwal = viewMode === 'kelas' ? jadwalKelas : jadwalGuru

  // Info pola aktif
  const polaHariInfo = polaDaftar.length > 0
    ? `${polaDaftar.length} pola · ${polaDaftar.map(p => p.nama).join(', ')}`
    : null

  const missingCodeCount = codeRows.filter(teacher => !(draftCodes[teacher.guruId] || '').trim()).length
  const duplicateCodeSet = new Set(
    Object.entries(
      codeRows.reduce<Record<string, number>>((acc, teacher) => {
        const code = (draftCodes[teacher.guruId] || '').trim()
        if (code) acc[code] = (acc[code] || 0) + 1
        return acc
      }, {}),
    ).filter(([, count]) => count > 1).map(([code]) => code),
  )

  return (
    <div className="space-y-3">
      <Dialog open={codeDialogOpen} onOpenChange={handleCodeDialogChange}>
        <DialogContent className="max-w-5xl rounded-xl p-0 overflow-hidden">
          <DialogHeader className="px-5 py-4 border-b border-surface-2 bg-surface-2">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Settings2 className="h-4 w-4 text-blue-600" />
              Kode Guru Tahun Ajaran {taAktif?.nama} - Semester {taAktif?.semester}
            </DialogTitle>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Kode disimpan khusus untuk tahun ajaran ini. Nilai awal dicocokkan dengan daftar Excel referensi.
            </p>
          </DialogHeader>

          <div className="p-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <Input
                  value={codeSearch}
                  onChange={event => setCodeSearch(event.target.value)}
                  placeholder="Cari kode, guru, atau mata pelajaran..."
                  className="h-9 pl-8 text-xs"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRestoreReferenceCodes}
                disabled={isLoadingCodes || codeRows.length === 0}
                className="h-9 text-xs"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                Pulihkan Referensi
              </Button>
            </div>

            {!isLoadingCodes && codeRows.length > 0 && (
              <div className="flex flex-wrap gap-2 text-[11px]">
                <span className="rounded-md border border-surface bg-surface-2 px-2 py-1">
                  {codeRows.length} guru
                </span>
                <span className={cn(
                  'rounded-md border px-2 py-1',
                  missingCodeCount > 0
                    ? 'border-amber-200 bg-amber-50 text-amber-700'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-700',
                )}>
                  {missingCodeCount > 0 ? `${missingCodeCount} belum berkode` : 'Semua guru berkode'}
                </span>
                {duplicateCodeSet.size > 0 && (
                  <span className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-rose-700">
                    {duplicateCodeSet.size} kode duplikat
                  </span>
                )}
              </div>
            )}

            <div className="rounded-lg border border-surface overflow-hidden">
              <div className="grid grid-cols-[90px_minmax(180px,1fr)_minmax(220px,1.2fr)_110px] gap-0 bg-surface-2 border-b border-surface-2 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                <span>Kode</span>
                <span>Nama Guru</span>
                <span>Mata Pelajaran</span>
                <span>Status</span>
              </div>
              <ScrollArea className="h-[52vh]">
                {isLoadingCodes ? (
                  <div className="h-48 flex items-center justify-center gap-2 text-sm text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin" /> Memuat kode guru...
                  </div>
                ) : filteredCodeRows.length === 0 ? (
                  <div className="h-40 flex items-center justify-center text-sm text-slate-400">
                    {codeRows.length === 0 ? 'Belum ada guru dengan beban mengajar.' : 'Guru tidak ditemukan.'}
                  </div>
                ) : (
                  <div className="divide-y divide-surface-2">
                    {filteredCodeRows.map(teacher => {
                      const code = draftCodes[teacher.guruId] || ''
                      const isDuplicate = Boolean(code.trim()) && duplicateCodeSet.has(code.trim())
                      return (
                        <div
                          key={teacher.guruId}
                          className="grid grid-cols-[90px_minmax(180px,1fr)_minmax(220px,1.2fr)_110px] gap-0 items-center px-3 py-2.5 text-xs hover:bg-surface-2/40"
                        >
                          <Input
                            value={code}
                            onChange={event => setDraftCodes(current => ({
                              ...current,
                              [teacher.guruId]: event.target.value,
                            }))}
                            maxLength={12}
                            className={cn(
                              'h-8 w-20 text-center font-semibold',
                              !code.trim() && 'border-amber-300 bg-amber-50',
                              isDuplicate && 'border-rose-300 bg-rose-50',
                            )}
                            aria-label={`Kode guru ${teacher.nama}`}
                          />
                          <div className="pr-3 min-w-0">
                            <p className="font-medium text-slate-800 dark:text-slate-200 truncate">{teacher.nama}</p>
                            {teacher.referenceName && teacher.referenceName !== teacher.nama && (
                              <p className="text-[10px] text-slate-400 truncate" title={teacher.referenceName}>
                                Cocok: {teacher.referenceName}
                              </p>
                            )}
                          </div>
                          <div className="pr-3 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                            {teacher.mapels.join(' • ')}
                          </div>
                          <div>
                            {!code.trim() ? (
                              <span className="text-[10px] rounded bg-amber-100 text-amber-700 px-1.5 py-1">Belum diisi</span>
                            ) : isDuplicate ? (
                              <span className="text-[10px] rounded bg-rose-100 text-rose-700 px-1.5 py-1">Duplikat</span>
                            ) : teacher.source === 'reference' ? (
                              <span className="text-[10px] rounded bg-blue-100 text-blue-700 px-1.5 py-1">Referensi</span>
                            ) : (
                              <span className="text-[10px] rounded bg-emerald-100 text-emerald-700 px-1.5 py-1">Tersimpan</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </ScrollArea>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2">
              <p className="text-[11px] text-slate-400 sm:self-center">
                Ekspor diblokir bila masih ada guru tanpa kode. Kode duplikat akan dikonfirmasi sebelum file dibuat.
              </p>
              <Button
                onClick={handleSaveTeacherCodes}
                disabled={isSavingCodes || isLoadingCodes || codeRows.length === 0}
                className="h-9 text-xs bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isSavingCodes
                  ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  : <Save className="h-3.5 w-3.5 mr-1.5" />}
                Simpan Kode Guru
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* TOOLBAR */}
      <div className="relative z-20 overflow-visible rounded-xl border border-surface bg-surface">

        {/* Baris 1: toggle + aksi kanan */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-surface-2">
          {/* Toggle Per Kelas / Per Guru */}
          <div className="flex rounded-lg border border-surface overflow-hidden shrink-0">
            <button
              onClick={() => { setViewMode('kelas'); setLoaded(false); setJadwalGuru([]) }}
              className={cn(
                'px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors',
                viewMode === 'kelas' ? 'bg-slate-900 text-white' : 'bg-surface text-slate-500 dark:text-slate-400 hover:bg-surface-2'
              )}
            >
              <BookOpen className="h-3 w-3" />
              <span>Per Kelas</span>
            </button>
            <button
              onClick={() => { setViewMode('guru'); setLoaded(false); setJadwalKelas([]) }}
              className={cn(
                'px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors',
                viewMode === 'guru' ? 'bg-slate-900 text-white' : 'bg-surface text-slate-500 dark:text-slate-400 hover:bg-surface-2'
              )}
            >
              <User className="h-3 w-3" />
              <span>Per Guru</span>
            </button>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {canManageSchedule && taAktif && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleCodeDialogChange(true)}
                className="h-8 px-2.5 text-xs border-surface"
                title="Atur kode guru per tahun ajaran"
              >
                <Settings2 className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Kode Guru</span>
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleExportExcel}
                disabled={isExporting}
                className="h-8 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                title="Export seluruh jadwal ke Excel"
              >
                {isExporting
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin sm:mr-1.5" />
                  : <Download className="h-3.5 w-3.5 sm:mr-1.5" />}
                <span className="hidden sm:inline">Export Excel</span>
              </Button>
            </>
          )}

          {/* Refresh */}
          {loaded && (viewMode === 'kelas' ? selectedKelas : selectedGuru) && (
            <button
              onClick={() => loadJadwal(viewMode === 'kelas' ? selectedKelas : selectedGuru, viewMode)}
              className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 dark:text-slate-500 hover:bg-surface-2 hover:text-slate-600 dark:hover:text-slate-400 transition-colors shrink-0"
              title="Refresh"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Import XML */}
          {isSuperAdmin && taAktif && <ImportXMLPanel onDone={handleImportDone} />}
        </div>

        {/* Baris 2: dropdown + reset */}
        <div className="flex items-center gap-2 px-3 py-3">
          {viewMode === 'kelas' ? (
            <Select value={selectedKelas} onValueChange={handleSelectKelas}>
              <SelectTrigger className="h-8 flex-1 text-xs rounded-lg border-surface">
                <SelectValue placeholder="Pilih kelas..." />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {Object.keys(kelasByTingkat).sort((a, b) => parseInt(a) - parseInt(b)).map(tStr => {
                  const items = kelasByTingkat[tStr] || []
                  if (!items.length) return null
                  return (
                    <div key={tStr}>
                      <div className="px-2 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Kelas {tStr}</div>
                      {items.map(k => (
                        <SelectItem key={k.id} value={k.id} className="text-xs">
                          {formatNamaKelas(k.tingkat, k.nomor_kelas, k.kelompok)}
                        </SelectItem>
                      ))}
                    </div>
                  )
                })}
              </SelectContent>
            </Select>
          ) : (
            <Combobox
              value={selectedGuru}
              onValueChange={handleSelectGuru}
              options={guruList.map(guru => ({ value: guru.id, label: guru.nama_lengkap }))}
              placeholder="Pilih guru mata pelajaran..."
              searchPlaceholder="Cari nama guru..."
              emptyText="Guru mata pelajaran tidak ditemukan"
              className="flex-1"
              triggerClassName="h-10 rounded-lg border-surface px-3 text-sm"
              contentClassName="shadow-xl"
              maxResults={80}
            />
          )}

          {/* Reset jadwal kelas — hanya muncul kalau ada data */}
          {canManageSchedule && loaded && activeJadwal.length > 0 && viewMode === 'kelas' && selectedKelas && (
            <button onClick={handleHapusJadwalKelas}
              className="h-8 w-8 flex items-center justify-center rounded-lg text-rose-400 hover:bg-rose-50 hover:text-rose-600 transition-colors shrink-0"
              title="Reset Jadwal Kelas"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {isTeacher && loaded && (
        <div className="bg-surface border border-surface rounded-xl p-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100">
              {isGuru ? <User className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Menampilkan Jadwal</p>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                {viewMode === 'guru'
                  ? guruList.find(g => g.id === selectedGuru)?.nama_lengkap || 'Guru'
                  : (() => {
                      const k = kelasList.find(c => c.id === selectedKelas)
                      return k ? `Kelas ${formatNamaKelas(k.tingkat, k.nomor_kelas, k.kelompok)}` : 'Kelas Binaan'
                    })()
                }
              </p>
            </div>
          </div>
          <button
            onClick={() => loadJadwal(viewMode === 'kelas' ? selectedKelas : selectedGuru, viewMode)}
            className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 dark:text-slate-500 hover:bg-surface-2 hover:text-slate-600 dark:hover:text-slate-400 transition-colors shrink-0"
            title="Refresh"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* KONTEN */}
      <div className="bg-surface border border-surface rounded-xl overflow-hidden">

        {/* Empty: belum pilih */}
        {!isLoading && !loaded && !hasImported && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="p-4 rounded-full bg-surface-2 border border-surface">
              <Calendar className="h-8 w-8 text-slate-300 dark:text-slate-600" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 dark:text-slate-300">Jadwal Mengajar</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {viewMode === 'kelas' ? 'Pilih kelas untuk melihat jadwal' : 'Pilih guru untuk melihat jadwal'}
              </p>
              {taAktif && (
                <p className="text-[11px] text-slate-300 dark:text-slate-600 mt-1">
                  atau import dari file XML ASC Timetables
                </p>
              )}
            </div>
            {!taAktif && (
              <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                Tahun Ajaran aktif belum diatur di Pengaturan
              </div>
            )}
            {taAktif && !polaHariInfo && (
              <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
                <Info className="h-3.5 w-3.5 shrink-0" />
                Jam pelajaran belum dikonfigurasi — waktu jam tidak akan tampil di grid
              </div>
            )}
          </div>
        )}

        {/* Empty: setelah import */}
        {!isLoading && !loaded && hasImported && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="p-3 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100">
              <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 dark:text-slate-200">Import berhasil!</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">Pilih kelas atau guru di atas untuk melihat jadwalnya</p>
            </div>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-16 gap-3 text-slate-400 dark:text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Memuat jadwal...</span>
          </div>
        )}

        {/* Empty: sudah load, tidak ada data */}
        {!isLoading && loaded && activeJadwal.length === 0 && (
          <div className="flex flex-col items-center justify-center py-14 gap-3">
            <div className="p-3 rounded-full bg-surface-2 border border-surface">
              <FileText className="h-6 w-6 text-slate-300 dark:text-slate-600" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                {viewMode === 'kelas' ? 'Belum ada jadwal untuk kelas ini' : 'Belum ada jadwal untuk guru ini'}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500">Import dari XML ASC atau tambah jadwal manual</p>
            </div>
          </div>
        )}

        {/* Ada data → grid */}
        {!isLoading && loaded && activeJadwal.length > 0 && (
          <div className="p-3">
            {/* Info bar */}
            <div className="flex flex-wrap items-center gap-3 mb-3 px-1">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                <span className="text-xs text-slate-400 dark:text-slate-500">{activeJadwal.length} slot jadwal</span>
              </div>
              {polaHariInfo ? (
                <span className="text-[11px] text-slate-400 dark:text-slate-500">{polaHariInfo}</span>
              ) : (
                <span className="text-[11px] text-amber-500 flex items-center gap-1">
                  <Info className="h-3 w-3" /> Jam pelajaran belum dikonfigurasi di Pengaturan
                </span>
              )}
            </div>

            <JadwalGrid
              jadwal={activeJadwal}
              polaDaftar={polaDaftar}
              mode={viewMode}
              onHapusSlot={handleHapusSlot}
              deletingId={deletingId}
              canManage={canManageSchedule}
            />
          </div>
        )}
      </div>
    </div>
  )
}
