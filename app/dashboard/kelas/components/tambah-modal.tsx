// TIMPA SELURUH ISI FILE INI
// Lokasi: app/dashboard/kelas/components/tambah-modal.tsx
'use client'

import { useState, useEffect } from 'react'
// PERBAIKAN: Mengganti useFormState menjadi useActionState dari 'react'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { PlusCircle, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { tambahKelas } from '../actions'

const initialState = { error: null as string | null, success: null as string | null }

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl shadow-md h-12 text-base font-bold transition-all">
      {pending ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Menyimpan...</> : 'Simpan Kelas Baru'}
    </Button>
  )
}

type GuruType = { id: string; nama_lengkap: string }

export function TambahModal({ 
  daftarGuru = [], 
  daftarJurusan = [] 
}: { 
  daftarGuru?: GuruType[], 
  daftarJurusan?: string[] 
}) {
  const [isOpen, setIsOpen] = useState(false)
  // PERBAIKAN: Menggunakan useActionState
  const [state, formAction] = useActionState(tambahKelas, initialState)

  useEffect(() => {
    if (state?.success) {
      const timer = setTimeout(() => setIsOpen(false), 1500)
      return () => clearTimeout(timer)
    }
  }, [state?.success])

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 h-12 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 text-white shadow-md hover:shadow-lg transition-all flex-1 sm:flex-none border-0 text-base font-bold">
          <PlusCircle className="h-5 w-5" /> Tambah Kelas
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md rounded-3xl bg-white/95 backdrop-blur-xl border-slate-200/60 shadow-xl">
        <DialogHeader className="border-b border-slate-100 pb-4">
          <DialogTitle className="text-xl font-bold text-slate-800">Buat Wadah Kelas Baru</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-5 pt-2">
          {state?.error && <div className="p-3 text-sm font-medium text-rose-600 bg-rose-50 rounded-xl border border-rose-100 flex items-start gap-2"><AlertCircle className="h-4 w-4 shrink-0 mt-0.5"/> {state.error}</div>}
          {state?.success && <div className="p-3 text-sm font-medium text-emerald-700 bg-emerald-50 rounded-xl border border-emerald-100 flex items-start gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5"/> {state.success}</div>}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tingkat" className="text-slate-600 font-bold text-xs uppercase tracking-wider">Tingkat <span className="text-rose-500">*</span></Label>
              <Select name="tingkat" required defaultValue="10">
                <SelectTrigger className="h-11 rounded-xl bg-slate-50 border-slate-200 focus:border-emerald-500 transition-colors">
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
              <Label htmlFor="kelompok" className="text-slate-600 font-bold text-xs uppercase tracking-wider">Kelompok / Jurusan <span className="text-rose-500">*</span></Label>
              <Select name="kelompok" required defaultValue="UMUM">
                <SelectTrigger className="h-11 rounded-xl bg-slate-50 border-slate-200 focus:border-emerald-500 transition-colors">
                  <SelectValue placeholder="Pilih Kelompok" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {/* GENERATE DARI MASTER JURUSAN DINAMIS */}
                  {daftarJurusan.map(jur => (
                    <SelectItem key={jur} value={jur}>{jur}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nomor_kelas" className="text-slate-600 font-bold text-xs uppercase tracking-wider">Nomor Kelas <span className="text-rose-500">*</span></Label>
              <Input id="nomor_kelas" name="nomor_kelas" placeholder="Contoh: 1, 2, A" required className="h-11 rounded-xl bg-slate-50 focus:bg-white focus:border-emerald-500 transition-colors" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="kapasitas" className="text-slate-600 font-bold text-xs uppercase tracking-wider">Kapasitas Maksimal <span className="text-rose-500">*</span></Label>
              <Input id="kapasitas" name="kapasitas" type="number" defaultValue="36" required className="h-11 rounded-xl bg-slate-50 focus:bg-white focus:border-emerald-500 transition-colors font-bold text-slate-800" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="wali_kelas_id" className="text-slate-600 font-bold text-xs uppercase tracking-wider">Wali Kelas (Opsional)</Label>
            <Select name="wali_kelas_id">
              <SelectTrigger className="h-11 rounded-xl bg-slate-50 border-slate-200 focus:border-emerald-500 transition-colors">
                <SelectValue placeholder="Bisa dipilih nanti..." />
              </SelectTrigger>
              <SelectContent className="rounded-xl max-h-[250px]">
                <SelectItem value="none" className="text-slate-400 italic">-- Jangan set wali kelas dulu --</SelectItem>
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