// Lokasi: app/dashboard/kedisiplinan/components/form-modal.tsx
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Camera, AlertCircle, CheckCircle2, Search, ShieldAlert } from 'lucide-react'
import { simpanPelanggaran, searchSiswa } from '../actions'
import { todayWIB } from '@/lib/time'

const initialState = { error: null as string | null, success: null as string | null, naik_sanksi: null as { nama: string; deskripsi?: string; total_poin: number } | null }

const compressImage = async (file: File): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target?.result as string
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX = 1024
        let w = img.width, h = img.height
        if (w > h) { if (w > MAX) { h *= MAX / w; w = MAX } }
        else { if (h > MAX) { w *= MAX / h; h = MAX } }
        canvas.width = w; canvas.height = h
        canvas.getContext('2d')?.drawImage(img, 0, 0, w, h)
        canvas.toBlob(blob => {
          if (blob) resolve(new File([blob], file.name.replace(/\.[^/.]+$/, '') + '_c.jpg', { type: 'image/jpeg', lastModified: Date.now() }))
          else resolve(file)
        }, 'image/jpeg', 0.7)
      }
      img.onerror = reject
    }
    reader.onerror = reject
  })
}

function SubmitBtn({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="w-full h-9 text-sm bg-rose-600 hover:bg-rose-700 text-white rounded-md mt-2">
      {pending ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Memproses...</> : isEdit ? 'Simpan Perubahan' : 'Catat Pelanggaran'}
    </Button>
  )
}

export function FormModal({ isOpen, onClose, editData, masterList }: {
  isOpen: boolean; onClose: () => void; editData: any
  masterList: { id: string; nama_pelanggaran: string; poin: number }[]
}) {
  const [state, formAction] = useActionState(simpanPelanggaran, initialState)
  const [sanksiNotif, setSanksiNotif] = useState<{ nama: string; deskripsi?: string; total_poin: number } | null>(null)
  const today = todayWIB()

  const [searchSiswaQuery, setSearchSiswaQuery] = useState('')
  const [selectedSiswaId, setSelectedSiswaId] = useState('')
  const [showSiswaDropdown, setShowSiswaDropdown] = useState(false)
  const [siswaResults, setSiswaResults] = useState<{ id: string; nama_lengkap: string; kelas: string }[]>([])
  const [isSearchingSiswa, setIsSearchingSiswa] = useState(false)
  const siswaDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [searchMaster, setSearchMaster] = useState('')
  const [selectedMasterId, setSelectedMasterId] = useState('')
  const [showMasterDropdown, setShowMasterDropdown] = useState(false)

  const handleSiswaInput = useCallback((val: string) => {
    setSearchSiswaQuery(val); setSelectedSiswaId(''); setShowSiswaDropdown(true)
    if (siswaDebounce.current) clearTimeout(siswaDebounce.current)
    if (val.length < 2) { setSiswaResults([]); return }
    siswaDebounce.current = setTimeout(async () => {
      setIsSearchingSiswa(true)
      try { setSiswaResults(await searchSiswa(val)) } finally { setIsSearchingSiswa(false) }
    }, 300)
  }, [])

  useEffect(() => {
    if (isOpen && editData) {
      setSelectedSiswaId(editData.siswa_id); setSearchSiswaQuery(editData.siswa.nama_lengkap)
      setSelectedMasterId(editData.master_pelanggaran_id); setSearchMaster(editData.master_pelanggaran.nama_pelanggaran)
    } else if (isOpen) {
      setSelectedSiswaId(''); setSearchSiswaQuery(''); setSiswaResults([])
      setSelectedMasterId(''); setSearchMaster('')
    }
  }, [isOpen, editData])

  // Naik sanksi notification
  useEffect(() => {
    if (state?.naik_sanksi) setSanksiNotif(state.naik_sanksi)
  }, [state?.naik_sanksi])

  // Jika sukses DAN ini mode edit → tutup modal. Jika sukses mode tambah baru → JANGAN tutup, biarkan lapor lagi
  useEffect(() => {
    if (state?.success && editData) {
      const t = setTimeout(() => onClose(), 1200)
      return () => clearTimeout(t)
    }
    // Mode tambah baru: reset field setelah sukses agar bisa lapor lagi tanpa refresh
    if (state?.success && !editData) {
      const t = setTimeout(() => {
        setSelectedSiswaId(''); setSearchSiswaQuery(''); setSiswaResults([])
        setSelectedMasterId(''); setSearchMaster('')
      }, 1500)
      return () => clearTimeout(t)
    }
  }, [state?.success, editData, onClose])


  const clientAction = async (formData: FormData) => {
    const file = formData.get('foto') as File
    if (file && file.size > 0 && file.type.startsWith('image/')) {
      try { formData.set('foto', await compressImage(file)) } catch {}
    }
    formAction(formData)
  }

  const filteredMaster = masterList.filter(m => m.nama_pelanggaran.toLowerCase().includes(searchMaster.toLowerCase())).slice(0, 20)

  return (
    <>
    {/* Sanksi naik notification */}
    <Dialog open={!!sanksiNotif} onOpenChange={open => !open && setSanksiNotif(null)}>
      <DialogContent className="sm:max-w-sm rounded-2xl text-center p-0 gap-0 overflow-hidden">
        <div className="bg-gradient-to-br from-rose-500 to-orange-500 px-6 pt-8 pb-6">
          <div className="mx-auto mb-3 h-14 w-14 rounded-full bg-white/20 flex items-center justify-center">
            <ShieldAlert className="h-7 w-7 text-white" />
          </div>
          <DialogTitle className="text-white text-lg font-black">Sanksi Baru!</DialogTitle>
          <p className="text-white/80 text-sm mt-1">Siswa ini telah mencapai sanksi</p>
        </div>
        <div className="px-6 py-5 space-y-3">
          <p className="text-2xl font-black text-slate-800 dark:text-slate-100">{sanksiNotif?.nama}</p>
          {sanksiNotif?.deskripsi && <p className="text-sm text-slate-500 dark:text-slate-400">{sanksiNotif.deskripsi}</p>}
          <p className="text-xs text-slate-400 dark:text-slate-500">Total akumulasi poin: <strong className="text-rose-600">{sanksiNotif?.total_poin} poin</strong></p>
          <Button onClick={() => setSanksiNotif(null)} className="w-full bg-rose-600 hover:bg-rose-700 text-white text-sm rounded-xl">
            Mengerti
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-lg rounded-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b pb-3">
          <DialogTitle className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {editData ? 'Edit Catatan Pelanggaran' : 'Lapor Pelanggaran Baru'}
          </DialogTitle>
        </DialogHeader>
        <form action={clientAction} className="space-y-3 pt-1">
          {state?.error && <div className="p-2.5 text-xs text-rose-600 bg-rose-50 rounded-lg border border-rose-100 flex gap-2"><AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />{state.error}</div>}
          {state?.success && <div className="p-2.5 text-xs text-emerald-700 bg-emerald-50 rounded-lg border border-emerald-100 flex gap-2"><CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />{state.success}</div>}

          {editData && <input type="hidden" name="id" value={editData.id} />}
          {editData?.foto_url && <input type="hidden" name="existing_foto_url" value={editData.foto_url} />}
          <input type="hidden" name="siswa_id" value={selectedSiswaId} />
          <input type="hidden" name="master_pelanggaran_id" value={selectedMasterId} />

          <div className="space-y-1.5 relative">
            <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300 dark:text-slate-600">Siswa Terlapor <span className="text-rose-500">*</span></Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
              <Input placeholder="Ketik min. 2 huruf nama siswa..." value={searchSiswaQuery}
                onChange={e => handleSiswaInput(e.target.value)}
                onFocus={() => setShowSiswaDropdown(true)}
                onBlur={() => setTimeout(() => setShowSiswaDropdown(false), 200)}
                className={`pl-8 h-8 text-sm rounded-md bg-surface-2 ${selectedSiswaId ? 'border-emerald-400 bg-emerald-50/30' : ''}`} />
              {isSearchingSiswa && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-slate-400 dark:text-slate-500" />}
            </div>
            {showSiswaDropdown && searchSiswaQuery.length > 1 && (
              <div className="absolute z-50 w-full mt-1 bg-surface border border-surface rounded-lg shadow-lg max-h-52 overflow-y-auto">
                {siswaResults.length === 0 && !isSearchingSiswa
                  ? <div className="p-3 text-xs text-center text-slate-400 dark:text-slate-500">Siswa tidak ditemukan</div>
                  : siswaResults.map(s => (
                    <div key={s.id} onMouseDown={e => e.preventDefault()}
                      onClick={() => { setSelectedSiswaId(s.id); setSearchSiswaQuery(s.nama_lengkap); setShowSiswaDropdown(false) }}
                      className="px-3 py-2 hover:bg-rose-50 cursor-pointer border-b border-slate-50 flex justify-between items-center">
                      <span className="text-xs font-medium text-slate-800 dark:text-slate-100">{s.nama_lengkap}</span>
                      <span className="text-[10px] font-bold bg-surface-3 px-1.5 py-0.5 rounded text-slate-500 dark:text-slate-400 dark:text-slate-500 shrink-0 ml-2">{s.kelas}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5 relative">
            <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300 dark:text-slate-600">Jenis Pelanggaran <span className="text-rose-500">*</span></Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
              <Input placeholder="Cari jenis kasus (HP, Telat, ...)" value={searchMaster}
                onChange={e => { setSearchMaster(e.target.value); setShowMasterDropdown(true); setSelectedMasterId('') }}
                onFocus={() => setShowMasterDropdown(true)}
                onBlur={() => setTimeout(() => setShowMasterDropdown(false), 200)}
                className={`pl-8 h-8 text-sm rounded-md bg-surface-2 ${selectedMasterId ? 'border-emerald-400 bg-emerald-50/30' : ''}`} />
            </div>
            {showMasterDropdown && searchMaster.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-surface border border-surface rounded-lg shadow-lg max-h-52 overflow-y-auto">
                {filteredMaster.length === 0
                  ? <div className="p-3 text-xs text-center text-slate-400 dark:text-slate-500">Kasus tidak ditemukan</div>
                  : filteredMaster.map(m => (
                    <div key={m.id} onMouseDown={e => e.preventDefault()}
                      onClick={() => { setSelectedMasterId(m.id); setSearchMaster(m.nama_pelanggaran); setShowMasterDropdown(false) }}
                      className="px-3 py-2 hover:bg-rose-50 cursor-pointer border-b border-slate-50 flex justify-between items-center gap-2">
                      <span className="text-xs text-slate-700 dark:text-slate-200 line-clamp-1">{m.nama_pelanggaran}</span>
                      <span className="text-[10px] font-bold bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded shrink-0">+{m.poin}p</span>
                    </div>
                  ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300 dark:text-slate-600">Tanggal <span className="text-rose-500">*</span></Label>
              <Input type="date" name="tanggal" defaultValue={editData?.tanggal || today} required className="h-8 text-xs rounded-md bg-surface-2" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300 dark:text-slate-600">Foto Bukti <span className="text-slate-400 dark:text-slate-500 font-normal">(otomatis kompres)</span></Label>
              <div className="relative">
                <Camera className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                <Input type="file" name="foto" accept="image/*" capture="environment"
                  className="h-8 pl-8 pt-1 text-xs rounded-md bg-surface-2 file:hidden cursor-pointer" />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300 dark:text-slate-600">Keterangan <span className="text-slate-400 dark:text-slate-500 font-normal">(opsional)</span></Label>
            <Input name="keterangan" defaultValue={editData?.keterangan || ''} placeholder="Kronologi singkat..." className="h-8 text-sm rounded-md bg-surface-2" />
          </div>

          <SubmitBtn isEdit={!!editData} />
        </form>
      </DialogContent>
    </Dialog>
    </>
  )
}
