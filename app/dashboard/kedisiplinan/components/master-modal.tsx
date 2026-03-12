'use client'

import { useEffect } from 'react'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, AlertCircle, CheckCircle2, BookOpen } from 'lucide-react'
import { simpanMasterPelanggaran } from '../actions'

const initialState = { error: null as string | null, success: null as string | null }

function SubmitBtn({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="w-full h-9 text-sm bg-slate-900 hover:bg-slate-800 text-white rounded-md mt-1">
      {pending ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Memproses...</> : isEdit ? 'Update Kamus' : 'Tambah ke Kamus'}
    </Button>
  )
}

export function MasterModal({ isOpen, onClose, editData }: {
  isOpen: boolean; onClose: () => void; editData: any
}) {
  const [state, formAction] = useActionState(simpanMasterPelanggaran, initialState)

  useEffect(() => {
    if (state?.success) {
      const timer = setTimeout(() => onClose(), 1500)
      return () => clearTimeout(timer)
    }
  }, [state?.success, onClose])

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-md rounded-xl">
        <DialogHeader className="border-b pb-3">
          <DialogTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-slate-600" />
            {editData ? 'Edit Kamus Pelanggaran' : 'Tambah Kamus Baru'}
          </DialogTitle>
        </DialogHeader>

        <form action={formAction} className="space-y-3 pt-1">
          {state?.error && (
            <div className="p-2.5 text-xs text-rose-600 bg-rose-50 rounded-lg border border-rose-100 flex gap-2">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {state.error}
            </div>
          )}
          {state?.success && (
            <div className="p-2.5 text-xs text-emerald-700 bg-emerald-50 rounded-lg border border-emerald-100 flex gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {state.success}
            </div>
          )}

          {editData && <input type="hidden" name="id" value={editData.id} />}

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-600">Nama Pelanggaran <span className="text-rose-500">*</span></Label>
            <Input
              name="nama_pelanggaran"
              defaultValue={editData?.nama_pelanggaran}
              required
              placeholder="Contoh: Merokok di lingkungan madrasah"
              className="h-8 text-sm rounded-md bg-slate-50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600">Kategori <span className="text-rose-500">*</span></Label>
              <Select name="kategori" defaultValue={editData?.kategori || 'Ringan'}>
                <SelectTrigger className="h-8 text-xs rounded-md bg-slate-50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ringan" className="text-xs">
                    <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-amber-400 inline-block" />Ringan</span>
                  </SelectItem>
                  <SelectItem value="Sedang" className="text-xs">
                    <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-orange-500 inline-block" />Sedang</span>
                  </SelectItem>
                  <SelectItem value="Berat" className="text-xs">
                    <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-rose-600 inline-block" />Berat</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600">Bobot Poin <span className="text-rose-500">*</span></Label>
              <Input
                type="number" name="poin" min="1" max="100"
                defaultValue={editData?.poin || 5}
                required
                className="h-8 text-sm rounded-md bg-slate-50 font-bold text-rose-600"
              />
            </div>
          </div>

          <SubmitBtn isEdit={!!editData} />
        </form>
      </DialogContent>
    </Dialog>
  )
}