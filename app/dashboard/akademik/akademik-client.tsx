'use client'

import { useState } from 'react'
import Script from 'next/script'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { BookOpen, FileSpreadsheet, Trash2, Loader2, Download, AlertCircle, Pencil } from 'lucide-react'
import { tambahMapel, editMapel, hapusMapel, importPenugasanASC, hapusPenugasan, importMapelMassal } from './actions'

type MapelType = { id: string, nama_mapel: string, kelompok: string, tingkat: string, kategori: string }
type PenugasanType = { 
  id: string, 
  guru: { nama_lengkap: string }, 
  mapel: { nama_mapel: string, kelompok: string }, 
  kelas: { tingkat: number, nomor_kelas: string, kelompok: string } 
}

export function AkademikClient({ mapelData, penugasanData }: { mapelData: MapelType[], penugasanData: PenugasanType[] }) {
  const [isMapelPending, setIsMapelPending] = useState(false)
  const [searchMapel, setSearchMapel] = useState('')
  const filteredMapel = mapelData.filter(m => m.nama_mapel.toLowerCase().includes(searchMapel.toLowerCase()))

  const [searchPenugasan, setSearchPenugasan] = useState('')
  const filteredPenugasan = penugasanData.filter(p => p.guru.nama_lengkap.toLowerCase().includes(searchPenugasan.toLowerCase()) || p.kelas.nomor_kelas.includes(searchPenugasan))
  
  const [isImportingASC, setIsImportingASC] = useState(false)
  const [importLogs, setImportLogs] = useState<string[]>([])
  const [isImportingMapel, setIsImportingMapel] = useState(false)
  
  // State untuk Edit Mapel
  const [editingMapel, setEditingMapel] = useState<MapelType | null>(null)

  const handleHapusMapel = async (id: string, nama: string) => {
    if (!confirm(`Hapus mata pelajaran ${nama}?`)) return
    setIsMapelPending(true)
    const res = await hapusMapel(id)
    if (res?.error) alert(res?.error)
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
      { NAMA_GURU: "Budi Santoso", NAMA_MAPEL: "Matematika Tingkat Lanjut", NAMA_KELAS: "11-1" },
      { NAMA_GURU: "Siti Aminah", NAMA_MAPEL: "Bahasa Indonesia", NAMA_KELAS: "10-2" }
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

  return (
    <>
      <Script src="https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js" strategy="lazyOnload" />

      {/* MODAL EDIT MAPEL */}
      <Dialog open={!!editingMapel} onOpenChange={(open) => !open && setEditingMapel(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Mata Pelajaran</DialogTitle></DialogHeader>
          <form action={async (fd) => { 
            setIsMapelPending(true); 
            fd.append('id', editingMapel!.id);
            const res = await editMapel({}, fd); 
            if (res?.error) alert(res.error);
            setIsMapelPending(false); 
            setEditingMapel(null);
          }} className="space-y-4">
            <div className="grid grid-cols-4 gap-4 items-center">
              <label className="text-right text-sm">Nama Mapel</label>
              <Input name="nama_mapel" defaultValue={editingMapel?.nama_mapel} placeholder="Misal: Biologi" className="col-span-3" required />
            </div>
            <div className="grid grid-cols-4 gap-4 items-center">
              <label className="text-right text-sm">Kelompok</label>
              <Select name="kelompok" defaultValue={editingMapel?.kelompok}>
                <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MIPA">MIPA</SelectItem>
                  <SelectItem value="SOSHUM">SOSHUM</SelectItem>
                  <SelectItem value="KEAGAMAAN">KEAGAMAAN</SelectItem>
                  <SelectItem value="UMUM">UMUM (Semua Jurusan)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 gap-4 items-center">
              <label className="text-right text-sm">Tingkat Kelas</label>
              <Select name="tingkat" defaultValue={editingMapel?.tingkat}>
                <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">Kelas 10</SelectItem>
                  <SelectItem value="11">Kelas 11</SelectItem>
                  <SelectItem value="12">Kelas 12</SelectItem>
                  <SelectItem value="11 & 12">Kelas 11 & 12 (Fase F)</SelectItem>
                  <SelectItem value="Semua">Semua Tingkat (10-12)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 gap-4 items-center">
              <label className="text-right text-sm">Kategori</label>
              <Select name="kategori" defaultValue={editingMapel?.kategori}>
                <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Kelompok Mata Pelajaran Umum">Kelompok Mata Pelajaran Umum</SelectItem>
                  <SelectItem value="Kelompok Mata Pelajaran Pilihan">Kelompok Mata Pelajaran Pilihan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full mt-4" disabled={isMapelPending}>Update Mapel</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="mapel" className="space-y-6">
        <TabsList className="bg-white border p-1 grid grid-cols-2 max-w-md h-auto">
          <TabsTrigger value="mapel" className="py-2.5">1. Master Mata Pelajaran</TabsTrigger>
          <TabsTrigger value="penugasan" className="py-2.5 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">2. Beban Mengajar (ASC)</TabsTrigger>
        </TabsList>

        {/* ===================== TAB 1: MASTER MAPEL ===================== */}
        <TabsContent value="mapel" className="space-y-4 m-0 focus-visible:ring-0">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <Input placeholder="Cari Nama Mapel..." value={searchMapel} onChange={e => setSearchMapel(e.target.value)} className="max-w-xs bg-white" />
            
            <div className="flex items-center gap-2">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-2 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
                    <FileSpreadsheet className="h-4 w-4" /> Import Excel
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-xl">
                  <DialogHeader><DialogTitle>Import Master Mata Pelajaran</DialogTitle></DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="flex justify-between items-center p-3 bg-slate-50 border rounded-lg">
                      <p className="text-sm text-slate-600">Download dan isi format berikut:</p>
                      <Button size="sm" variant="outline" onClick={handleDownloadTemplateMapel} className="gap-2 h-8 text-xs"><Download className="h-3 w-3"/> Template</Button>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-lg text-xs space-y-1 font-mono text-emerald-800">
                      <p>Kolom Wajib:</p>
                      <p><strong>NAMA_MAPEL</strong>, <strong>KELOMPOK</strong> (MIPA/SOSHUM/dll), <strong>TINGKAT</strong> (10/11/12/11 & 12/Semua), <strong>KATEGORI</strong></p>
                    </div>
                    <Input type="file" accept=".xlsx, .xls" onChange={handleFileUploadMapel} disabled={isImportingMapel} className="cursor-pointer" />
                    {isImportingMapel && <div className="flex items-center text-sm text-emerald-600"><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Sedang mengimport data...</div>}
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog>
                <DialogTrigger asChild><Button className="gap-2 bg-blue-600 hover:bg-blue-700"><BookOpen className="h-4 w-4" /> Tambah Mapel</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Tambah Mata Pelajaran</DialogTitle></DialogHeader>
                  <form action={async (fd) => { setIsMapelPending(true); await tambahMapel({}, fd); setIsMapelPending(false); }} className="space-y-4">
                    <div className="grid grid-cols-4 gap-4 items-center">
                      <label className="text-right text-sm">Nama Mapel</label>
                      <Input name="nama_mapel" placeholder="Misal: Biologi" className="col-span-3" required />
                    </div>
                    <div className="grid grid-cols-4 gap-4 items-center">
                      <label className="text-right text-sm">Kelompok</label>
                      <Select name="kelompok" defaultValue="UMUM">
                        <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MIPA">MIPA</SelectItem>
                          <SelectItem value="SOSHUM">SOSHUM</SelectItem>
                          <SelectItem value="KEAGAMAAN">KEAGAMAAN</SelectItem>
                          <SelectItem value="UMUM">UMUM (Semua Jurusan)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-4 gap-4 items-center">
                      <label className="text-right text-sm">Tingkat Kelas</label>
                      <Select name="tingkat" defaultValue="Semua">
                        <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">Kelas 10</SelectItem>
                          <SelectItem value="11">Kelas 11</SelectItem>
                          <SelectItem value="12">Kelas 12</SelectItem>
                          <SelectItem value="11 & 12">Kelas 11 & 12 (Fase F)</SelectItem>
                          <SelectItem value="Semua">Semua Tingkat (10-12)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-4 gap-4 items-center">
                      <label className="text-right text-sm">Kategori</label>
                      <Select name="kategori" defaultValue="Kelompok Mata Pelajaran Umum">
                        <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Kelompok Mata Pelajaran Umum">Kelompok Mata Pelajaran Umum</SelectItem>
                          <SelectItem value="Kelompok Mata Pelajaran Pilihan">Kelompok Mata Pelajaran Pilihan</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="submit" className="w-full mt-4" disabled={isMapelPending}>Simpan Mapel</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead>Nama Mata Pelajaran</TableHead>
                  <TableHead>Kelompok</TableHead>
                  <TableHead>Tingkat Kelas</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMapel.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center p-8 text-slate-500">Belum ada mata pelajaran.</TableCell></TableRow>
                ) : (
                  filteredMapel.map(m => (
                    <TableRow key={m.id}>
                      <TableCell className="font-bold text-slate-800">{m.nama_mapel}</TableCell>
                      <TableCell>
                        {m.kelompok !== 'UMUM' ? (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded-full">{m.kelompok}</span>
                        ) : (
                          <span className="text-xs text-slate-500">Umum</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md text-xs font-semibold">
                          {m.tingkat === 'Semua' ? 'Semua Tingkat' : `Kelas ${m.tingkat}`}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">{m.kategori}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => setEditingMapel(m)} className="text-blue-500 hover:bg-blue-50"><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleHapusMapel(m.id, m.nama_mapel)} className="text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ===================== TAB 2: PENUGASAN (ASC IMPORT) ===================== */}
        <TabsContent value="penugasan" className="space-y-4 m-0 focus-visible:ring-0">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <Input placeholder="Cari Nama Guru / Kelas..." value={searchPenugasan} onChange={e => setSearchPenugasan(e.target.value)} className="max-w-xs bg-white" />
            
            <Dialog>
              <DialogTrigger asChild><Button className="gap-2 bg-indigo-600 hover:bg-indigo-700"><FileSpreadsheet className="h-4 w-4" /> Import dari ASC</Button></DialogTrigger>
              <DialogContent className="sm:max-w-xl">
                <DialogHeader><DialogTitle>Smart Import dari ASC Timetables</DialogTitle></DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="flex justify-between items-center p-3 bg-slate-50 border rounded-lg">
                    <p className="text-sm text-slate-600">Pastikan Excel dari ASC memiliki 3 kolom wajib ini:</p>
                    <Button size="sm" variant="outline" onClick={handleDownloadTemplateASC} className="gap-2 h-8 text-xs"><Download className="h-3 w-3"/> Template</Button>
                  </div>
                  <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-lg text-xs space-y-1 font-mono text-indigo-800">
                    <p>1. <strong>NAMA_GURU</strong> : (Sistem akan melacak nama yang mirip)</p>
                    <p>2. <strong>NAMA_MAPEL</strong> : (Harus persis dengan Nama Mapel di sistem)</p>
                    <p>3. <strong>NAMA_KELAS</strong> : (Format angka-angka, contoh: 10-1 atau 11-2)</p>
                  </div>
                  
                  <Input type="file" accept=".xlsx, .xls" onChange={handleFileUploadASC} disabled={isImportingASC} className="cursor-pointer" />
                  
                  {isImportingASC && <div className="flex items-center text-sm text-indigo-600"><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Sedang mencocokkan data...</div>}
                  
                  {importLogs.length > 0 && (
                    <div className="mt-4 border border-rose-200 rounded-lg overflow-hidden">
                      <div className="bg-rose-50 px-3 py-2 text-sm font-bold text-rose-800 flex items-center gap-2"><AlertCircle className="h-4 w-4"/> Laporan Data Tidak Cocok:</div>
                      <ScrollArea className="h-32 bg-white p-3 text-xs font-mono text-rose-600 leading-relaxed">
                        {importLogs.map((log, i) => <div key={i}>{log}</div>)}
                      </ScrollArea>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-white p-4 rounded-xl border shadow-sm">
              <p className="text-sm text-slate-500">Total Penugasan Ter-import</p>
              <h3 className="text-2xl font-bold text-indigo-700">{penugasanData.length} <span className="text-sm font-normal text-slate-500">Relasi</span></h3>
            </div>
          </div>

          <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead>Nama Guru</TableHead>
                  <TableHead>Mata Pelajaran</TableHead>
                  <TableHead>Mengajar di Kelas</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPenugasan.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="h-24 text-center text-slate-500">Belum ada data penugasan. Silakan import dari ASC.</TableCell></TableRow>
                ) : (
                  filteredPenugasan.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-bold text-slate-800">{p.guru?.nama_lengkap}</TableCell>
                      <TableCell>
                        <span className="font-medium text-slate-700">{p.mapel?.nama_mapel}</span>
                        {p.mapel?.kelompok !== 'UMUM' && (
                          <span className="ml-2 text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded">{p.mapel?.kelompok}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 border border-indigo-100">
                          {p.kelas?.tingkat}-{p.kelas?.nomor_kelas} {p.kelas?.kelompok !== 'UMUM' ? p.kelas?.kelompok : ''}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                         <Button variant="ghost" size="icon" onClick={async () => { if(confirm('Hapus penugasan ini?')) { setIsMapelPending(true); await hapusPenugasan(p.id); setIsMapelPending(false); } }} className="text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </>
  )
}