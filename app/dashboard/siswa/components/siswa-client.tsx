'use client'

import { useState, useEffect } from 'react'
import Script from 'next/script'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, UserPlus, Trash2, Pencil, Users, MapPin, GraduationCap } from 'lucide-react'
import { hapusSiswa } from '../actions'
import { ImportModalSiswa } from './import-modal'
import { TambahModal } from './tambah-modal'

type SiswaType = {
  id: string
  nisn: string
  nis_lokal: string
  nama_lengkap: string
  jenis_kelamin: string
  tempat_tinggal: string
  status: string
  kelas?: { id: string, tingkat: number, nomor_kelas: string, kelompok: string } | null
}

type KelasType = { id: string, tingkat: number, nomor_kelas: string, kelompok: string }

export function SiswaClient({ initialData, kelasList }: { initialData: SiswaType[], kelasList: KelasType[] }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterKelas, setFilterKelas] = useState('ALL')
  const [filterStatus, setFilterStatus] = useState('Aktif')
  const [isPending, setIsPending] = useState(false)
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  // Reset pagination on filter change
  useEffect(() => { setCurrentPage(1) }, [searchTerm, filterKelas, filterStatus, itemsPerPage])

  // FILTERING
  const filteredData = initialData.filter(s => {
    const matchSearch = s.nama_lengkap.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        s.nisn.includes(searchTerm) || 
                        (s.nis_lokal && s.nis_lokal.includes(searchTerm))
    const matchKelas = filterKelas === 'ALL' || (s.kelas && s.kelas.id === filterKelas)
    const matchStatus = filterStatus === 'ALL' || s.status.toLowerCase() === filterStatus.toLowerCase()
    
    return matchSearch && matchKelas && matchStatus
  })

  // PAGINATION
  const totalPages = Math.ceil(filteredData.length / itemsPerPage)
  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const handleHapus = async (id: string, nama: string) => {
    if (!confirm(`Hapus permanen data siswa ${nama}?`)) return
    setIsPending(true)
    const res = await hapusSiswa(id)
    if (res?.error) alert(res.error)
    setIsPending(false)
  }

  // Fungsi helper untuk mendapatkan warna avatar
  const getAvatarColor = (name: string) => {
    const colors = [
      'from-emerald-100 to-emerald-200 text-emerald-800',
      'from-teal-100 to-teal-200 text-teal-800',
      'from-cyan-100 to-cyan-200 text-cyan-800',
      'from-blue-100 to-blue-200 text-blue-800',
    ]
    const charCode = name.charCodeAt(0) || 0
    return colors[charCode % colors.length]
  }

  // Fungsi helper untuk badge status
  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase()
    if (s === 'aktif') return 'bg-emerald-100 text-emerald-700 ring-emerald-300'
    if (s === 'lulus') return 'bg-blue-100 text-blue-700 ring-blue-300'
    return 'bg-rose-100 text-rose-700 ring-rose-300'
  }

  return (
    <>
      <Script src="https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js" strategy="lazyOnload" />

      <div className="space-y-6">
        {/* TOOLBAR MODERN */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white/80 backdrop-blur-xl p-4 rounded-2xl border border-slate-200/60 shadow-sm">
          
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            {/* SEARCH */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Cari nama atau NISN..." 
                className="pl-10 rounded-xl bg-slate-50/50 border-slate-200 focus:bg-white focus:border-emerald-500 transition-all h-11" 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
              />
            </div>
            {/* FILTER KELAS */}
            <Select value={filterKelas} onValueChange={setFilterKelas}>
              <SelectTrigger className="w-full sm:w-40 rounded-xl h-11 bg-slate-50/50 border-slate-200 text-slate-600 font-medium focus:ring-emerald-500">
                <SelectValue placeholder="Semua Kelas" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="ALL" className="font-semibold text-emerald-600">Semua Kelas</SelectItem>
                {kelasList.map(k => (
                  <SelectItem key={k.id} value={k.id}>{k.tingkat}-{k.nomor_kelas} {k.kelompok}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* FILTER STATUS */}
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-36 rounded-xl h-11 bg-slate-50/50 border-slate-200 text-slate-600 font-medium focus:ring-emerald-500">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="ALL">Semua Status</SelectItem>
                <SelectItem value="Aktif">Aktif</SelectItem>
                <SelectItem value="Lulus">Lulus</SelectItem>
                <SelectItem value="Keluar">Keluar / Pindah</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <ImportModalSiswa />
            <TambahModal />
          </div>
        </div>

        {/* DATA TABLE MODERN */}
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="border-slate-200/60 hover:bg-transparent">
                <TableHead className="font-semibold text-slate-600 h-12 px-6">Identitas Siswa</TableHead>
                <TableHead className="font-semibold text-slate-600 h-12">Detail Akademik</TableHead>
                <TableHead className="font-semibold text-slate-600 h-12">Status</TableHead>
                <TableHead className="text-right font-semibold text-slate-600 h-12 px-6">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400 space-y-3">
                      <div className="p-4 bg-slate-50 rounded-full"><Users className="h-8 w-8 text-slate-300" /></div>
                      <p className="font-medium text-slate-500">Tidak ada data siswa yang ditemukan.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map((s) => (
                  <TableRow key={s.id} className="hover:bg-emerald-50/30 transition-colors border-slate-100 group">
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className={`h-11 w-11 rounded-full bg-gradient-to-br ${getAvatarColor(s.nama_lengkap)} shadow-inner flex items-center justify-center text-lg font-bold ring-2 ring-white`}>
                          {s.nama_lengkap.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800 group-hover:text-emerald-700 transition-colors">{s.nama_lengkap}</span>
                          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 font-medium">
                            <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{s.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}</span>
                            <span className="flex items-center gap-1"><MapPin className="h-3 w-3 opacity-70"/> {s.tempat_tinggal}</span>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                          <GraduationCap className="h-4 w-4 text-emerald-500" /> 
                          {s.kelas ? `${s.kelas.tingkat}-${s.kelas.nomor_kelas} ${s.kelas.kelompok}` : <span className="text-rose-500 italic">Belum Ada Kelas</span>}
                        </div>
                        <div className="text-xs text-slate-500 font-mono">NISN: {s.nisn} {s.nis_lokal && `• NIS: ${s.nis_lokal}`}</div>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset ${getStatusBadge(s.status)}`}>
                        {s.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right px-6 py-4">
                      <div className="flex items-center justify-end gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" asChild className="h-9 w-9 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700">
                          <Link href={`/dashboard/siswa/${s.id}/edit`}><Pencil className="h-4 w-4" /></Link>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleHapus(s.id, s.nama_lengkap)} disabled={isPending} className="h-9 w-9 rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* PAGINATION FOOTER MODERN */}
          <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-t border-slate-100 bg-slate-50/50 gap-4 text-sm">
            <div className="flex items-center gap-3 text-slate-500 font-medium">
              <span>Tampilkan</span>
              <Select value={itemsPerPage.toString()} onValueChange={(v) => setItemsPerPage(Number(v))}>
                <SelectTrigger className="h-9 w-[80px] bg-white rounded-lg border-slate-200 font-bold text-slate-700 shadow-sm focus:ring-emerald-500"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
              <span>dari <strong className="text-slate-800">{filteredData.length}</strong> siswa</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="rounded-lg bg-white shadow-sm hover:bg-slate-50 border-slate-200 text-slate-600">
                Sebelumnya
              </Button>
              <div className="flex items-center justify-center min-w-[4rem] font-bold text-slate-700">
                {currentPage} <span className="text-slate-400 font-medium mx-1">/</span> {totalPages || 1}
              </div>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages || totalPages === 0} className="rounded-lg bg-white shadow-sm hover:bg-slate-50 border-slate-200 text-slate-600">
                Berikutnya
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}