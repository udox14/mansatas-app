'use client'

import { useActionState, useEffect } from 'react'
import { useFormStatus } from 'react-dom'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, AlertCircle, CheckCircle2, Trophy } from 'lucide-react'
import { tambahEkskul, editEkskul } from '../actions'
import type { EkskulMaster } from '../actions'

const initialState = { error: null as string | null, success: null as string | null }

function SubmitBtn({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="w-full h-9 text-sm mt-1">
      {pending ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Memproses...</> : isEdit ? 'Simpan Perubahan' : 'Tambah Ekstrakurikuler'}
    </Button>
  )
}

export function EkskulModal({ isOpen, onClose, editData }: {
  isOpen: boolean
  onClose: (refreshed?: boolean) => void
  editData: EkskulMaster | null
}) {
  const [state, formAction] = useActionState(editData ? editEkskul : tambahEkskul, initialState)

  useEffect(() => {
    if (state?.success) {
      const t = setTimeout(() => onClose(true), 1200)
      return () => clearTimeout(t)
    }
  }, [state?.success, onClose])

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-md rounded-xl">
        <DialogHeader className="border-b pb-3">
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <Trophy className="h-4 w-4 text-slate-600 dark:text-slate-400" />
            {editData ? 'Edit Ekstrakurikuler' : 'Tambah Ekstrakurikuler'}
          </DialogTitle>
        </DialogHeader>

        <form action={formAction} className="space-y-3 pt-1">
          {state?.error && (
            <div className="p-2.5 text-xs text-rose-600 bg-rose-50 rounded-lg border border-rose-100 flex gap-2">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {state.error}
            </div>
          )}
          {state?.success && (
            <div className="p-2.5 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 rounded-lg border border-emerald-100 flex gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {state.success}
            </div>
          )}

          {editData && <input type="hidden" name="id" value={editData.id} />}

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Nama Ekstrakurikuler <span className="text-rose-500">*</span></Label>
            <Input
              name="nama"
              defaultValue={editData?.nama}
              required
              placeholder="Contoh: Pramuka, Futsal, PMR"
              className="h-8 text-sm rounded-md bg-slate-50 dark:bg-slate-800"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Deskripsi</Label>
            <Textarea
              name="deskripsi"
              defaultValue={editData?.deskripsi ?? ''}
              rows={2}
              placeholder="Keterangan singkat (opsional)"
              className="text-sm rounded-md bg-slate-50 dark:bg-slate-800 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Mode Nilai <span className="text-rose-500">*</span></Label>
              <Select name="mode_nilai" defaultValue={editData?.mode_nilai || 'angka'}>
                <SelectTrigger className="h-8 text-xs rounded-md bg-slate-50 dark:bg-slate-800"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="angka" className="text-xs">Angka (0-100)</SelectItem>
                  <SelectItem value="huruf" className="text-xs">Huruf (A/B/C/D)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editData && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Status</Label>
                <Select name="status" defaultValue={editData?.status || 'aktif'}>
                  <SelectTrigger className="h-8 text-xs rounded-md bg-slate-50 dark:bg-slate-800"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aktif" className="text-xs">Aktif</SelectItem>
                    <SelectItem value="nonaktif" className="text-xs">Nonaktif</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <SubmitBtn isEdit={!!editData} />
        </form>
      </DialogContent>
    </Dialog>
  )
}
