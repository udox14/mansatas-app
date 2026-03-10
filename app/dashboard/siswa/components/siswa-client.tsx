// TIMPA SELURUH ISI FILE INI
// Lokasi: app/dashboard/siswa/components/siswa-client.tsx
'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Users, Trash2, MapPin, Loader2, Pencil, LayoutGrid, List, Camera, CheckCircle2 } from 'lucide-react'
import { TambahModal } from './tambah-modal'
import { ImportModalSiswa } from './import-modal'
import { hapusSiswa, uploadFotoSiswaAction, getDetailSiswaLengkap } from '../actions'
import { EditSiswaModal } from './edit-modal'

// --- HELPER KOMPRESI GAMBAR CLIENT SIDE ---
const compressImage = async (file: File): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target?.result as string
      img.onload = () => {
        const canvas = document.createElement('canvas')
        // PERBAIKAN: Golden Ratio 800px. Sangat tajam untuk dicetak fisik (ID Card/Rapot), tapi tetap hemat database.
        const MAX_SIZE = 800 
        let width = img.width
        let height = img.height

        if (width > height && width > MAX_SIZE) {
          height *= MAX_SIZE / width; width = MAX_SIZE
        } else if (height > MAX_SIZE) {
          width *= MAX_SIZE / height; height = MAX_SIZE
        }

        canvas.width = width; canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx?.drawImage(img, 0, 0, width, height)

        // PERBAIKAN: Kualitas diturunkan sedikit saja ke 80% (0.8) agar gambar tetap HD.
        canvas.toBlob(blob => {
            if (blob) resolve(new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", { type: 'image/jpeg' }))
            else resolve(file)
        }, 'image/jpeg', 0.8) 
      }
      img.onerror = reject
    }
    reader.onerror = reject
  })
}

export function SiswaClient({ initialData, kelasList, currentUser }: { initialData: any[], kelasList: any[], currentUser: any }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterKelas, setFilterKelas] = useState('Semua')
  const [filterStatus, setFilterStatus] = useState('aktif')
  
  // Fitur Baru: Tampilan Galeri vs Tabel
  const [viewMode, setViewMode] = useState<'table' | 'gallery'>('table')
  const [uploadingId, setUploadingId] = useState<string | null>(null)

  const [isPending, setIsPending] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  // Fitur Baru: Edit Lengkap
  const [editingSiswa, setEditingSiswa] = useState<any | null>(null)
  const [isFetchingDetail, setIsFetchingDetail] = useState<string | null>(null)

  const userRole = currentUser?.role || 'wali_murid'
  const canFullEdit = ['super_admin', 'admin_tu'].includes(userRole)

  const filteredData = initialData.filter(s => {
    const matchSearch = s.nama_lengkap.toLowerCase().includes(searchTerm.toLowerCase()) || s.nisn.includes(searchTerm)
    const matchKelas = filterKelas === 'Semua' || s.kelas?.id === filterKelas
    const matchStatus = filterStatus === 'Semua' || s.status === filterStatus
    return matchSearch && matchKelas && matchStatus
  })

  // Di mode galeri, kita tampilkan lebih banyak per halaman (misal 20)
  const dynamicItemsPerPage = viewMode === 'gallery' ? 20 : itemsPerPage
  const totalPages = Math.ceil(filteredData.length / dynamicItemsPerPage)
  const paginatedData = filteredData.slice((currentPage - 1) * dynamicItemsPerPage, currentPage * dynamicItemsPerPage)

  const handleHapus = async (id: string, nama: string) => {
    if (!confirm(`Yakin ingin menghapus permanen data siswa ${nama}?`)) return
    setIsPending(true)
    const res = await hapusSiswa(id)
    if (res?.error) alert(res.error)
    setIsPending(false)
  }

  // FUNGSI BARU: INSTANT PHOTO UPLOAD
  const handleUploadFoto = async (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingId(id)
    try {
      const compressedFile = await compressImage(file)
      const fd = new FormData()
      fd.append('foto', compressedFile)
      
      const res = await uploadFotoSiswaAction(id, fd)
      if (res.error) alert(res.error)
    } catch (err) {
      alert("Gagal memproses gambar.")
    } finally {
      setUploadingId(null)
      e.target.value = ''
    }
  }

  const navigateToDetail = (id: string) => {
    window.location.href = `/dashboard/siswa/${id}`
  }

  const getAvatarColor = (name: string) => {
    const colors = ['from-emerald-400 to-teal-500', 'from-blue-400 to-indigo-500', 'from-amber-400 to-orange-500', 'from-rose-400 to-pink-500']
    return colors[(name.charCodeAt(0) || 0) % colors.length]
  }

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase()
    if (s === 'aktif') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    if (s === 'lulus') return 'bg-blue-50 text-blue-700 border-blue-200'
    return 'bg-rose-50 text-rose-700 border-rose-200'
  }

  const handleEditClick = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setIsFetchingDetail(id)
    const res = await getDetailSiswaLengkap(id)
    setIsFetchingDetail(null)
    if (res.data) setEditingSiswa(res.data)
    else alert(res.error || 'Gagal memuat detail siswa.')
  }

  return (
    <div className="space-y-6">
      <EditSiswaModal isOpen={!!editingSiswa} onClose={() => setEditingSiswa(null)} siswa={editingSiswa} kelasList={kelasList} />

      {/* TOOLBAR */}
      <div className="flex flex-col lg:flex-row justify-between gap-4 bg-white/80 backdrop-blur-xl p-4 sm:p-5 rounded-3xl shadow-sm border border-slate-200/60">
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <Input placeholder="Cari Nama / NISN..." value={searchTerm} onChange={e => {setSearchTerm(e.target.value); setCurrentPage(1)}} className="pl-11 h-12 rounded-xl bg-white focus:border-blue-500 shadow-sm text-base" />
          </div>
          <Select value={filterKelas} onValueChange={v=>{setFilterKelas(v); setCurrentPage(1)}}>
            <SelectTrigger className="h-12 w-full sm:w-48 rounded-xl bg-white shadow-sm font-semibold"><SelectValue placeholder="Semua Kelas" /></SelectTrigger>
            <SelectContent className="rounded-xl max-h-[300px]">
              <SelectItem value="Semua">Semua Kelas</SelectItem>
              <SelectItem value="null">Tanpa Kelas / Belum Plotting</SelectItem>
              {kelasList.map(k => <SelectItem key={k.id} value={k.id}>{k.tingkat}-{k.nomor_kelas} {k.kelompok!=='UMUM'?k.kelompok:''}</SelectItem>)}
            </SelectContent>
          </Select>
          
          {/* TOGGLE VIEW MODE */}
          <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner w-fit">
            <button onClick={() => setViewMode('table')} className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold transition-all ${viewMode === 'table' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <List className="h-4 w-4"/> Tabel
            </button>
            <button onClick={() => setViewMode('gallery')} className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold transition-all ${viewMode === 'gallery' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <LayoutGrid className="h-4 w-4"/> Galeri Foto
            </button>
          </div>
        </div>

        {canFullEdit && (
          <div className="flex gap-2 w-full lg:w-auto">
            <ImportModalSiswa />
            <TambahModal />
          </div>
        )}
      </div>

      {/* TAMPILAN GALERI (LAZY VIEW & PHOTO BATCH UPLOAD) */}
      {viewMode === 'gallery' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 animate-in fade-in zoom-in-95 duration-300">
          {paginatedData.length === 0 ? (
            <div className="col-span-full p-12 text-center text-slate-500 bg-white rounded-3xl border border-dashed border-slate-300">Tidak ada siswa ditemukan.</div>
          ) : (
            paginatedData.map(s => (
              <div key={s.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden group flex flex-col">
                
                {/* AREA FOTO */}
                <div className="relative aspect-[3/4] bg-slate-100 w-full overflow-hidden">
                  {uploadingId === s.id ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/10 backdrop-blur-sm z-20">
                      <Loader2 className="h-8 w-8 text-blue-600 animate-spin mb-2" />
                      <span className="text-xs font-bold text-slate-700">Kompresi...</span>
                    </div>
                  ) : s.foto_url ? (
                    <img src={s.foto_url} alt={s.nama_lengkap} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                  ) : (
                    <div className={`w-full h-full bg-gradient-to-br ${getAvatarColor(s.nama_lengkap)} flex items-center justify-center text-6xl font-black text-white/50`}>
                      {s.nama_lengkap.charAt(0).toUpperCase()}
                    </div>
                  )}
                  
                  {/* OVERLAY UPLOAD KETIKA DI-HOVER (DESKTOP) / SELALU TAMPIL ICON KECIL DI MOBILE */}
                  <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
                    <label className="cursor-pointer bg-white/90 hover:bg-white text-slate-800 px-4 py-2 rounded-full font-bold text-xs flex items-center gap-2 shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-all active:scale-95">
                      <Camera className="w-4 h-4" /> {s.foto_url ? 'Ubah Foto' : 'Jepret Foto'}
                      {/* capture="environment" langsung buka kamera belakang di HP */}
                      <input type="file" className="hidden" accept="image/*" capture="environment" onChange={(e) => handleUploadFoto(s.id, e)} />
                    </label>
                  </div>
                  {/* Indikator kamera mobile (jika susah hover) */}
                  <label className="lg:hidden absolute bottom-2 right-2 bg-blue-600 text-white p-2 rounded-full shadow-lg z-10 cursor-pointer">
                    <Camera className="w-4 h-4" />
                    <input type="file" className="hidden" accept="image/*" capture="environment" onChange={(e) => handleUploadFoto(s.id, e)} />
                  </label>
                </div>

                {/* INFO SINGKAT */}
                <div className="p-3 text-center flex flex-col flex-1 cursor-pointer hover:bg-slate-50" onClick={() => navigateToDetail(s.id)}>
                  <h3 className="font-bold text-slate-800 text-xs sm:text-sm line-clamp-2 leading-snug">{s.nama_lengkap}</h3>
                  <div className="mt-auto pt-2">
                    <span className="inline-block px-2 py-0.5 text-[10px] font-bold text-slate-600 bg-slate-100 rounded-md border border-slate-200">
                      {s.kelas ? `${s.kelas.tingkat}-${s.kelas.nomor_kelas}` : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* TAMPILAN TABEL KLASIK */
        <>
          {/* MOBILE VIEW */}
          <div className="block lg:hidden space-y-4 animate-in fade-in">
            {paginatedData.length === 0 ? (
              <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center shadow-sm">
                <Users className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <p className="font-medium text-slate-500">Tidak ada data siswa ditemukan.</p>
              </div>
            ) : (
              paginatedData.map(s => {
                const isWaliKelas = s.kelas?.wali_kelas_id === currentUser?.id
                const canEditThis = canFullEdit || isWaliKelas

                return (
                  <div key={s.id} onClick={() => navigateToDetail(s.id)} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4 relative overflow-hidden cursor-pointer active:scale-[0.98] transition-transform">
                    <div className="flex gap-3 items-start">
                      <div className={`h-14 w-14 shrink-0 rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center text-xl font-black shadow-sm border border-slate-200`}>
                        {s.foto_url ? <img src={s.foto_url} className="w-full h-full object-cover"/> : <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${getAvatarColor(s.nama_lengkap)} text-white`}>{s.nama_lengkap.charAt(0).toUpperCase()}</div>}
                      </div>
                      <div className="flex-1 pr-4">
                        <h3 className="font-bold text-slate-800 text-base leading-tight">{s.nama_lengkap}</h3>
                        <p className="text-xs text-slate-500 mt-1 font-mono">NISN: {s.nisn}</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded border ${getStatusBadge(s.status)}`}>{s.status}</span>
                          <span className="px-2 py-0.5 text-[10px] font-bold text-slate-600 bg-slate-100 rounded border border-slate-200">{s.kelas ? `${s.kelas.tingkat}-${s.kelas.nomor_kelas} ${s.kelas.kelompok!=='UMUM'?s.kelas.kelompok:''}` : 'Tanpa Kelas'}</span>
                        </div>
                      </div>
                    </div>
                    {canEditThis && (
                      <div className="flex justify-end gap-2 pt-1 border-t border-slate-100" onClick={e => e.stopPropagation()}>
                        <Button variant="outline" size="sm" onClick={(e) => handleEditClick(e, s.id)} disabled={isFetchingDetail === s.id} className="h-9 rounded-xl text-blue-600 border-blue-200 hover:bg-blue-50 flex-1">
                          {isFetchingDetail === s.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Pencil className="h-4 w-4 mr-2" />} Edit Biodata
                        </Button>
                        {canFullEdit && (
                          <Button variant="outline" size="sm" onClick={() => handleHapus(s.id, s.nama_lengkap)} disabled={isPending} className="h-9 rounded-xl text-rose-600 border-rose-200 hover:bg-rose-50 flex-1">
                            <Trash2 className="h-4 w-4 mr-2" /> Hapus
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>

          {/* DESKTOP VIEW */}
          <div className="hidden lg:flex bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden flex-col animate-in fade-in">
            <Table>
              <TableHeader className="bg-slate-50 border-b border-slate-200">
                <TableRow>
                  <TableHead className="font-semibold text-slate-600 h-14 px-6 w-[350px]">Identitas Siswa</TableHead>
                  <TableHead className="font-semibold text-slate-600 h-14">Kelas</TableHead>
                  <TableHead className="font-semibold text-slate-600 h-14">Domisili</TableHead>
                  <TableHead className="font-semibold text-slate-600 h-14 text-center">Status</TableHead>
                  <TableHead className="text-right font-semibold text-slate-600 h-14 px-6">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="h-48 text-center text-slate-500">Tidak ada data siswa ditemukan.</TableCell></TableRow>
                ) : (
                  paginatedData.map(s => {
                    const isWaliKelas = s.kelas?.wali_kelas_id === currentUser?.id
                    const canEditThis = canFullEdit || isWaliKelas

                    return (
                      <TableRow key={s.id} className="hover:bg-slate-50/50 transition-colors border-slate-100 group">
                        <TableCell onClick={() => navigateToDetail(s.id)} className="px-6 py-3 cursor-pointer" title="Klik untuk lihat Buku Induk">
                          <div className="flex items-center gap-4">
                            <div className={`h-12 w-12 shrink-0 rounded-xl overflow-hidden bg-slate-100 shadow-sm flex items-center justify-center text-xl font-black ring-1 ring-slate-200 text-white`}>
                               {s.foto_url ? <img src={s.foto_url} className="w-full h-full object-cover"/> : <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${getAvatarColor(s.nama_lengkap)}`}>{s.nama_lengkap.charAt(0).toUpperCase()}</div>}
                            </div>
                            <div>
                               <span className="font-bold text-slate-800 text-base group-hover:text-blue-700 transition-colors">{s.nama_lengkap}</span>
                               <div className="text-xs text-slate-500 font-mono mt-0.5">NISN: {s.nisn}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          {s.kelas ? (
                            <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200">
                              {s.kelas.tingkat}-{s.kelas.nomor_kelas} {s.kelas.kelompok !== 'UMUM' ? s.kelas.kelompok : ''}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Belum diploting</span>
                          )}
                        </TableCell>
                        <TableCell className="py-4">
                            <span className="flex items-center gap-1.5 text-sm text-slate-600"><MapPin className="h-3.5 w-3.5 opacity-50"/> {s.tempat_tinggal}</span>
                        </TableCell>
                        <TableCell className="py-4 text-center">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${getStatusBadge(s.status)}`}>{s.status}</span>
                        </TableCell>
                        <TableCell className="text-right px-6 py-4">
                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              {canEditThis && (
                                <Button variant="ghost" size="icon" onClick={(e) => handleEditClick(e, s.id)} disabled={isFetchingDetail === s.id} className="h-10 w-10 rounded-xl text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-100 shadow-sm" title="Edit Biodata">
                                  {isFetchingDetail === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
                                </Button>
                              )}
                              {canFullEdit && (
                                <Button variant="ghost" size="icon" onClick={(e) => {e.stopPropagation(); handleHapus(s.id, s.nama_lengkap)}} disabled={isPending} className="h-10 w-10 rounded-xl text-rose-500 bg-rose-50 hover:bg-rose-100 border border-rose-100 shadow-sm"><Trash2 className="h-4 w-4" /></Button>
                              )}
                            </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* PAGINATION FOOTER */}
      <div className="flex flex-col sm:flex-row items-center justify-between p-4 sm:p-5 bg-white sm:bg-white/80 backdrop-blur-md rounded-3xl border border-slate-200/60 shadow-sm gap-4 text-sm mt-4">
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-3 text-slate-500 font-medium w-full sm:w-auto">
          <span>Tampilkan</span>
          <Select value={itemsPerPage.toString()} onValueChange={(v) => setItemsPerPage(Number(v))}>
            <SelectTrigger className="h-10 w-[80px] bg-slate-50 rounded-xl border-slate-200 font-bold text-slate-700 focus:ring-blue-500"><SelectValue /></SelectTrigger>
            <SelectContent className="rounded-2xl">
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
          <span>dari <strong className="text-slate-800">{filteredData.length}</strong> siswa</span>
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <Button variant="outline" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="h-10 rounded-xl bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600 px-4">
            Prev
          </Button>
          <div className="flex items-center justify-center min-w-[3rem] font-bold text-slate-700 bg-slate-50 h-10 px-3 rounded-xl border border-slate-200">
            {currentPage} <span className="text-slate-400 font-medium mx-1">/</span> {totalPages || 1}
          </div>
          <Button variant="outline" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages || totalPages === 0} className="h-10 rounded-xl bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600 px-4">
            Next
          </Button>
        </div>
      </div>

    </div>
  )
}