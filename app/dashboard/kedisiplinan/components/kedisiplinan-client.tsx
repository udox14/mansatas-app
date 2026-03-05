// TIMPA SELURUH ISI FILE INI
// Lokasi: app/dashboard/kedisiplinan/components/kedisiplinan-client.tsx
'use client'

import { useState, useMemo } from 'react'
import Script from 'next/script'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Search, PlusCircle, Trash2, Pencil, Image as ImageIcon, AlertTriangle, ShieldCheck, Filter, ArrowUpDown, BookOpen, FileSpreadsheet, Download, Loader2 } from 'lucide-react'
import { FormModal } from './form-modal'
import { MasterModal } from './master-modal'
import { hapusPelanggaran, hapusMasterPelanggaran, importMasterPelanggaranMassal } from '../actions'

export function KedisiplinanClient({ 
  currentUser, kasusList, siswaList, masterList 
}: { 
  currentUser: { id: string, role: string, nama: string },
  kasusList: any[], siswaList: any[], masterList: any[]
}) {
  const isSuperAdmin = currentUser.role === 'super_admin'
  const canInput = ['super_admin', 'admin_tu', 'wakamad', 'guru_bk', 'guru_piket', 'satpam', 'guru'].includes(currentUser.role)
  const canManageMaster = ['super_admin', 'wakamad', 'guru_bk'].includes(currentUser.role)

  // =====================================
  // STATE & LOGIC: TAB RIWAYAT KASUS
  // =====================================
  const [searchKasus, setSearchKasus] = useState('')
  const [filterTingkat, setFilterTingkat] = useState('ALL')
  const [sortBy, setSortBy] = useState('terbaru')
  
  const [pageKasus, setPageKasus] = useState(1)
  const itemsPerPage = 10

  const [isKasusModalOpen, setIsKasusModalOpen] = useState(false)
  const [editKasusData, setEditKasusData] = useState<any>(null)
  const [isPending, setIsPending] = useState(false)

  const poinSiswaMap = useMemo(() => {
    return kasusList.reduce((acc, curr) => {
      acc[curr.siswa_id] = (acc[curr.siswa_id] || 0) + curr.master_pelanggaran.poin
      return acc
    }, {} as Record<string, number>)
  }, [kasusList])

  const processedKasus = useMemo(() => {
    let result = kasusList.filter(k => 
      k.siswa.nama_lengkap.toLowerCase().includes(searchKasus.toLowerCase()) ||
      k.siswa.kelas?.nomor_kelas?.toLowerCase().includes(searchKasus.toLowerCase())
    )
    if (filterTingkat !== 'ALL') {
      result = result.filter(k => k.siswa.kelas?.tingkat?.toString() === filterTingkat)
    }
    if (sortBy === 'poin_tertinggi') {
      result.sort((a, b) => (poinSiswaMap[b.siswa_id] || 0) - (poinSiswaMap[a.siswa_id] || 0))
    } else {
      result.sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime())
    }
    return result
  }, [kasusList, searchKasus, filterTingkat, sortBy, poinSiswaMap])

  const totalPagesKasus = Math.ceil(processedKasus.length / itemsPerPage)
  const paginatedKasus = processedKasus.slice((pageKasus - 1) * itemsPerPage, pageKasus * itemsPerPage)

  const handleHapusKasus = async (id: string) => {
    if (!confirm('PERINGATAN!\nAnda yakin ingin menghapus catatan pelanggaran ini secara permanen?')) return
    setIsPending(true)
    const res = await hapusPelanggaran(id)
    if (res.error) alert(res.error)
    setIsPending(false)
  }

  // =====================================
  // STATE & LOGIC: TAB MASTER KAMUS
  // =====================================
  const [searchMaster, setSearchMaster] = useState('')
  const [isMasterModalOpen, setIsMasterModalOpen] = useState(false)
  const [editMasterData, setEditMasterData] = useState<any>(null)
  
  const [isImportingKamus, setIsImportingKamus] = useState(false)

  const filteredMaster = masterList.filter(m => m.nama_pelanggaran.toLowerCase().includes(searchMaster.toLowerCase()))

  const handleHapusMaster = async (id: string) => {
    if (!confirm('Yakin ingin menghapus kamus pelanggaran ini?')) return
    setIsPending(true)
    const res = await hapusMasterPelanggaran(id)
    if (res.error) alert(res.error)
    setIsPending(false)
  }

  // IMPORT EXCEL MASTER PELANGGARAN
  const handleDownloadTemplateKamus = () => {
    const XLSX = (window as any).XLSX
    if (!XLSX) return alert('Library belum siap.')
    const data = [
      { NAMA_PELANGGARAN: "Terlambat hadir lebih dari 15 menit", KATEGORI: "Ringan", POIN: 5 },
      { NAMA_PELANGGARAN: "Berambut panjang/gondrong (Putra)", KATEGORI: "Sedang", POIN: 10 },
      { NAMA_PELANGGARAN: "Membawa senjata tajam", KATEGORI: "Berat", POIN: 100 }
    ]
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Kamus_Pelanggaran")
    XLSX.writeFile(wb, "Template_Kamus_Pelanggaran.xlsx")
  }

  const handleFileUploadKamus = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsImportingKamus(true)

    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const XLSX = (window as any).XLSX
        if (!XLSX) throw new Error("Library pemroses Excel belum dimuat.")
        const workbook = XLSX.read(event.target?.result, { type: 'binary' })
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]])
        
        const result = await importMasterPelanggaranMassal(jsonData)
        if (result.error) alert(result.error)
        else alert(result.success)
      } catch (err: any) {
        alert('Gagal membaca file Excel.')
      } finally {
        setIsImportingKamus(false)
        e.target.value = '' 
      }
    }
    reader.readAsBinaryString(file)
  }

  return (
    <>
      <Script src="https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js" strategy="lazyOnload" />

      <div className="space-y-6">
        <Tabs defaultValue="riwayat" className="space-y-6">
          
          {/* PERBAIKAN UI TABS MOBILE & HAK AKSES */}
          <TabsList className={`bg-white border shadow-sm rounded-2xl w-full grid p-1 gap-1 h-auto ${canManageMaster ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <TabsTrigger value="riwayat" className="py-2.5 px-2 rounded-xl data-[state=active]:bg-rose-50 data-[state=active]:text-rose-700 font-bold text-[11px] sm:text-sm md:text-base whitespace-normal text-center h-full leading-tight">
              Riwayat Pelanggaran
            </TabsTrigger>
            {canManageMaster && (
              <TabsTrigger value="kamus" className="py-2.5 px-2 rounded-xl data-[state=active]:bg-slate-900 data-[state=active]:text-white font-bold text-[11px] sm:text-sm md:text-base whitespace-normal text-center h-full leading-tight">
                Kamus & Bobot Poin
              </TabsTrigger>
            )}
          </TabsList>

          {/* ======================= TAB RIWAYAT KASUS ======================= */}
          <TabsContent value="riwayat" className="space-y-4 sm:space-y-6 m-0 focus-visible:ring-0">
            
            {/* TOOLBAR KASUS - MOBILE RESPONSIVE */}
            <div className="flex flex-col bg-white/80 backdrop-blur-xl p-4 sm:p-5 rounded-3xl shadow-sm border border-slate-200/60 gap-4">
              <div className="flex flex-col lg:flex-row justify-between gap-4">
                <div className="relative w-full lg:max-w-md">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <Input placeholder="Cari nama siswa / kelas..." value={searchKasus} onChange={e => {setSearchKasus(e.target.value); setPageKasus(1)}} className="pl-11 h-12 rounded-2xl bg-white focus:border-rose-500 shadow-sm text-base" />
                </div>
                {canInput && (
                  <Button onClick={() => { setEditKasusData(null); setIsKasusModalOpen(true); }} className="w-full lg:w-auto h-12 px-6 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white shadow-md gap-2 font-bold transition-all text-base">
                    <PlusCircle className="h-5 w-5" /> Lapor Pelanggaran
                  </Button>
                )}
              </div>

              <hr className="border-slate-100" />

              <div className="grid grid-cols-2 md:flex md:flex-row gap-3">
                <div className="relative w-full md:w-48">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 z-10" />
                  <Select value={filterTingkat} onValueChange={v=>{setFilterTingkat(v); setPageKasus(1)}}>
                    <SelectTrigger className="pl-9 h-12 rounded-xl bg-slate-50 font-semibold"><SelectValue placeholder="Tingkat Kelas" /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="ALL">Semua Kelas</SelectItem>
                      <SelectItem value="10">Kelas 10</SelectItem>
                      <SelectItem value="11">Kelas 11</SelectItem>
                      <SelectItem value="12">Kelas 12</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="relative w-full md:w-56">
                  <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 z-10" />
                  <Select value={sortBy} onValueChange={v=>{setSortBy(v); setPageKasus(1)}}>
                    <SelectTrigger className="pl-9 h-12 rounded-xl bg-slate-50 font-semibold"><SelectValue placeholder="Urutkan" /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="terbaru">Kejadian Terbaru</SelectItem>
                      <SelectItem value="poin_tertinggi">Total Poin Tertinggi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* MOBILE VIEW (CARDS) */}
            <div className="block lg:hidden space-y-4">
              {paginatedKasus.length === 0 ? (
                <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center shadow-sm">
                  <ShieldCheck className="h-10 w-10 text-emerald-400 mx-auto mb-3" />
                  <p className="font-medium text-slate-500">Belum ada catatan pelanggaran.</p>
                </div>
              ) : (
                paginatedKasus.map(k => {
                  const isOwner = k.diinput_oleh === currentUser.id
                  const canEditThis = isOwner || isSuperAdmin
                  const totalPoin = poinSiswaMap[k.siswa_id] || 0

                  return (
                    <div key={k.id} className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-4">
                      <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                        <div>
                          <h3 className="font-extrabold text-slate-800 text-lg leading-tight">{k.siswa.nama_lengkap}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-600">{k.siswa.kelas?.tingkat}-{k.siswa.kelas?.nomor_kelas}</span>
                            <span className="text-xs text-slate-400">{new Date(k.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="font-black text-rose-600 text-xl">+{k.master_pelanggaran.poin}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${totalPoin >= 50 ? 'bg-rose-100 text-rose-700 animate-pulse' : 'bg-slate-100 text-slate-500'}`}>Tot: {totalPoin}</span>
                        </div>
                      </div>

                      <div className="bg-rose-50/50 p-3 rounded-xl border border-rose-100/50">
                        <p className="font-bold text-rose-800 text-sm leading-snug">{k.master_pelanggaran.nama_pelanggaran}</p>
                        {k.keterangan && <p className="text-xs text-slate-500 italic mt-1 leading-relaxed">"{k.keterangan}"</p>}
                      </div>

                      <div className="flex justify-between items-center pt-1">
                        <div className="flex items-center gap-2">
                          <div className={`h-6 w-6 rounded-full flex items-center justify-center font-bold text-[10px] ${isOwner ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                            {k.pelapor?.nama_lengkap?.charAt(0).toUpperCase() || '?'}
                          </div>
                          <span className="text-xs font-medium text-slate-500 truncate max-w-[100px]">{isOwner ? 'Anda' : k.pelapor?.nama_lengkap}</span>
                          {k.foto_url && (
                            <a href={k.foto_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[10px] font-bold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded ml-1"><ImageIcon className="h-3 w-3"/> Bukti</a>
                          )}
                        </div>
                        
                        <div className="flex gap-1">
                          {canEditThis && <Button variant="ghost" size="icon" onClick={() => {setEditKasusData(k); setIsKasusModalOpen(true)}} className="h-8 w-8 text-blue-600 bg-blue-50"><Pencil className="h-3.5 w-3.5"/></Button>}
                          {isSuperAdmin && <Button variant="ghost" size="icon" onClick={() => handleHapusKasus(k.id)} className="h-8 w-8 text-rose-600 bg-rose-50"><Trash2 className="h-3.5 w-3.5"/></Button>}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* DESKTOP VIEW (TABLE) */}
            <div className="hidden lg:flex bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden flex-col">
              <div className="overflow-x-auto custom-scrollbar min-h-[400px]">
                <Table className="min-w-[900px]">
                  <TableHeader className="bg-slate-50 border-b border-slate-200">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="font-bold text-slate-600 h-14 px-6 w-[120px]">Tanggal</TableHead>
                      <TableHead className="font-bold text-slate-600 h-14">Siswa Pelanggar</TableHead>
                      <TableHead className="font-bold text-slate-600 h-14">Kasus / Pelanggaran</TableHead>
                      <TableHead className="font-bold text-slate-600 h-14 text-center">Poin</TableHead>
                      <TableHead className="font-bold text-slate-600 h-14">Pelapor</TableHead>
                      <TableHead className="text-right font-bold text-slate-600 h-14 px-6">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedKasus.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-48 text-center">
                          <div className="flex flex-col items-center justify-center text-slate-400 space-y-3">
                            <div className="p-4 bg-emerald-50 rounded-full"><ShieldCheck className="h-10 w-10 text-emerald-400" /></div>
                            <p className="font-medium text-slate-500 text-base">Alhamdulillah. Belum ada catatan pelanggaran siswa.</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedKasus.map((k) => {
                        const isOwner = k.diinput_oleh === currentUser.id
                        const canEditThis = isOwner || isSuperAdmin
                        const totalPoin = poinSiswaMap[k.siswa_id] || 0
                        
                        return (
                          <TableRow key={k.id} className="hover:bg-rose-50/30 transition-colors border-slate-100 group">
                            <TableCell className="px-6 font-semibold text-slate-500 text-sm">
                              {new Date(k.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </TableCell>
                            <TableCell className="py-4">
                              <div className="font-extrabold text-slate-800 text-base group-hover:text-rose-700 transition-colors">{k.siswa.nama_lengkap}</div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/60 text-slate-600">{k.siswa.kelas?.tingkat}-{k.siswa.kelas?.nomor_kelas} {k.siswa.kelas?.kelompok!=='UMUM'?k.siswa.kelas?.kelompok:''}</span>
                                {totalPoin >= 50 && (
                                  <span className="text-[10px] font-bold bg-rose-100 text-rose-700 px-2 py-0.5 rounded-md shadow-sm border border-rose-200 flex items-center gap-1 animate-pulse">
                                    <AlertTriangle className="h-3 w-3"/> SP/Ortu
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="py-4 max-w-xs">
                              <div className="font-bold text-rose-700 text-sm leading-snug">{k.master_pelanggaran.nama_pelanggaran}</div>
                              {k.keterangan && <div className="text-xs text-slate-500 italic mt-1 line-clamp-1" title={k.keterangan}>"{k.keterangan}"</div>}
                            </TableCell>
                            <TableCell className="py-4 text-center">
                              <div className="flex flex-col items-center gap-0.5">
                                <span className="font-black text-rose-600 text-xl">+{k.master_pelanggaran.poin}</span>
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tot: {totalPoin}</span>
                              </div>
                            </TableCell>
                            <TableCell className="py-4">
                              <div className="flex items-center gap-3">
                                <div className={`h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-xs shrink-0 ring-2 ring-white shadow-sm ${isOwner ? 'bg-blue-100 text-blue-700' : ''}`}>
                                  {k.pelapor?.nama_lengkap?.charAt(0).toUpperCase() || '?'}
                                </div>
                                <div className="flex flex-col">
                                  <span className={`text-sm font-bold truncate w-32 ${isOwner ? 'text-blue-700' : 'text-slate-700'}`}>
                                    {isOwner ? 'Anda Sendiri' : k.pelapor?.nama_lengkap || 'Sistem'}
                                  </span>
                                  {k.foto_url && (
                                    <a href={k.foto_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[10px] font-bold text-blue-500 hover:text-blue-700 mt-0.5 w-fit bg-blue-50 px-1.5 py-0.5 rounded transition-colors"><ImageIcon className="h-3 w-3"/> Lihat Bukti</a>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-right px-6 py-4">
                              <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                {canEditThis && <Button variant="ghost" size="icon" onClick={() => {setEditKasusData(k); setIsKasusModalOpen(true)}} disabled={isPending} className="h-10 w-10 rounded-xl text-blue-600 bg-blue-50 hover:bg-blue-100 shadow-sm"><Pencil className="h-4 w-4" /></Button>}
                                {isSuperAdmin && <Button variant="ghost" size="icon" onClick={() => handleHapusKasus(k.id)} disabled={isPending} className="h-10 w-10 rounded-xl text-rose-600 bg-rose-50 hover:bg-rose-100 shadow-sm"><Trash2 className="h-4 w-4" /></Button>}
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
              
              {/* PAGINATION */}
              <div className="flex items-center justify-between p-4 bg-slate-50/50 border-t border-slate-100">
                <div className="text-sm font-medium text-slate-500">Total: {processedKasus.length} kasus</div>
                <div className="flex gap-2 items-center">
                  <Button variant="outline" size="sm" onClick={() => setPageKasus(p => Math.max(1, p-1))} disabled={pageKasus === 1} className="h-9 rounded-lg bg-white">Prev</Button>
                  <div className="text-sm font-bold px-3">{pageKasus} / {totalPagesKasus || 1}</div>
                  <Button variant="outline" size="sm" onClick={() => setPageKasus(p => Math.min(totalPagesKasus, p+1))} disabled={pageKasus >= totalPagesKasus || totalPagesKasus === 0} className="h-9 rounded-lg bg-white">Next</Button>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ======================= TAB MASTER KAMUS ======================= */}
          {canManageMaster && (
            <TabsContent value="kamus" className="space-y-4 sm:space-y-6 m-0 focus-visible:ring-0">
              <div className="flex flex-col md:flex-row justify-between gap-4 bg-white/80 backdrop-blur-xl p-4 sm:p-5 rounded-3xl shadow-sm border border-slate-200/60">
                <div className="relative w-full md:w-96">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <Input placeholder="Cari nama pelanggaran..." value={searchMaster} onChange={e => setSearchMaster(e.target.value)} className="pl-11 h-12 rounded-2xl bg-white shadow-sm text-base focus:border-slate-900" />
                </div>
                <div className="grid grid-cols-2 md:flex gap-3 w-full md:w-auto">
                  {/* TOMBOL IMPORT EXCEL KAMUS */}
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full md:w-auto h-12 px-4 rounded-2xl border-slate-300 text-slate-700 hover:bg-slate-50 transition-all font-bold">
                        <FileSpreadsheet className="h-4 w-4 mr-2" /> Import Excel
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md rounded-3xl">
                      <DialogHeader><DialogTitle className="text-xl font-bold">Import Kamus Pelanggaran</DialogTitle></DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <span className="text-sm font-medium text-slate-600">Download format:</span>
                          <Button size="sm" variant="outline" onClick={handleDownloadTemplateKamus} className="gap-2 bg-white"><Download className="h-3.5 w-3.5"/> Template</Button>
                        </div>
                        <div className="bg-slate-100 p-4 rounded-xl text-sm font-mono text-slate-700 space-y-1">
                          <p className="font-bold mb-1">Struktur Kolom:</p>
                          <p>1. NAMA_PELANGGARAN</p>
                          <p>2. KATEGORI (Ringan/Sedang/Berat)</p>
                          <p>3. POIN (Angka, cth: 10)</p>
                        </div>
                        <Input type="file" accept=".xlsx, .xls" onChange={handleFileUploadKamus} disabled={isImportingKamus} className="h-12 pt-2.5 rounded-xl border-slate-300 focus:border-slate-900 cursor-pointer" />
                        {isImportingKamus && <div className="flex items-center text-sm font-bold text-slate-700 bg-slate-100 p-3 rounded-xl animate-pulse"><Loader2 className="mr-2 h-5 w-5 animate-spin"/> Mengimport data...</div>}
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Button onClick={() => { setEditMasterData(null); setIsMasterModalOpen(true); }} className="w-full md:w-auto h-12 px-6 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white shadow-md gap-2 font-bold transition-all text-base">
                    <BookOpen className="h-5 w-5" /> Tambah Kamus
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredMaster.map(m => (
                  <div key={m.id} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between group hover:border-slate-300 transition-colors">
                    <div>
                      <div className="flex justify-between items-start mb-3">
                        <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md border 
                          ${m.kategori === 'Ringan' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : m.kategori === 'Sedang' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                          {m.kategori}
                        </span>
                        <span className="font-black text-2xl text-slate-800">+{m.poin}</span>
                      </div>
                      <h3 className="font-bold text-slate-800 leading-snug">{m.nama_pelanggaran}</h3>
                    </div>
                    
                    <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-100 opacity-20 md:opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" onClick={() => {setEditMasterData(m); setIsMasterModalOpen(true)}} className="h-9 w-9 rounded-xl text-blue-600 bg-blue-50 hover:bg-blue-100"><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleHapusMaster(m.id)} className="h-9 w-9 rounded-xl text-rose-600 bg-rose-50 hover:bg-rose-100"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          )}
        </Tabs>

        {/* Modals */}
        <FormModal isOpen={isKasusModalOpen} onClose={() => setIsKasusModalOpen(false)} editData={editKasusData} siswaList={siswaList} masterList={masterList} />
        <MasterModal isOpen={isMasterModalOpen} onClose={() => setIsMasterModalOpen(false)} editData={editMasterData} />
      </div>
    </>
  )
}