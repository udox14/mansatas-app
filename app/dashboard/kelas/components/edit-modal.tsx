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
    <Button type="submit" disabled={pending} className="w-full h-9 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md">
      {pending ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Menyimpan...</> : 'Simpan Perubahan'}
    </Button>
  )
}

export function EditModal({ isOpen, onClose, kelasData, daftarGuru = [], daftarJurusan = [] }: {
  isOpen: boolean; onClose: () => void; kelasData: any; daftarGuru?: any[]; daftarJurusan?: string[]
}) {
  const [state, formAction] = useActionState(editKelasForm, initialState)

  useEffect(() => {
    if (state?.success) {
      const timer = setTimeout(() => onClose(), 1500)
      return () => clearTimeout(timer)
    }
  }, [state?.success, onClose])

  if (!kelasData) return null

  const isJurusanUsang = kelasData.kelompok !== 'UMUM' && !daftarJurusan.includes(kelasData.kelompok)

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-md rounded-xl">
        <DialogHeader className="border-b pb-3">
          <DialogTitle className="text-sm font-semibold flex items-center gap-2 text-slate-800 dark:text-slate-100">
            <Pencil className="h-4 w-4 text-blue-600" /> Edit Rombongan Belajar
          </DialogTitle>
        </DialogHeader>

        <form action={formAction} className="space-y-3 pt-1">
          <input type="hidden" name="id" value={kelasData.id} />

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

          {isJurusanUsang && !state?.success && (
            <div className="p-2.5 text-xs text-amber-700 bg-amber-50 rounded-lg border border-amber-200 flex items-start gap-2">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              Jurusan <strong>"{kelasData.kelompok}"</strong> sudah tidak ada di Pengaturan. Pilih jurusan baru di bawah.
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300 dark:text-slate-600">Tingkat <span className="text-rose-500">*</span></Label>
              <Select name="tingkat" defaultValue={kelasData.tingkat.toString()} required>
                <SelectTrigger className="h-8 text-xs rounded-md bg-slate-50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7" className="text-xs">Kelas 7</SelectItem>
                  <SelectItem value="8" className="text-xs">Kelas 8</SelectItem>
                  <SelectItem value="9" className="text-xs">Kelas 9</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300 dark:text-slate-600">Kelompok / Jurusan <span className="text-rose-500">*</span></Label>
              <Select name="kelompok" defaultValue={isJurusanUsang ? undefined : kelasData.kelompok} required>
                <SelectTrigger className={`h-8 text-xs rounded-md ${isJurusanUsang ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-slate-50'}`}>
                  <SelectValue placeholder="Pilih jurusan" />
                </SelectTrigger>
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
              <Input name="nomor_kelas" defaultValue={kelasData.nomor_kelas} required className="h-8 text-sm rounded-md bg-slate-50" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300 dark:text-slate-600">Kapasitas <span className="text-rose-500">*</span></Label>
              <Input name="kapasitas" type="number" defaultValue={kelasData.kapasitas} required className="h-8 text-sm rounded-md bg-slate-50 font-bold" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300 dark:text-slate-600">Wali Kelas</Label>
            <Select name="wali_kelas_id" defaultValue={kelasData.wali_kelas_id || 'none'}>
              <SelectTrigger className="h-8 text-xs rounded-md bg-slate-50"><SelectValue placeholder="-- Kosong --" /></SelectTrigger>
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