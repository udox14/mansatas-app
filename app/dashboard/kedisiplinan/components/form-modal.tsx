// TIMPA SELURUH ISI FILE INI
// Lokasi: app/dashboard/kedisiplinan/components/form-modal.tsx
'use client'

import { useState, useEffect } from 'react'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Camera, AlertCircle, CheckCircle2, Search } from 'lucide-react'
import { simpanPelanggaran } from '../actions'

const initialState = { error: null as string | null, success: null as string | null }

// ==============================================================================
// HELPER: FUNGSI KOMPRESI GAMBAR (CLIENT-SIDE)
// Mengubah foto 5MB+ menjadi ~150KB tanpa kehilangan kejelasan bukti
// ==============================================================================
const compressImage = async (file: File): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target?.result as string
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX_WIDTH = 1024 // Resolusi aman untuk bukti
        const MAX_HEIGHT = 1024
        let width = img.width
        let height = img.height

        // Kalkulasi rasio aspek
        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width
            width = MAX_WIDTH
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height
            height = MAX_HEIGHT
          }
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx?.drawImage(img, 0, 0, width, height)

        // Konversi ke Blob JPEG Kualitas 70%
        canvas.toBlob(
          (blob) => {
            if (blob) {
              // Ubah ekstensi file asli menjadi .jpg
              const newName = file.name.replace(/\.[^/.]+$/, "") + "_compressed.jpg"
              const newFile = new File([blob], newName, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              })
              resolve(newFile)
            } else {
              resolve(file) // Fallback jika gagal
            }
          },
          'image/jpeg',
          0.7 
        )
      }
      img.onerror = (err) => reject(err)
    }
    reader.onerror = (err) => reject(err)
  })
}

function SubmitBtn({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="w-full bg-rose-600 hover:bg-rose-700 h-14 text-white rounded-2xl shadow-md font-bold mt-4 text-base">
      {pending ? <><Loader2 className="mr-2 h-5 w-5 animate-spin"/> Memproses & Kompresi...</> : isEdit ? 'Simpan Perubahan' : 'Catat Pelanggaran'}
    </Button>
  )
}

export function FormModal({ 
  isOpen, onClose, editData, siswaList, masterList
}: { 
  isOpen: boolean, onClose: () => void, editData: any,
  siswaList: {id: string, nama_lengkap: string, kelas: string}[],
  masterList: {id: string, nama_pelanggaran: string, poin: number}[]
}) {
  const [state, formAction] = useActionState(simpanPelanggaran, initialState)
  const today = new Date().toISOString().split('T')[0]

  // Autocomplete State
  const [searchSiswa, setSearchSiswa] = useState('')
  const [selectedSiswaId, setSelectedSiswaId] = useState('')
  const [showSiswaDropdown, setShowSiswaDropdown] = useState(false)

  const [searchMaster, setSearchMaster] = useState('')
  const [selectedMasterId, setSelectedMasterId] = useState('')
  const [showMasterDropdown, setShowMasterDropdown] = useState(false)

  useEffect(() => {
    if (isOpen && editData) {
      setSelectedSiswaId(editData.siswa_id)
      setSearchSiswa(editData.siswa.nama_lengkap)
      setSelectedMasterId(editData.master_pelanggaran_id)
      setSearchMaster(editData.master_pelanggaran.nama_pelanggaran)
    } else if (isOpen) {
      setSelectedSiswaId(''); setSearchSiswa('')
      setSelectedMasterId(''); setSearchMaster('')
    }
  }, [isOpen, editData])

  useEffect(() => {
    if (state?.success) {
      const timer = setTimeout(() => onClose(), 1500)
      return () => clearTimeout(timer)
    }
  }, [state?.success, onClose])

  // ==============================================================================
  // INTERCEPT FORM SUBMISSION UNTUK KOMPRESI FOTO
  // ==============================================================================
  const clientAction = async (formData: FormData) => {
    const file = formData.get('foto') as File
    
    // Jika user mengunggah file dan file tersebut adalah gambar
    if (file && file.size > 0 && file.type.startsWith('image/')) {
      try {
        const compressedFile = await compressImage(file)
        formData.set('foto', compressedFile) // Timpa file asli dengan file yang sudah dikompres
      } catch (error) {
        console.error('Gagal mengompres gambar', error)
      }
    }
    
    // Lanjutkan eksekusi ke Server Action
    formAction(formData)
  }

  // Filter logika (Dibatasi 20 item agar tidak lag di HP)
  const filteredSiswa = siswaList.filter(s => s.nama_lengkap.toLowerCase().includes(searchSiswa.toLowerCase())).slice(0, 20)
  const filteredMaster = masterList.filter(m => m.nama_pelanggaran.toLowerCase().includes(searchMaster.toLowerCase())).slice(0, 20)

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg rounded-3xl bg-white/95 backdrop-blur-xl shadow-2xl border-slate-200/60 p-4 sm:p-6 max-h-[90vh] overflow-y-auto custom-scrollbar">
        <DialogHeader className="border-b border-slate-100 pb-4">
          <DialogTitle className="text-xl font-bold text-slate-800">
            {editData ? 'Edit Catatan Pelanggaran' : 'Lapor Pelanggaran Baru'}
          </DialogTitle>
        </DialogHeader>

        {/* PERHATIKAN: action diarahkan ke clientAction, BUKAN formAction secara langsung */}
        <form action={clientAction} className="space-y-5 pt-2">
          {state?.error && <div className="p-3 text-sm font-medium text-rose-600 bg-rose-50 rounded-xl border border-rose-100 flex gap-2"><AlertCircle className="h-4 w-4 shrink-0"/> {state.error}</div>}
          {state?.success && <div className="p-3 text-sm font-medium text-emerald-700 bg-emerald-50 rounded-xl border border-emerald-100 flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0"/> {state.success}</div>}

          {editData && <input type="hidden" name="id" value={editData.id} />}
          {editData?.foto_url && <input type="hidden" name="existing_foto_url" value={editData.foto_url} />}
          
          <input type="hidden" name="siswa_id" value={selectedSiswaId} />
          <input type="hidden" name="master_pelanggaran_id" value={selectedMasterId} />

          <div className="space-y-2 relative">
            <Label className="font-bold text-slate-600 text-xs uppercase tracking-wider">Cari Siswa Terlapor <span className="text-rose-500">*</span></Label>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input 
                placeholder="Ketik 3 huruf nama siswa..." 
                value={searchSiswa}
                onChange={(e) => { setSearchSiswa(e.target.value); setShowSiswaDropdown(true); setSelectedSiswaId('') }}
                onFocus={() => setShowSiswaDropdown(true)}
                onBlur={() => setTimeout(() => setShowSiswaDropdown(false), 200)}
                className={`pl-11 h-12 rounded-xl bg-slate-50 focus:bg-white focus:border-rose-500 text-base ${selectedSiswaId ? 'border-emerald-500 ring-1 ring-emerald-500 bg-emerald-50/30' : ''}`}
                required={!selectedSiswaId}
              />
            </div>
            {showSiswaDropdown && searchSiswa.length > 1 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto custom-scrollbar">
                {filteredSiswa.length === 0 ? (
                  <div className="p-4 text-center text-sm text-slate-500">Siswa tidak ditemukan</div>
                ) : (
                  filteredSiswa.map(s => (
                    <div 
                      key={s.id} 
                      onMouseDown={(e) => e.preventDefault()} 
                      onClick={() => { setSelectedSiswaId(s.id); setSearchSiswa(s.nama_lengkap); setShowSiswaDropdown(false) }} 
                      className="p-3 hover:bg-rose-50 cursor-pointer border-b border-slate-50 transition-colors flex justify-between items-center"
                    >
                      <span className="font-bold text-slate-800 text-sm">{s.nama_lengkap}</span>
                      <span className="text-[10px] font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-600">{s.kelas}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="space-y-2 relative">
            <Label className="font-bold text-slate-600 text-xs uppercase tracking-wider">Jenis Kasus Pelanggaran <span className="text-rose-500">*</span></Label>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input 
                placeholder="Ketik kata kunci kasus (contoh: HP, Telat)..." 
                value={searchMaster}
                onChange={(e) => { setSearchMaster(e.target.value); setShowMasterDropdown(true); setSelectedMasterId('') }}
                onFocus={() => setShowMasterDropdown(true)}
                onBlur={() => setTimeout(() => setShowMasterDropdown(false), 200)}
                className={`pl-11 h-12 rounded-xl bg-slate-50 focus:bg-white focus:border-rose-500 text-base ${selectedMasterId ? 'border-emerald-500 ring-1 ring-emerald-500 bg-emerald-50/30' : ''}`}
                required={!selectedMasterId}
              />
            </div>
            {showMasterDropdown && searchMaster.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto custom-scrollbar">
                {filteredMaster.length === 0 ? (
                  <div className="p-4 text-center text-sm text-slate-500">Kasus tidak ditemukan</div>
                ) : (
                  filteredMaster.map(m => (
                    <div 
                      key={m.id} 
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { setSelectedMasterId(m.id); setSearchMaster(m.nama_pelanggaran); setShowMasterDropdown(false) }} 
                      className="p-3 hover:bg-rose-50 cursor-pointer border-b border-slate-50 transition-colors flex justify-between items-center"
                    >
                      <span className="font-bold text-slate-700 text-sm line-clamp-2 pr-2">{m.nama_pelanggaran}</span>
                      <span className="text-[10px] font-black bg-rose-100 text-rose-700 px-2 py-1 rounded shrink-0">+{m.poin} Poin</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-bold text-slate-600 text-xs uppercase tracking-wider">Tanggal Kejadian <span className="text-rose-500">*</span></Label>
              <Input type="date" name="tanggal" defaultValue={editData?.tanggal || today} required className="h-12 rounded-xl bg-slate-50 text-base" />
            </div>
            <div className="space-y-2">
              <Label className="font-bold text-slate-600 text-xs uppercase tracking-wider">Foto Bukti (Otomatis Kompres)</Label>
              <div className="relative">
                <Camera className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input type="file" name="foto" accept="image/*" capture="environment" className="h-12 pl-11 pt-2.5 rounded-xl bg-slate-50 file:hidden cursor-pointer text-sm" />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="font-bold text-slate-600 text-xs uppercase tracking-wider">Keterangan / Kronologi Singkat</Label>
            <Input name="keterangan" defaultValue={editData?.keterangan || ''} placeholder="Opsional: Tertangkap di kantin..." className="h-12 rounded-xl bg-slate-50 text-base" />
          </div>

          <SubmitBtn isEdit={!!editData} />
        </form>
      </DialogContent>
    </Dialog>
  )
}