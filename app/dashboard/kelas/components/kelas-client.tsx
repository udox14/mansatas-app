// TIMPA SELURUH ISI FILE INI
// Lokasi: app/dashboard/kelas/components/kelas-client.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Search, Trash2, Users, ChevronRight, UserCircle, Library, Pencil, AlertTriangle, Save, Loader2, ChevronDown } from 'lucide-react'
import { TambahModal } from './tambah-modal'
import { ImportModal } from './import-modal'
import { EditModal } from './edit-modal'
import { hapusKelas, batchUpdateKelas } from '../actions'

type KelasData = {
  id: string
  tingkat: number
  nomor_kelas: string
  kelompok: string
  kapasitas: number
  wali_kelas_id: string
  wali_kelas_nama: string
  jumlah_siswa: number
}

type GuruType = { id: string; nama_lengkap: string }

// ============================================================================
// KOMPONEN CUSTOM: SEARCHABLE DROPDOWN WALI KELAS
// ============================================================================
function WaliKelasSelector({ value, onChange, daftarGuru, disabled }: { value: string, onChange: (v: string) => void, daftarGuru: GuruType[], disabled: boolean }) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  
  const selected = daftarGuru.find(g => g.id === value)
  const filtered = daftarGuru.filter(g => g.nama_lengkap.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="relative w-full max-w-[260px]">
      <button 
        type="button" 
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)} 
        className={`flex items-center justify-between w-full h-11 px-3 border rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${isOpen ? 'bg-white border-blue-500 ring-2 ring-blue-50' : 'bg-slate-50/80 border-slate-200/60 hover:bg-white text-slate-700'}`}
      >
        <span className="truncate">{selected ? selected.nama_lengkap : <span className="text-slate-400 italic">-- Kosongkan Wali --</span>}</span>
        <ChevronDown className="h-4 w-4 text-slate-400 shrink-0 ml-2" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute z-50 top-full left-0 mt-2 w-full min-w-[260px] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-2 border-b border-slate-100 bg-slate-50/80 sticky top-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                  autoFocus
                  placeholder="Ketik cari nama guru..." 
                  value={search} 
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 h-9 text-xs rounded-lg bg-white border-slate-200 focus:border-blue-500 shadow-sm"
                />
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto custom-scrollbar p-1.5 space-y-0.5">
              <div 
                onClick={() => { onChange('none'); setIsOpen(false) }}
                className="px-3 py-2.5 text-xs text-slate-400 italic hover:bg-slate-50 hover:text-slate-600 rounded-lg cursor-pointer transition-colors"
              >
                -- Kosongkan Wali Kelas --
              </div>
              {filtered.map(g => (
                <div 
                  key={g.id}
                  onClick={() => { onChange(g.id); setIsOpen(false) }}
                  className={`px-3 py-2.5 text-xs font-medium rounded-lg cursor-pointer transition-colors ${value === g.id ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-slate-50 text-slate-700'}`}
                >
                  {g.nama_lengkap}
                </div>
              ))}
              {filtered.length === 0 && <div className="px-3 py-4 text-center text-xs text-slate-400">Guru tidak ditemukan</div>}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ============================================================================
// KOMPONEN UTAMA CLIENT
// ============================================================================
export function KelasClient({ 
  initialData, 
  daftarGuru, 
  daftarJurusan = [] 
}: { 
  initialData: KelasData[], 
  daftarGuru: GuruType[], 
  daftarJurusan?: string[] 
}) {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState('')
  const [filterTingkat, setFilterTingkat] = useState('Semua')
  const [isPending, setIsPending] = useState(false)
  const [editingKelas, setEditingKelas] = useState<KelasData | null>(null)

  // STATE BATCH EDIT (Menampung semua perubahan sebelum dikirim ke database)
  const [pendingChanges, setPendingChanges] = useState<Record<string, {kelompok?: string, wali_kelas_id?: string}>>({})
  const [isSavingBatch, setIsSavingBatch] = useState(false)
  
  // STATE BARU: Tampilkan Total Kapasitas Manual
  const [showTotalKapasitas, setShowTotalKapasitas] = useState(false)

  const handleQueueChange = (id: string, field: 'kelompok' | 'wali_kelas_id', value: string) => {
    setPendingChanges(prev => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        [field]: value
      }
    }))
  }

  const getValue = (id: string, field: 'kelompok' | 'wali_kelas_id', originalValue: string) => {
    return pendingChanges[id]?.[field] !== undefined ? pendingChanges[id][field] : originalValue
  }

  const executeBatchSave = async () => {
    setIsSavingBatch(true)
    const updates = Object.entries(pendingChanges).map(([id, changes]) => ({ id, ...changes }))
    const res = await batchUpdateKelas(updates)
    if (res.error) alert(res.error)
    else {
      setPendingChanges({}) // Bersihkan antrean
      // Notifikasi otomatis ditangani oleh GlobalAlert di layout
    }
    setIsSavingBatch(false)
  }

  const filteredData = initialData.filter(k => {
    const matchTingkat = filterTingkat === 'Semua' || k.tingkat.toString() === filterTingkat
    const namaKelasPencarian = `${k.tingkat} ${k.kelompok} ${k.nomor_kelas}`.toLowerCase()
    const matchSearch = namaKelasPencarian.includes(searchTerm.toLowerCase()) || 
           k.wali_kelas_nama.toLowerCase().includes(searchTerm.toLowerCase())
           
    return matchTingkat && matchSearch
  })

  const sortedData = [...filteredData].sort((a, b) => {
    const namaA = `${a.tingkat} ${a.kelompok} ${a.nomor_kelas}`
    const namaB = `${b.tingkat} ${b.kelompok} ${b.nomor_kelas}`
    return namaA.localeCompare(namaB, undefined, { numeric: true, sensitivity: 'base' })
  })

  const handleHapus = async (id: string, namaKelas: string, jumlahSiswa: number) => {
    if (jumlahSiswa > 0) {
      alert(`Tidak bisa menghapus kelas ${namaKelas} karena masih ada ${jumlahSiswa} siswa di dalamnya. Kosongkan kelas terlebih dahulu.`)
      return
    }
    if (!confirm(`Yakin ingin menghapus kelas ${namaKelas}?`)) return
    
    setIsPending(true)
    const res = await hapusKelas(id)
    if (res?.error) alert(res.error)
    setIsPending(false)
  }

  return (
    <div className="space-y-6 pb-24">
      
      <EditModal isOpen={!!editingKelas} onClose={() => setEditingKelas(null)} kelasData={editingKelas} daftarGuru={daftarGuru} daftarJurusan={daftarJurusan} />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/80 backdrop-blur-xl p-4 sm:p-5 rounded-3xl shadow-sm border border-slate-200/60">
        <div className="flex flex-col sm:flex-row w-full sm:w-auto items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Cari kelas atau wali..." className="pl-11 h-12 rounded-xl bg-white shadow-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <Select value={filterTingkat} onValueChange={setFilterTingkat}>
            <SelectTrigger className="w-full sm:w-[160px] h-12 rounded-xl bg-white shadow-sm font-semibold text-slate-700"><SelectValue placeholder="Semua Tingkat" /></SelectTrigger>
            <SelectContent className="rounded-xl"><SelectItem value="Semua">Semua Tingkat</SelectItem><SelectItem value="10">Kelas 10</SelectItem><SelectItem value="11">Kelas 11</SelectItem><SelectItem value="12">Kelas 12</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <ImportModal />
          <TambahModal daftarGuru={daftarGuru} daftarJurusan={daftarJurusan} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white p-5 rounded-3xl border border-slate-200/60 shadow-sm flex items-center gap-5">
          <div className="bg-blue-100 p-4 rounded-2xl text-blue-600"><Library className="h-7 w-7" /></div>
          <div><p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Total Kelas</p><h3 className="text-3xl font-black text-slate-800 leading-none">{sortedData.length}</h3></div>
        </div>
        
        {/* PERBAIKAN: KARTU KAPASITAS MANUAL */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/60 shadow-sm flex items-center justify-between gap-5">
          <div className="flex items-center gap-5">
            <div className="bg-emerald-100 p-4 rounded-2xl text-emerald-600"><Users className="h-7 w-7" /></div>
            <div>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Total Kapasitas Kursi</p>
              {showTotalKapasitas ? (
                <h3 className="text-3xl font-black text-slate-800 leading-none animate-in zoom-in duration-300">
                  {sortedData.reduce((acc, curr) => acc + curr.kapasitas, 0)}
                </h3>
              ) : (
                <p className="text-xs font-medium text-slate-400 mt-1">Mode hitung manual aktif</p>
              )}
            </div>
          </div>
          {!showTotalKapasitas && (
            <Button 
              onClick={() => setShowTotalKapasitas(true)} 
              variant="outline" 
              className="h-10 px-4 rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50 text-xs font-bold shrink-0 transition-all shadow-sm"
            >
              Hitung Total
            </Button>
          )}
        </div>
      </div>

      {/* MOBILE VIEW */}
      <div className="block xl:hidden space-y-4">
        {sortedData.length === 0 ? (
          <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center shadow-sm">
            <Library className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="font-medium text-slate-500">Belum ada data kelas.</p>
          </div>
        ) : (
          sortedData.map((k) => {
            const isFull = k.jumlah_siswa >= k.kapasitas
            const percentage = Math.round((k.jumlah_siswa / k.kapasitas) * 100)
            
            const currentKelompok = getValue(k.id, 'kelompok', k.kelompok)
            const currentWali = getValue(k.id, 'wali_kelas_id', k.wali_kelas_id)
            const isRowPending = !!pendingChanges[k.id]
            const isJurusanValid = currentKelompok === 'UMUM' || daftarJurusan.includes(currentKelompok);

            return (
              <div key={k.id} className={`bg-white p-5 rounded-3xl border shadow-sm flex flex-col gap-4 relative overflow-hidden transition-all ${isRowPending ? 'border-blue-300 ring-2 ring-blue-50' : !isJurusanValid ? 'border-rose-300 ring-2 ring-rose-50' : 'border-slate-200'}`}>
                <div className="flex items-center justify-between cursor-pointer group pb-3 border-b border-slate-100" onClick={() => router.push(`/dashboard/kelas/${k.id}`)}>
                  <div className="flex flex-col gap-1.5">
                    <span className="font-black text-slate-800 text-2xl group-hover:text-blue-700 transition-colors tracking-tight leading-none">
                      {k.tingkat}-{k.nomor_kelas}
                    </span>
                    {!isJurusanValid && (
                      <span className="flex items-center gap-1.5 text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-1 rounded-md border border-rose-200">
                        <AlertTriangle className="h-3 w-3 shrink-0" /> Usang! Edit Jurusan
                      </span>
                    )}
                  </div>
                  <div className="bg-blue-50 p-2.5 rounded-xl text-blue-600 group-hover:bg-blue-100 transition-colors"><ChevronRight className="h-5 w-5" /></div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Label className="text-xs font-bold text-slate-500 w-20">Jurusan</Label>
                    <Select value={currentKelompok} onValueChange={(val) => handleQueueChange(k.id, 'kelompok', val)} disabled={isSavingBatch}>
                      <SelectTrigger className={`h-11 flex-1 rounded-xl text-xs font-bold tracking-wider ${pendingChanges[k.id]?.kelompok !== undefined ? 'bg-blue-50 border-blue-200 text-blue-700' : !isJurusanValid ? 'bg-rose-50 border-rose-300 text-rose-700' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">{daftarJurusan.map(jur => <SelectItem key={jur} value={jur} className="text-xs font-bold">{jur}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-3">
                    <Label className="text-xs font-bold text-slate-500 w-20">Wali Kelas</Label>
                    <div className="flex-1">
                      <WaliKelasSelector value={currentWali} onChange={(val) => handleQueueChange(k.id, 'wali_kelas_id', val)} daftarGuru={daftarGuru} disabled={isSavingBatch} />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 mt-1 border-t border-slate-100">
                  <div className="flex flex-col gap-1.5 w-1/2">
                    <span className={`text-xs font-bold w-fit px-2.5 py-1 rounded-md ${isFull ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>
                      {k.jumlah_siswa} / {k.kapasitas} Kursi
                    </span>
                    <div className="w-full max-w-[140px] h-2 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full ${isFull ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(percentage, 100)}%` }}></div></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={() => setEditingKelas(k)} className="h-11 w-11 rounded-xl text-blue-600 border-blue-200 hover:bg-blue-50"><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleHapus(k.id, `${k.tingkat}-${k.nomor_kelas}`, k.jumlah_siswa)} disabled={isPending || k.jumlah_siswa > 0} className={`h-11 w-11 rounded-xl shadow-sm ${k.jumlah_siswa > 0 ? "text-slate-300" : "text-red-600 bg-red-50 hover:bg-red-100"}`}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* DESKTOP VIEW */}
      <div className="hidden xl:flex rounded-3xl border border-slate-200/60 bg-white shadow-sm overflow-hidden flex-col">
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow className="border-b border-slate-100">
              <TableHead className="font-bold text-slate-600 px-6 h-14 w-[180px]">Identitas (Klik)</TableHead>
              <TableHead className="font-bold text-slate-600 h-14 w-[200px]">Jurusan / Peminatan</TableHead>
              <TableHead className="font-bold text-slate-600 h-14">Wali Kelas</TableHead>
              <TableHead className="font-bold text-slate-600 text-center h-14 w-[160px]">Keterisian</TableHead>
              <TableHead className="text-right font-bold text-slate-600 px-6 h-14 w-[120px]">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="h-32 text-center text-slate-500">Belum ada data kelas.</TableCell></TableRow>
            ) : (
              sortedData.map((k) => {
                const isFull = k.jumlah_siswa >= k.kapasitas
                const percentage = Math.round((k.jumlah_siswa / k.kapasitas) * 100)

                // Ambil nilai real-time (bisa dari antrean pending atau dari database)
                const currentKelompok = getValue(k.id, 'kelompok', k.kelompok)
                const currentWali = getValue(k.id, 'wali_kelas_id', k.wali_kelas_id)
                
                const isRowPending = !!pendingChanges[k.id]
                const isJurusanPending = pendingChanges[k.id]?.kelompok !== undefined
                const isJurusanValid = currentKelompok === 'UMUM' || daftarJurusan.includes(currentKelompok)

                return (
                  <TableRow key={k.id} className={`transition-colors group ${isRowPending ? 'bg-blue-50/30 border-l-4 border-l-blue-500 border-b-blue-100' : 'hover:bg-slate-50/50 border-b border-slate-100'}`}>
                    <TableCell 
                      className="px-6 py-4 cursor-pointer relative"
                      onClick={() => router.push(`/dashboard/kelas/${k.id}`)}
                      title="Klik untuk melihat detail siswa kelas ini"
                    >
                      <div className="font-black text-slate-800 text-2xl group-hover:text-blue-700 transition-colors tracking-tight">
                        {k.tingkat}-{k.nomor_kelas}
                      </div>
                    </TableCell>

                    <TableCell className="py-4">
                      <Select value={currentKelompok} onValueChange={(val) => handleQueueChange(k.id, 'kelompok', val)} disabled={isSavingBatch}>
                        <SelectTrigger className={`h-10 w-[140px] rounded-xl text-xs font-bold tracking-wider uppercase ${isJurusanPending ? 'bg-blue-50 border-blue-300 text-blue-700 ring-2 ring-blue-100' : !isJurusanValid ? 'bg-rose-50 border-rose-300 text-rose-700 ring-2 ring-rose-50' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white'}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl shadow-xl">
                          {daftarJurusan.map(jur => <SelectItem key={jur} value={jur} className="text-xs font-bold">{jur}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {!isJurusanValid && <p className="text-[10px] text-rose-500 font-bold mt-1 flex items-center gap-1"><AlertTriangle className="h-3 w-3"/> Usang!</p>}
                    </TableCell>
                    
                    <TableCell className="py-4">
                      <div className="flex items-center gap-3">
                        <UserCircle className={`h-6 w-6 shrink-0 transition-colors ${pendingChanges[k.id]?.wali_kelas_id !== undefined ? 'text-blue-500' : currentWali === 'none' ? 'text-slate-300' : 'text-emerald-500'}`} />
                        <WaliKelasSelector 
                          value={currentWali} 
                          onChange={(val) => handleQueueChange(k.id, 'wali_kelas_id', val)} 
                          daftarGuru={daftarGuru} 
                          disabled={isSavingBatch} 
                        />
                      </div>
                    </TableCell>

                    <TableCell className="py-4">
                      <div className="flex flex-col items-center gap-1.5">
                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${isFull ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                          {k.jumlah_siswa} / {k.kapasitas}
                        </span>
                        <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                          <div className={`h-full ${isFull ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(percentage, 100)}%` }}></div>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="text-right px-6 py-4">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setEditingKelas(k) }} title="Edit Lengkap (Nomor & Kapasitas)" className="h-9 w-9 rounded-xl text-blue-500 hover:text-blue-700 hover:bg-blue-50 shadow-sm border border-transparent hover:border-blue-200">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleHapus(k.id, `${k.tingkat}-${k.nomor_kelas}`, k.jumlah_siswa) }} disabled={isPending || k.jumlah_siswa > 0} className={`h-9 w-9 rounded-xl shadow-sm border border-transparent ${k.jumlah_siswa > 0 ? "text-slate-300" : "text-red-500 hover:text-red-700 hover:bg-red-50 hover:border-red-200"}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* ============================================================================ */}
      {/* BATCH SAVE FLOATING ACTION BAR */}
      {/* ============================================================================ */}
      {Object.keys(pendingChanges).length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-slate-900/95 backdrop-blur-xl border border-slate-700 text-white px-5 py-4 rounded-[2rem] shadow-[0_20px_40px_rgba(0,0,0,0.4)] flex flex-col sm:flex-row items-center gap-4 sm:gap-6 animate-in slide-in-from-bottom-10 fade-in duration-500 w-[90%] sm:w-auto">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-black text-lg border border-blue-500/30 shrink-0">
              {Object.keys(pendingChanges).length}
            </div>
            <div className="text-center sm:text-left">
              <p className="font-bold text-sm sm:text-base leading-tight">Perubahan Belum Disimpan</p>
              <p className="text-xs text-slate-400 mt-0.5">Terapkan perubahan jurusan atau wali kelas ke database.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
            <Button variant="ghost" onClick={() => setPendingChanges({})} disabled={isSavingBatch} className="text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl h-12 flex-1 sm:flex-none">
              Batal
            </Button>
            <Button onClick={executeBatchSave} disabled={isSavingBatch} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl shadow-lg h-12 px-6 font-bold flex-1 sm:flex-none border-0">
              {isSavingBatch ? <><Loader2 className="h-4 w-4 animate-spin mr-2"/> Menyimpan...</> : <><Save className="h-4 w-4 mr-2"/> Simpan Massal</>}
            </Button>
          </div>
        </div>
      )}

    </div>
  )
}