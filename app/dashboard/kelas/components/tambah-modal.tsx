'use client'

import { useState, useEffect } from 'react'
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
    <Button type="submit" disabled={pending} className="w-full h-9 text-sm bg-slate-900 hover:bg-slate-800 text-white rounded-md">
      {pending ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Menyimpan...</> : 'Simpan Kelas Baru'}
    </Button>
  )
}

type GuruType = { id: string; nama_lengkap: string }

export function TambahModal({ daftarGuru = [], daftarJurusan = [] }: { daftarGuru?: GuruType[]; daftarJurusan?: string[] }) {
  const [isOpen, setIsOpen] = useState(false)
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
        <Button size="sm" className="h-8 text-xs gap-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md px-3">
          <PlusCircle className="h-3.5 w-3.5" /> Tambah Kelas
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md rounded-xl">
        <DialogHeader className="border-b pb-3">
          <DialogTitle className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <PlusCircle className="h-4 w-4 text-slate-600 dark:text-slate-300 dark:text-slate-600" /> Buat Wadah Kelas Baru
          </DialogTitle>
        </DialogHeader>

        <form action={formAction} className="space-y-3 pt-1">
          {state?.error && (
            <div className="p-2.5 text-xs text-rose-600 bg-rose-50 rounded-lg border border-rose-100 flex items-start gap-2">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {state.error}
            </div>
          )}
          {state?.success && (
            <div className="p-2.5 text-xs text-emerald-700 bg-emerald-50 rounded-lg border border-emerald-100 flex items-start gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {state.success}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300 dark:text-slate-600">Tingkat <span className="text-rose-500">*</span></Label>
              <Select name="tingkat" required defaultValue="10">
                <SelectTrigger className="h-8 text-xs rounded-md bg-slate-50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="10" className="text-xs">Kelas 10</SelectItem>
                  <SelectItem value="11" className="text-xs">Kelas 11</SelectItem>
                  <SelectItem value="12" className="text-xs">Kelas 12</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300 dark:text-slate-600">Kelompok / Jurusan <span className="text-rose-500">*</span></Label>
              <Select name="kelompok" required defaultValue="UMUM">
                <SelectTrigger className="h-8 text-xs rounded-md bg-slate-50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {daftarJurusan.map(jur => (
                    <SelectItem key={jur} value={jur} className="text-xs">{jur}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300 dark:text-slate-600">Nomor Kelas <span className="text-rose-500">*</span></Label>
              <Input name="nomor_kelas" placeholder="Contoh: 1, 2, A" required className="h-8 text-sm rounded-md bg-slate-50" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300 dark:text-slate-600">Kapasitas <span className="text-rose-500">*</span></Label>
              <Input name="kapasitas" type="number" defaultValue="36" required className="h-8 text-sm rounded-md bg-slate-50 font-bold" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300 dark:text-slate-600">Wali Kelas <span className="text-slate-400 dark:text-slate-500 font-normal">(opsional)</span></Label>
            <Select name="wali_kelas_id">
              <SelectTrigger className="h-8 text-xs rounded-md bg-slate-50"><SelectValue placeholder="Bisa dipilih nanti..." /></SelectTrigger>
              <SelectContent className="max-h-56">
                <SelectItem value="none" className="text-xs text-slate-400 dark:text-slate-500 italic">-- Kosongkan --</SelectItem>
                {daftarGuru.map(g => (
                  <SelectItem key={g.id} value={g.id} className="text-xs">{g.nama_lengkap}</SelectItem>
                ))}
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