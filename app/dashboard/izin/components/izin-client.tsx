// TIMPA SELURUH ISI FILE INI
// Lokasi: app/dashboard/izin/components/izin-client.tsx
'use client'

import { useState, useEffect } from 'react'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Search, Loader2, DoorOpen, UserX, AlertCircle, CheckCircle2, Trash2, LogIn, Clock } from 'lucide-react'
import { tambahIzinKeluar, tandaiSudahKembali, tambahIzinKelas, hapusIzinKeluar, hapusIzinKelas } from '../actions'

const initialFormState = { error: null as string | null, success: null as string | null }

// Komponen Tombol Submit (Reusable)
function SubmitBtn({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-base shadow-md mt-4">
      {pending ? <Loader2 className="h-5 w-5 animate-spin"/> : label}
    </Button>
  )
}

export function IzinClient({ 
  siswaList, 
  izinKeluarList, 
  izinKelasList,
  currentUserRole
}: { 
  siswaList: any[], 
  izinKeluarList: any[], 
  izinKelasList: any[],
  currentUserRole: string
}) {
  const isSuperAdmin = currentUserRole === 'super_admin'

  // State Tabs 1: Keluar Komplek
  const [searchKeluar, setSearchKeluar] = useState('')
  const [filterStatus, setFilterStatus] = useState('SEMUA')
  const [isModalKeluarOpen, setIsModalKeluarOpen] = useState(false)
  const [stateKeluar, actionKeluar] = useActionState(tambahIzinKeluar, initialFormState)

  // State Tabs 2: Tidak Masuk Kelas
  const [searchKelas, setSearchKelas] = useState('')
  const [filterAlasan, setFilterAlasan] = useState('SEMUA')
  const [isModalKelasOpen, setIsModalKelasOpen] = useState(false)
  const [stateKelas, actionKelas] = useActionState(tambahIzinKelas, initialFormState)

  // State Jam Pelajaran Pintar
  const [selectedJam, setSelectedJam] = useState<number[]>([])

  // Autocomplete Siswa (Dipakai di kedua modal)
  const [searchSiswa, setSearchSiswa] = useState('')
  const [selectedSiswaId, setSelectedSiswaId] = useState('')
  const [showSiswaDropdown, setShowSiswaDropdown] = useState(false)

  const filteredSiswa = siswaList.filter(s => s.nama_lengkap.toLowerCase().includes(searchSiswa.toLowerCase())).slice(0, 20)

  // Handlers Jam Pelajaran
  const toggleJam = (jam: number) => {
    setSelectedJam(prev => prev.includes(jam) ? prev.filter(j => j !== jam) : [...prev, jam].sort((a,b) => a-b))
  }
  
  const toggleSemuaJam = () => {
    if (selectedJam.length === 10) setSelectedJam([])
    else setSelectedJam([1,2,3,4,5,6,7,8,9,10])
  }

  // Auto-close modals on success
  useEffect(() => {
    if (stateKeluar?.success) {
      const timer = setTimeout(() => setIsModalKeluarOpen(false), 1500)
      return () => clearTimeout(timer)
    }
  }, [stateKeluar?.success])

  useEffect(() => {
    if (stateKelas?.success) {
      const timer = setTimeout(() => setIsModalKelasOpen(false), 1500)
      return () => clearTimeout(timer)
    }
  }, [stateKelas?.success])

  // Handlers untuk aksi tabel
  const handleKembali = async (id: string) => {
    const res = await tandaiSudahKembali(id)
    if (res.error) alert(res.error)
  }

  const handleDeleteKeluar = async (id: string) => {
    if (!confirm('Hapus permanen riwayat ini?')) return
    const res = await hapusIzinKeluar(id)
    if (res.error) alert(res.error)
  }

  const handleDeleteKelas = async (id: string) => {
    if (!confirm('Hapus permanen riwayat ini?')) return
    const res = await hapusIzinKelas(id)
    if (res.error) alert(res.error)
  }

  // Filter logic
  const displayKeluar = izinKeluarList.filter(k => {
    const matchName = k.siswa?.nama_lengkap?.toLowerCase().includes(searchKeluar.toLowerCase())
    const matchStatus = filterStatus === 'SEMUA' || k.status === filterStatus
    return matchName && matchStatus
  })

  const displayKelas = izinKelasList.filter(k => {
    const matchName = k.siswa?.nama_lengkap?.toLowerCase().includes(searchKelas.toLowerCase())
    const matchAlasan = filterAlasan === 'SEMUA' || k.alasan === filterAlasan
    return matchName && matchAlasan
  })

  // Format Waktu Helper
  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="space-y-6">
      
      {/* ==================================================================== */}
      {/* MODAL 1: FORM KELUAR KOMPLEK */}
      {/* ==================================================================== */}
      <Dialog open={isModalKeluarOpen} onOpenChange={(open: boolean) => { setIsModalKeluarOpen(open); setSelectedSiswaId(''); setSearchSiswa('') }}>
        <DialogContent className="sm:max-w-md rounded-3xl bg-white/95 backdrop-blur-xl border border-slate-200/60 shadow-2xl">
          <DialogHeader className="border-b pb-4"><DialogTitle className="text-xl font-bold flex items-center gap-2"><DoorOpen className="h-5 w-5 text-blue-600"/> Catat Izin Keluar Komplek</DialogTitle></DialogHeader>
          <form action={actionKeluar} className="space-y-4 pt-2">
            {stateKeluar?.error && <div className="p-3 text-sm text-rose-600 bg-rose-50 rounded-xl border flex gap-2"><AlertCircle className="h-4 w-4"/> {stateKeluar.error}</div>}
            {stateKeluar?.success && <div className="p-3 text-sm text-emerald-700 bg-emerald-50 rounded-xl border flex gap-2"><CheckCircle2 className="h-4 w-4"/> {stateKeluar.success}</div>}

            <input type="hidden" name="siswa_id" value={selectedSiswaId} />

            <div className="space-y-2 relative">
              <Label className="font-bold text-slate-600 text-xs uppercase tracking-wider">Cari Siswa <span className="text-rose-500">*</span></Label>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input 
                  placeholder="Ketik nama siswa..." 
                  value={searchSiswa}
                  onChange={(e) => { setSearchSiswa(e.target.value); setShowSiswaDropdown(true); setSelectedSiswaId('') }}
                  onFocus={() => setShowSiswaDropdown(true)}
                  onBlur={() => setTimeout(() => setShowSiswaDropdown(false), 200)}
                  className={`pl-11 h-12 rounded-xl bg-slate-50 focus:bg-white ${selectedSiswaId ? 'border-emerald-500 ring-1 ring-emerald-500 bg-emerald-50/30' : ''}`}
                />
              </div>
              {showSiswaDropdown && searchSiswa.length > 1 && (
                <div className="absolute z-50 w-full mt-1 bg-white border rounded-xl shadow-xl max-h-60 overflow-y-auto custom-scrollbar">
                  {filteredSiswa.map(s => (
                    <div 
                      key={s.id} onMouseDown={(e) => e.preventDefault()} 
                      onClick={() => { setSelectedSiswaId(s.id); setSearchSiswa(s.nama_lengkap); setShowSiswaDropdown(false) }} 
                      className="p-3 hover:bg-slate-50 cursor-pointer border-b flex justify-between items-center"
                    >
                      <span className="font-bold text-sm">{s.nama_lengkap}</span>
                      <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded">{s.kelas?.tingkat}-{s.kelas?.nomor_kelas}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="font-bold text-slate-600 text-xs uppercase tracking-wider">Keterangan / Tujuan (Opsional)</Label>
              <Input name="keterangan" placeholder="Contoh: Beli alat tulis, Fotokopi..." className="h-12 rounded-xl bg-slate-50" />
            </div>

            <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 text-xs text-blue-700 flex gap-2">
              <Clock className="h-4 w-4 shrink-0"/> 
              Sistem akan otomatis mencatat waktu keluar saat tombol ini ditekan. Status siswa akan menjadi "BELUM KEMBALI".
            </div>

            <SubmitBtn label="Simpan Data & Izinkan Keluar" />
          </form>
        </DialogContent>
      </Dialog>

      {/* ==================================================================== */}
      {/* MODAL 2: FORM TIDAK MASUK KELAS */}
      {/* ==================================================================== */}
      <Dialog open={isModalKelasOpen} onOpenChange={(open: boolean) => { setIsModalKelasOpen(open); if(!open) { setSelectedSiswaId(''); setSearchSiswa(''); setSelectedJam([]); } }}>
        <DialogContent className="sm:max-w-md rounded-3xl bg-white/95 backdrop-blur-xl border border-slate-200/60 shadow-2xl">
          <DialogHeader className="border-b pb-4"><DialogTitle className="text-xl font-bold flex items-center gap-2"><UserX className="h-5 w-5 text-indigo-600"/> Izin Tidak Masuk Kelas</DialogTitle></DialogHeader>
          <form action={actionKelas} className="space-y-4 pt-2">
            {stateKelas?.error && <div className="p-3 text-sm text-rose-600 bg-rose-50 rounded-xl border flex gap-2"><AlertCircle className="h-4 w-4"/> {stateKelas.error}</div>}
            {stateKelas?.success && <div className="p-3 text-sm text-emerald-700 bg-emerald-50 rounded-xl border flex gap-2"><CheckCircle2 className="h-4 w-4"/> {stateKelas.success}</div>}

            <input type="hidden" name="siswa_id" value={selectedSiswaId} />
            {/* Hidden Input array jam pelajaran */}
            {selectedJam.map(jam => <input key={`hdn-${jam}`} type="hidden" name="jam_pelajaran" value={jam} />)}

            <div className="space-y-2 relative">
              <Label className="font-bold text-slate-600 text-xs uppercase tracking-wider">Cari Siswa <span className="text-rose-500">*</span></Label>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input 
                  placeholder="Ketik nama siswa..." 
                  value={searchSiswa}
                  onChange={(e) => { setSearchSiswa(e.target.value); setShowSiswaDropdown(true); setSelectedSiswaId('') }}
                  onFocus={() => setShowSiswaDropdown(true)}
                  onBlur={() => setTimeout(() => setShowSiswaDropdown(false), 200)}
                  className={`pl-11 h-12 rounded-xl bg-slate-50 focus:bg-white ${selectedSiswaId ? 'border-emerald-500 ring-1 ring-emerald-500 bg-emerald-50/30' : ''}`}
                />
              </div>
              {showSiswaDropdown && searchSiswa.length > 1 && (
                <div className="absolute z-50 w-full mt-1 bg-white border rounded-xl shadow-xl max-h-60 overflow-y-auto custom-scrollbar">
                  {filteredSiswa.map(s => (
                    <div 
                      key={`k-${s.id}`} onMouseDown={(e) => e.preventDefault()} 
                      onClick={() => { setSelectedSiswaId(s.id); setSearchSiswa(s.nama_lengkap); setShowSiswaDropdown(false) }} 
                      className="p-3 hover:bg-slate-50 cursor-pointer border-b flex justify-between items-center"
                    >
                      <span className="font-bold text-sm">{s.nama_lengkap}</span>
                      <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded">{s.kelas?.tingkat}-{s.kelas?.nomor_kelas}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="font-bold text-slate-600 text-xs uppercase tracking-wider">Pilih Jam Pelajaran <span className="text-rose-500">*</span></Label>
                <button type="button" onClick={toggleSemuaJam} className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-md transition-colors border border-indigo-100">
                  {selectedJam.length === 10 ? 'Batalkan Semua' : 'Pilih Semua'}
                </button>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {[1,2,3,4,5,6,7,8,9,10].map(jam => (
                  <button
                    key={`btn-jam-${jam}`}
                    type="button"
                    onClick={() => toggleJam(jam)}
                    className={`h-11 rounded-xl border text-sm font-black transition-all shadow-sm active:scale-95 ${selectedJam.includes(jam) ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}
                  >
                    {jam}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-bold text-slate-600 text-xs uppercase tracking-wider">Alasan Izin <span className="text-rose-500">*</span></Label>
              <Select name="alasan" required>
                <SelectTrigger className="h-12 rounded-xl bg-slate-50"><SelectValue placeholder="Pilih Alasan..." /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="KELUAR KOMPLEK BERSAMA ORANG TUA">KELUAR BERSAMA ORTU</SelectItem>
                  <SelectItem value="SAKIT DI UKS">SAKIT DI UKS</SelectItem>
                  <SelectItem value="SAKIT (PULANG)">SAKIT (PULANG)</SelectItem>
                  <SelectItem value="BIMBINGAN LOMBA">BIMBINGAN LOMBA</SelectItem>
                  <SelectItem value="KEGIATAN DI DALAM">KEGIATAN DI DALAM</SelectItem>
                  <SelectItem value="KEGIATAN DI LUAR">KEGIATAN DI LUAR</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="font-bold text-slate-600 text-xs uppercase tracking-wider">Keterangan Tambahan (Opsional)</Label>
              <Input name="keterangan" placeholder="Contoh: Lomba OSN Tingkat Kota..." className="h-12 rounded-xl bg-slate-50" />
            </div>

            <SubmitBtn label="Simpan Izin Kelas" />
          </form>
        </DialogContent>
      </Dialog>


      {/* ==================================================================== */}
      {/* TAMPILAN TABS UTAMA */}
      {/* ==================================================================== */}
      <Tabs defaultValue="keluar" className="space-y-6">
        <TabsList className="bg-white border p-1 h-auto grid grid-cols-2 rounded-2xl shadow-sm">
          <TabsTrigger value="keluar" className="py-3 rounded-xl data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 font-bold text-sm sm:text-base">
            Izin Keluar Komplek
          </TabsTrigger>
          <TabsTrigger value="kelas" className="py-3 rounded-xl data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 font-bold text-sm sm:text-base">
            Izin Tidak Masuk Kelas
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: KELUAR KOMPLEK */}
        <TabsContent value="keluar" className="m-0 space-y-4">
          <div className="flex flex-col md:flex-row justify-between gap-4 bg-white/80 backdrop-blur-xl p-4 sm:p-5 rounded-3xl shadow-sm border border-slate-200/60">
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input placeholder="Cari nama siswa..." value={searchKeluar} onChange={e => setSearchKeluar(e.target.value)} className="pl-11 h-12 rounded-xl bg-white shadow-sm" />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-12 w-full sm:w-48 rounded-xl bg-white shadow-sm font-semibold">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="SEMUA">Semua Status</SelectItem>
                  <SelectItem value="BELUM KEMBALI">Belum Kembali (Di Luar)</SelectItem>
                  <SelectItem value="SUDAH KEMBALI">Sudah Kembali</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => setIsModalKeluarOpen(true)} className="h-12 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md font-bold w-full md:w-auto">
              <DoorOpen className="h-5 w-5 mr-2" /> Catat Siswa Keluar
            </Button>
          </div>

          {/* TAMPILAN MOBILE COMPACT */}
          <div className="block lg:hidden space-y-2.5">
            {displayKeluar.length === 0 ? (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 text-center shadow-sm">
                <p className="font-medium text-sm text-slate-500">Tidak ada data izin keluar ditemukan.</p>
              </div>
            ) : (
              displayKeluar.map(k => (
                <div key={k.id} className={`p-3.5 rounded-2xl border shadow-sm relative group overflow-hidden ${k.status === 'BELUM KEMBALI' ? 'bg-amber-50/30 border-amber-100' : 'bg-white border-slate-200'}`}>
                  <div className="flex justify-between items-start mb-1.5 pr-6">
                    <h3 className="font-bold text-slate-800 text-sm leading-tight">{k.siswa?.nama_lengkap}</h3>
                    <div className="flex flex-col items-end shrink-0 ml-2 gap-1">
                       <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${k.status === 'BELUM KEMBALI' ? 'bg-amber-100 text-amber-700 animate-pulse' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>{k.status}</span>
                       <span className="text-[10px] font-mono font-bold text-slate-600 bg-white px-1.5 py-0.5 rounded border border-slate-100 shadow-sm">{formatTime(k.waktu_keluar)}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 mb-2 text-xs">
                    <span className="text-[10px] font-bold text-slate-600 bg-white border border-slate-200 px-1.5 py-0.5 rounded shrink-0 shadow-sm">
                      {k.siswa?.kelas?.tingkat}-{k.siswa?.kelas?.nomor_kelas}
                    </span>
                    <span className="text-slate-500 truncate" title={k.keterangan}>{k.keterangan || 'Tanpa keterangan'}</span>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100/80">
                    <span className="text-[9px] font-medium text-slate-400">Oleh: {k.pelapor?.nama_lengkap?.split(' ')[0]}</span>
                    
                    {/* TOMBOL KEMBALI DIPISAH DARI STATUS */}
                    <div className="flex gap-2">
                        {k.status === 'BELUM KEMBALI' ? (
                          <Button size="sm" onClick={() => handleKembali(k.id)} className="h-8 px-4 text-xs bg-emerald-600 hover:bg-emerald-700 font-bold rounded-lg shadow-sm">
                            <LogIn className="h-3.5 w-3.5 mr-1.5"/> Tandai Kembali
                          </Button>
                        ) : (
                          <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100"><CheckCircle2 className="h-3 w-3"/> Tiba {formatTime(k.waktu_kembali)}</span>
                        )}
                    </div>
                  </div>

                  {isSuperAdmin && (
                    <button onClick={() => handleDeleteKeluar(k.id)} className="absolute top-2 right-2 text-slate-300 hover:text-rose-500 p-1.5 transition-colors">
                      <Trash2 className="h-3.5 w-3.5"/>
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* TAMPILAN DESKTOP (TABLE) */}
          <div className="hidden lg:flex bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden flex-col">
             <div className="overflow-x-auto custom-scrollbar min-h-[300px]">
                <Table className="min-w-[800px]">
                  <TableHeader className="bg-slate-50 border-b border-slate-200">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="font-bold text-slate-600 h-14 px-6">Identitas Siswa</TableHead>
                      <TableHead className="font-bold text-slate-600 h-14 text-center">Waktu Keluar</TableHead>
                      
                      {/* HEADER DIUBAH MENJADI MURNI STATUS */}
                      <TableHead className="font-bold text-slate-600 h-14 text-center">Status</TableHead>
                      <TableHead className="font-bold text-slate-600 h-14">Keterangan</TableHead>
                      
                      {/* HEADER AKSI */}
                      <TableHead className="text-right font-bold text-slate-600 h-14 px-6">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayKeluar.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="h-32 text-center text-slate-500">Tidak ada data izin keluar ditemukan.</TableCell></TableRow>
                    ) : (
                      displayKeluar.map(k => (
                        <TableRow key={k.id} className="hover:bg-slate-50/50 transition-colors border-slate-100 group">
                          <TableCell className="px-6 py-4">
                            <div className="font-bold text-slate-800 text-base">{k.siswa?.nama_lengkap}</div>
                            <div className="text-xs font-semibold text-slate-500 mt-1">Kelas: <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{k.siswa?.kelas?.tingkat}-{k.siswa?.kelas?.nomor_kelas}</span></div>
                          </TableCell>
                          <TableCell className="text-center py-4">
                            <div className="font-mono font-bold text-lg text-slate-700">{formatTime(k.waktu_keluar)}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">{new Date(k.waktu_keluar).toLocaleDateString('id-ID')}</div>
                          </TableCell>
                          
                          {/* KOLOM STATUS YANG SUDAH BERSIH */}
                          <TableCell className="text-center py-4">
                            {k.status === 'BELUM KEMBALI' ? (
                              <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm border border-amber-200 animate-pulse">Belum Kembali</span>
                            ) : (
                              <div className="flex flex-col items-center gap-1">
                                <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border border-slate-200">Sudah Kembali</span>
                                <span className="font-mono text-sm text-emerald-600 font-bold">{formatTime(k.waktu_kembali)}</span>
                              </div>
                            )}
                          </TableCell>
                          
                          <TableCell className="py-4">
                            <p className="text-sm font-medium text-slate-700 max-w-[200px] truncate" title={k.keterangan}>{k.keterangan || '-'}</p>
                            <p className="text-[10px] font-semibold text-slate-400 mt-1">Oleh: {k.pelapor?.nama_lengkap}</p>
                          </TableCell>
                          
                          {/* KOLOM AKSI: TOMBOL KEMBALI DAN HAPUS DITEMPATKAN DI SINI */}
                          <TableCell className="text-right px-6 py-4">
                            <div className="flex items-center justify-end gap-2">
                              {k.status === 'BELUM KEMBALI' && (
                                <Button size="sm" onClick={() => handleKembali(k.id)} className="h-9 px-4 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md transition-all">
                                  <LogIn className="h-4 w-4 mr-1.5"/> Tandai Kembali
                                </Button>
                              )}
                              {isSuperAdmin && (
                                <Button variant="ghost" size="icon" onClick={() => handleDeleteKeluar(k.id)} className="h-9 w-9 rounded-xl text-rose-500 hover:bg-rose-50 border border-transparent hover:border-rose-100 opacity-20 group-hover:opacity-100 transition-all"><Trash2 className="h-4 w-4"/></Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
             </div>
          </div>
        </TabsContent>

        {/* TAB 2: TIDAK MASUK KELAS */}
        <TabsContent value="kelas" className="m-0 space-y-4">
           <div className="flex flex-col md:flex-row justify-between gap-4 bg-white/80 backdrop-blur-xl p-4 sm:p-5 rounded-3xl shadow-sm border border-slate-200/60">
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input placeholder="Cari nama siswa..." value={searchKelas} onChange={e => setSearchKelas(e.target.value)} className="pl-11 h-12 rounded-xl bg-white shadow-sm" />
              </div>
              <Select value={filterAlasan} onValueChange={setFilterAlasan}>
                <SelectTrigger className="h-12 w-full sm:w-[250px] rounded-xl bg-white shadow-sm font-semibold text-xs sm:text-sm">
                  <SelectValue placeholder="Alasan" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="SEMUA">Semua Alasan</SelectItem>
                  <SelectItem value="KELUAR KOMPLEK BERSAMA ORANG TUA">Bersama Orang Tua</SelectItem>
                  <SelectItem value="SAKIT DI UKS">Sakit di UKS</SelectItem>
                  <SelectItem value="SAKIT (PULANG)">Sakit (Pulang)</SelectItem>
                  <SelectItem value="BIMBINGAN LOMBA">Bimbingan Lomba</SelectItem>
                  <SelectItem value="KEGIATAN DI DALAM">Kegiatan Dalam</SelectItem>
                  <SelectItem value="KEGIATAN DI LUAR">Kegiatan Luar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => setIsModalKelasOpen(true)} className="h-12 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md font-bold w-full md:w-auto">
              <UserX className="h-5 w-5 mr-2" /> Catat Izin Kelas
            </Button>
          </div>

          {/* TAMPILAN MOBILE COMPACT */}
          <div className="block lg:hidden space-y-2.5">
            {displayKelas.length === 0 ? (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 text-center shadow-sm">
                <p className="font-medium text-sm text-slate-500">Tidak ada data izin kelas hari ini.</p>
              </div>
            ) : (
              displayKelas.map(k => (
                <div key={k.id} className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm relative group overflow-hidden">
                  <div className="flex justify-between items-start mb-1 pr-6">
                    <h3 className="font-bold text-slate-800 text-sm leading-tight truncate">{k.siswa?.nama_lengkap}</h3>
                    <span className="text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded shrink-0 ml-2">
                      {k.siswa?.kelas?.tingkat}-{k.siswa?.kelas?.nomor_kelas}
                    </span>
                  </div>
                  
                  <div className="flex items-center flex-wrap gap-1 mb-1.5">
                    <span className="text-[9px] font-black uppercase text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded tracking-wider shadow-sm max-w-full truncate">
                      {k.alasan}
                    </span>
                    {k.jam_pelajaran.map((jam: number) => (
                      <span key={jam} className="text-[9px] h-4 w-4 rounded-sm bg-slate-100 text-slate-600 font-bold flex items-center justify-center border border-slate-200">
                        {jam}
                      </span>
                    ))}
                  </div>

                  {k.keterangan && <p className="text-[10px] text-slate-500 truncate">{k.keterangan}</p>}

                  <div className="mt-2 pt-2 border-t border-slate-100 text-[9px] font-medium text-slate-400">
                    Oleh: {k.pelapor?.nama_lengkap}
                  </div>

                  {isSuperAdmin && (
                    <button onClick={() => handleDeleteKelas(k.id)} className="absolute top-2 right-2 text-slate-300 hover:text-rose-500 p-1.5 transition-colors">
                      <Trash2 className="h-3.5 w-3.5"/>
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* TAMPILAN DESKTOP (TABLE) */}
          <div className="hidden lg:flex bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden flex-col">
             <div className="overflow-x-auto custom-scrollbar min-h-[300px]">
                <Table className="min-w-[900px]">
                  <TableHeader className="bg-slate-50 border-b border-slate-200">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="font-bold text-slate-600 h-14 px-6">Identitas Siswa</TableHead>
                      <TableHead className="font-bold text-slate-600 h-14 text-center w-[180px]">Jam Ke-</TableHead>
                      <TableHead className="font-bold text-slate-600 h-14">Alasan Izin</TableHead>
                      <TableHead className="font-bold text-slate-600 h-14">Keterangan Tambahan</TableHead>
                      <TableHead className="text-right font-bold text-slate-600 h-14 px-6">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayKelas.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="h-32 text-center text-slate-500">Tidak ada data izin kelas hari ini.</TableCell></TableRow>
                    ) : (
                      displayKelas.map(k => (
                        <TableRow key={k.id} className="hover:bg-slate-50/50 transition-colors border-slate-100 group">
                          <TableCell className="px-6 py-4">
                            <div className="font-bold text-slate-800 text-base">{k.siswa?.nama_lengkap}</div>
                            <div className="text-xs font-semibold text-slate-500 mt-1">Kelas: <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{k.siswa?.kelas?.tingkat}-{k.siswa?.kelas?.nomor_kelas}</span></div>
                          </TableCell>
                          <TableCell className="text-center py-4">
                            <div className="flex flex-wrap justify-center gap-1.5">
                              {k.jam_pelajaran.map((jam: number) => (
                                <span key={jam} className="h-7 w-7 rounded-lg bg-indigo-100 text-indigo-700 font-black text-xs flex items-center justify-center border border-indigo-200 shadow-sm">
                                  {jam}
                                </span>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="py-4">
                            <span className="bg-white text-indigo-700 px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-wider font-black shadow-sm border border-indigo-100">
                              {k.alasan}
                            </span>
                          </TableCell>
                          <TableCell className="py-4">
                            <p className="text-sm font-medium text-slate-700 max-w-[250px] truncate" title={k.keterangan}>{k.keterangan || '-'}</p>
                            <p className="text-[10px] font-semibold text-slate-400 mt-1.5">Oleh: {k.pelapor?.nama_lengkap}</p>
                          </TableCell>
                          <TableCell className="text-right px-6 py-4">
                            {isSuperAdmin && (
                              <Button variant="ghost" size="icon" onClick={() => handleDeleteKelas(k.id)} className="h-9 w-9 rounded-xl text-rose-500 hover:bg-rose-50 border border-transparent hover:border-rose-100 shadow-sm opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="h-4 w-4"/></Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
             </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}