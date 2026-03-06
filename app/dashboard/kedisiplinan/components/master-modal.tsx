// BUAT FILE BARU
// Lokasi: app/dashboard/kedisiplinan/components/master-modal.tsx
'use client'

import { useState, useEffect } from 'react'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { simpanMasterPelanggaran } from '../actions'

const initialState = { error: null as string | null, success: null as string | null }

function SubmitBtn({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="w-full bg-slate-900 hover:bg-slate-800 h-12 text-white rounded-2xl shadow-md font-bold mt-2">
      {pending ? <><Loader2 className="mr-2 h-5 w-5 animate-spin"/> Memproses...</> : isEdit ? 'Update Kamus' : 'Tambahkan ke Kamus'}
    </Button>
  )
}

export function MasterModal({ isOpen, onClose, editData }: { isOpen: boolean, onClose: () => void, editData: any }) {
  const [state, formAction] = useActionState(simpanMasterPelanggaran, initialState)

  useEffect(() => {
    if (state?.success) {
      const timer = setTimeout(() => onClose(), 1500)
      return () => clearTimeout(timer)
    }
  }, [state?.success, onClose])

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md rounded-3xl bg-white border-slate-200">
        <DialogHeader className="border-b border-slate-100 pb-4">
          <DialogTitle className="text-xl font-bold text-slate-800">
            {editData ? 'Edit Kamus Pelanggaran' : 'Tambah Kamus Pelanggaran Baru'}
          </DialogTitle>
        </DialogHeader>

        <form action={formAction} className="space-y-4 pt-2">
          {state?.error && <div className="p-3 text-sm font-medium text-rose-600 bg-rose-50 rounded-xl border border-rose-100 flex gap-2"><AlertCircle className="h-4 w-4 shrink-0"/> {state.error}</div>}
          {state?.success && <div className="p-3 text-sm font-medium text-emerald-700 bg-emerald-50 rounded-xl border border-emerald-100 flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0"/> {state.success}</div>}

          {editData && <input type="hidden" name="id" value={editData.id} />}

          <div className="space-y-2">
            <Label className="font-bold text-slate-600 text-xs uppercase tracking-wider">Nama Pelanggaran <span className="text-rose-500">*</span></Label>
            <Input name="nama_pelanggaran" defaultValue={editData?.nama_pelanggaran} required placeholder="Contoh: Merokok di lingkungan madrasah" className="h-12 rounded-xl bg-slate-50" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-bold text-slate-600 text-xs uppercase tracking-wider">Kategori <span className="text-rose-500">*</span></Label>
              <Select name="kategori" defaultValue={editData?.kategori || 'Ringan'}>
                <SelectTrigger className="h-12 rounded-xl bg-slate-50"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="Ringan">Ringan</SelectItem>
                  <SelectItem value="Sedang">Sedang</SelectItem>
                  <SelectItem value="Berat">Berat</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="font-bold text-slate-600 text-xs uppercase tracking-wider">Bobot Poin <span className="text-rose-500">*</span></Label>
              <Input type="number" name="poin" min="1" max="100" defaultValue={editData?.poin || 5} required className="h-12 rounded-xl bg-slate-50 font-bold text-rose-600" />
            </div>
          </div>

          <SubmitBtn isEdit={!!editData} />
        </form>
      </DialogContent>
    </Dialog>
  )
}