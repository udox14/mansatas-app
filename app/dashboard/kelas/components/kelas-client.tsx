// Lokasi: app/dashboard/kelas/components/kelas-client.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Trash2, Users, ChevronRight, UserCircle, Library, Pencil, AlertTriangle, Save, Loader2, ChevronDown } from 'lucide-react'
import { TambahModal } from './tambah-modal'
import { ImportModal } from './import-modal'
import { EditModal } from './edit-modal'
import { hapusKelas, batchUpdateKelas } from '../actions'
import { cn } from '@/lib/utils'

type KelasData = {
  id: string; tingkat: number; nomor_kelas: string; kelompok: string
  kapasitas: number; wali_kelas_id: string; wali_kelas_nama: string; jumlah_siswa: number
}
type GuruType = { id: string; nama_lengkap: string }

function WaliKelasSelector({ value, onChange, daftarGuru, disabled }: { value: string, onChange: (v: string) => void, daftarGuru: GuruType[], disabled: boolean }) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const selected = daftarGuru.find(g => g.id === value)
  const filtered = daftarGuru.filter(g => g.nama_lengkap.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center justify-between w-full h-8 px-2.5 border rounded text-xs font-medium transition-colors disabled:opacity-50",
          isOpen ? 'bg-surface border-blue-400 ring-1 ring-blue-200' : 'bg-surface-2 border-surface hover:bg-surface text-slate-700 dark:text-slate-200'
        )}
      >
        <span className="truncate">{selected ? selected.nama_lengkap : <span className="text-slate-400 dark:text-slate-500 italic">— Kosong —</span>}</span>
        <ChevronDown className="h-3 w-3 text-slate-400 dark:text-slate-500 shrink-0 ml-1" />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute z-50 top-full left-0 mt-1 w-full min-w-[200px] bg-surface border border-surface rounded-lg shadow-lg overflow-hidden">
            <div className="p-1.5 border-b border-surface-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 dark:text-slate-500" />
                <Input autoFocus placeholder="Cari guru..." value={search} onChange={e => setSearch(e.target.value)} className="pl-7 h-7 text-xs rounded border-surface" />
              </div>
            </div>
            <div className="max-h-44 overflow-y-auto p-1 space-y-0.5">
              <div onClick={() => { onChange('none'); setIsOpen(false) }} className="px-2.5 py-1.5 text-xs text-slate-400 dark:text-slate-500 italic hover:bg-surface-2 rounded cursor-pointer">— Kosongkan —</div>
              {filtered.map(g => (
                <div key={g.id} onClick={() => { onChange(g.id); setIsOpen(false) }}
                  className={cn("px-2.5 py-1.5 text-xs rounded cursor-pointer transition-colors", value === g.id ? 'bg-blue-50 text-blue-700 font-semibold' : 'hover:bg-surface-2 text-slate-700 dark:text-slate-200')}
                >{g.nama_lengkap}</div>
              ))}
              {filtered.length === 0 && <div className="px-2.5 py-3 text-center text-xs text-slate-400 dark:text-slate-500">Tidak ditemukan</div>}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export function KelasClient({ initialData, daftarGuru, daftarJurusan = [] }: { initialData: KelasData[], daftarGuru: GuruType[], daftarJurusan?: string[] }) {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState('')
  const [filterTingkat, setFilterTingkat] = useState('Semua')
  const [isPending, setIsPending] = useState(false)
  const [editingKelas, setEditingKelas] = useState<KelasData | null>(null)
  const [pendingChanges, setPendingChanges] = useState<Record<string, { kelompok?: string; wali_kelas_id?: string }>>({})
  const [isSavingBatch, setIsSavingBatch] = useState(false)

  const handleQueueChange = (id: string, field: 'kelompok' | 'wali_kelas_id', value: string) => {
    setPendingChanges(prev => ({ ...prev, [id]: { ...(prev[id] || {}), [field]: value } }))
  }
  const getValue = (id: string, field: 'kelompok' | 'wali_kelas_id', orig: string) =>
    pendingChanges[id]?.[field] !== undefined ? pendingChanges[id][field] : orig

  const executeBatchSave = async () => {
    setIsSavingBatch(true)
    const updates = Object.entries(pendingChanges).map(([id, changes]) => ({ id, ...changes }))
    const res = await batchUpdateKelas(updates)
    if (res.error) alert(res.error)
    else setPendingChanges({})
    setIsSavingBatch(false)
  }

  const filteredData = initialData.filter(k => {
    const matchTingkat = filterTingkat === 'Semua' || k.tingkat.toString() === filterTingkat
    const matchSearch = `${k.tingkat} ${k.kelompok} ${k.nomor_kelas}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      k.wali_kelas_nama.toLowerCase().includes(searchTerm.toLowerCase())
    return matchTingkat && matchSearch
  })

  const sortedData = [...filteredData].sort((a, b) =>
    `${a.tingkat} ${a.kelompok} ${a.nomor_kelas}`.localeCompare(`${b.tingkat} ${b.kelompok} ${b.nomor_kelas}`, undefined, { numeric: true, sensitivity: 'base' })
  )

  const handleHapus = async (id: string, namaKelas: string, jumlahSiswa: number) => {
    if (jumlahSiswa > 0) { alert(`Tidak bisa menghapus kelas ${namaKelas} karena masih ada ${jumlahSiswa} siswa.`); return }
    if (!confirm(`Yakin ingin menghapus kelas ${namaKelas}?`)) return
    setIsPending(true)
    const res = await hapusKelas(id)
    if (res?.error) alert(res.error)
    setIsPending(false)
  }

  return (
    <div className="space-y-3 pb-20">
      <EditModal isOpen={!!editingKelas} onClose={() => setEditingKelas(null)} kelasData={editingKelas} daftarGuru={daftarGuru} daftarJurusan={daftarJurusan} />

      {/* TOOLBAR */}
      <div className="bg-surface border border-surface rounded-lg p-3 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-0" style={{ minWidth: '140px' }}>
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
          <Input placeholder="Cari kelas atau wali..." className="pl-8 h-8 text-sm rounded-md" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <Select value={filterTingkat} onValueChange={setFilterTingkat}>
          <SelectTrigger className="h-8 w-32 text-xs rounded-md shrink-0"><SelectValue placeholder="Tingkat" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Semua">Semua</SelectItem>
            <SelectItem value="10">Kelas 10</SelectItem>
            <SelectItem value="11">Kelas 11</SelectItem>
            <SelectItem value="12">Kelas 12</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-2 ml-auto">
          <ImportModal />
          <TambahModal daftarGuru={daftarGuru} daftarJurusan={daftarJurusan} />
        </div>
      </div>

      {/* SUMMARY STRIP */}
      <div className="flex gap-3">
        <div className="flex items-center gap-2 bg-surface border border-surface rounded-lg px-3 py-2">
          <Library className="h-4 w-4 text-blue-500" />
          <span className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">Total Kelas</span>
          <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{sortedData.length}</span>
        </div>
        <div className="flex items-center gap-2 bg-surface border border-surface rounded-lg px-3 py-2">
          <Users className="h-4 w-4 text-emerald-500" />
          <span className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">Siswa</span>
          <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{sortedData.reduce((a, k) => a + k.jumlah_siswa, 0)}</span>
        </div>
      </div>

      {/* MOBILE CARDS */}
      <div className="block xl:hidden space-y-2">
        {sortedData.length === 0 ? (
          <div className="bg-surface py-10 rounded-lg border border-surface text-center">
            <Library className="h-7 w-7 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-400 dark:text-slate-500">Belum ada kelas.</p>
          </div>
        ) : sortedData.map(k => {
          const isFull = k.jumlah_siswa >= k.kapasitas
          const pct = Math.min(Math.round((k.jumlah_siswa / k.kapasitas) * 100), 100)
          const currentKelompok = getValue(k.id, 'kelompok', k.kelompok)
          const currentWali = getValue(k.id, 'wali_kelas_id', k.wali_kelas_id)
          const isPending = !!pendingChanges[k.id]
          const isJurusanValid = currentKelompok === 'UMUM' || daftarJurusan.includes(currentKelompok)

          return (
            <div key={k.id} className={cn(
              "bg-surface border rounded-lg p-3 space-y-2.5 transition-colors",
              isPending ? 'border-blue-300 bg-blue-50/30' : !isJurusanValid ? 'border-rose-300 bg-rose-50/20' : 'border-surface'
            )}>
              {/* Header row */}
              <div className="flex items-center justify-between cursor-pointer" onClick={() => router.push(`/dashboard/kelas/${k.id}`)}>
                <div>
                  <span className="text-lg font-bold text-slate-800 dark:text-slate-100">{k.tingkat}-{k.nomor_kelas}</span>
                  {!isJurusanValid && (
                    <span className="ml-2 text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                      <AlertTriangle className="h-2.5 w-2.5 inline mr-0.5" />Usang
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("text-xs font-semibold px-2 py-0.5 rounded border", isFull ? 'bg-red-50 text-red-600 border-red-200' : 'bg-surface-2 text-slate-600 dark:text-slate-300 dark:text-slate-600 border-surface')}>
                    {k.jumlah_siswa}/{k.kapasitas}
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-1 bg-surface-3 rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full", isFull ? 'bg-red-500' : 'bg-blue-500')} style={{ width: `${pct}%` }} />
              </div>

              {/* Editable fields */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 mb-1">Jurusan</p>
                  <Select value={currentKelompok} onValueChange={v => handleQueueChange(k.id, 'kelompok', v)} disabled={isSavingBatch}>
                    <SelectTrigger className={cn("h-8 text-xs rounded", pendingChanges[k.id]?.kelompok !== undefined ? 'bg-blue-50 border-blue-300 text-blue-700' : !isJurusanValid ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-surface-2 border-surface')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>{daftarJurusan.map(j => <SelectItem key={j} value={j} className="text-xs">{j}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 mb-1">Wali Kelas</p>
                  <WaliKelasSelector value={currentWali} onChange={v => handleQueueChange(k.id, 'wali_kelas_id', v)} daftarGuru={daftarGuru} disabled={isSavingBatch} />
                </div>
              </div>

              {/* Action row */}
              <div className="flex justify-end gap-1.5 pt-1 border-t border-surface-2">
                <button onClick={() => setEditingKelas(k)} className="p-1.5 rounded text-blue-600 hover:bg-blue-50 transition-colors">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleHapus(k.id, `${k.tingkat}-${k.nomor_kelas}`, k.jumlah_siswa)}
                  disabled={k.jumlah_siswa > 0}
                  className={cn("p-1.5 rounded transition-colors", k.jumlah_siswa > 0 ? 'text-slate-300 dark:text-slate-600' : 'text-rose-500 hover:bg-rose-50')}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* DESKTOP TABLE */}
      <div className="hidden xl:block bg-surface rounded-lg border border-surface overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-surface-2 hover:bg-surface-2">
              <TableHead className="h-9 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500 w-32">Kelas</TableHead>
              <TableHead className="h-9 text-xs font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500 w-44">Jurusan</TableHead>
              <TableHead className="h-9 text-xs font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500">Wali Kelas</TableHead>
              <TableHead className="h-9 text-xs font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500 text-center w-36">Keterisian</TableHead>
              <TableHead className="h-9 text-xs font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500 text-right px-4 w-20">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="h-24 text-center text-sm text-slate-400 dark:text-slate-500">Belum ada data kelas.</TableCell></TableRow>
            ) : sortedData.map(k => {
              const isFull = k.jumlah_siswa >= k.kapasitas
              const pct = Math.min(Math.round((k.jumlah_siswa / k.kapasitas) * 100), 100)
              const currentKelompok = getValue(k.id, 'kelompok', k.kelompok)
              const currentWali = getValue(k.id, 'wali_kelas_id', k.wali_kelas_id)
              const isRowPending = !!pendingChanges[k.id]
              const isJurusanValid = currentKelompok === 'UMUM' || daftarJurusan.includes(currentKelompok)

              return (
                <TableRow key={k.id} className={cn(
                  "border-surface-2 group transition-colors",
                  isRowPending ? 'bg-blue-50/40 border-l-2 border-l-blue-400' : 'hover:bg-surface-2/60'
                )}>
                  <TableCell className="px-4 py-2.5 cursor-pointer" onClick={() => router.push(`/dashboard/kelas/${k.id}`)}>
                    <span className="text-base font-bold text-slate-800 dark:text-slate-100 group-hover:text-blue-700 transition-colors">
                      {k.tingkat}-{k.nomor_kelas}
                    </span>
                    {!isJurusanValid && <AlertTriangle className="h-3 w-3 text-rose-500 inline ml-1" />}
                  </TableCell>
                  <TableCell className="py-2.5">
                    <Select value={currentKelompok} onValueChange={v => handleQueueChange(k.id, 'kelompok', v)} disabled={isSavingBatch}>
                      <SelectTrigger className={cn("h-7 w-36 text-xs rounded", pendingChanges[k.id]?.kelompok !== undefined ? 'bg-blue-50 border-blue-300 text-blue-700' : !isJurusanValid ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-surface-2 border-surface')}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>{daftarJurusan.map(j => <SelectItem key={j} value={j} className="text-xs">{j}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="py-2.5">
                    <div className="flex items-center gap-2">
                      <UserCircle className={cn("h-4 w-4 shrink-0", pendingChanges[k.id]?.wali_kelas_id !== undefined ? 'text-blue-500' : currentWali === 'none' ? 'text-slate-300 dark:text-slate-600' : 'text-emerald-500')} />
                      <div className="w-52">
                        <WaliKelasSelector value={currentWali} onChange={v => handleQueueChange(k.id, 'wali_kelas_id', v)} daftarGuru={daftarGuru} disabled={isSavingBatch} />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-2.5">
                    <div className="flex flex-col items-center gap-1">
                      <span className={cn("text-xs font-semibold px-2 py-0.5 rounded border", isFull ? 'bg-red-50 text-red-600 border-red-200' : 'bg-surface-2 text-slate-600 dark:text-slate-300 dark:text-slate-600 border-surface')}>
                        {k.jumlah_siswa} / {k.kapasitas}
                      </span>
                      <div className="w-20 h-1.5 bg-surface-3 rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full", isFull ? 'bg-red-500' : 'bg-blue-500')} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-2.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={e => { e.stopPropagation(); setEditingKelas(k) }} className="p-1.5 rounded text-blue-600 hover:bg-blue-50" title="Edit">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); handleHapus(k.id, `${k.tingkat}-${k.nomor_kelas}`, k.jumlah_siswa) }}
                        disabled={k.jumlah_siswa > 0}
                        className={cn("p-1.5 rounded", k.jumlah_siswa > 0 ? 'text-slate-300 dark:text-slate-600' : 'text-rose-500 hover:bg-rose-50')}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* BATCH SAVE FAB */}
      {Object.keys(pendingChanges).length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 border border-slate-700 w-[calc(100%-2rem)] sm:w-auto">
          <div className="h-6 w-6 rounded-full bg-blue-500/20 text-blue-300 flex items-center justify-center text-xs font-bold border border-blue-500/30 shrink-0">
            {Object.keys(pendingChanges).length}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold leading-tight">Perubahan belum disimpan</p>
          </div>
          <div className="flex gap-1.5">
            <Button variant="ghost" size="sm" onClick={() => setPendingChanges({})} disabled={isSavingBatch} className="h-7 text-xs text-slate-400 dark:text-slate-500 hover:text-white hover:bg-slate-800 rounded">
              Batal
            </Button>
            <Button size="sm" onClick={executeBatchSave} disabled={isSavingBatch} className="h-7 text-xs bg-blue-600 hover:bg-blue-500 rounded px-3">
              {isSavingBatch ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />Menyimpan</> : <><Save className="h-3 w-3 mr-1" />Simpan</>}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}