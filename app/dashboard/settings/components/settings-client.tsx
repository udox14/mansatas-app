// TIMPA SELURUH ISI FILE INI
// Lokasi: app/dashboard/settings/components/settings-client.tsx
'use client'

import { useState, useEffect } from 'react'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area' // <-- PERBAIKAN: Import ScrollArea ditambahkan
import { CalendarDays, Loader2, PlusCircle, CheckCircle2, AlertCircle, Trash2, Power, X, Tags, Edit3 } from 'lucide-react'
import { tambahTahunAjaran, setAktifTahunAjaran, hapusTahunAjaran, simpanDaftarJurusan } from '../actions'

type TAProps = { id: string, nama: string, semester: number, is_active: boolean, daftar_jurusan?: string[] }

const initialState = { error: null as string | null, success: null as string | null }

function SubmitBtn() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-lg h-9 text-sm font-medium transition-colors">
      {pending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : 'Simpan Tahun Ajaran'}
    </Button>
  )
}

export function SettingsClient({ taData }: { taData: TAProps[] }) {
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isPending, setIsPending] = useState(false)
  
  const [state, formAction] = useActionState(tambahTahunAjaran, initialState)

  // <-- PERBAIKAN: Mendefinisikan defaultJurusan
  const defaultJurusan = ['MIPA', 'SOSHUM', 'KEAGAMAAN', 'UMUM'] 

  // ==========================================
  // STATE UNTUK MODAL TAMBAH (JURUSAN DINAMIS)
  // ==========================================
  const [tambahJurusanList, setTambahJurusanList] = useState<string[]>(defaultJurusan)
  const [tambahJurusanInput, setTambahJurusanInput] = useState('')

  // ==========================================
  // STATE UNTUK MODAL EDIT JURUSAN EKSISTING
  // ==========================================
  const [editingTA, setEditingTA] = useState<TAProps | null>(null)
  const [editJurusanList, setEditJurusanList] = useState<string[]>([])
  const [editJurusanInput, setEditJurusanInput] = useState('')
  const [isSavingJurusan, setIsSavingJurusan] = useState(false)

  // --- Fungsi Global Tambah/Hapus Jurusan di Modal ---
  const handleAddJurusan = (isEdit: boolean) => {
    if (isEdit) {
      if (!editJurusanInput.trim()) return
      const clean = editJurusanInput.trim().toUpperCase()
      if (!editJurusanList.includes(clean)) setEditJurusanList([...editJurusanList, clean])
      setEditJurusanInput('')
    } else {
      if (!tambahJurusanInput.trim()) return
      const clean = tambahJurusanInput.trim().toUpperCase()
      if (!tambahJurusanList.includes(clean)) setTambahJurusanList([...tambahJurusanList, clean])
      setTambahJurusanInput('')
    }
  }

  const handleRemoveJurusan = (isEdit: boolean, j: string) => {
    if (j === 'UMUM') { alert('Jurusan UMUM adalah default sistem (Fase E) dan tidak boleh dihapus.'); return }
    if (isEdit) {
      setEditJurusanList(editJurusanList.filter(item => item !== j))
    } else {
      setTambahJurusanList(tambahJurusanList.filter(item => item !== j))
    }
  }

  const submitEditJurusan = async () => {
    if (!editingTA) return
    setIsSavingJurusan(true)
    const res = await simpanDaftarJurusan(editingTA.id, editJurusanList)
    if (res.error) alert(res.error)
    else {
      alert(res.success)
      setEditingTA(null)
    }
    setIsSavingJurusan(false)
  }

  // Auto close & reset modal tambah
  useEffect(() => {
    if (state?.success) {
      const timer = setTimeout(() => {
        setIsAddOpen(false)
        setTambahJurusanList(defaultJurusan) // Reset form ke default
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [state?.success])

  const handleSetAktif = async (id: string) => {
    setIsPending(true)
    const res = await setAktifTahunAjaran(id)
    if (res?.error) alert(res.error)
    setIsPending(false)
  }

  const handleHapusTA = async (id: string, isActive: boolean) => {
    if (!confirm('Yakin ingin menghapus Tahun Ajaran ini?')) return
    setIsPending(true)
    const res = await hapusTahunAjaran(id, isActive)
    if (res?.error) alert(res.error)
    setIsPending(false)
  }

  return (
    <div className="space-y-8 animate-in fade-in">
      
      {/* ============================================================== */}
      {/* KOTAK TAHUN AJARAN */}
      {/* ============================================================== */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
        <div className="p-6 lg:p-8 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-slate-100 rounded-md border border-slate-200"><CalendarDays className="h-4 w-4 text-slate-500"/></div>
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Manajemen Tahun Ajaran & Jurusan</h2>
              <p className="text-sm text-slate-500">Tentukan periode aktif dan konfigurasi jurusan untuk tiap periode.</p>
            </div>
          </div>
          
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-slate-900 hover:bg-slate-800 text-white transition-colors rounded-lg h-9 px-4 text-sm">
                <PlusCircle className="h-4 w-4" /> Tambah Periode Baru
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md rounded-xl border-slate-200">
              <DialogHeader className="border-b border-slate-100 pb-4">
                <DialogTitle className="text-sm font-semibold text-slate-800">Setup Tahun Ajaran & Jurusan</DialogTitle>
              </DialogHeader>
              
              <ScrollArea className="max-h-[70vh] pr-4 py-2">
                <form action={formAction} className="space-y-5">
                  {state?.error && <div className="p-3 text-sm text-rose-600 bg-rose-50 rounded-xl border border-rose-100 flex gap-2"><AlertCircle className="h-4 w-4"/> {state.error}</div>}
                  {state?.success && <div className="p-3 text-sm text-emerald-700 bg-emerald-50 rounded-xl border border-emerald-100 flex gap-2"><CheckCircle2 className="h-4 w-4"/> {state.success}</div>}

                  {/* IDENTITAS TA */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-slate-600">Nama Periode</Label>
                    <Input name="nama" required placeholder="Contoh: 2025/2026" className="h-9 rounded-lg bg-slate-50 focus:bg-white focus:border-slate-400 transition-colors text-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-slate-600">Semester</Label>
                    <Select name="semester" defaultValue="1">
                      <SelectTrigger className="h-9 rounded-lg bg-slate-50 focus:bg-white focus:border-slate-400 transition-colors text-sm"><SelectValue/></SelectTrigger>
                      <SelectContent className="rounded-lg">
                        <SelectItem value="1">Ganjil (1)</SelectItem>
                        <SelectItem value="2">Genap (2)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* SETUP JURUSAN DI DALAM MODAL */}
                  <div className="bg-blue-50/50 border border-blue-100 p-3 rounded-lg space-y-3">
                    <div>
                      <Label className="text-blue-800 font-bold text-sm flex items-center gap-2 mb-1"><Tags className="h-4 w-4" /> Daftar Jurusan (Peminatan)</Label>
                      <p className="text-[11px] text-blue-600/80 leading-tight">Tentukan jurusan apa saja yang dibuka pada tahun ajaran ini. Data ini akan dipakai saat pembuatan kelas dan plotting.</p>
                    </div>

                    <div className="flex gap-2">
                      <Input 
                        value={tambahJurusanInput} 
                        onChange={e => setTambahJurusanInput(e.target.value)} 
                        onKeyDown={e => { if(e.key === 'Enter') { e.preventDefault(); handleAddJurusan(false); } }}
                        placeholder="Ketik lalu Enter..." 
                        className="h-9 rounded-lg bg-white border-blue-200 text-sm"
                      />
                      <Button type="button" onClick={() => handleAddJurusan(false)} className="h-9 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium">Tambah</Button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {tambahJurusanList.map(jur => (
                        <div key={jur} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border shadow-sm font-bold text-xs tracking-wide ${jur === 'UMUM' ? 'bg-slate-200 text-slate-600 border-slate-300' : 'bg-white text-blue-700 border-blue-200'}`}>
                          {jur}
                          {jur !== 'UMUM' && (
                            <button type="button" onClick={() => handleRemoveJurusan(false, jur)} className="text-slate-400 hover:text-rose-500 transition-colors"><X className="h-3 w-3"/></button>
                          )}
                        </div>
                      ))}
                    </div>
                    {/* Hidden input agar masuk ke Server Action */}
                    <input type="hidden" name="daftar_jurusan" value={JSON.stringify(tambahJurusanList)} />
                  </div>

                  <div className="pt-2"><SubmitBtn /></div>
                </form>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </div>

        <div className="p-0">
          {taData.length === 0 ? (
            <div className="p-12 text-center text-slate-500">Belum ada data Tahun Ajaran.</div>
          ) : (
            taData.map((ta) => (
              <div key={ta.id} className={`flex flex-col xl:flex-row items-start xl:items-center justify-between p-5 border-b border-slate-100 last:border-0 transition-colors ${ta.is_active ? 'bg-emerald-50/30' : 'hover:bg-slate-50/50'}`}>
                
                {/* IDENTITAS TA & BADGES JURUSAN */}
                <div className="flex items-start gap-4 mb-4 xl:mb-0">
                  <div className={`mt-1 h-9 w-9 shrink-0 rounded-full flex items-center justify-center font-bold text-sm border-2 ${ta.is_active ? 'bg-emerald-500 text-white border-emerald-300' : 'bg-slate-100 text-slate-400 border-white'}`}>
                    {ta.semester}
                  </div>
                  <div>
                    <h3 className={`font-bold text-lg leading-tight ${ta.is_active ? 'text-emerald-900' : 'text-slate-800'}`}>{ta.nama}</h3>
                    <p className="text-sm font-medium text-slate-500 mb-2">Semester {ta.semester === 1 ? 'Ganjil' : 'Genap'}</p>
                    
                    {/* Menampilkan list jurusan yang nempel di TA ini */}
                    <div className="flex flex-wrap gap-1.5">
                      {ta.daftar_jurusan?.map((jur: string) => (
                         <span key={jur} className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${ta.is_active ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                           {jur}
                         </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* TOMBOL AKSI */}
                <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto mt-2 xl:mt-0">
                  {/* Tombol Edit Jurusan */}
                  <Button 
                    variant="outline" 
                    onClick={() => { setEditingTA(ta); setEditJurusanList(ta.daftar_jurusan || defaultJurusan); }} 
                    className="flex-1 xl:flex-none h-10 rounded-xl border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    <Edit3 className="h-4 w-4 mr-2" /> Edit Jurusan
                  </Button>

                  {ta.is_active ? (
                    <span className="flex-1 xl:flex-none text-center px-4 py-2.5 rounded-xl bg-emerald-100 text-emerald-700 font-bold text-sm border border-emerald-200 flex items-center justify-center gap-2">
                      <CheckCircle2 className="h-4 w-4"/> Aktif Saat Ini
                    </span>
                  ) : (
                    <>
                      <Button variant="outline" onClick={() => handleSetAktif(ta.id)} disabled={isPending} className="flex-1 xl:flex-none gap-2 rounded-xl h-10 border-slate-200 text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 transition-colors">
                        <Power className="h-4 w-4"/> Aktifkan
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleHapusTA(ta.id, ta.is_active)} disabled={isPending} className="h-10 w-10 rounded-xl text-rose-500 hover:bg-rose-50 hover:text-rose-600 border border-transparent hover:border-rose-100">
                        <Trash2 className="h-4 w-4"/>
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* MODAL EDIT JURUSAN UNTUK TA TERTENTU */}
      {/* ============================================================== */}
      <Dialog open={!!editingTA} onOpenChange={(open) => !open && setEditingTA(null)}>
        <DialogContent className="sm:max-w-md rounded-xl border-slate-200">
          <DialogHeader className="border-b border-slate-100 pb-4">
            <DialogTitle className="text-sm font-semibold text-slate-800">Edit Jurusan — TA {editingTA?.nama}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            <div className="bg-blue-50/50 border border-blue-100 p-3 rounded-lg space-y-3">
              <div>
                <Label className="text-blue-800 font-bold text-sm flex items-center gap-2 mb-1"><Tags className="h-4 w-4" /> Daftar Jurusan Terkini</Label>
                <p className="text-[11px] text-blue-600/80 leading-tight">Peringatan: Menghapus jurusan tidak merusak data kelas lama, hanya menghilangkan dari opsi Dropdown di masa depan.</p>
              </div>

              <div className="flex gap-2">
                <Input 
                  value={editJurusanInput} 
                  onChange={e => setEditJurusanInput(e.target.value)} 
                  onKeyDown={e => { if(e.key === 'Enter') { e.preventDefault(); handleAddJurusan(true); } }}
                  placeholder="Ketik lalu Enter..." 
                  className="h-9 rounded-lg bg-white border-blue-200 text-sm"
                />
                <Button type="button" onClick={() => handleAddJurusan(true)} className="h-9 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium">Tambah</Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {editJurusanList.map(jur => (
                  <div key={jur} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border shadow-sm font-bold text-xs tracking-wide ${jur === 'UMUM' ? 'bg-slate-200 text-slate-600 border-slate-300' : 'bg-white text-blue-700 border-blue-200'}`}>
                    {jur}
                    {jur !== 'UMUM' && (
                      <button type="button" onClick={() => handleRemoveJurusan(true, jur)} className="text-slate-400 hover:text-rose-500 transition-colors"><X className="h-3 w-3"/></button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            
            <Button onClick={submitEditJurusan} disabled={isSavingJurusan} className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-lg h-9 text-sm font-medium transition-colors">
              {isSavingJurusan ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : 'Simpan Perubahan'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}