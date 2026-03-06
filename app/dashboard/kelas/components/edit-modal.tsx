// BUAT FILE BARU
// Lokasi: app/dashboard/kelas/components/edit-modal.tsx
'use client'

import { useEffect } from 'react'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Pencil, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { editKelasForm } from '../actions'

const initialState = { error: null as string | null, success: null as string | null }

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md h-12 text-base font-bold transition-all">
      {pending ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Menyimpan...</> : 'Simpan Perubahan Kelas'}
    </Button>
  )
}

export function EditModal({
  isOpen, onClose, kelasData, daftarGuru = [], daftarJurusan = []
}: {
  isOpen: boolean, onClose: () => void, kelasData: any, daftarGuru?: any[], daftarJurusan?: string[]
}) {
  const [state, formAction] = useActionState(editKelasForm, initialState)

  useEffect(() => {
    if (state?.success) {
      const timer = setTimeout(() => onClose(), 1500)
      return () => clearTimeout(timer)
    }
  }, [state?.success, onClose])

  if (!kelasData) return null

  // Cek apakah jurusan lama masih ada di pengaturan
  const isJurusanUsang = kelasData.kelompok !== 'UMUM' && !daftarJurusan.includes(kelasData.kelompok)

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md rounded-3xl bg-white/95 backdrop-blur-xl border-slate-200/60 shadow-xl">
        <DialogHeader className="border-b border-slate-100 pb-4">
          <DialogTitle className="text-xl font-bold flex items-center gap-2 text-slate-800">
            <Pencil className="h-5 w-5 text-blue-600" /> Edit Rombongan Belajar
          </DialogTitle>
        </DialogHeader>
        
        <form action={formAction} className="space-y-5 pt-2">
          <input type="hidden" name="id" value={kelasData.id} />

          {state?.error && <div className="p-3 text-sm font-medium text-rose-600 bg-rose-50 rounded-xl border border-rose-100 flex items-start gap-2"><AlertCircle className="h-4 w-4 shrink-0 mt-0.5"/> {state.error}</div>}
          {state?.success && <div className="p-3 text-sm font-medium text-emerald-700 bg-emerald-50 rounded-xl border border-emerald-100 flex items-start gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5"/> {state.success}</div>}

          {isJurusanUsang && !state?.success && (
            <div className="p-3 text-xs font-bold text-rose-700 bg-rose-50 rounded-xl border border-rose-200 flex items-start gap-2 animate-pulse">
              <AlertCircle className="h-4 w-4 shrink-0"/> 
              Jurusan "{kelasData.kelompok}" sudah tidak ada di Pengaturan. Harap pilih jurusan baru yang valid di bawah!
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-600 font-bold text-xs uppercase tracking-wider">Tingkat <span className="text-rose-500">*</span></Label>
              <Select name="tingkat" defaultValue={kelasData.tingkat.toString()} required>
                <SelectTrigger className="h-11 rounded-xl bg-slate-50 border-slate-200 focus:border-blue-500 transition-colors">
                  <SelectValue placeholder="Pilih" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="10">Kelas 10</SelectItem>
                  <SelectItem value="11">Kelas 11</SelectItem>
                  <SelectItem value="12">Kelas 12</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-600 font-bold text-xs uppercase tracking-wider">Kelompok / Jurusan <span className="text-rose-500">*</span></Label>
              <Select name="kelompok" defaultValue={isJurusanUsang ? undefined : kelasData.kelompok} required>
                <SelectTrigger className={`h-11 rounded-xl focus:border-blue-500 transition-colors ${isJurusanUsang ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-200 text-rose-700' : 'bg-slate-50 border-slate-200'}`}>
                  <SelectValue placeholder="Pilih Jurusan Baru" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {daftarJurusan.map(jur => (
                    <SelectItem key={jur} value={jur}>{jur}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-600 font-bold text-xs uppercase tracking-wider">Nomor Kelas <span className="text-rose-500">*</span></Label>
              <Input name="nomor_kelas" defaultValue={kelasData.nomor_kelas} placeholder="Contoh: 1, 2, A" required className="h-11 rounded-xl bg-slate-50 focus:bg-white focus:border-blue-500 transition-colors" />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-600 font-bold text-xs uppercase tracking-wider">Kapasitas Kursi <span className="text-rose-500">*</span></Label>
              <Input name="kapasitas" type="number" defaultValue={kelasData.kapasitas} required className="h-11 rounded-xl bg-slate-50 focus:bg-white focus:border-blue-500 transition-colors font-bold text-slate-800" />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-600 font-bold text-xs uppercase tracking-wider">Wali Kelas</Label>
            <Select name="wali_kelas_id" defaultValue={kelasData.wali_kelas_id || 'none'}>
              <SelectTrigger className="h-11 rounded-xl bg-slate-50 border-slate-200 focus:border-blue-500 transition-colors">
                <SelectValue placeholder="-- Kosong --" />
              </SelectTrigger>
              <SelectContent className="rounded-xl max-h-[250px]">
                <SelectItem value="none" className="text-slate-400 italic">-- Kosongkan --</SelectItem>
                {daftarGuru.map(g => (
                  <SelectItem key={g.id} value={g.id}>{g.nama_lengkap}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="pt-3">
            <SubmitButton />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}