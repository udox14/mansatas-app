// TIMPA SELURUH ISI FILE INI
// Lokasi: app/dashboard/akademik/akademik-client.tsx
'use client'

import { useState, useEffect } from 'react'
import Script from 'next/script'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { BookOpen, FileSpreadsheet, Trash2, Loader2, Download, AlertCircle, Pencil, CalendarDays, RefreshCw, Search, GraduationCap } from 'lucide-react'
import { tambahMapel, editMapel, hapusMapel, importPenugasanASC, hapusPenugasan, importMapelMassal, resetPenugasanSemesterIni } from './actions'

type MapelType = { id: string, nama_mapel: string, kelompok: string, tingkat: string, kategori: string }
type PenugasanType = { 
  id: string, 
  guru: { nama_lengkap: string }, 
  mapel: { nama_mapel: string, kelompok: string }, 
  kelas: { tingkat: number, nomor_kelas: string, kelompok: string } 
}

export function AkademikClient({ 
  mapelData, 
  penugasanData, 
  taAktif,
  daftarJurusan = []
}: { 
  mapelData: MapelType[], 
  penugasanData: PenugasanType[],
  taAktif: { id: string, nama: string, semester: number } | null,
  daftarJurusan?: string[]
}) {
  const [isMapelPending, setIsMapelPending] = useState(false)
  const [searchMapel, setSearchMapel] = useState('')
  
  // Pagination Mapel
  const [currentMapelPage, setCurrentMapelPage] = useState(1)
  const [mapelItemsPerPage, setMapelItemsPerPage] = useState(10)

  const filteredMapel = mapelData.filter(m => m.nama_mapel.toLowerCase().includes(searchMapel.toLowerCase()))
  const totalMapelPages = Math.ceil(filteredMapel.length / mapelItemsPerPage)
  const paginatedMapel = filteredMapel.slice((currentMapelPage - 1) * mapelItemsPerPage, currentMapelPage * mapelItemsPerPage)

  useEffect(() => { setCurrentMapelPage(1) }, [searchMapel, mapelItemsPerPage])

  const [searchPenugasan, setSearchPenugasan] = useState('')
  
  // Pagination Penugasan
  const [currentPenugasanPage, setCurrentPenugasanPage] = useState(1)
  const [penugasanItemsPerPage, setPenugasanItemsPerPage] = useState(10)

  const filteredPenugasan = penugasanData.filter(p => p.guru?.nama_lengkap?.toLowerCase().includes(searchPenugasan.toLowerCase()) || p.kelas?.nomor_kelas?.includes(searchPenugasan))
  const totalPenugasanPages = Math.ceil(filteredPenugasan.length / penugasanItemsPerPage)
  const paginatedPenugasan = filteredPenugasan.slice((currentPenugasanPage - 1) * penugasanItemsPerPage, currentPenugasanPage * penugasanItemsPerPage)

  useEffect(() => { setCurrentPenugasanPage(1) }, [searchPenugasan, penugasanItemsPerPage])
  
  const [isImportingASC, setIsImportingASC] = useState(false)
  const [importLogs, setImportLogs] = useState<string[]>([])
  const [isImportingMapel, setIsImportingMapel] = useState(false)
  
  const [editingMapel, setEditingMapel] = useState<MapelType | null>(null)

  const handleHapusMapel = async (id: string, nama: string) => {
    if (!confirm(`Hapus mata pelajaran ${nama}?`)) return
    setIsMapelPending(true)
    const res = await hapusMapel(id)
    if (res?.error) alert(res?.error)
    setIsMapelPending(false)
  }

  const handleResetJadwal = async () => {
    if (!taAktif) return
    const konfirmasi = prompt(`TINDAKAN SANGAT BERBAHAYA!\nKetik "RESET" untuk menghapus ${penugasanData.length} jadwal di semester ini:`)
    if (konfirmasi !== 'RESET') {
      if (konfirmasi !== null) alert("Gagal. Kata kunci tidak cocok.")
      return
    }

    setIsMapelPending(true)
    const res = await resetPenugasanSemesterIni(taAktif.id)
    if (res?.error) alert(res.error)
    else alert(res.success)
    setIsMapelPending(false)
  }

  // --- HANDLER IMPORT MAPEL ---
  const handleDownloadTemplateMapel = () => {
    const XLSX = (window as any).XLSX
    if (!XLSX) return alert('Library belum siap.')
    const data = [
      { NAMA_MAPEL: "Matematika Tingkat Lanjut", KELOMPOK: "MIPA", TINGKAT: "11 & 12", KATEGORI: "Kelompok Mata Pelajaran Pilihan" },
      { NAMA_MAPEL: "Biologi", KELOMPOK: "MIPA", TINGKAT: "11 & 12", KATEGORI: "Kelompok Mata Pelajaran Pilihan" },
      { NAMA_MAPEL: "Bahasa Indonesia", KELOMPOK: "UMUM", TINGKAT: "Semua", KATEGORI: "Kelompok Mata Pelajaran Umum" }
    ]
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Master_Mapel")
    XLSX.writeFile(wb, "Template_Import_Mapel.xlsx")
  }

  const handleFileUploadMapel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsImportingMapel(true)

    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const XLSX = (window as any).XLSX
        const workbook = XLSX.read(event.target?.result, { type: 'binary' })
        const worksheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonData = XLSX.utils.sheet_to_json(worksheet)
        
        const result = await importMapelMassal(jsonData)
        if (result.error) alert(result.error)
        else alert(result.success)
      } catch (err: any) {
        alert('Gagal membaca file Excel.')
      } finally {
        setIsImportingMapel(false)
        e.target.value = ''
      }
    }
    reader.readAsBinaryString(file)
  }

  // --- HANDLER IMPORT ASC ---
  const handleDownloadTemplateASC = () => {
    const XLSX = (window as any).XLSX
    if (!XLSX) return alert('Library belum siap.')
    const data = [
      { NAMA_GURU: "Muhammad Ropik Nazib, M.Ag.", NAMA_KELAS: "12-1", NAMA_MAPEL: "Fikih" },
      { NAMA_GURU: "Drs. Khoerun", NAMA_KELAS: "12-1", NAMA_MAPEL: "Pendidikan Pancasila" }
    ]
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Jadwal_ASC")
    XLSX.writeFile(wb, "Template_Import_ASC.xlsx")
  }

  const handleFileUploadASC = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsImportingASC(true); setImportLogs([])

    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const XLSX = (window as any).XLSX
        const workbook = XLSX.read(event.target?.result, { type: 'binary' })
        const worksheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonData = XLSX.utils.sheet_to_json(worksheet)
        
        const result = await importPenugasanASC(jsonData)
        if (result.error) alert(result.error)
        else alert(result.success)
        
        if (result.logs && result.logs.length > 0) setImportLogs(result.logs)
      } catch (err: any) {
        alert('Gagal membaca file Excel.')
      } finally {
        setIsImportingASC(false)
        e.target.value = '' 
      }
    }
    reader.readAsBinaryString(file)
  }

  // Fungsi helper warna avatar untuk guru
  const getAvatarColor = (name: string) => {
    const colors = [
      'from-emerald-100 to-emerald-200 text-emerald-800',
      'from-teal-100 to-teal-200 text-teal-800',
      'from-cyan-100 to-cyan-200 text-cyan-800',
      'from-blue-100 to-blue-200 text-blue-800',
      'from-indigo-100 to-indigo-200 text-indigo-800',
    ]
    const charCode = name?.charCodeAt(0) || 0
    return colors[charCode % colors.length]
  }

  return (
    <>
      <Script src="https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js" strategy="lazyOnload" />

      {/* MODAL EDIT MAPEL */}
      <Dialog open={!!editingMapel} onOpenChange={(open) => !open && setEditingMapel(null)}>
        <DialogContent className="sm:max-w-md rounded-3xl bg-white/95 backdrop-blur-xl border border-slate-200/60 shadow-xl">
          <DialogHeader className="border-b border-slate-100 pb-4">
            <DialogTitle className="text-xl font-bold text-slate-800">Edit Mata Pelajaran</DialogTitle>
          </DialogHeader>
          <form action={async (fd) => { 
            setIsMapelPending(true); 
            fd.append('id', editingMapel!.id);
            const res = await editMapel({}, fd); 
            if (res?.error) alert(res.error);
            setIsMapelPending(false); 
            setEditingMapel(null);
          }} className="space-y-5 pt-2">
            <div className="space-y-2">
              <Label className="text-slate-600 font-semibold text-xs uppercase tracking-wider">Kelompok Jurusan</Label>
              <Select name="kelompok" defaultValue={editingMapel?.kelompok}>
                <SelectTrigger className="h-11 rounded-xl bg-slate-50 border-slate-200 focus:border-emerald-500 transition-colors"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  {/* GENERATE DARI MASTER DINAMIS */}
                  {daftarJurusan.map(jur => <SelectItem key={`edit-${jur}`} value={jur}>{jur}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-600 font-semibold text-xs uppercase tracking-wider">Tingkat Kelas</Label>
                <Select name="tingkat" defaultValue={editingMapel?.tingkat}>
                  <SelectTrigger className="h-11 rounded-xl bg-slate-50 border-slate-200 focus:border-emerald-500 transition-colors"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="10">Kelas 10</SelectItem>
                    <SelectItem value="11">Kelas 11</SelectItem>
                    <SelectItem value="12">Kelas 12</SelectItem>
                    <SelectItem value="11 & 12">Kelas 11 & 12</SelectItem>
                    <SelectItem value="Semua">Semua Tingkat</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-600 font-semibold text-xs uppercase tracking-wider">Kategori</Label>
                <Select name="kategori" defaultValue={editingMapel?.kategori}>
                  <SelectTrigger className="h-11 rounded-xl bg-slate-50 border-slate-200 focus:border-emerald-500 transition-colors"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="Kelompok Mata Pelajaran Umum">Mata Pelajaran Umum</SelectItem>
                    <SelectItem value="Kelompok Mata Pelajaran Pilihan">Mata Pelajaran Pilihan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl shadow-md h-12 text-base font-bold transition-all mt-4" disabled={isMapelPending}>
              {isMapelPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : 'Update Mapel'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <div className="space-y-6 pb-20 sm:pb-8">
        <Tabs defaultValue="penugasan" className="space-y-6">
          <div className="overflow-x-auto custom-scrollbar pb-2">
            <TabsList className="bg-white border p-1.5 flex flex-nowrap w-max sm:w-full min-w-full sm:grid sm:grid-cols-2 h-auto shadow-sm rounded-2xl">
              <TabsTrigger value="penugasan" className="py-3 px-6 sm:px-0 rounded-xl data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 font-semibold text-sm sm:text-base whitespace-nowrap">
                1. Jadwal Mengajar (ASC)
              </TabsTrigger>
              <TabsTrigger value="mapel" className="py-3 px-6 sm:px-0 rounded-xl data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700 font-semibold text-sm sm:text-base whitespace-nowrap">
                2. Master Mata Pelajaran
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ===================== TAB 1: PENUGASAN (ASC IMPORT) ===================== */}
          <TabsContent value="penugasan" className="space-y-4 m-0 focus-visible:ring-0">
            
            {!taAktif ? (
              <div className="p-4 bg-rose-50 text-rose-600 rounded-xl border border-rose-200 flex items-center gap-3 shadow-sm">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <span className="text-sm sm:text-base font-medium">Tahun Ajaran Aktif belum diatur di menu Pengaturan. Anda tidak bisa mengimport jadwal.</span>
              </div>
            ) : (
              <div className="bg-indigo-50 text-indigo-800 p-4 rounded-2xl border border-indigo-200 flex items-center gap-3 font-medium shadow-sm">
                <CalendarDays className="h-5 w-5 shrink-0 text-indigo-600" />
                <span className="text-sm sm:text-base leading-snug">Menampilkan Jadwal untuk: <strong className="bg-white px-2 py-0.5 rounded shadow-sm mx-1 text-indigo-900 font-semibold">{taAktif.nama}</strong> <span className="opacity-80">(Semester {taAktif.semester})</span></span>
              </div>
            )}

            {/* TOOLBAR JADWAL */}
            <div className="flex flex-col bg-white/80 backdrop-blur-xl p-4 sm:p-5 rounded-3xl border border-slate-200/60 shadow-sm gap-4">
              <div className="flex flex-col lg:flex-row justify-between gap-4">
                <div className="relative w-full lg:max-w-md">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <Input 
                    placeholder="Cari Nama Guru / Kelas..." 
                    value={searchPenugasan} 
                    onChange={e => setSearchPenugasan(e.target.value)} 
                    className="pl-11 rounded-2xl bg-slate-50 border-slate-200 focus:bg-white focus:border-indigo-500 transition-all h-12 text-base shadow-inner" 
                  />
                </div>
                
                <div className="grid grid-cols-1 sm:flex sm:flex-row gap-3 w-full lg:w-auto">
                  <Button onClick={handleResetJadwal} disabled={isMapelPending || !taAktif || penugasanData.length === 0} variant="outline" className="h-11 rounded-xl text-rose-600 border-rose-200 hover:bg-rose-50 flex-1 sm:flex-none transition-all font-medium">
                    <RefreshCw className="h-4 w-4 mr-2" /> <span className="sm:hidden">Reset</span><span className="hidden sm:inline">Reset Jadwal Smt Ini</span>
                  </Button>
                  
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button disabled={!taAktif} className="gap-2 bg-indigo-600 hover:bg-indigo-700 h-11 rounded-xl shadow-md flex-1 sm:flex-none text-white transition-all border-0 font-medium">
                        <FileSpreadsheet className="h-4 w-4" /> Import ASC Baru
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-xl rounded-3xl bg-white/95 backdrop-blur-xl border border-slate-200/60 shadow-xl">
                      <DialogHeader className="border-b border-slate-100 pb-4">
                        <DialogTitle className="text-xl font-bold text-slate-800">Smart Import Data ASC</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-2">
                        <div className="flex justify-between items-center p-4 bg-slate-50 border border-slate-100 rounded-xl">
                          <p className="text-sm font-medium text-slate-600">Download format template ASC:</p>
                          <Button size="sm" variant="outline" onClick={handleDownloadTemplateASC} className="gap-2 rounded-lg bg-white border-slate-200 hover:bg-slate-100 font-medium"><Download className="h-4 w-4"/> Template</Button>
                        </div>
                        <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-xl text-sm space-y-2 text-indigo-800">
                          <p className="font-medium text-indigo-900 border-b border-indigo-100/50 pb-2 mb-2">Jadwal otomatis masuk ke <strong className="font-semibold">TA: {taAktif?.nama} Smt {taAktif?.semester}</strong>.</p>
                          <p className="font-mono text-xs"><strong className="text-indigo-700 bg-white px-1 py-0.5 rounded shadow-sm mr-1 font-semibold">NAMA_GURU</strong> (Sistem abaikan gelar M.Ag/Drs)</p>
                          <p className="font-mono text-xs"><strong className="text-indigo-700 bg-white px-1 py-0.5 rounded shadow-sm mr-1 font-semibold">NAMA_KELAS</strong> (Ditulis diulang per kelas, cth: 12-1)</p>
                          <p className="font-mono text-xs"><strong className="text-indigo-700 bg-white px-1 py-0.5 rounded shadow-sm mr-1 font-semibold">NAMA_MAPEL</strong> (Sama persis dengan Master Mapel)</p>
                        </div>
                        <Input type="file" accept=".xlsx, .xls" onChange={handleFileUploadASC} disabled={isImportingASC} className="cursor-pointer file:cursor-pointer h-12 pt-2.5 rounded-xl border-slate-300 focus:border-indigo-500" />
                        {isImportingASC && <div className="flex items-center justify-center p-4 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-xl border border-indigo-100 animate-pulse"><Loader2 className="mr-2 h-5 w-5 animate-spin"/> Memplot ribuan jadwal...</div>}
                        {importLogs.length > 0 && (
                          <div className="mt-4 border border-rose-200 rounded-xl overflow-hidden shadow-sm">
                            <div className="bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800 flex items-center gap-2"><AlertCircle className="h-5 w-5"/> Laporan Data Tidak Cocok:</div>
                            <ScrollArea className="h-32 bg-white p-4 text-xs font-mono text-rose-600 leading-relaxed">
                              {importLogs.map((log, i) => <div key={i} className="mb-1">{log}</div>)}
                            </ScrollArea>
                          </div>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </div>

            {/* TAMPILAN MOBILE: KARTU JADWAL */}
            <div className="block lg:hidden space-y-4">
              {paginatedPenugasan.length === 0 ? (
                <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center shadow-sm">
                  <CalendarDays className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                  <p className="font-medium text-slate-500">Belum ada jadwal mengajar di semester ini.</p>
                </div>
              ) : (
                paginatedPenugasan.map(p => (
                  <div key={p.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4 relative overflow-hidden">
                    <div className="flex gap-3 items-start">
                      <div className={`h-12 w-12 shrink-0 rounded-full bg-gradient-to-br ${getAvatarColor(p.guru?.nama_lengkap)} flex items-center justify-center text-xl font-bold shadow-sm border-2 border-white`}>
                        {p.guru?.nama_lengkap?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 pr-10">
                        <h3 className="font-bold text-slate-800 text-base leading-tight">{p.guru?.nama_lengkap}</h3>
                        <div className="text-sm font-medium text-indigo-600 mt-1">{p.mapel?.nama_mapel}</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div className="flex flex-col gap-1">
                        <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Mengajar di</span>
                        <span className="font-bold text-slate-700 flex items-center gap-1.5 text-base">
                          <GraduationCap className="h-4 w-4 text-emerald-500" />
                          {p.kelas?.tingkat}-{p.kelas?.nomor_kelas} {p.kelas?.kelompok !== 'UMUM' ? p.kelas?.kelompok : ''}
                        </span>
                      </div>
                      {p.mapel?.kelompok !== 'UMUM' && (
                        <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-100 border border-indigo-200 rounded-lg">
                          {p.mapel?.kelompok}
                        </span>
                      )}
                    </div>

                    <div className="flex justify-end gap-2 pt-1 border-t border-slate-100">
                      <Button variant="ghost" size="sm" onClick={async () => { if(confirm('Hapus penugasan ini?')) { setIsMapelPending(true); await hapusPenugasan(p.id); setIsMapelPending(false); } }} className="h-9 rounded-xl text-rose-600 hover:bg-rose-50 w-full font-medium">
                        <Trash2 className="h-4 w-4 mr-2" /> Hapus Jadwal
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* TAMPILAN DESKTOP: TABEL JADWAL */}
            <div className="hidden lg:flex bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden flex-col">
              <div className="overflow-x-auto custom-scrollbar">
                <Table className="min-w-[800px]">
                  <TableHeader className="bg-slate-50 border-b border-slate-200">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="font-semibold text-slate-600 h-12 px-6">Nama Guru Pengajar</TableHead>
                      <TableHead className="font-semibold text-slate-600 h-12">Mata Pelajaran</TableHead>
                      <TableHead className="font-semibold text-slate-600 h-12">Mengajar di Kelas</TableHead>
                      <TableHead className="text-right font-semibold text-slate-600 h-12 px-6">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedPenugasan.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="h-48 text-center text-slate-500">Belum ada jadwal mengajar di semester ini. Silakan import dari ASC.</TableCell></TableRow>
                    ) : (
                      paginatedPenugasan.map(p => (
                        <TableRow key={p.id} className="hover:bg-slate-50/50 transition-colors border-slate-100 group">
                          <TableCell className="px-6 py-4">
                             <div className="flex items-center gap-3">
                              <div className={`h-10 w-10 shrink-0 rounded-full bg-gradient-to-br ${getAvatarColor(p.guru?.nama_lengkap)} shadow-sm flex items-center justify-center text-sm font-bold ring-2 ring-white`}>
                                {p.guru?.nama_lengkap?.charAt(0).toUpperCase() || '?'}
                              </div>
                              <span className="font-bold text-slate-800 text-base">{p.guru?.nama_lengkap}</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-4">
                            <div className="flex flex-col gap-1.5">
                              <span className="font-medium text-slate-700">{p.mapel?.nama_mapel}</span>
                              {p.mapel?.kelompok !== 'UMUM' && (
                                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md w-fit">{p.mapel?.kelompok}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="py-4">
                            <span className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-700 border border-slate-200 shadow-sm">
                              <GraduationCap className="h-4 w-4 text-emerald-500" />
                              {p.kelas?.tingkat}-{p.kelas?.nomor_kelas} {p.kelas?.kelompok !== 'UMUM' ? p.kelas?.kelompok : ''}
                            </span>
                          </TableCell>
                          <TableCell className="text-right px-6 py-4">
                            <Button variant="ghost" size="icon" onClick={async () => { if(confirm('Hapus penugasan ini?')) { setIsMapelPending(true); await hapusPenugasan(p.id); setIsMapelPending(false); } }} className="h-10 w-10 rounded-xl text-rose-500 hover:bg-rose-50 border border-transparent hover:border-rose-100 shadow-sm opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="h-4 w-4" /></Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* PAGINATION FOOTER PENUGASAN */}
            <div className="flex flex-col sm:flex-row items-center justify-between p-4 sm:p-5 bg-white sm:bg-white/80 backdrop-blur-md rounded-3xl border border-slate-200/60 shadow-sm gap-4 text-sm mt-4">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-3 text-slate-500 font-medium w-full sm:w-auto">
                <span>Tampilkan</span>
                <Select value={penugasanItemsPerPage.toString()} onValueChange={(v) => setPenugasanItemsPerPage(Number(v))}>
                  <SelectTrigger className="h-10 w-[80px] bg-slate-50 rounded-xl border-slate-200 font-bold text-slate-700 focus:ring-indigo-500"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
                <span>dari <strong className="text-slate-800">{filteredPenugasan.length}</strong> jadwal</span>
              </div>
              
              <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                <Button variant="outline" onClick={() => setCurrentPenugasanPage(p => Math.max(1, p - 1))} disabled={currentPenugasanPage === 1} className="h-10 rounded-xl bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600 px-4">
                  <span className="hidden sm:inline">Sebelumnya</span>
                  <span className="sm:hidden">Prev</span>
                </Button>
                <div className="flex items-center justify-center min-w-[3rem] font-bold text-slate-700 bg-slate-50 h-10 px-3 rounded-xl border border-slate-200">
                  {currentPenugasanPage} <span className="text-slate-400 font-medium mx-1">/</span> {totalPenugasanPages || 1}
                </div>
                <Button variant="outline" onClick={() => setCurrentPenugasanPage(p => Math.min(totalPenugasanPages, p + 1))} disabled={currentPenugasanPage >= totalPenugasanPages || totalPenugasanPages === 0} className="h-10 rounded-xl bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600 px-4">
                  <span className="hidden sm:inline">Berikutnya</span>
                  <span className="sm:hidden">Next</span>
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* ===================== TAB 2: MASTER MAPEL ===================== */}
          <TabsContent value="mapel" className="space-y-4 m-0 focus-visible:ring-0">
            {/* TOOLBAR MAPEL */}
            <div className="flex flex-col bg-white/80 backdrop-blur-xl p-4 sm:p-5 rounded-3xl border border-slate-200/60 shadow-sm gap-4">
              <div className="flex flex-col lg:flex-row justify-between gap-4">
                <div className="relative w-full lg:max-w-md">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <Input 
                    placeholder="Cari Nama Mapel..." 
                    value={searchMapel} 
                    onChange={e => setSearchMapel(e.target.value)} 
                    className="pl-11 rounded-2xl bg-slate-50 border-slate-200 focus:bg-white focus:border-emerald-500 transition-all h-12 text-base shadow-inner" 
                  />
                </div>
                
                <div className="grid grid-cols-2 sm:flex sm:flex-row gap-3 w-full lg:w-auto">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="gap-2 h-11 px-4 rounded-xl border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50 transition-all flex-1 sm:flex-none text-xs sm:text-sm font-medium">
                        <FileSpreadsheet className="h-4 w-4 shrink-0" /> <span className="truncate">Import Mapel</span>
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-xl rounded-3xl bg-white/95 backdrop-blur-xl border border-slate-200/60 shadow-xl">
                      <DialogHeader className="border-b border-slate-100 pb-4">
                        <DialogTitle className="text-xl font-bold text-slate-800">Import Master Mata Pelajaran</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-2">
                        <div className="flex justify-between items-center p-4 bg-slate-50 border border-slate-100 rounded-xl">
                          <p className="text-sm font-medium text-slate-600">Download format template:</p>
                          <Button size="sm" variant="outline" onClick={handleDownloadTemplateMapel} className="gap-2 rounded-lg bg-white border-slate-200 hover:bg-slate-100 font-medium"><Download className="h-4 w-4"/> Template</Button>
                        </div>
                        <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-xl text-sm space-y-2 text-emerald-800">
                          <p className="font-mono text-xs"><strong className="text-emerald-700 bg-white px-1 py-0.5 rounded shadow-sm mr-1 font-semibold">NAMA_MAPEL</strong></p>
                          <p className="font-mono text-xs"><strong className="text-emerald-700 bg-white px-1 py-0.5 rounded shadow-sm mr-1 font-semibold">KELOMPOK</strong> (MIPA/SOSHUM/UMUM)</p>
                          <p className="font-mono text-xs"><strong className="text-emerald-700 bg-white px-1 py-0.5 rounded shadow-sm mr-1 font-semibold">TINGKAT</strong> (10/11/12/Semua)</p>
                          <p className="font-mono text-xs"><strong className="text-emerald-700 bg-white px-1 py-0.5 rounded shadow-sm mr-1 font-semibold">KATEGORI</strong></p>
                        </div>
                        <Input type="file" accept=".xlsx, .xls" onChange={handleFileUploadMapel} disabled={isImportingMapel} className="cursor-pointer file:cursor-pointer h-12 pt-2.5 rounded-xl border-slate-300 focus:border-emerald-500" />
                        {isImportingMapel && <div className="flex items-center justify-center p-4 text-sm font-medium text-emerald-600 bg-emerald-50 rounded-xl border border-emerald-100 animate-pulse"><Loader2 className="mr-2 h-5 w-5 animate-spin"/> Import data mapel...</div>}
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Dialog>
                    <DialogTrigger asChild>
                      <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 h-11 px-4 rounded-xl shadow-md flex-1 sm:flex-none text-white transition-all border-0 text-xs sm:text-sm font-medium">
                        <BookOpen className="h-4 w-4 shrink-0" /> <span className="truncate">Tambah Mapel</span>
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md rounded-3xl bg-white/95 backdrop-blur-xl border border-slate-200/60 shadow-xl">
                      <DialogHeader className="border-b border-slate-100 pb-4">
                        <DialogTitle className="text-xl font-bold text-slate-800">Tambah Mata Pelajaran</DialogTitle>
                      </DialogHeader>
                      <form action={async (fd) => { setIsMapelPending(true); await tambahMapel({}, fd); setIsMapelPending(false); }} className="space-y-5 pt-2">
                        <div className="space-y-2">
                          <Label className="text-slate-600 font-semibold text-xs uppercase tracking-wider">Kelompok Jurusan</Label>
                          <Select name="kelompok" defaultValue="UMUM">
                            <SelectTrigger className="h-11 rounded-xl bg-slate-50 border-slate-200 focus:border-emerald-500 transition-colors"><SelectValue /></SelectTrigger>
                            <SelectContent className="rounded-xl">
                              {/* GENERATE DARI MASTER DINAMIS */}
                              {daftarJurusan.map(jur => <SelectItem key={`tambah-${jur}`} value={jur}>{jur}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-slate-600 font-semibold text-xs uppercase tracking-wider">Tingkat Kelas</Label>
                            <Select name="tingkat" defaultValue="Semua">
                              <SelectTrigger className="h-11 rounded-xl bg-slate-50 border-slate-200 focus:border-emerald-500 transition-colors"><SelectValue /></SelectTrigger>
                              <SelectContent className="rounded-xl">
                                <SelectItem value="10">Kelas 10</SelectItem>
                                <SelectItem value="11">Kelas 11</SelectItem>
                                <SelectItem value="12">Kelas 12</SelectItem>
                                <SelectItem value="11 & 12">Kelas 11 & 12 (Fase F)</SelectItem>
                                <SelectItem value="Semua">Semua Tingkat</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-slate-600 font-semibold text-xs uppercase tracking-wider">Kategori</Label>
                            <Select name="kategori" defaultValue="Kelompok Mata Pelajaran Umum">
                              <SelectTrigger className="h-11 rounded-xl bg-slate-50 border-slate-200 focus:border-emerald-500 transition-colors"><SelectValue /></SelectTrigger>
                              <SelectContent className="rounded-xl">
                                <SelectItem value="Kelompok Mata Pelajaran Umum">Mata Pelajaran Umum</SelectItem>
                                <SelectItem value="Kelompok Mata Pelajaran Pilihan">Mata Pelajaran Pilihan</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <Button type="submit" className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl shadow-md h-12 text-base font-bold transition-all mt-4" disabled={isMapelPending}>
                          {isMapelPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : 'Simpan Mapel Baru'}
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </div>

            {/* TAMPILAN MOBILE: KARTU MAPEL */}
            <div className="block lg:hidden space-y-4">
              {paginatedMapel.length === 0 ? (
                <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center shadow-sm">
                  <BookOpen className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                  <p className="font-medium text-slate-500">Belum ada mata pelajaran.</p>
                </div>
              ) : (
                paginatedMapel.map(m => (
                  <div key={m.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3 relative overflow-hidden">
                    <div className="flex justify-between items-start">
                      <h3 className="font-bold text-slate-800 text-base leading-tight pr-4">{m.nama_mapel}</h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {m.kelompok !== 'UMUM' ? (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md">{m.kelompok}</span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-md">UMUM</span>
                      )}
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-md">
                        {m.tingkat === 'Semua' ? 'SEMUA TINGKAT' : `KELAS ${m.tingkat}`}
                      </span>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 mt-1">
                      <Button variant="outline" size="sm" onClick={() => setEditingMapel(m)} className="h-9 rounded-xl text-blue-600 border-blue-200 hover:bg-blue-50 flex-1 font-medium">
                        <Pencil className="h-4 w-4 mr-2" /> Edit
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleHapusMapel(m.id, m.nama_mapel)} className="h-9 rounded-xl text-rose-600 border-rose-200 hover:bg-rose-50 flex-1 font-medium">
                        <Trash2 className="h-4 w-4 mr-2" /> Hapus
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* TAMPILAN DESKTOP: TABEL MAPEL */}
            <div className="hidden lg:flex bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden flex-col">
              <div className="overflow-x-auto custom-scrollbar">
                <Table className="min-w-[800px]">
                  <TableHeader className="bg-slate-50 border-b border-slate-200">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="font-semibold text-slate-600 h-12 px-6">Nama Mata Pelajaran</TableHead>
                      <TableHead className="font-semibold text-slate-600 h-12">Kelompok</TableHead>
                      <TableHead className="font-semibold text-slate-600 h-12">Tingkat Kelas</TableHead>
                      <TableHead className="text-right font-semibold text-slate-600 h-12 px-6">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedMapel.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="h-48 text-center text-slate-500">Belum ada mata pelajaran. Silakan import atau tambah manual.</TableCell></TableRow>
                    ) : (
                      paginatedMapel.map(m => (
                        <TableRow key={m.id} className="hover:bg-slate-50/50 transition-colors border-slate-100 group">
                          <TableCell className="font-bold text-slate-800 px-6 py-4">{m.nama_mapel}</TableCell>
                          <TableCell className="py-4">
                            {m.kelompok !== 'UMUM' ? (
                              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-md">{m.kelompok}</span>
                            ) : (
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-slate-100 border border-slate-200 px-3 py-1 rounded-md">UMUM</span>
                            )}
                          </TableCell>
                          <TableCell className="py-4">
                            <span className="text-sm font-semibold text-slate-700 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                              {m.tingkat === 'Semua' ? 'Semua Tingkat' : `Kelas ${m.tingkat}`}
                            </span>
                          </TableCell>
                          <TableCell className="text-right px-6 py-4">
                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button variant="ghost" size="icon" onClick={() => setEditingMapel(m)} className="h-10 w-10 rounded-xl text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-100 shadow-sm"><Pencil className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => handleHapusMapel(m.id, m.nama_mapel)} className="h-10 w-10 rounded-xl text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-100 shadow-sm"><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* PAGINATION FOOTER MAPEL */}
            <div className="flex flex-col sm:flex-row items-center justify-between p-4 sm:p-5 bg-white sm:bg-white/80 backdrop-blur-md rounded-3xl border border-slate-200/60 shadow-sm gap-4 text-sm mt-4">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-3 text-slate-500 font-medium w-full sm:w-auto">
                <span>Tampilkan</span>
                <Select value={mapelItemsPerPage.toString()} onValueChange={(v) => setMapelItemsPerPage(Number(v))}>
                  <SelectTrigger className="h-10 w-[80px] bg-slate-50 rounded-xl border-slate-200 font-bold text-slate-700 focus:ring-emerald-500"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
                <span>dari <strong className="text-slate-800">{filteredMapel.length}</strong> mapel</span>
              </div>
              
              <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                <Button variant="outline" onClick={() => setCurrentMapelPage(p => Math.max(1, p - 1))} disabled={currentMapelPage === 1} className="h-10 rounded-xl bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600 px-4">
                  <span className="hidden sm:inline">Sebelumnya</span>
                  <span className="sm:hidden">Prev</span>
                </Button>
                <div className="flex items-center justify-center min-w-[3rem] font-bold text-slate-700 bg-slate-50 h-10 px-3 rounded-xl border border-slate-200">
                  {currentMapelPage} <span className="text-slate-400 font-medium mx-1">/</span> {totalMapelPages || 1}
                </div>
                <Button variant="outline" onClick={() => setCurrentMapelPage(p => Math.min(totalMapelPages, p + 1))} disabled={currentMapelPage >= totalMapelPages || totalMapelPages === 0} className="h-10 rounded-xl bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600 px-4">
                  <span className="hidden sm:inline">Berikutnya</span>
                  <span className="sm:hidden">Next</span>
                </Button>
              </div>
            </div>
          </TabsContent>

        </Tabs>
      </div>
    </>
  )
}