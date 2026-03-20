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
import { cn } from '@/lib/utils'

export function KedisiplinanClient({
  currentUser, kasusList, masterList
}: {
  currentUser: { id: string, role: string, nama: string },
  kasusList: any[], masterList: any[]
}) {
  const isSuperAdmin = currentUser.role === 'super_admin'
  const canInput = ['super_admin', 'admin_tu', 'wakamad', 'guru_bk', 'guru_piket', 'satpam', 'guru'].includes(currentUser.role)
  const canManageMaster = ['super_admin', 'wakamad', 'guru_bk'].includes(currentUser.role)

  const [searchKasus, setSearchKasus] = useState('')
  const [filterTingkat, setFilterTingkat] = useState('ALL')
  const [sortBy, setSortBy] = useState('terbaru')
  const [pageKasus, setPageKasus] = useState(1)
  const itemsPerPage = 15
  const [isKasusModalOpen, setIsKasusModalOpen] = useState(false)
  const [editKasusData, setEditKasusData] = useState<any>(null)
  const [isPending, setIsPending] = useState(false)

  const poinSiswaMap = useMemo(() => kasusList.reduce((acc, curr) => {
    acc[curr.siswa_id] = (acc[curr.siswa_id] || 0) + curr.master_pelanggaran.poin
    return acc
  }, {} as Record<string, number>), [kasusList])

  const processedKasus = useMemo(() => {
    let result = kasusList.filter(k =>
      k.siswa.nama_lengkap.toLowerCase().includes(searchKasus.toLowerCase()) ||
      k.siswa.kelas?.nomor_kelas?.toLowerCase().includes(searchKasus.toLowerCase())
    )
    if (filterTingkat !== 'ALL') result = result.filter(k => k.siswa.kelas?.tingkat?.toString() === filterTingkat)
    result.sort(sortBy === 'poin_tertinggi'
      ? (a, b) => (poinSiswaMap[b.siswa_id] || 0) - (poinSiswaMap[a.siswa_id] || 0)
      : (a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime()
    )
    return result
  }, [kasusList, searchKasus, filterTingkat, sortBy, poinSiswaMap])

  const totalPagesKasus = Math.ceil(processedKasus.length / itemsPerPage)
  const paginatedKasus = processedKasus.slice((pageKasus - 1) * itemsPerPage, pageKasus * itemsPerPage)

  const handleHapusKasus = async (id: string) => {
    if (!confirm('Yakin ingin menghapus catatan pelanggaran ini?')) return
    setIsPending(true)
    const res = await hapusPelanggaran(id)
    if (res.error) alert(res.error)
    setIsPending(false)
  }

  // MASTER KAMUS
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

  const handleDownloadTemplateKamus = () => {
    const XLSX = (window as any).XLSX
    if (!XLSX) return alert('Library belum siap.')
    const data = [
      { NAMA_PELANGGARAN: 'Terlambat hadir lebih dari 15 menit', KATEGORI: 'Ringan', POIN: 5 },
      { NAMA_PELANGGARAN: 'Berambut panjang/gondrong (Putra)', KATEGORI: 'Sedang', POIN: 10 },
      { NAMA_PELANGGARAN: 'Membawa senjata tajam', KATEGORI: 'Berat', POIN: 100 },
    ]
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Kamus_Pelanggaran')
    XLSX.writeFile(wb, 'Template_Kamus_Pelanggaran.xlsx')
  }

  const handleFileUploadKamus = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsImportingKamus(true)
    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const XLSX = (window as any).XLSX
        if (!XLSX) throw new Error('Library belum dimuat.')
        const workbook = XLSX.read(event.target?.result, { type: 'binary' })
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]])
        const result = await importMasterPelanggaranMassal(jsonData)
        if (result.error) alert(result.error)
        else alert(result.success)
      } catch { alert('Gagal membaca file Excel.') }
      finally { setIsImportingKamus(false); e.target.value = '' }
    }
    reader.readAsBinaryString(file)
  }

  const kategoriColor = (k: string) => {
    if (k === 'Ringan') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    if (k === 'Sedang') return 'bg-amber-50 text-amber-700 border-amber-200'
    return 'bg-rose-50 text-rose-700 border-rose-200'
  }

  return (
    <>
      <Script src="https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js" strategy="lazyOnload" />
      <div className="space-y-3">
        <Tabs defaultValue="riwayat" className="space-y-3">
          <TabsList className={cn("bg-surface border border-surface rounded-lg w-full grid p-0.5 gap-0.5 h-auto", canManageMaster ? 'grid-cols-2' : 'grid-cols-1')}>
            <TabsTrigger value="riwayat" className="py-2 rounded-md data-[state=active]:bg-rose-600 data-[state=active]:text-white text-xs sm:text-sm font-medium">
              Riwayat Pelanggaran
            </TabsTrigger>
            {canManageMaster && (
              <TabsTrigger value="kamus" className="py-2 rounded-md data-[state=active]:bg-slate-800 data-[state=active]:text-white text-xs sm:text-sm font-medium">
                Kamus & Poin
              </TabsTrigger>
            )}
          </TabsList>

          {/* TAB RIWAYAT */}
          <TabsContent value="riwayat" className="space-y-3 m-0">
            {/* TOOLBAR */}
            <div className="bg-surface border border-surface rounded-lg p-3 space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <Input placeholder="Cari nama siswa / kelas..." value={searchKasus} onChange={e => { setSearchKasus(e.target.value); setPageKasus(1) }} className="pl-8 h-8 text-sm rounded-md" />
                </div>
                {canInput && (
                  <Button onClick={() => { setEditKasusData(null); setIsKasusModalOpen(true) }} size="sm" className="h-8 px-3 text-xs bg-rose-600 hover:bg-rose-700 text-white rounded-md shrink-0">
                    <PlusCircle className="h-3.5 w-3.5 mr-1" /> Lapor
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Select value={filterTingkat} onValueChange={v => { setFilterTingkat(v); setPageKasus(1) }}>
                  <SelectTrigger className="h-7 text-xs rounded flex-1"><SelectValue placeholder="Tingkat" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Semua Kelas</SelectItem>
                    <SelectItem value="10">Kelas 10</SelectItem>
                    <SelectItem value="11">Kelas 11</SelectItem>
                    <SelectItem value="12">Kelas 12</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={v => { setSortBy(v); setPageKasus(1) }}>
                  <SelectTrigger className="h-7 text-xs rounded flex-1"><SelectValue placeholder="Urut" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="terbaru">Terbaru</SelectItem>
                    <SelectItem value="poin_tertinggi">Poin Tertinggi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* MOBILE CARDS */}
            <div className="block lg:hidden space-y-2">
              {paginatedKasus.length === 0 ? (
                <div className="bg-surface py-10 rounded-lg border border-surface text-center">
                  <ShieldCheck className="h-7 w-7 text-emerald-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">Belum ada catatan pelanggaran.</p>
                </div>
              ) : paginatedKasus.map(k => {
                const isOwner = k.diinput_oleh === currentUser.id
                const canEditThis = isOwner || isSuperAdmin
                const totalPoin = poinSiswaMap[k.siswa_id] || 0

                return (
                  <div key={k.id} className="bg-surface border border-surface rounded-lg p-3">
                    {/* Row 1: Nama + Poin */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="text-sm font-semibold text-slate-800 leading-tight truncate">{k.siswa.nama_lengkap}</p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="text-[10px] font-medium text-slate-500 bg-surface-3 px-1.5 py-0.5 rounded border border-surface">
                            {k.siswa.kelas?.tingkat}-{k.siswa.kelas?.nomor_kelas}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(k.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                          </span>
                          {totalPoin >= 50 && (
                            <span className="text-[9px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 flex items-center gap-0.5 animate-pulse">
                              <AlertTriangle className="h-2.5 w-2.5" />SP
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-base font-black text-rose-600">+{k.master_pelanggaran.poin}</span>
                        <p className="text-[9px] text-slate-400">Tot: {totalPoin}</p>
                      </div>
                    </div>

                    {/* Row 2: Nama pelanggaran */}
                    <p className="text-xs font-semibold text-rose-700 bg-rose-50 px-2 py-1.5 rounded border border-rose-100 leading-snug">
                      {k.master_pelanggaran.nama_pelanggaran}
                    </p>
                    {k.keterangan && <p className="text-[10px] text-slate-500 italic mt-1 truncate">"{k.keterangan}"</p>}

                    {/* Row 3: Pelapor + aksi */}
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-surface-2">
                      <div className="flex items-center gap-1.5">
                        <div className={cn("h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold", isOwner ? 'bg-blue-100 text-blue-700' : 'bg-surface-3 text-slate-500')}>
                          {k.pelapor?.nama_lengkap?.charAt(0) || '?'}
                        </div>
                        <span className="text-[10px] text-slate-500 truncate max-w-[80px]">{isOwner ? 'Anda' : k.pelapor?.nama_lengkap}</span>
                        {k.foto_url && (
                          <a href={k.foto_url} target="_blank" rel="noreferrer" className="text-[9px] font-bold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                            <ImageIcon className="h-2.5 w-2.5" />Bukti
                          </a>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {canEditThis && (
                          <button onClick={() => { setEditKasusData(k); setIsKasusModalOpen(true) }} className="p-1.5 rounded text-blue-600 hover:bg-blue-50 transition-colors">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {isSuperAdmin && (
                          <button onClick={() => handleHapusKasus(k.id)} className="p-1.5 rounded text-rose-500 hover:bg-rose-50 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* DESKTOP TABLE */}
            <div className="hidden lg:block bg-surface rounded-lg border border-surface overflow-hidden">
              <div className="overflow-x-auto">
                <Table className="min-w-[820px]">
                  <TableHeader>
                    <TableRow className="bg-surface-2 hover:bg-surface-2">
                      <TableHead className="h-9 px-4 text-xs font-semibold text-slate-500 w-24">Tanggal</TableHead>
                      <TableHead className="h-9 text-xs font-semibold text-slate-500">Siswa</TableHead>
                      <TableHead className="h-9 text-xs font-semibold text-slate-500">Pelanggaran</TableHead>
                      <TableHead className="h-9 text-xs font-semibold text-slate-500 text-center w-20">Poin</TableHead>
                      <TableHead className="h-9 text-xs font-semibold text-slate-500 w-36">Pelapor</TableHead>
                      <TableHead className="h-9 text-xs font-semibold text-slate-500 text-right px-4 w-20">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedKasus.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-32 text-center">
                          <div className="flex flex-col items-center gap-2 text-slate-400">
                            <ShieldCheck className="h-7 w-7 text-emerald-400" />
                            <p className="text-sm">Belum ada catatan pelanggaran.</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : paginatedKasus.map(k => {
                      const isOwner = k.diinput_oleh === currentUser.id
                      const canEditThis = isOwner || isSuperAdmin
                      const totalPoin = poinSiswaMap[k.siswa_id] || 0

                      return (
                        <TableRow key={k.id} className="hover:bg-rose-50/20 border-surface-2 group">
                          <TableCell className="px-4 py-2.5 text-xs text-slate-500 font-medium">
                            {new Date(k.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: '2-digit' })}
                          </TableCell>
                          <TableCell className="py-2.5">
                            <p className="text-sm font-semibold text-slate-800 group-hover:text-rose-700 transition-colors leading-tight">{k.siswa.nama_lengkap}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] text-slate-500 bg-surface-3 px-1.5 py-0.5 rounded border border-surface font-medium">
                                {k.siswa.kelas?.tingkat}-{k.siswa.kelas?.nomor_kelas} {k.siswa.kelas?.kelompok !== 'UMUM' ? k.siswa.kelas?.kelompok : ''}
                              </span>
                              {totalPoin >= 50 && (
                                <span className="text-[9px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 flex items-center gap-0.5 animate-pulse">
                                  <AlertTriangle className="h-2.5 w-2.5" />SP
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="py-2.5 max-w-xs">
                            <p className="text-xs font-semibold text-rose-700 leading-snug">{k.master_pelanggaran.nama_pelanggaran}</p>
                            {k.keterangan && <p className="text-[10px] text-slate-400 italic mt-0.5 line-clamp-1">"{k.keterangan}"</p>}
                          </TableCell>
                          <TableCell className="py-2.5 text-center">
                            <span className="text-base font-black text-rose-600">+{k.master_pelanggaran.poin}</span>
                            <p className="text-[9px] text-slate-400">Tot: {totalPoin}</p>
                          </TableCell>
                          <TableCell className="py-2.5">
                            <div className="flex items-center gap-2">
                              <div className={cn("h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0", isOwner ? 'bg-blue-100 text-blue-700' : 'bg-surface-3 text-slate-600')}>
                                {k.pelapor?.nama_lengkap?.charAt(0) || '?'}
                              </div>
                              <div>
                                <p className="text-xs font-medium text-slate-700 truncate w-24">{isOwner ? 'Anda' : k.pelapor?.nama_lengkap || 'Sistem'}</p>
                                {k.foto_url && (
                                  <a href={k.foto_url} target="_blank" rel="noreferrer" className="text-[9px] font-bold text-blue-500 hover:text-blue-700 flex items-center gap-0.5 mt-0.5">
                                    <ImageIcon className="h-2.5 w-2.5" />Bukti
                                  </a>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-2.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {canEditThis && (
                                <button onClick={() => { setEditKasusData(k); setIsKasusModalOpen(true) }} disabled={isPending} className="p-1.5 rounded text-blue-600 hover:bg-blue-50">
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                              )}
                              {isSuperAdmin && (
                                <button onClick={() => handleHapusKasus(k.id)} disabled={isPending} className="p-1.5 rounded text-rose-500 hover:bg-rose-50">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center justify-between px-4 py-2 border-t border-surface-2 bg-slate-50/50">
                <span className="text-xs text-slate-500">{processedKasus.length} kasus</span>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" onClick={() => setPageKasus(p => Math.max(1, p - 1))} disabled={pageKasus === 1} className="h-7 px-2.5 text-xs rounded">←</Button>
                  <span className="text-xs font-medium px-2">{pageKasus}/{totalPagesKasus || 1}</span>
                  <Button variant="outline" size="sm" onClick={() => setPageKasus(p => Math.min(totalPagesKasus, p + 1))} disabled={pageKasus >= totalPagesKasus} className="h-7 px-2.5 text-xs rounded">→</Button>
                </div>
              </div>
            </div>

            {/* Mobile pagination */}
            <div className="flex items-center justify-between lg:hidden bg-surface border border-surface rounded-lg px-3 py-2">
              <span className="text-xs text-slate-500">{processedKasus.length} kasus</span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={() => setPageKasus(p => Math.max(1, p - 1))} disabled={pageKasus === 1} className="h-7 px-2.5 text-xs rounded">←</Button>
                <span className="text-xs font-medium px-2">{pageKasus}/{totalPagesKasus || 1}</span>
                <Button variant="outline" size="sm" onClick={() => setPageKasus(p => Math.min(totalPagesKasus, p + 1))} disabled={pageKasus >= totalPagesKasus} className="h-7 px-2.5 text-xs rounded">→</Button>
              </div>
            </div>
          </TabsContent>

          {/* TAB KAMUS */}
          {canManageMaster && (
            <TabsContent value="kamus" className="space-y-3 m-0">
              <div className="bg-surface border border-surface rounded-lg p-3 flex flex-wrap gap-2 items-center">
                <div className="relative flex-1 min-w-0" style={{ minWidth: '140px' }}>
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <Input placeholder="Cari pelanggaran..." value={searchMaster} onChange={e => setSearchMaster(e.target.value)} className="pl-8 h-8 text-sm rounded-md" />
                </div>
                <div className="flex gap-2 ml-auto">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 text-xs rounded-md">
                        <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Import
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md rounded-xl">
                      <DialogHeader><DialogTitle className="text-base font-semibold">Import Kamus Pelanggaran</DialogTitle></DialogHeader>
                      <div className="space-y-3 py-3">
                        <div className="flex justify-between items-center bg-surface-2 p-2.5 rounded-lg border border-surface">
                          <span className="text-xs font-medium text-slate-600">Download format:</span>
                          <Button size="sm" variant="outline" onClick={handleDownloadTemplateKamus} className="h-7 text-xs gap-1"><Download className="h-3 w-3" />Template</Button>
                        </div>
                        <div className="bg-surface-3 p-3 rounded-lg text-xs font-mono text-slate-600 space-y-0.5">
                          <p className="font-bold mb-1">Kolom:</p>
                          <p>1. NAMA_PELANGGARAN</p>
                          <p>2. KATEGORI (Ringan/Sedang/Berat)</p>
                          <p>3. POIN (angka)</p>
                        </div>
                        <Input type="file" accept=".xlsx,.xls" onChange={handleFileUploadKamus} disabled={isImportingKamus} className="h-9 text-xs rounded-lg cursor-pointer" />
                        {isImportingKamus && <div className="flex items-center text-xs font-medium text-slate-600 bg-surface-3 p-2.5 rounded-lg animate-pulse"><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Mengimport...</div>}
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Button onClick={() => { setEditMasterData(null); setIsMasterModalOpen(true) }} size="sm" className="h-8 text-xs rounded-md bg-slate-800 hover:bg-slate-700 text-white">
                    <BookOpen className="h-3.5 w-3.5 mr-1" /> Tambah
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {filteredMaster.map(m => (
                  <div key={m.id} className="bg-surface border border-surface rounded-lg p-3 flex flex-col justify-between group hover:border-slate-300 transition-colors">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <span className={cn("text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border", kategoriColor(m.kategori))}>
                          {m.kategori}
                        </span>
                        <span className="text-base font-black text-slate-800">+{m.poin}</span>
                      </div>
                      <p className="text-xs font-medium text-slate-700 leading-snug">{m.nama_pelanggaran}</p>
                    </div>
                    <div className="flex justify-end gap-1 mt-2.5 pt-2 border-t border-surface-2 opacity-30 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditMasterData(m); setIsMasterModalOpen(true) }} className="p-1.5 rounded text-blue-600 hover:bg-blue-50">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => handleHapusMaster(m.id)} className="p-1.5 rounded text-rose-500 hover:bg-rose-50">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          )}
        </Tabs>

        <FormModal isOpen={isKasusModalOpen} onClose={() => setIsKasusModalOpen(false)} editData={editKasusData} masterList={masterList} />
        <MasterModal isOpen={isMasterModalOpen} onClose={() => setIsMasterModalOpen(false)} editData={editMasterData} />
      </div>
    </>
  )
}