'use client'

import { useState, useEffect } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { UserPlus, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { tambahSiswa } from '../actions'

const initialState = { error: null as string | null, success: null as string | null }

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl shadow-md h-11">
      {pending ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Menyimpan...</> : 'Simpan Siswa'}
    </Button>
  )
}

export function TambahModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [state, formAction] = useFormState(tambahSiswa, initialState)

  useEffect(() => {
    if (state?.success) {
      const timer = setTimeout(() => setIsOpen(false), 1500)
      return () => clearTimeout(timer)
    }
  }, [state?.success])

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 h-11 px-5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md hover:shadow-lg transition-all flex-1 sm:flex-none border-0">
          <UserPlus className="h-4 w-4" />
          Tambah Manual
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-800">Tambah Data Siswa Baru</DialogTitle>
        </DialogHeader>

        <form action={formAction} className="space-y-5 py-2">
          {state?.error && (
            <div className="p-3 text-sm font-medium text-rose-600 bg-rose-50 rounded-xl border border-rose-100 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5"/> {state.error}
            </div>
          )}
          {state?.success && (
            <div className="p-3 text-sm font-medium text-emerald-600 bg-emerald-50 rounded-xl border border-emerald-100 flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5"/> {state.success}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="nisn" className="text-slate-600 font-medium">NISN <span className="text-rose-500">*</span></Label>
            <Input id="nisn" name="nisn" required placeholder="Contoh: 0051234567" className="rounded-xl bg-slate-50 focus:bg-white focus:border-emerald-500 transition-colors" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nama_lengkap" className="text-slate-600 font-medium">Nama Lengkap <span className="text-rose-500">*</span></Label>
            <Input id="nama_lengkap" name="nama_lengkap" required placeholder="Sesuai ijazah sebelumnya" className="rounded-xl bg-slate-50 focus:bg-white focus:border-emerald-500 transition-colors" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nis_lokal" className="text-slate-600 font-medium">NIS Lokal (Opsional)</Label>
            <Input id="nis_lokal" name="nis_lokal" placeholder="Nomor Induk Siswa internal" className="rounded-xl bg-slate-50 focus:bg-white focus:border-emerald-500 transition-colors" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="jenis_kelamin" className="text-slate-600 font-medium">Jenis Kelamin</Label>
              <Select name="jenis_kelamin" defaultValue="L">
                <SelectTrigger className="rounded-xl bg-slate-50 focus:ring-emerald-500">
                  <SelectValue placeholder="Pilih JK" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="L">Laki-laki (L)</SelectItem>
                  <SelectItem value="P">Perempuan (P)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tempat_tinggal" className="text-slate-600 font-medium">Domisili</Label>
              <Select name="tempat_tinggal" defaultValue="Non-Pesantren">
                <SelectTrigger className="rounded-xl bg-slate-50 focus:ring-emerald-500">
                  <SelectValue placeholder="Pilih Domisili" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="Non-Pesantren">Non-Pesantren</SelectItem>
                  <SelectItem value="Pesantren Sukahideng">Pesantren Sukahideng</SelectItem>
                  <SelectItem value="Pesantren Sukamanah">Pesantren Sukamanah</SelectItem>
                  <SelectItem value="Pesantren Sukaguru">Pesantren Sukaguru</SelectItem>
                  <SelectItem value="Pesantren Al-Ma'mur">Pesantren Al-Ma'mur</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="pt-2">
            <SubmitButton />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}