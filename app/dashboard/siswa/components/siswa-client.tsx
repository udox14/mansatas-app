// Lokasi: app/dashboard/siswa/components/siswa-client.tsx
'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Users, Trash2, MapPin, Loader2, Pencil, LayoutGrid, List, Camera, ChevronRight } from 'lucide-react'
import { TambahModal } from './tambah-modal'
import { ImportModalSiswa } from './import-modal'
import { hapusSiswa, uploadFotoSiswaAction, getDetailSiswaLengkap } from '../actions'
import { EditSiswaModal } from './edit-modal'

const compressImage = async (file: File): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target?.result as string
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX_SIZE = 800
        let width = img.width, height = img.height
        if (width > height && width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE }
        else if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE }
        canvas.width = width; canvas.height = height
        canvas.getContext('2d')?.drawImage(img, 0, 0, width, height)
        canvas.toBlob(blob => {
          if (blob) resolve(new File([blob], file.name.replace(/\.[^/.]+$/, '') + '.jpg', { type: 'image/jpeg' }))
          else resolve(file)
        }, 'image/jpeg', 0.8)
      }
      img.onerror = reject
    }
    reader.onerror = reject
  })
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

export function SiswaClient({ initialData, kelasList, currentUser }: { initialData: any[], kelasList: any[], currentUser: any }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterKelas, setFilterKelas] = useState('Semua')
  const [filterStatus, setFilterStatus] = useState('aktif')
  const [viewMode, setViewMode] = useState<'table' | 'gallery'>('table')
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)
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

  const dynamicItemsPerPage = viewMode === 'gallery' ? 24 : itemsPerPage
  const totalPages = Math.ceil(filteredData.length / dynamicItemsPerPage)
  const paginatedData = filteredData.slice((currentPage - 1) * dynamicItemsPerPage, currentPage * dynamicItemsPerPage)

  const handleHapus = async (id: string, nama: string) => {
    if (!confirm(`Yakin ingin menghapus permanen data siswa ${nama}?`)) return
    setIsPending(true)
    const res = await hapusSiswa(id)
    if (res?.error) alert(res.error)
    setIsPending(false)
  }

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
    } catch { alert('Gagal memproses gambar.') }
    finally { setUploadingId(null); e.target.value = '' }
  }

  const navigateToDetail = (id: string) => { window.location.href = `/dashboard/siswa/${id}` }

  const handleEditClick = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setIsFetchingDetail(id)
    const res = await getDetailSiswaLengkap(id)
    setIsFetchingDetail(null)
    if (res.data) setEditingSiswa(res.data)
    else alert(res.error || 'Gagal memuat detail siswa.')
  }

  return (
    <div className="space-y-3">
      <EditSiswaModal isOpen={!!editingSiswa} onClose={() => setEditingSiswa(null)} siswa={editingSiswa} kelasList={kelasList} />

      {/* ── TOOLBAR ── */}
      <div className="bg-surface border border-surface rounded-lg p-3 space-y-2">

        {/* Baris 1: Search + view toggle + aksi */}
        <div className="flex items-center gap-2">
          {/* Search — flex-1, makan sisa ruang */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Cari nama / NISN..."
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1) }}
              className="pl-8 h-9 text-sm rounded-lg"
            />
          </div>

          {/* View toggle pill */}
          <div className="flex bg-surface-2 border border-surface p-0.5 rounded-lg shrink-0">
            <button
              onClick={() => setViewMode('table')}
              className={`h-8 px-2.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
                viewMode === 'table'
                  ? 'bg-surface text-slate-800 dark:text-slate-100 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <List className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Tabel</span>
            </button>
            <button
              onClick={() => setViewMode('gallery')}
              className={`h-8 px-2.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
                viewMode === 'gallery'
                  ? 'bg-surface text-slate-800 dark:text-slate-100 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Foto</span>
            </button>
          </div>

          {/* Action buttons */}
          {canFullEdit && (
            <div className="flex items-center gap-1.5 shrink-0">
              <ImportModalSiswa />
              <TambahModal />
            </div>
          )}
        </div>

        {/* Baris 2: Filter kelas + status */}
        <div className="flex items-center gap-2">
          <Select value={filterKelas} onValueChange={v => { setFilterKelas(v); setCurrentPage(1) }}>
            <SelectTrigger className="h-8 flex-1 text-xs rounded-lg">
              <SelectValue placeholder="Semua Kelas" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="Semua">Semua Kelas</SelectItem>
              <SelectItem value="null">Tanpa Kelas</SelectItem>
              {kelasList.map(k => (
                <SelectItem key={k.id} value={k.id}>
                  {k.tingkat}-{k.nomor_kelas} {k.kelompok !== 'UMUM' ? k.kelompok : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); setCurrentPage(1) }}>
            <SelectTrigger className="h-8 w-28 text-xs rounded-lg shrink-0">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Semua">Semua</SelectItem>
              <SelectItem value="aktif">Aktif</SelectItem>
              <SelectItem value="lulus">Lulus</SelectItem>
              <SelectItem value="keluar">Keluar</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* GALLERY MODE */}
      {viewMode === 'gallery' ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
          {paginatedData.length === 0 ? (
            <div className="col-span-full py-12 text-center text-sm text-slate-400 bg-surface rounded-lg border border-surface">
              Tidak ada siswa ditemukan.
            </div>
          ) : paginatedData.map(s => (
            <div key={s.id} className="bg-surface rounded-lg border border-surface overflow-hidden group flex flex-col">
              <div className="relative aspect-[3/4] bg-surface-3">
                {uploadingId === s.id ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/70 z-10">
                    <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                  </div>
                ) : s.foto_url ? (
                  <img src={s.foto_url} alt={s.nama_lengkap} className="w-full h-full object-cover" />
                ) : (
                  <div className={`w-full h-full bg-gradient-to-br ${getAvatarColor(s.nama_lengkap)} flex items-center justify-center text-3xl font-black text-white/60`}>
                    {s.nama_lengkap.charAt(0).toUpperCase()}
                  </div>
                )}
                <label className="absolute bottom-1 right-1 bg-white/90 text-slate-700 p-1 rounded shadow cursor-pointer z-10 hover:bg-surface transition-colors">
                  <Camera className="w-3 h-3" />
                  <input type="file" className="hidden" accept="image/*" capture="environment" onChange={e => handleUploadFoto(s.id, e)} />
                </label>
              </div>
              <div className="p-1.5 text-center cursor-pointer hover:bg-surface-2 flex-1" onClick={() => navigateToDetail(s.id)}>
                <p className="text-[10px] font-semibold text-slate-800 leading-tight line-clamp-2">{s.nama_lengkap}</p>
                <p className="text-[9px] text-slate-400 mt-0.5">{s.kelas ? `${s.kelas.tingkat}-${s.kelas.nomor_kelas}` : '-'}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* MOBILE CARDS */}
          <div className="block md:hidden space-y-2">
            {paginatedData.length === 0 ? (
              <div className="bg-surface py-10 rounded-lg border border-surface text-center">
                <Users className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-400">Tidak ada data siswa.</p>
              </div>
            ) : paginatedData.map(s => {
              const isWaliKelas = s.kelas?.wali_kelas_id === currentUser?.id
              const canEditThis = canFullEdit || isWaliKelas
              return (
                <div
                  key={s.id}
                  onClick={() => navigateToDetail(s.id)}
                  className="bg-surface border border-surface rounded-xl p-3 flex items-center gap-3 cursor-pointer active:bg-surface-2 transition-colors"
                >
                  {/* Avatar */}
                  <div className="h-11 w-11 shrink-0 rounded-xl overflow-hidden bg-surface-3">
                    {s.foto_url
                      ? <img src={s.foto_url} className="w-full h-full object-cover" alt="" />
                      : <div className={`w-full h-full bg-gradient-to-br ${getAvatarColor(s.nama_lengkap)} flex items-center justify-center text-lg font-bold text-white`}>
                          {s.nama_lengkap.charAt(0).toUpperCase()}
                        </div>
                    }
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate leading-tight">{s.nama_lengkap}</p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className="text-[10px] text-slate-400 font-mono">{s.nisn}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border uppercase ${getStatusBadge(s.status)}`}>{s.status}</span>
                      {s.kelas && (
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                          {s.kelas.tingkat}-{s.kelas.nomor_kelas}
                          {s.kelas.kelompok !== 'UMUM' ? ` ${s.kelas.kelompok}` : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                    {canEditThis && (
                      <button
                        onClick={e => handleEditClick(e, s.id)}
                        disabled={isFetchingDetail === s.id}
                        className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                      >
                        {isFetchingDetail === s.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Pencil className="h-3.5 w-3.5" />
                        }
                      </button>
                    )}
                    {canFullEdit && (
                      <button
                        onClick={() => handleHapus(s.id, s.nama_lengkap)}
                        disabled={isPending}
                        className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <ChevronRight className="h-4 w-4 text-slate-300 ml-0.5" />
                  </div>
                </div>
              )
            })}
          </div>

          {/* DESKTOP TABLE */}
          <div className="hidden md:block bg-surface rounded-lg border border-surface overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-surface-2 hover:bg-surface-2">
                  <TableHead className="h-9 px-4 text-xs font-semibold text-slate-500 w-72">Siswa</TableHead>
                  <TableHead className="h-9 text-xs font-semibold text-slate-500">Kelas</TableHead>
                  <TableHead className="h-9 text-xs font-semibold text-slate-500 hidden lg:table-cell">Domisili</TableHead>
                  <TableHead className="h-9 text-xs font-semibold text-slate-500 text-center">Status</TableHead>
                  <TableHead className="h-9 text-xs font-semibold text-slate-500 text-right px-4">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-sm text-slate-400">
                      Tidak ada data siswa ditemukan.
                    </TableCell>
                  </TableRow>
                ) : paginatedData.map(s => {
                  const isWaliKelas = s.kelas?.wali_kelas_id === currentUser?.id
                  const canEditThis = canFullEdit || isWaliKelas
                  return (
                    <TableRow key={s.id} className="hover:bg-surface-2/60 border-surface-2 group cursor-pointer" onClick={() => navigateToDetail(s.id)}>
                      <TableCell className="px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 shrink-0 rounded-md overflow-hidden bg-surface-3">
                            {s.foto_url
                              ? <img src={s.foto_url} className="w-full h-full object-cover" alt="" />
                              : <div className={`w-full h-full bg-gradient-to-br ${getAvatarColor(s.nama_lengkap)} flex items-center justify-center text-xs font-bold text-white`}>
                                  {s.nama_lengkap.charAt(0).toUpperCase()}
                                </div>
                            }
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 group-hover:text-blue-700 transition-colors leading-tight">{s.nama_lengkap}</p>
                            <p className="text-[11px] text-slate-400 font-mono">{s.nisn}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5">
                        {s.kelas ? (
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-400 bg-surface-3 px-2 py-0.5 rounded border border-surface">
                            {s.kelas.tingkat}-{s.kelas.nomor_kelas} {s.kelas.kelompok !== 'UMUM' ? s.kelas.kelompok : ''}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Belum diploting</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2.5 hidden lg:table-cell">
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <MapPin className="h-3 w-3 opacity-50 shrink-0" /> {s.tempat_tinggal}
                        </span>
                      </TableCell>
                      <TableCell className="py-2.5 text-center">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${getStatusBadge(s.status)}`}>
                          {s.status}
                        </span>
                      </TableCell>
                      <TableCell className="py-2.5 px-4 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {canEditThis && (
                            <button
                              onClick={e => handleEditClick(e, s.id)}
                              disabled={isFetchingDetail === s.id}
                              className="p-1.5 rounded text-blue-600 hover:bg-blue-50 transition-colors"
                              title="Edit Biodata"
                            >
                              {isFetchingDetail === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pencil className="h-3.5 w-3.5" />}
                            </button>
                          )}
                          {canFullEdit && (
                            <button
                              onClick={() => handleHapus(s.id, s.nama_lengkap)}
                              disabled={isPending}
                              className="p-1.5 rounded text-rose-500 hover:bg-rose-50 transition-colors"
                              title="Hapus"
                            >
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
        </>
      )}

      {/* PAGINATION */}
      <div className="flex items-center justify-between bg-surface border border-surface rounded-lg px-3 py-2">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="hidden sm:inline">Tampilkan</span>
          {viewMode === 'table' && (
            <Select value={itemsPerPage.toString()} onValueChange={v => { setItemsPerPage(Number(v)); setCurrentPage(1) }}>
              <SelectTrigger className="h-7 w-16 text-xs rounded border-surface"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[10, 20, 50, 100].map(n => <SelectItem key={n} value={n.toString()}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <span><strong className="text-slate-700 dark:text-slate-300">{filteredData.length}</strong> siswa</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="h-7 px-2.5 text-xs rounded">
            ←
          </Button>
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400 px-2">{currentPage} / {totalPages || 1}</span>
          <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="h-7 px-2.5 text-xs rounded">
            →
          </Button>
        </div>
      </div>
    </div>
  )
}