// Lokasi: app/dashboard/akademik/akademik-client.tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
import Script from 'next/script'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { BookOpen, FileSpreadsheet, Trash2, Loader2, Download, AlertCircle, Pencil, CalendarDays, RefreshCw, Search, Eye, Layers, User, Save } from 'lucide-react'
import { tambahMapel, editMapel, hapusMapel, importPenugasanASC, hapusPenugasan, importMapelMassal, resetPenugasanSemesterIni } from './actions'
import { JadwalTab } from './components/jadwal-tab'
import { cn } from '@/lib/utils'

type MapelType = { id: string; nama_mapel: string; kode_mapel?: string; kelompok: string; tingkat: string; kategori: string }
type PenugasanType = {
  id: string
  guru: { nama_lengkap: string }
  mapel: { nama_mapel: string; kelompok: string }
  kelas: { tingkat: number; nomor_kelas: string; kelompok: string }
}
type KelasItem = { id: string; tingkat: number; nomor_kelas: string; kelompok: string }
type GuruItem = { id: string; nama_lengkap: string }
type PolaJam = { id: string; nama: string; hari: number[]; slots: any[] }

const getAvatarColor = (name: string) => {
  const colors = [
    'from-emerald-100 to-emerald-200 text-emerald-800',
    'from-teal-100 to-teal-200 text-teal-800',
    'from-blue-100 to-blue-200 text-blue-800',
    'from-indigo-100 to-indigo-200 text-indigo-800',
    'from-amber-100 to-amber-200 text-amber-800',
  ]
  return colors[(name?.charCodeAt(0) || 0) % colors.length]
}

export function AkademikClient({
  mapelData, penugasanData, taAktif, daftarJurusan = [],
  kelasList = [], guruList = [], polaDaftar = [], userRole = 'guru'
}: {
  mapelData: MapelType[]
  penugasanData: PenugasanType[]
  taAktif: { id: string; nama: string; semester: number } | null
  daftarJurusan?: string[]
  kelasList?: KelasItem[]
  guruList?: GuruItem[]
  polaDaftar?: PolaJam[]
  userRole?: string
}) {
  const [isMapelPending, setIsMapelPending] = useState(false)
  const [searchMapel, setSearchMapel] = useState('')
  const [currentMapelPage, setCurrentMapelPage] = useState(1)
  const [mapelItemsPerPage, setMapelItemsPerPage] = useState(20)
  const [pendingMapelChanges, setPendingMapelChanges] = useState<Record<string, { kode_mapel?: string }>>({})
  const [isSavingBatchMapel, setIsSavingBatchMapel] = useState(false)
  const [editingMapel, setEditingMapel] = useState<MapelType | null>(null)

  const [searchPenugasan, setSearchPenugasan] = useState('')
  const [currentPenugasanPage, setCurrentPenugasanPage] = useState(1)
  const [penugasanItemsPerPage, setPenugasanItemsPerPage] = useState(20)
  const [viewModePenugasan, setViewModePenugasan] = useState<'guru' | 'mapel'>('guru')
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null)
  const [selectedMapelKey, setSelectedMapelKey] = useState<string | null>(null)

  const [isImportingASC, setIsImportingASC] = useState(false)
  const [importLogs, setImportLogs] = useState<string[]>([])
  const [isImportingMapel, setIsImportingMapel] = useState(false)

  // ── Helpers ──────────────────────────────────────────────────────────────
  const handleQueueMapelChange = (id: string, value: string) =>
    setPendingMapelChanges(prev => ({ ...prev, [id]: { ...(prev[id] || {}), kode_mapel: value } }))
  const getMapelValue = (id: string, orig?: string) =>
    pendingMapelChanges[id]?.kode_mapel !== undefined ? pendingMapelChanges[id].kode_mapel : (orig || '')

  const executeBatchSaveMapel = async () => {
    setIsSavingBatchMapel(true)
    const promises = Object.entries(pendingMapelChanges).map(async ([id, changes]) => {
      const m = mapelData.find(x => x.id === id)
      if (!m) return
      const fd = new FormData()
      fd.append('id', id); fd.append('nama_mapel', m.nama_mapel)
      fd.append('kode_mapel', changes.kode_mapel || ''); fd.append('kelompok', m.kelompok)
      fd.append('tingkat', m.tingkat); fd.append('kategori', m.kategori)
      return editMapel({}, fd)
    })
    const results = await Promise.all(promises)
    if (results.some(r => r?.error)) alert('Terjadi kesalahan saat menyimpan beberapa perubahan.')
    else setPendingMapelChanges({})
    setIsSavingBatchMapel(false)
  }

  const normalizeMapelName = (name: string) => {
    const lower = name.toLowerCase()
    if (lower.includes('terpadu') || lower === 'ipat' || lower === 'ipst') return name.trim()
    return name.replace(/^IPA\s+/i, '').replace(/^IPS\s+/i, '').replace(/\s+Tingkat Lanjut/i, '').replace(/\s+TL/i, '').replace(/\s*\(Peminatan\)/i, '').trim()
  }

  // ── Mapel filtering ───────────────────────────────────────────────────────
  const filteredMapel = mapelData.filter(m =>
    m.nama_mapel.toLowerCase().includes(searchMapel.toLowerCase()) ||
    (m.kode_mapel && m.kode_mapel.toLowerCase().includes(searchMapel.toLowerCase()))
  )
  const totalMapelPages = Math.ceil(filteredMapel.length / mapelItemsPerPage)
  const paginatedMapel = filteredMapel.slice((currentMapelPage - 1) * mapelItemsPerPage, currentMapelPage * mapelItemsPerPage)
  useEffect(() => { setCurrentMapelPage(1) }, [searchMapel, mapelItemsPerPage])

  // ── Penugasan grouping ────────────────────────────────────────────────────
  const groupedByGuru = useMemo(() => {
    const groups = new Map<string, any>()
    penugasanData.forEach(p => {
      if (!p.guru || !p.mapel || !p.kelas) return
      const key = `${p.guru.nama_lengkap}__${p.mapel.nama_mapel}`
      if (!groups.has(key)) groups.set(key, { guru_nama: p.guru.nama_lengkap, mapel_nama: p.mapel.nama_mapel, mapel_kelompok: p.mapel.kelompok, key, list: [] })
      groups.get(key).list.push(p)
    })
    groups.forEach(g => g.list.sort((a: any, b: any) => `${a.kelas.tingkat}-${a.kelas.nomor_kelas}`.localeCompare(`${b.kelas.tingkat}-${b.kelas.nomor_kelas}`, undefined, { numeric: true })))
    return Array.from(groups.values())
  }, [penugasanData])

  const filteredByGuru = useMemo(() =>
    groupedByGuru.filter(g =>
      g.guru_nama.toLowerCase().includes(searchPenugasan.toLowerCase()) ||
      g.mapel_nama.toLowerCase().includes(searchPenugasan.toLowerCase()) ||
      g.list.some((p: any) => p.kelas.nomor_kelas.toLowerCase().includes(searchPenugasan.toLowerCase()))
    ).sort((a, b) => a.guru_nama.localeCompare(b.guru_nama))
  , [groupedByGuru, searchPenugasan])

  const selectedGuruGroup = useMemo(() => groupedByGuru.find(g => g.key === selectedGroupKey), [groupedByGuru, selectedGroupKey])

  const groupedByMapel = useMemo(() => {
    const groups = new Map<string, any>()
    penugasanData.forEach(p => {
      if (!p.guru || !p.mapel || !p.kelas) return
      const normalizedName = normalizeMapelName(p.mapel.nama_mapel)
      const key = normalizedName.toLowerCase()
      if (!groups.has(key)) groups.set(key, { mapel_nama_utama: normalizedName, key, total_kelas: 0, guru_list: new Map<string, any>() })
      const mg = groups.get(key)
      mg.total_kelas++
      if (!mg.guru_list.has(p.guru.nama_lengkap)) mg.guru_list.set(p.guru.nama_lengkap, { guru_nama: p.guru.nama_lengkap, mapel_asli: p.mapel.nama_mapel, kelas_list: [] })
      mg.guru_list.get(p.guru.nama_lengkap).kelas_list.push(p)
    })
    return Array.from(groups.values()).map(g => {
      const guruArr = Array.from(g.guru_list.values())
      guruArr.forEach((gg: any) => gg.kelas_list.sort((a: any, b: any) => `${a.kelas.tingkat}-${a.kelas.nomor_kelas}`.localeCompare(`${b.kelas.tingkat}-${b.kelas.nomor_kelas}`, undefined, { numeric: true })))
      guruArr.sort((a: any, b: any) => a.guru_nama.localeCompare(b.guru_nama))
      return { ...g, guru_list: guruArr }
    }).sort((a, b) => a.mapel_nama_utama.localeCompare(b.mapel_nama_utama))
  }, [penugasanData])

  const filteredByMapel = useMemo(() =>
    groupedByMapel.filter(g =>
      g.mapel_nama_utama.toLowerCase().includes(searchPenugasan.toLowerCase()) ||
      g.guru_list.some((gg: any) => gg.guru_nama.toLowerCase().includes(searchPenugasan.toLowerCase()))
    )
  , [groupedByMapel, searchPenugasan])

  const selectedMapelGroup = useMemo(() => groupedByMapel.find(g => g.key === selectedMapelKey), [groupedByMapel, selectedMapelKey])

  const currentActiveData = viewModePenugasan === 'guru' ? filteredByGuru : filteredByMapel
  const totalPenugasanPages = Math.ceil(currentActiveData.length / penugasanItemsPerPage)
  const paginatedPenugasan = currentActiveData.slice((currentPenugasanPage - 1) * penugasanItemsPerPage, currentPenugasanPage * penugasanItemsPerPage)
  useEffect(() => { setCurrentPenugasanPage(1) }, [searchPenugasan, penugasanItemsPerPage, viewModePenugasan])

  // ── Action handlers ───────────────────────────────────────────────────────
  const handleHapusMapel = async (id: string, nama: string) => {
    if (!confirm(`Hapus mata pelajaran "${nama}"?`)) return
    setIsMapelPending(true)
    const res = await hapusMapel(id)
    if (res?.error) alert(res.error)
    setIsMapelPending(false)
  }

  const handleResetJadwal = async () => {
    if (!taAktif) return
    const k = prompt(`BERBAHAYA!\nKetik "RESET" untuk menghapus ${penugasanData.length} jadwal semester ini:`)
    if (k !== 'RESET') { if (k !== null) alert('Kata kunci tidak cocok.'); return }
    setIsMapelPending(true)
    const res = await resetPenugasanSemesterIni(taAktif.id)
    if (res?.error) alert(res.error)
    else alert(res.success)
    setIsMapelPending(false)
  }

  const handleDownloadTemplateMapel = () => {
    const XLSX = (window as any).XLSX; if (!XLSX) return alert('Library belum siap.')
    const ws = XLSX.utils.json_to_sheet([
      { KODE_RDM: 'IPAT', NAMA_MAPEL: 'IPA Terpadu', KELOMPOK: 'UMUM', TINGKAT: '10', KATEGORI: 'Kelompok Mata Pelajaran Umum' },
      { KODE_RDM: 'BIO', NAMA_MAPEL: 'Biologi', KELOMPOK: 'MIPA', TINGKAT: '11 & 12', KATEGORI: 'Kelompok Mata Pelajaran Pilihan' },
    ])
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Master_Mapel')
    XLSX.writeFile(wb, 'Template_Import_Mapel.xlsx')
  }

  const handleFileUploadMapel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setIsImportingMapel(true)
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const XLSX = (window as any).XLSX
        const wb = XLSX.read(ev.target?.result, { type: 'binary' })
        const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])
        const res = await importMapelMassal(data)
        if (res.error) alert(res.error); else alert(res.success)
      } catch { alert('Gagal membaca file Excel.') }
      finally { setIsImportingMapel(false); e.target.value = '' }
    }
    reader.readAsBinaryString(file)
  }

  const handleDownloadTemplateASC = () => {
    const XLSX = (window as any).XLSX; if (!XLSX) return alert('Library belum siap.')
    const ws = XLSX.utils.json_to_sheet([
      { NAMA_GURU: 'Muhammad Ropik Nazib, M.Ag.', NAMA_KELAS: '12-1', NAMA_MAPEL: 'Fikih' },
      { NAMA_GURU: 'Drs. Khoerun', NAMA_KELAS: '12-1', NAMA_MAPEL: 'Pendidikan Pancasila' },
    ])
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Jadwal_ASC')
    XLSX.writeFile(wb, 'Template_Import_ASC.xlsx')
  }

  const handleFileUploadASC = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setIsImportingASC(true); setImportLogs([])
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const XLSX = (window as any).XLSX
        const wb = XLSX.read(ev.target?.result, { type: 'binary' })
        const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])
        const res = await importPenugasanASC(data)
        if (res.error) alert(res.error); else alert(res.success)
        if (res.logs?.length > 0) setImportLogs(res.logs)
      } catch { alert('Gagal membaca file Excel.') }
      finally { setIsImportingASC(false); e.target.value = '' }
    }
    reader.readAsBinaryString(file)
  }

  // ── Modal form: shared mapel fields ──────────────────────────────────────
  const MapelFormFields = ({ defaults }: { defaults?: MapelType }) => (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300 dark:text-slate-600">Nama Mata Pelajaran <span className="text-rose-500">*</span></Label>
        <Input name="nama_mapel" defaultValue={defaults?.nama_mapel} required placeholder="Contoh: Biologi" className="h-9 text-sm rounded-lg" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300 dark:text-slate-600">Kode RDM <span className="text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 font-normal">(Opsional)</span></Label>
        <Input name="kode_mapel" defaultValue={defaults?.kode_mapel || ''} placeholder="Contoh: BIO, IPAT" className="h-9 text-sm rounded-lg font-mono text-emerald-700" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300 dark:text-slate-600">Kelompok</Label>
          <Select name="kelompok" defaultValue={defaults?.kelompok || 'UMUM'}>
            <SelectTrigger className="h-9 text-xs rounded-lg"><SelectValue /></SelectTrigger>
            <SelectContent>{daftarJurusan.map(j => <SelectItem key={j} value={j} className="text-xs">{j}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300 dark:text-slate-600">Tingkat</Label>
          <Select name="tingkat" defaultValue={defaults?.tingkat || 'Semua'}>
            <SelectTrigger className="h-9 text-xs rounded-lg"><SelectValue /></SelectTrigger>
            <SelectContent>
              {['10','11','12','11 & 12','Semua'].map(v => <SelectItem key={v} value={v} className="text-xs">{v === 'Semua' ? 'Semua' : `Kelas ${v}`}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300 dark:text-slate-600">Kategori</Label>
          <Select name="kategori" defaultValue={defaults?.kategori || 'Kelompok Mata Pelajaran Umum'}>
            <SelectTrigger className="h-9 text-xs rounded-lg"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Kelompok Mata Pelajaran Umum" className="text-xs">Umum</SelectItem>
              <SelectItem value="Kelompok Mata Pelajaran Pilihan" className="text-xs">Pilihan</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )

  return (
    <>
      <Script src="https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js" strategy="lazyOnload" />

      {/* MODAL EDIT MAPEL */}
      <Dialog open={!!editingMapel} onOpenChange={open => !open && setEditingMapel(null)}>
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader className="border-b pb-3"><DialogTitle className="text-sm font-semibold">Edit Mata Pelajaran</DialogTitle></DialogHeader>
          <form action={async (fd) => {
            setIsMapelPending(true)
            fd.append('id', editingMapel!.id)
            const res = await editMapel({}, fd)
            if (res?.error) alert(res.error)
            setIsMapelPending(false); setEditingMapel(null)
          }} className="pt-3 space-y-3">
            <MapelFormFields defaults={editingMapel!} />
            <Button type="submit" disabled={isMapelPending} className="w-full h-9 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg mt-1">
              {isMapelPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update Mapel'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL DETAIL GURU */}
      <Dialog open={!!selectedGroupKey} onOpenChange={open => !open && setSelectedGroupKey(null)}>
        <DialogContent className="sm:max-w-md rounded-xl overflow-hidden p-0">
          <DialogHeader className="px-4 py-3 border-b bg-surface-2">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Layers className="h-4 w-4 text-indigo-600" /> Detail Rombongan Belajar
            </DialogTitle>
          </DialogHeader>
          {selectedGuruGroup && (
            <div className="flex flex-col max-h-[70vh]">
              <div className="p-4 pb-2">
                <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                  <p className="font-bold text-indigo-900 text-sm leading-tight">{selectedGuruGroup.guru_nama}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs font-semibold text-indigo-700">{selectedGuruGroup.mapel_nama}</span>
                    {selectedGuruGroup.mapel_kelompok !== 'UMUM' && (
                      <span className="text-[9px] font-bold uppercase tracking-wide bg-surface px-1.5 py-0.5 rounded text-indigo-600 border border-indigo-200">{selectedGuruGroup.mapel_kelompok}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-hidden px-4 pb-4">
                <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 mt-2">{selectedGuruGroup.list.length} Kelas</p>
                <ScrollArea className="h-64 rounded-lg border border-surface bg-surface-2 p-2">
                  <div className="space-y-1.5">
                    {selectedGuruGroup.list.map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between bg-surface px-3 py-2 rounded-lg border border-surface-2 group hover:border-indigo-200 transition-colors">
                        <div className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs border border-indigo-200">{p.kelas.tingkat}</div>
                          <div>
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Kelas {p.kelas.tingkat}-{p.kelas.nomor_kelas}</span>
                            {p.kelas.kelompok !== 'UMUM' && <span className="text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 ml-1.5">{p.kelas.kelompok}</span>}
                          </div>
                        </div>
                        <button
                          onClick={async () => { if (confirm(`Hapus jadwal di Kelas ${p.kelas.tingkat}-${p.kelas.nomor_kelas}?`)) { setIsMapelPending(true); await hapusPenugasan(p.id); setIsMapelPending(false) } }}
                          className="p-1 text-slate-300 dark:text-slate-600 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                        ><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL DETAIL MAPEL */}
      <Dialog open={!!selectedMapelKey} onOpenChange={open => !open && setSelectedMapelKey(null)}>
        <DialogContent className="sm:max-w-lg rounded-xl overflow-hidden p-0">
          <DialogHeader className="px-4 py-3 border-b bg-surface-2">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-emerald-600" /> Detail Pengajar Mata Pelajaran
            </DialogTitle>
          </DialogHeader>
          {selectedMapelGroup && (
            <div className="flex flex-col max-h-[75vh]">
              <div className="p-4 pb-2">
                <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100 flex justify-between items-center">
                  <div>
                    <p className="font-bold text-emerald-900 text-sm leading-tight">{selectedMapelGroup.mapel_nama_utama}</p>
                    <p className="text-xs text-emerald-700 mt-0.5">{selectedMapelGroup.total_kelas} Kelas · {selectedMapelGroup.guru_list.length} Guru</p>
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-hidden px-4 pb-4">
                <ScrollArea className="h-72 rounded-lg border border-surface bg-surface-2 p-2">
                  <div className="space-y-3">
                    {selectedMapelGroup.guru_list.map((gi: any) => (
                      <div key={gi.guru_nama} className="bg-surface rounded-lg border border-surface overflow-hidden">
                        <div className="bg-surface-2 px-3 py-2 border-b border-surface-2 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={cn("h-7 w-7 rounded-full bg-gradient-to-br flex items-center justify-center text-xs font-bold shrink-0", getAvatarColor(gi.guru_nama))}>
                              {gi.guru_nama.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 leading-tight">{gi.guru_nama}</p>
                              {gi.mapel_asli !== selectedMapelGroup.mapel_nama_utama && (
                                <p className="text-[9px] text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 italic">{gi.mapel_asli}</p>
                              )}
                            </div>
                          </div>
                          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 bg-surface px-1.5 py-0.5 rounded border border-surface">{gi.kelas_list.length} Kls</span>
                        </div>
                        <div className="p-2 grid grid-cols-3 gap-1.5">
                          {gi.kelas_list.map((p: any) => (
                            <div key={p.id} className="flex justify-between items-center bg-surface-2 px-2 py-1.5 rounded border border-surface-2 group hover:border-emerald-200 transition-colors">
                              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{p.kelas.tingkat}-{p.kelas.nomor_kelas}</span>
                              <button
                                onClick={async () => { if (confirm(`Hapus jadwal di Kelas ${p.kelas.tingkat}-${p.kelas.nomor_kelas}?`)) { setIsMapelPending(true); await hapusPenugasan(p.id); setIsMapelPending(false) } }}
                                className="text-slate-300 dark:text-slate-600 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                              ><Trash2 className="h-3 w-3" /></button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── MAIN ── */}
      <div className="space-y-3 pb-20">
        <Tabs defaultValue="jadwal" className="space-y-3">
          <TabsList className="bg-surface border border-surface p-0.5 grid grid-cols-3 h-auto rounded-lg">
            <TabsTrigger value="jadwal" className="py-2 rounded-md data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs sm:text-sm font-medium">
              Jadwal Mengajar
            </TabsTrigger>
            <TabsTrigger value="penugasan" className="py-2 rounded-md data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-xs sm:text-sm font-medium">
              Beban Mengajar
            </TabsTrigger>
            <TabsTrigger value="mapel" className="py-2 rounded-md data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-xs sm:text-sm font-medium">
              Master Mapel
            </TabsTrigger>
          </TabsList>

          {/* ══ TAB 0: JADWAL MENGAJAR ══════════════════════════════════ */}
          <TabsContent value="jadwal" className="space-y-3 m-0">
            <JadwalTab
              taAktif={taAktif}
              kelasList={kelasList}
              guruList={guruList}
              polaDaftar={polaDaftar}
              userRole={userRole}
            />
          </TabsContent>
          <TabsContent value="penugasan" className="space-y-3 m-0">
            {/* TA Banner */}
            {!taAktif ? (
              <div className="p-3 bg-rose-50 text-rose-600 rounded-lg border border-rose-200 flex items-center gap-2 text-xs font-medium">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" /> Tahun Ajaran Aktif belum diatur di menu Pengaturan.
              </div>
            ) : (
              <div className="bg-indigo-50 text-indigo-800 px-3 py-2 rounded-lg border border-indigo-200 flex items-center gap-2 text-xs">
                <CalendarDays className="h-3.5 w-3.5 shrink-0 text-indigo-600" />
                Jadwal: <strong className="bg-surface px-1.5 py-0.5 rounded border border-indigo-200 mx-1 text-indigo-900">{taAktif.nama}</strong> Smt {taAktif.semester}
              </div>
            )}

            {/* Toolbar */}
            <div className="bg-surface border border-surface rounded-lg p-3 space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500" />
                  <Input
                    placeholder={viewModePenugasan === 'guru' ? 'Cari guru / mapel...' : 'Cari mapel / guru...'}
                    value={searchPenugasan} onChange={e => setSearchPenugasan(e.target.value)}
                    className="pl-8 h-8 text-sm rounded-md"
                  />
                </div>
                {/* View toggle */}
                <div className="flex bg-surface-3 p-0.5 rounded-md shrink-0">
                  <button onClick={() => setViewModePenugasan('guru')} className={cn("px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 transition-colors", viewModePenugasan === 'guru' ? 'bg-surface text-indigo-700 shadow-sm' : 'text-slate-500 dark:text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:text-slate-200')}>
                    <User className="h-3.5 w-3.5" /> Guru
                  </button>
                  <button onClick={() => setViewModePenugasan('mapel')} className={cn("px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 transition-colors", viewModePenugasan === 'mapel' ? 'bg-surface text-indigo-700 shadow-sm' : 'text-slate-500 dark:text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:text-slate-200')}>
                    <BookOpen className="h-3.5 w-3.5" /> Mapel
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleResetJadwal} disabled={isMapelPending || !taAktif || penugasanData.length === 0} variant="outline" size="sm" className="h-7 text-xs text-rose-600 border-rose-200 hover:bg-rose-50 rounded">
                  <RefreshCw className="h-3 w-3 mr-1" /> Reset
                </Button>
                {/* Import ASC */}
                <Dialog>
                  <DialogTrigger asChild>
                    <Button disabled={!taAktif} size="sm" className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded ml-auto">
                      <FileSpreadsheet className="h-3 w-3 mr-1" /> Import ASC
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-lg rounded-xl">
                    <DialogHeader className="border-b pb-3"><DialogTitle className="text-sm font-semibold">Import Data ASC</DialogTitle></DialogHeader>
                    <div className="space-y-3 pt-2">
                      <div className="flex justify-between items-center p-2.5 bg-surface-2 border border-surface rounded-lg">
                        <span className="text-xs text-slate-600 dark:text-slate-300 dark:text-slate-600 font-medium">Download template:</span>
                        <Button size="sm" variant="outline" onClick={handleDownloadTemplateASC} className="h-7 text-xs gap-1"><Download className="h-3 w-3" />Template</Button>
                      </div>
                      <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-lg text-xs text-indigo-800 space-y-1">
                        <p className="font-semibold">Masuk ke: {taAktif?.nama} Smt {taAktif?.semester}</p>
                        <p className="font-mono"><strong className="bg-surface px-1 rounded">NAMA_GURU</strong> · <strong className="bg-surface px-1 rounded">NAMA_KELAS</strong> · <strong className="bg-surface px-1 rounded">NAMA_MAPEL</strong></p>
                      </div>
                      <Input type="file" accept=".xlsx,.xls" onChange={handleFileUploadASC} disabled={isImportingASC} className="h-9 text-xs rounded-lg cursor-pointer" />
                      {isImportingASC && <div className="flex items-center text-xs font-medium text-indigo-600 bg-indigo-50 p-2.5 rounded-lg animate-pulse"><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Memplot jadwal...</div>}
                      {importLogs.length > 0 && (
                        <div className="border border-rose-200 rounded-lg overflow-hidden">
                          <div className="bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" />Data Tidak Cocok:</div>
                          <ScrollArea className="h-28 bg-surface p-3 text-xs font-mono text-rose-600">
                            {importLogs.map((log, i) => <div key={i}>{log}</div>)}
                          </ScrollArea>
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* MOBILE CARDS */}
            <div className="block lg:hidden space-y-2">
              {paginatedPenugasan.length === 0 ? (
                <div className="bg-surface py-10 rounded-lg border border-surface text-center">
                  <CalendarDays className="h-7 w-7 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                  <p className="text-sm text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500">Belum ada jadwal di semester ini.</p>
                </div>
              ) : paginatedPenugasan.map(item => {
                if (viewModePenugasan === 'guru') {
                  const g = item as any
                  return (
                    <div key={g.key} className="bg-surface border border-surface rounded-lg p-3 flex items-center gap-3">
                      <div className={cn("h-9 w-9 shrink-0 rounded-full bg-gradient-to-br flex items-center justify-center text-sm font-bold", getAvatarColor(g.guru_nama))}>
                        {g.guru_nama.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate leading-tight">{g.guru_nama}</p>
                        <p className="text-xs text-indigo-600 truncate mt-0.5">{g.mapel_nama}</p>
                        {g.mapel_kelompok !== 'UMUM' && <span className="text-[9px] font-bold bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded border border-indigo-100 uppercase">{g.mapel_kelompok}</span>}
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">{g.list.length} Kls</span>
                        <button onClick={() => setSelectedGroupKey(g.key)} className="text-[10px] font-medium text-slate-500 dark:text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 hover:text-indigo-600 flex items-center gap-0.5">
                          <Eye className="h-3 w-3" />Detail
                        </button>
                      </div>
                    </div>
                  )
                } else {
                  const m = item as any
                  return (
                    <div key={m.key} className="bg-surface border border-surface rounded-lg p-3 flex items-center gap-3">
                      <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600 border border-emerald-100 shrink-0">
                        <BookOpen className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate leading-tight">{m.mapel_nama_utama}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-0.5">{m.guru_list.length} Guru Pengampu</p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">{m.total_kelas} Kls</span>
                        <button onClick={() => setSelectedMapelKey(m.key)} className="text-[10px] font-medium text-slate-500 dark:text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 hover:text-emerald-600 flex items-center gap-0.5">
                          <Eye className="h-3 w-3" />Detail
                        </button>
                      </div>
                    </div>
                  )
                }
              })}
            </div>

            {/* DESKTOP TABLE */}
            <div className="hidden lg:block bg-surface rounded-lg border border-surface overflow-hidden">
              <div className="overflow-x-auto">
                <Table className="min-w-[700px]">
                  <TableHeader>
                    <TableRow className="bg-surface-2 hover:bg-surface-2">
                      {viewModePenugasan === 'guru' ? (
                        <>
                          <TableHead className="h-9 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 w-72">Guru Pengajar</TableHead>
                          <TableHead className="h-9 text-xs font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500">Mata Pelajaran</TableHead>
                        </>
                      ) : (
                        <>
                          <TableHead className="h-9 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 w-72">Mata Pelajaran</TableHead>
                          <TableHead className="h-9 text-xs font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500">Daftar Pengampu</TableHead>
                        </>
                      )}
                      <TableHead className="h-9 text-xs font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 text-center w-28">Beban</TableHead>
                      <TableHead className="h-9 text-xs font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 text-right px-4 w-32">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedPenugasan.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="h-24 text-center text-sm text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500">Belum ada jadwal di semester ini.</TableCell></TableRow>
                    ) : paginatedPenugasan.map(item => {
                      if (viewModePenugasan === 'guru') {
                        const g = item as any
                        return (
                          <TableRow key={g.key} className="hover:bg-surface-2/60 border-surface-2 group">
                            <TableCell className="px-4 py-2.5">
                              <div className="flex items-center gap-3">
                                <div className={cn("h-8 w-8 shrink-0 rounded-full bg-gradient-to-br flex items-center justify-center text-sm font-bold", getAvatarColor(g.guru_nama))}>
                                  {g.guru_nama.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{g.guru_nama}</span>
                              </div>
                            </TableCell>
                            <TableCell className="py-2.5">
                              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{g.mapel_nama}</p>
                              {g.mapel_kelompok !== 'UMUM' && <span className="text-[9px] font-bold uppercase tracking-wide text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded mt-0.5 inline-block">{g.mapel_kelompok}</span>}
                            </TableCell>
                            <TableCell className="py-2.5 text-center">
                              <span className="text-sm font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">{g.list.length}</span>
                            </TableCell>
                            <TableCell className="py-2.5 px-4 text-right">
                              <button onClick={() => setSelectedGroupKey(g.key)} className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                                <Layers className="h-3.5 w-3.5" /> Kelas
                              </button>
                            </TableCell>
                          </TableRow>
                        )
                      } else {
                        const m = item as any
                        return (
                          <TableRow key={m.key} className="hover:bg-surface-2/60 border-surface-2 group">
                            <TableCell className="px-4 py-2.5">
                              <div className="flex items-center gap-2.5">
                                <div className="p-1.5 bg-emerald-50 rounded-md text-emerald-600 border border-emerald-100"><BookOpen className="h-3.5 w-3.5" /></div>
                                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{m.mapel_nama_utama}</span>
                              </div>
                            </TableCell>
                            <TableCell className="py-2.5">
                              <div className="flex flex-wrap gap-1">
                                {m.guru_list.slice(0, 3).map((g: any) => (
                                  <span key={g.guru_nama} className="text-[10px] font-medium text-slate-600 dark:text-slate-300 dark:text-slate-600 bg-surface-3 border border-surface px-2 py-0.5 rounded">{g.guru_nama.split(',')[0]}</span>
                                ))}
                                {m.guru_list.length > 3 && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">+{m.guru_list.length - 3}</span>}
                              </div>
                            </TableCell>
                            <TableCell className="py-2.5 text-center">
                              <span className="text-sm font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">{m.total_kelas}</span>
                            </TableCell>
                            <TableCell className="py-2.5 px-4 text-right">
                              <button onClick={() => setSelectedMapelKey(m.key)} className="text-xs font-medium text-emerald-600 hover:text-emerald-800 flex items-center gap-1 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                                <Eye className="h-3.5 w-3.5" /> Rincian
                              </button>
                            </TableCell>
                          </TableRow>
                        )
                      }
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Pagination Penugasan */}
            <div className="flex items-center justify-between bg-surface border border-surface rounded-lg px-3 py-2">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500">
                <Select value={penugasanItemsPerPage.toString()} onValueChange={v => { setPenugasanItemsPerPage(Number(v)); setCurrentPenugasanPage(1) }}>
                  <SelectTrigger className="h-7 w-16 text-xs rounded border-surface"><SelectValue /></SelectTrigger>
                  <SelectContent>{[10,20,50].map(n => <SelectItem key={n} value={n.toString()}>{n}</SelectItem>)}</SelectContent>
                </Select>
                <span><strong className="text-slate-700 dark:text-slate-200">{currentActiveData.length}</strong> grup {viewModePenugasan}</span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={() => setCurrentPenugasanPage(p => Math.max(1, p - 1))} disabled={currentPenugasanPage === 1} className="h-7 px-2.5 text-xs rounded">←</Button>
                <span className="text-xs font-medium px-2">{currentPenugasanPage}/{totalPenugasanPages || 1}</span>
                <Button variant="outline" size="sm" onClick={() => setCurrentPenugasanPage(p => Math.min(totalPenugasanPages, p + 1))} disabled={currentPenugasanPage >= totalPenugasanPages} className="h-7 px-2.5 text-xs rounded">→</Button>
              </div>
            </div>
          </TabsContent>

          {/* ══ TAB 2: MASTER MAPEL ══════════════════════════════════════ */}
          <TabsContent value="mapel" className="space-y-3 m-0">
            {/* Toolbar */}
            <div className="bg-surface border border-surface rounded-lg p-3 flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-0" style={{ minWidth: '140px' }}>
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500" />
                <Input placeholder="Cari nama atau kode mapel..." value={searchMapel} onChange={e => setSearchMapel(e.target.value)} className="pl-8 h-8 text-sm rounded-md" />
              </div>
              <div className="flex gap-2 ml-auto">
                {/* Import Mapel */}
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs rounded-md border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                      <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Import
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-lg rounded-xl">
                    <DialogHeader className="border-b pb-3"><DialogTitle className="text-sm font-semibold">Import Master Mata Pelajaran</DialogTitle></DialogHeader>
                    <div className="space-y-3 pt-2">
                      <div className="flex justify-between items-center p-2.5 bg-surface-2 border border-surface rounded-lg">
                        <span className="text-xs text-slate-600 dark:text-slate-300 dark:text-slate-600 font-medium">Download template:</span>
                        <Button size="sm" variant="outline" onClick={handleDownloadTemplateMapel} className="h-7 text-xs gap-1"><Download className="h-3 w-3" />Template</Button>
                      </div>
                      <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-lg text-xs text-emerald-800 space-y-0.5">
                        {['NAMA_MAPEL','KODE_RDM (opsional)','KELOMPOK','TINGKAT','KATEGORI'].map(k => (
                          <p key={k} className="font-mono"><strong className="bg-surface px-1 rounded border border-emerald-200">{k}</strong></p>
                        ))}
                      </div>
                      <Input type="file" accept=".xlsx,.xls" onChange={handleFileUploadMapel} disabled={isImportingMapel} className="h-9 text-xs rounded-lg cursor-pointer" />
                      {isImportingMapel && <div className="flex items-center text-xs text-emerald-600 bg-emerald-50 p-2.5 rounded-lg animate-pulse"><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Mengimport...</div>}
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Tambah Mapel */}
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm" className="h-8 text-xs rounded-md bg-emerald-600 hover:bg-emerald-700 text-white">
                      <BookOpen className="h-3.5 w-3.5 mr-1" /> Tambah
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md rounded-xl">
                    <DialogHeader className="border-b pb-3"><DialogTitle className="text-sm font-semibold">Tambah Mata Pelajaran</DialogTitle></DialogHeader>
                    <form action={async (fd) => { setIsMapelPending(true); await tambahMapel({}, fd); setIsMapelPending(false) }} className="pt-3 space-y-3">
                      <MapelFormFields />
                      <Button type="submit" disabled={isMapelPending} className="w-full h-9 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg mt-1">
                        {isMapelPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Simpan Mapel'}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* MOBILE CARDS MAPEL */}
            <div className="block lg:hidden space-y-2">
              {paginatedMapel.length === 0 ? (
                <div className="bg-surface py-10 rounded-lg border border-surface text-center">
                  <BookOpen className="h-7 w-7 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                  <p className="text-sm text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500">Belum ada mata pelajaran.</p>
                </div>
              ) : paginatedMapel.map(m => {
                const currentKode = getMapelValue(m.id, m.kode_mapel)
                const isPendingChange = pendingMapelChanges[m.id]?.kode_mapel !== undefined
                return (
                  <div key={m.id} className={cn("bg-surface border rounded-lg p-3 space-y-2 transition-colors", isPendingChange ? 'border-emerald-300 bg-emerald-50/20' : 'border-surface')}>
                    <div className="flex items-start justify-between">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-tight flex-1 pr-2">{m.nama_mapel}</p>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => setEditingMapel(m)} className="p-1.5 rounded text-blue-600 hover:bg-blue-50"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => handleHapusMapel(m.id, m.nama_mapel)} className="p-1.5 rounded text-rose-500 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase shrink-0">RDM</span>
                      <Input
                        value={currentKode} onChange={e => handleQueueMapelChange(m.id, e.target.value)}
                        placeholder="Kosong" disabled={isSavingBatchMapel}
                        className={cn("h-7 w-24 text-xs font-mono font-bold px-2 rounded", isPendingChange ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-surface-2 border-surface')}
                      />
                      <div className="flex gap-1 flex-wrap">
                        <span className={cn("text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border", m.kelompok !== 'UMUM' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-surface-3 text-slate-600 dark:text-slate-300 dark:text-slate-600 border-surface')}>{m.kelompok}</span>
                        <span className="text-[9px] font-bold uppercase bg-surface-3 text-slate-500 dark:text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 border border-surface px-1.5 py-0.5 rounded">{m.tingkat === 'Semua' ? 'SEMUA' : `KLS ${m.tingkat}`}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* DESKTOP TABLE MAPEL */}
            <div className="hidden lg:block bg-surface rounded-lg border border-surface overflow-hidden">
              <div className="overflow-x-auto">
                <Table className="min-w-[700px]">
                  <TableHeader>
                    <TableRow className="bg-surface-2 hover:bg-surface-2">
                      <TableHead className="h-9 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500">Nama Mata Pelajaran</TableHead>
                      <TableHead className="h-9 text-xs font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 w-36">Kode RDM</TableHead>
                      <TableHead className="h-9 text-xs font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 w-28">Kelompok</TableHead>
                      <TableHead className="h-9 text-xs font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 w-28">Tingkat</TableHead>
                      <TableHead className="h-9 text-xs font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 text-right px-4 w-20">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedMapel.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="h-24 text-center text-sm text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500">Belum ada mata pelajaran.</TableCell></TableRow>
                    ) : paginatedMapel.map(m => {
                      const currentKode = getMapelValue(m.id, m.kode_mapel)
                      const isPendingChange = pendingMapelChanges[m.id]?.kode_mapel !== undefined
                      return (
                        <TableRow key={m.id} className={cn("border-surface-2 group transition-colors", isPendingChange ? 'bg-emerald-50/20' : 'hover:bg-surface-2/60')}>
                          <TableCell className="px-4 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100">{m.nama_mapel}</TableCell>
                          <TableCell className="py-2.5">
                            <Input
                              value={currentKode} onChange={e => handleQueueMapelChange(m.id, e.target.value)}
                              placeholder="Kosong" disabled={isSavingBatchMapel}
                              className={cn("h-8 font-mono font-bold text-xs w-full transition-all", isPendingChange ? 'bg-emerald-50 border-emerald-300 text-emerald-700 ring-1 ring-emerald-200' : 'bg-transparent border-transparent hover:border-surface hover:bg-surface-2 focus:bg-surface text-slate-600 dark:text-slate-300 dark:text-slate-600')}
                            />
                          </TableCell>
                          <TableCell className="py-2.5">
                            <span className={cn("text-[9px] font-bold uppercase px-2 py-0.5 rounded border", m.kelompok !== 'UMUM' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-surface-3 text-slate-600 dark:text-slate-300 dark:text-slate-600 border-surface')}>{m.kelompok}</span>
                          </TableCell>
                          <TableCell className="py-2.5">
                            <span className="text-xs text-slate-600 dark:text-slate-300 dark:text-slate-600 bg-surface-2 px-2 py-0.5 rounded border border-surface">{m.tingkat === 'Semua' ? 'Semua' : `Kelas ${m.tingkat}`}</span>
                          </TableCell>
                          <TableCell className="py-2.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => setEditingMapel(m)} className="p-1.5 rounded text-blue-600 hover:bg-blue-50"><Pencil className="h-3.5 w-3.5" /></button>
                              <button onClick={() => handleHapusMapel(m.id, m.nama_mapel)} className="p-1.5 rounded text-rose-500 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" /></button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Pagination Mapel */}
            <div className="flex items-center justify-between bg-surface border border-surface rounded-lg px-3 py-2">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500">
                <Select value={mapelItemsPerPage.toString()} onValueChange={v => { setMapelItemsPerPage(Number(v)); setCurrentMapelPage(1) }}>
                  <SelectTrigger className="h-7 w-16 text-xs rounded border-surface"><SelectValue /></SelectTrigger>
                  <SelectContent>{[10,20,50].map(n => <SelectItem key={n} value={n.toString()}>{n}</SelectItem>)}</SelectContent>
                </Select>
                <span><strong className="text-slate-700 dark:text-slate-200">{filteredMapel.length}</strong> mapel</span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={() => setCurrentMapelPage(p => Math.max(1, p - 1))} disabled={currentMapelPage === 1} className="h-7 px-2.5 text-xs rounded">←</Button>
                <span className="text-xs font-medium px-2">{currentMapelPage}/{totalMapelPages || 1}</span>
                <Button variant="outline" size="sm" onClick={() => setCurrentMapelPage(p => Math.min(totalMapelPages, p + 1))} disabled={currentMapelPage >= totalMapelPages} className="h-7 px-2.5 text-xs rounded">→</Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* BATCH SAVE FAB — Kode RDM */}
      {Object.keys(pendingMapelChanges).length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 border border-slate-700 w-[calc(100%-2rem)] sm:w-auto">
          <div className="h-6 w-6 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-xs font-bold border border-emerald-500/30 shrink-0">
            {Object.keys(pendingMapelChanges).length}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold leading-tight">Perubahan Kode RDM</p>
          </div>
          <div className="flex gap-1.5">
            <Button variant="ghost" size="sm" onClick={() => setPendingMapelChanges({})} disabled={isSavingBatchMapel} className="h-7 text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 hover:text-white hover:bg-slate-800 rounded">Batal</Button>
            <Button size="sm" onClick={executeBatchSaveMapel} disabled={isSavingBatchMapel} className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 rounded px-3">
              {isSavingBatchMapel ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />Menyimpan</> : <><Save className="h-3 w-3 mr-1" />Simpan</>}
            </Button>
          </div>
        </div>
      )}
    </>
  )
}