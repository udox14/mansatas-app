// Lokasi: app/dashboard/izin/components/izin-client.tsx
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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
import { tambahIzinKeluar, tandaiSudahKembali, tambahIzinKelas, hapusIzinKeluar, hapusIzinKelas, searchSiswaIzin } from '../actions'
import { cn } from '@/lib/utils'

const initialFormState = { error: null as string | null, success: null as string | null }

function SubmitBtn({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="w-full h-10 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm mt-3">
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : label}
    </Button>
  )
}

export function IzinClient({ izinKeluarList, izinKelasList, currentUserRole }: {
  izinKeluarList: any[], izinKelasList: any[], currentUserRole: string
}) {
  const isSuperAdmin = currentUserRole === 'super_admin'

  // Tab 1: Keluar
  const [searchKeluar, setSearchKeluar] = useState('')
  const [filterStatus, setFilterStatus] = useState('SEMUA')
  const [isModalKeluarOpen, setIsModalKeluarOpen] = useState(false)
  const [stateKeluar, actionKeluar] = useActionState(tambahIzinKeluar, initialFormState)

  // Tab 2: Kelas
  const [searchKelas, setSearchKelas] = useState('')
  const [filterAlasan, setFilterAlasan] = useState('SEMUA')
  const [isModalKelasOpen, setIsModalKelasOpen] = useState(false)
  const [stateKelas, actionKelas] = useActionState(tambahIzinKelas, initialFormState)
  const [selectedJam, setSelectedJam] = useState<number[]>([])

  // Autocomplete siswa — lazy via Server Action (bukan pre-load semua siswa)
  const [searchSiswa, setSearchSiswa] = useState('')
  const [selectedSiswaId, setSelectedSiswaId] = useState('')
  const [showSiswaDropdown, setShowSiswaDropdown] = useState(false)
  const [siswaResults, setSiswaResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSiswaSearch = useCallback((val: string) => {
    setSearchSiswa(val)
    setSelectedSiswaId('')
    setShowSiswaDropdown(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (val.length < 2) { setSiswaResults([]); return }
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const results = await searchSiswaIzin(val)
        setSiswaResults(results)
      } finally {
        setIsSearching(false)
      }
    }, 300)
  }, [])

  const toggleJam = (jam: number) => setSelectedJam(prev => prev.includes(jam) ? prev.filter(j => j !== jam) : [...prev, jam].sort((a, b) => a - b))
  const toggleSemuaJam = () => setSelectedJam(selectedJam.length === 10 ? [] : [1,2,3,4,5,6,7,8,9,10])

  useEffect(() => { if (stateKeluar?.success) { const t = setTimeout(() => setIsModalKeluarOpen(false), 1500); return () => clearTimeout(t) } }, [stateKeluar?.success])
  useEffect(() => { if (stateKelas?.success) { const t = setTimeout(() => setIsModalKelasOpen(false), 1500); return () => clearTimeout(t) } }, [stateKelas?.success])

  const handleKembali = async (id: string) => { const res = await tandaiSudahKembali(id); if (res.error) alert(res.error) }
  const handleDeleteKeluar = async (id: string) => { if (!confirm('Hapus riwayat ini?')) return; const res = await hapusIzinKeluar(id); if (res.error) alert(res.error) }
  const handleDeleteKelas = async (id: string) => { if (!confirm('Hapus riwayat ini?')) return; const res = await hapusIzinKelas(id); if (res.error) alert(res.error) }

  const displayKeluar = izinKeluarList.filter(k =>
    k.siswa?.nama_lengkap?.toLowerCase().includes(searchKeluar.toLowerCase()) &&
    (filterStatus === 'SEMUA' || k.status === filterStatus)
  )
  const displayKelas = izinKelasList.filter(k =>
    k.siswa?.nama_lengkap?.toLowerCase().includes(searchKelas.toLowerCase()) &&
    (filterAlasan === 'SEMUA' || k.alasan === filterAlasan)
  )

  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })

  // Autocomplete component (reusable)
  const SiswaAutocomplete = () => (
    <div className="space-y-1.5 relative">
      <Label className="text-xs font-semibold text-slate-600">Cari Siswa <span className="text-rose-500">*</span></Label>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
        <Input
          placeholder="Ketik min. 2 huruf nama siswa..."
          value={searchSiswa}
          onChange={e => handleSiswaSearch(e.target.value)}
          onFocus={() => setShowSiswaDropdown(true)}
          onBlur={() => setTimeout(() => setShowSiswaDropdown(false), 200)}
          className={cn("pl-8 h-9 text-sm rounded-lg", selectedSiswaId ? 'border-emerald-400 bg-emerald-50/40' : '')}
        />
        {isSearching && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-slate-400" />}
      </div>
      {showSiswaDropdown && searchSiswa.length > 1 && (
        <div className="absolute z-50 w-full mt-0.5 bg-surface border border-surface rounded-lg shadow-lg max-h-52 overflow-y-auto">
          {siswaResults.length === 0 && !isSearching && (
            <div className="px-3 py-4 text-center text-xs text-slate-400">Tidak ditemukan</div>
          )}
          {siswaResults.map(s => (
            <div
              key={s.id}
              onMouseDown={e => e.preventDefault()}
              onClick={() => { setSelectedSiswaId(s.id); setSearchSiswa(s.nama_lengkap); setShowSiswaDropdown(false) }}
              className="px-3 py-2 hover:bg-surface-2 cursor-pointer border-b border-surface-2 flex justify-between items-center last:border-0"
            >
              <span className="text-sm font-medium text-slate-800">{s.nama_lengkap}</span>
              <span className="text-[10px] bg-surface-3 px-1.5 py-0.5 rounded text-slate-500">{s.kelas?.tingkat}-{s.kelas?.nomor_kelas}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-3">

      {/* MODAL 1: KELUAR KOMPLEK */}
      <Dialog open={isModalKeluarOpen} onOpenChange={open => { setIsModalKeluarOpen(open); if (!open) { setSelectedSiswaId(''); setSearchSiswa('') } }}>
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader className="border-b pb-3">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <DoorOpen className="h-4 w-4 text-blue-600" /> Catat Izin Keluar Komplek
            </DialogTitle>
          </DialogHeader>
          <form action={actionKeluar} className="space-y-3 pt-1">
            {stateKeluar?.error && <div className="p-2.5 text-xs text-rose-600 bg-rose-50 rounded-lg border border-rose-200 flex gap-1.5"><AlertCircle className="h-3.5 w-3.5 shrink-0" />{stateKeluar.error}</div>}
            {stateKeluar?.success && <div className="p-2.5 text-xs text-emerald-700 bg-emerald-50 rounded-lg border border-emerald-200 flex gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 shrink-0" />{stateKeluar.success}</div>}
            <input type="hidden" name="siswa_id" value={selectedSiswaId} />
            <SiswaAutocomplete />
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600">Keterangan / Tujuan (Opsional)</Label>
              <Input name="keterangan" placeholder="Contoh: Beli alat tulis..." className="h-9 text-sm rounded-lg" />
            </div>
            <div className="bg-blue-50 p-2.5 rounded-lg border border-blue-100 text-xs text-blue-700 flex gap-1.5">
              <Clock className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              Waktu keluar dicatat otomatis. Status: "BELUM KEMBALI".
            </div>
            <SubmitBtn label="Simpan & Izinkan Keluar" />
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: IZIN KELAS */}
      <Dialog open={isModalKelasOpen} onOpenChange={open => { setIsModalKelasOpen(open); if (!open) { setSelectedSiswaId(''); setSearchSiswa(''); setSelectedJam([]) } }}>
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader className="border-b pb-3">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <UserX className="h-4 w-4 text-indigo-600" /> Izin Tidak Masuk Kelas
            </DialogTitle>
          </DialogHeader>
          <form action={actionKelas} className="space-y-3 pt-1">
            {stateKelas?.error && <div className="p-2.5 text-xs text-rose-600 bg-rose-50 rounded-lg border flex gap-1.5"><AlertCircle className="h-3.5 w-3.5 shrink-0" />{stateKelas.error}</div>}
            {stateKelas?.success && <div className="p-2.5 text-xs text-emerald-700 bg-emerald-50 rounded-lg border flex gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 shrink-0" />{stateKelas.success}</div>}
            <input type="hidden" name="siswa_id" value={selectedSiswaId} />
            {selectedJam.map(jam => <input key={jam} type="hidden" name="jam_pelajaran" value={jam} />)}
            <SiswaAutocomplete />
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-slate-600">Jam Pelajaran <span className="text-rose-500">*</span></Label>
                <button type="button" onClick={toggleSemuaJam} className="text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded transition-colors">
                  {selectedJam.length === 10 ? 'Batal Semua' : 'Pilih Semua'}
                </button>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {[1,2,3,4,5,6,7,8,9,10].map(jam => (
                  <button
                    key={jam} type="button" onClick={() => toggleJam(jam)}
                    className={cn("h-9 rounded-lg border text-sm font-bold transition-all", selectedJam.includes(jam) ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-surface-2 text-slate-500 border-surface hover:bg-surface-3')}
                  >{jam}</button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600">Alasan <span className="text-rose-500">*</span></Label>
              <Select name="alasan" required>
                <SelectTrigger className="h-9 text-xs rounded-lg"><SelectValue placeholder="Pilih alasan..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="KELUAR KOMPLEK BERSAMA ORANG TUA">Keluar bersama Ortu</SelectItem>
                  <SelectItem value="SAKIT DI UKS">Sakit di UKS</SelectItem>
                  <SelectItem value="SAKIT (PULANG)">Sakit (Pulang)</SelectItem>
                  <SelectItem value="BIMBINGAN LOMBA">Bimbingan Lomba</SelectItem>
                  <SelectItem value="KEGIATAN DI DALAM">Kegiatan di Dalam</SelectItem>
                  <SelectItem value="KEGIATAN DI LUAR">Kegiatan di Luar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600">Keterangan (Opsional)</Label>
              <Input name="keterangan" placeholder="Contoh: Lomba OSN..." className="h-9 text-sm rounded-lg" />
            </div>
            <SubmitBtn label="Simpan Izin Kelas" />
          </form>
        </DialogContent>
      </Dialog>

      {/* MAIN TABS */}
      <Tabs defaultValue="keluar" className="space-y-3">
        <TabsList className="bg-surface border border-surface p-0.5 h-auto grid grid-cols-2 rounded-lg">
          <TabsTrigger value="keluar" className="py-2 rounded-md data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs sm:text-sm font-medium">
            Keluar Komplek
          </TabsTrigger>
          <TabsTrigger value="kelas" className="py-2 rounded-md data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-xs sm:text-sm font-medium">
            Izin Tidak Masuk Kelas
          </TabsTrigger>
        </TabsList>

        {/* TAB KELUAR */}
        <TabsContent value="keluar" className="m-0 space-y-3">
          <div className="bg-surface border border-surface rounded-lg p-3 flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-0" style={{ minWidth: '140px' }}>
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input placeholder="Cari nama siswa..." value={searchKeluar} onChange={e => setSearchKeluar(e.target.value)} className="pl-8 h-8 text-sm rounded-md" />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-8 w-36 text-xs rounded-md shrink-0"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="SEMUA">Semua Status</SelectItem>
                <SelectItem value="BELUM KEMBALI">Belum Kembali</SelectItem>
                <SelectItem value="SUDAH KEMBALI">Sudah Kembali</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => setIsModalKeluarOpen(true)} size="sm" className="h-8 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-md shrink-0">
              <DoorOpen className="h-3.5 w-3.5 mr-1" /> Catat Keluar
            </Button>
          </div>

          {/* MOBILE */}
          <div className="block lg:hidden space-y-2">
            {displayKeluar.length === 0 ? (
              <div className="bg-surface py-10 rounded-lg border border-surface text-center">
                <p className="text-sm text-slate-400">Tidak ada data izin keluar.</p>
              </div>
            ) : displayKeluar.map(k => (
              <div key={k.id} className={cn("bg-surface border rounded-lg p-3 relative", k.status === 'BELUM KEMBALI' ? 'border-amber-200 bg-amber-50/30' : 'border-surface')}>
                {isSuperAdmin && (
                  <button onClick={() => handleDeleteKeluar(k.id)} className="absolute top-2 right-2 p-1 text-slate-300 hover:text-rose-500 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
                <div className="flex items-start justify-between pr-6 mb-1.5">
                  <div>
                    <p className="text-sm font-semibold text-slate-800 leading-tight">{k.siswa?.nama_lengkap}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-slate-500 bg-surface-3 px-1.5 py-0.5 rounded border border-surface">
                        {k.siswa?.kelas?.tingkat}-{k.siswa?.kelas?.nomor_kelas}
                      </span>
                      <span className="text-[10px] font-mono text-slate-600">{formatTime(k.waktu_keluar)}</span>
                    </div>
                  </div>
                  <span className={cn("text-[9px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0", k.status === 'BELUM KEMBALI' ? 'bg-amber-100 text-amber-700 animate-pulse' : 'bg-surface-3 text-slate-500')}>
                    {k.status === 'BELUM KEMBALI' ? 'Di Luar' : 'Kembali'}
                  </span>
                </div>
                {k.keterangan && <p className="text-[10px] text-slate-500 truncate mb-2">{k.keterangan}</p>}
                <div className="flex items-center justify-between pt-2 border-t border-surface-2">
                  <span className="text-[10px] text-slate-400">Oleh: {k.pelapor?.nama_lengkap?.split(' ')[0]}</span>
                  {k.status === 'BELUM KEMBALI' ? (
                    <Button size="sm" onClick={() => handleKembali(k.id)} className="h-7 px-2.5 text-[10px] bg-emerald-600 hover:bg-emerald-700 rounded">
                      <LogIn className="h-3 w-3 mr-1" />Tandai Kembali
                    </Button>
                  ) : (
                    <span className="text-[10px] text-emerald-600 flex items-center gap-0.5"><CheckCircle2 className="h-3 w-3" />Tiba {formatTime(k.waktu_kembali)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* DESKTOP TABLE */}
          <div className="hidden lg:block bg-surface rounded-lg border border-surface overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-surface-2 hover:bg-surface-2">
                  <TableHead className="h-9 px-4 text-xs font-semibold text-slate-500">Siswa</TableHead>
                  <TableHead className="h-9 text-xs font-semibold text-slate-500 w-24">Keluar</TableHead>
                  <TableHead className="h-9 text-xs font-semibold text-slate-500">Keterangan</TableHead>
                  <TableHead className="h-9 text-xs font-semibold text-slate-500 text-center w-28">Status</TableHead>
                  <TableHead className="h-9 text-xs font-semibold text-slate-500 text-right px-4 w-36">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayKeluar.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="h-24 text-center text-sm text-slate-400">Tidak ada data izin keluar.</TableCell></TableRow>
                ) : displayKeluar.map(k => (
                  <TableRow key={k.id} className={cn("border-surface-2 group", k.status === 'BELUM KEMBALI' ? 'bg-amber-50/20 hover:bg-amber-50/40' : 'hover:bg-surface-2/60')}>
                    <TableCell className="px-4 py-2.5">
                      <p className="text-sm font-semibold text-slate-800 leading-tight">{k.siswa?.nama_lengkap}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Kelas {k.siswa?.kelas?.tingkat}-{k.siswa?.kelas?.nomor_kelas} · {k.pelapor?.nama_lengkap}</p>
                    </TableCell>
                    <TableCell className="py-2.5 text-xs font-mono text-slate-600">{formatTime(k.waktu_keluar)}</TableCell>
                    <TableCell className="py-2.5 text-xs text-slate-500">{k.keterangan || '-'}</TableCell>
                    <TableCell className="py-2.5 text-center">
                      <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded border", k.status === 'BELUM KEMBALI' ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse' : 'bg-surface-2 text-slate-500 border-surface')}>
                        {k.status === 'BELUM KEMBALI' ? 'Di Luar' : `Tiba ${formatTime(k.waktu_kembali)}`}
                      </span>
                    </TableCell>
                    <TableCell className="py-2.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {k.status === 'BELUM KEMBALI' ? (
                          <Button size="sm" onClick={() => handleKembali(k.id)} className="h-7 px-2.5 text-[10px] bg-emerald-600 hover:bg-emerald-700 rounded">
                            <LogIn className="h-3 w-3 mr-1" />Tandai Kembali
                          </Button>
                        ) : null}
                        {isSuperAdmin && (
                          <button onClick={() => handleDeleteKeluar(k.id)} className="p-1.5 rounded text-rose-400 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* TAB KELAS */}
        <TabsContent value="kelas" className="m-0 space-y-3">
          <div className="bg-surface border border-surface rounded-lg p-3 flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-0" style={{ minWidth: '140px' }}>
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input placeholder="Cari nama siswa..." value={searchKelas} onChange={e => setSearchKelas(e.target.value)} className="pl-8 h-8 text-sm rounded-md" />
            </div>
            <Select value={filterAlasan} onValueChange={setFilterAlasan}>
              <SelectTrigger className="h-8 w-36 text-xs rounded-md shrink-0"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="SEMUA">Semua Alasan</SelectItem>
                <SelectItem value="SAKIT DI UKS">Sakit di UKS</SelectItem>
                <SelectItem value="SAKIT (PULANG)">Sakit (Pulang)</SelectItem>
                <SelectItem value="BIMBINGAN LOMBA">Bimbingan Lomba</SelectItem>
                <SelectItem value="KEGIATAN DI DALAM">Kegiatan di Dalam</SelectItem>
                <SelectItem value="KEGIATAN DI LUAR">Kegiatan di Luar</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => setIsModalKelasOpen(true)} size="sm" className="h-8 px-3 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-md shrink-0">
              <UserX className="h-3.5 w-3.5 mr-1" /> Catat Izin Kelas
            </Button>
          </div>

          {/* MOBILE */}
          <div className="block lg:hidden space-y-2">
            {displayKelas.length === 0 ? (
              <div className="bg-surface py-10 rounded-lg border border-surface text-center">
                <p className="text-sm text-slate-400">Tidak ada data izin kelas.</p>
              </div>
            ) : displayKelas.map(k => (
              <div key={k.id} className="bg-surface border border-surface rounded-lg p-3 relative">
                {isSuperAdmin && (
                  <button onClick={() => handleDeleteKelas(k.id)} className="absolute top-2 right-2 p-1 text-slate-300 hover:text-rose-500 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
                <div className="flex items-start justify-between pr-6 mb-1.5">
                  <p className="text-sm font-semibold text-slate-800 leading-tight truncate">{k.siswa?.nama_lengkap}</p>
                  <span className="text-[10px] text-slate-500 bg-surface-3 px-1.5 py-0.5 rounded border border-surface shrink-0 ml-2">
                    {k.siswa?.kelas?.tingkat}-{k.siswa?.kelas?.nomor_kelas}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1 mb-1.5">
                  <span className="text-[9px] font-bold uppercase text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded tracking-wide">
                    {k.alasan}
                  </span>
                  {k.jam_pelajaran.map((jam: number) => (
                    <span key={jam} className="text-[9px] h-4 w-4 rounded bg-surface-3 text-slate-600 font-bold flex items-center justify-center border border-surface">{jam}</span>
                  ))}
                </div>
                {k.keterangan && <p className="text-[10px] text-slate-500 truncate">{k.keterangan}</p>}
                <p className="text-[10px] text-slate-400 mt-1.5 pt-1.5 border-t border-surface-2">Oleh: {k.pelapor?.nama_lengkap}</p>
              </div>
            ))}
          </div>

          {/* DESKTOP TABLE */}
          <div className="hidden lg:block bg-surface rounded-lg border border-surface overflow-hidden">
            <div className="overflow-x-auto">
              <Table className="min-w-[700px]">
                <TableHeader>
                  <TableRow className="bg-surface-2 hover:bg-surface-2">
                    <TableHead className="h-9 px-4 text-xs font-semibold text-slate-500">Siswa</TableHead>
                    <TableHead className="h-9 text-xs font-semibold text-slate-500 text-center w-44">Jam Ke-</TableHead>
                    <TableHead className="h-9 text-xs font-semibold text-slate-500 w-44">Alasan</TableHead>
                    <TableHead className="h-9 text-xs font-semibold text-slate-500">Keterangan</TableHead>
                    <TableHead className="h-9 text-xs font-semibold text-slate-500 text-right px-4 w-16">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayKelas.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="h-24 text-center text-sm text-slate-400">Tidak ada data izin kelas.</TableCell></TableRow>
                  ) : displayKelas.map(k => (
                    <TableRow key={k.id} className="hover:bg-surface-2/60 border-surface-2 group">
                      <TableCell className="px-4 py-2.5">
                        <p className="text-sm font-semibold text-slate-800 leading-tight">{k.siswa?.nama_lengkap}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Kelas {k.siswa?.kelas?.tingkat}-{k.siswa?.kelas?.nomor_kelas}</p>
                      </TableCell>
                      <TableCell className="py-2.5 text-center">
                        <div className="flex flex-wrap justify-center gap-1">
                          {k.jam_pelajaran.map((jam: number) => (
                            <span key={jam} className="h-6 w-6 rounded bg-indigo-100 text-indigo-700 font-bold text-[10px] flex items-center justify-center border border-indigo-200">{jam}</span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5">
                        <span className="text-[10px] font-bold uppercase text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded tracking-wide">{k.alasan}</span>
                      </TableCell>
                      <TableCell className="py-2.5">
                        <p className="text-xs text-slate-600 truncate max-w-[200px]">{k.keterangan || '-'}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Oleh: {k.pelapor?.nama_lengkap}</p>
                      </TableCell>
                      <TableCell className="py-2.5 px-4 text-right">
                        {isSuperAdmin && (
                          <button onClick={() => handleDeleteKelas(k.id)} className="p-1.5 rounded text-rose-400 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}