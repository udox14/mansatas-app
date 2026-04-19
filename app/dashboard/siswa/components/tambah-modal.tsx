'use client'

import { useState, useEffect } from 'react'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
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
    <Button type="submit" disabled={pending} className="w-full h-9 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-md">
      {pending ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Menyimpan...</> : 'Simpan Siswa'}
    </Button>
  )
}

export function TambahModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [state, formAction] = useActionState(tambahSiswa, initialState)

  useEffect(() => {
    if (state?.success) {
      const timer = setTimeout(() => setIsOpen(false), 1500)
      return () => clearTimeout(timer)
    }
  }, [state?.success])

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md px-2.5">
          <UserPlus className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden sm:inline">Tambah Manual</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md rounded-xl">
        <DialogHeader className="border-b pb-3">
          <DialogTitle className="text-sm font-semibold text-slate-800 dark:text-slate-200 dark:text-slate-100 flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-emerald-600" /> Tambah Data Siswa Baru
          </DialogTitle>
        </DialogHeader>

        <form action={formAction} className="space-y-3 pt-1">
          {state?.error && (
            <div className="p-2.5 text-xs text-rose-600 bg-rose-50 rounded-lg border border-rose-100 flex items-start gap-2">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {state.error}
            </div>
          )}
          {state?.success && (
            <div className="p-2.5 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 rounded-lg border border-emerald-100 flex items-start gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {state.success}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="nisn" className="text-xs font-semibold text-slate-600 dark:text-slate-400 dark:text-slate-300 dark:text-slate-600">NISN <span className="text-rose-500">*</span></Label>
            <Input id="nisn" name="nisn" required placeholder="Contoh: 0051234567" className="h-8 text-sm rounded-md bg-slate-50 dark:bg-slate-800" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nama_lengkap" className="text-xs font-semibold text-slate-600 dark:text-slate-400 dark:text-slate-300 dark:text-slate-600">Nama Lengkap <span className="text-rose-500">*</span></Label>
            <Input id="nama_lengkap" name="nama_lengkap" required placeholder="Sesuai ijazah sebelumnya" className="h-8 text-sm rounded-md bg-slate-50 dark:bg-slate-800" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nis_lokal" className="text-xs font-semibold text-slate-600 dark:text-slate-400 dark:text-slate-300 dark:text-slate-600">NIS Lokal <span className="text-slate-400 dark:text-slate-500 font-normal">(opsional)</span></Label>
            <Input id="nis_lokal" name="nis_lokal" placeholder="Nomor Induk Siswa internal" className="h-8 text-sm rounded-md bg-slate-50 dark:bg-slate-800" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tahun_masuk" className="text-xs font-semibold text-slate-600 dark:text-slate-400 dark:text-slate-300">Tahun Masuk (Angkatan) <span className="text-rose-500">*</span></Label>
              <Input id="tahun_masuk" name="tahun_masuk" type="number" min={2000} max={2099} required placeholder={String(new Date().getFullYear())} className="h-8 text-sm rounded-md bg-slate-50 dark:bg-slate-800" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 dark:text-slate-300 dark:text-slate-600">Jenis Kelamin</Label>
              <Select name="jenis_kelamin" defaultValue="L">
                <SelectTrigger className="h-8 text-xs rounded-md bg-slate-50 dark:bg-slate-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="L" className="text-xs">Laki-laki (L)</SelectItem>
                  <SelectItem value="P" className="text-xs">Perempuan (P)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 dark:text-slate-300 dark:text-slate-600">Domisili</Label>
            <Select name="tempat_tinggal" defaultValue="Non-Pesantren">
                <SelectTrigger className="h-8 text-xs rounded-md bg-slate-50 dark:bg-slate-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Non-Pesantren" className="text-xs">Non-Pesantren</SelectItem>
                  <SelectItem value="Pesantren Sukahideng" className="text-xs">Pesantren Sukahideng</SelectItem>
                  <SelectItem value="Pesantren Sukamanah" className="text-xs">Pesantren Sukamanah</SelectItem>
                  <SelectItem value="Pesantren Sukaguru" className="text-xs">Pesantren Sukaguru</SelectItem>
                  <SelectItem value="Pesantren Al-Ma'mur" className="text-xs">Pesantren Al-Ma'mur</SelectItem>
                </SelectContent>
            </Select>
          </div>

          <div className="pt-1">
            <SubmitButton />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}