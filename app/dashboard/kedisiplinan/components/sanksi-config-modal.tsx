'use client'

import { useState, useActionState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertTriangle, CheckCircle2, Pencil, PlusCircle, Trash2, X, Shield } from 'lucide-react'
import { simpanSanksiItem, hapusSanksiItem, type SanksiConfig } from '../actions'
import { useFormStatus } from 'react-dom'
import { cn } from '@/lib/utils'

function getSanksiStyle(urutan: number) {
  if (urutan === 1) return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800'
  if (urutan === 2) return 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800'
  if (urutan === 3) return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800'
  return 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800'
}

function SubmitBtn({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} size="sm" className="bg-slate-800 hover:bg-slate-700 text-white text-xs">
      {pending ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Tambah Sanksi'}
    </Button>
  )
}

export function SanksiConfigModal({ isOpen, onClose, sanksiList }: {
  isOpen: boolean
  onClose: () => void
  sanksiList: SanksiConfig[]
}) {
  const [editData, setEditData] = useState<SanksiConfig | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [localList, setLocalList] = useState(sanksiList)
  const [formState, formAction] = useActionState(simpanSanksiItem, null)

  const handleHapus = async (id: string, nama: string) => {
    if (!confirm(`Yakin hapus sanksi "${nama}"? Tindakan ini tidak bisa dibatalkan.`)) return
    setIsPending(true)
    const res = await hapusSanksiItem(id)
    if (res.error) alert(res.error)
    else setLocalList(prev => prev.filter(s => s.id !== id))
    setIsPending(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-lg rounded-xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              <Shield className="h-4 w-4 text-rose-500" />
              Kelola Tingkat Sanksi
            </DialogTitle>
            <button onClick={onClose} className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800">
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            Siswa otomatis mendapat sanksi saat poin akumulasi (seumur sekolah) mencapai ambang yang ditentukan.
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Daftar sanksi */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Tingkat Sanksi Aktif ({localList.length})
            </h4>
            {localList.length === 0 ? (
              <div className="text-center py-6 text-slate-400 dark:text-slate-500 text-sm border-2 border-dashed rounded-xl">
                Belum ada sanksi. Tambahkan di bawah.
              </div>
            ) : (
              localList.map(s => (
                <div key={s.id}
                  className={cn('border rounded-xl px-4 py-3 flex items-center gap-3', getSanksiStyle(s.urutan))}
                >
                  <div className="shrink-0 w-8 h-8 rounded-lg bg-white/60 flex items-center justify-center font-black text-sm border border-current/20">
                    {s.urutan}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm">{s.nama}</p>
                    <p className="text-[11px] opacity-75 truncate">{s.deskripsi || '—'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] opacity-60 font-medium uppercase">Mulai</p>
                    <p className="text-base font-black">{s.poin_minimal} poin</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => setEditData(s)}
                      className="p-1.5 rounded-lg bg-white/50 hover:bg-white/80 transition-colors">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleHapus(s.id, s.nama)} disabled={isPending}
                      className="p-1.5 rounded-lg bg-white/50 hover:bg-white/80 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Form tambah/edit */}
          <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-slate-50 dark:bg-slate-800/50">
            <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <PlusCircle className="h-3.5 w-3.5" />
              {editData ? `Edit: ${editData.nama}` : 'Tambah Sanksi Baru'}
            </h4>

            {formState?.success && (
              <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-2 mb-3">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />{formState.success}
              </div>
            )}
            {formState?.error && (
              <div className="flex items-center gap-2 text-xs text-rose-700 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 rounded-lg px-3 py-2 mb-3">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />{formState.error}
              </div>
            )}

            <form action={async (fd) => {
              await formAction(fd)
              setEditData(null)
            }} className="space-y-3">
              {editData && <input type="hidden" name="id" value={editData.id} />}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Nama Sanksi <span className="text-rose-500">*</span>
                  </Label>
                  <Input name="nama" placeholder="mis. SP1, Skorsing" required
                    defaultValue={editData?.nama || ''}
                    key={editData?.id || 'new-nama'}
                    className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Poin Minimal <span className="text-rose-500">*</span>
                  </Label>
                  <Input name="poin_minimal" type="number" min="1" placeholder="mis. 100" required
                    defaultValue={editData?.poin_minimal || ''}
                    key={editData?.id || 'new-poin'}
                    className="h-8 text-sm" />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Deskripsi <span className="text-slate-400 dark:text-slate-500 font-normal">(opsional)</span>
                </Label>
                <Input name="deskripsi" placeholder="mis. Surat Peringatan Pertama"
                  defaultValue={editData?.deskripsi || ''}
                  key={editData?.id || 'new-desc'}
                  className="h-8 text-sm" />
              </div>

              <div className="flex items-center justify-between">
                {editData ? (
                  <button type="button" onClick={() => setEditData(null)}
                    className="text-xs text-slate-400 hover:text-slate-600 underline">
                    Batal edit
                  </button>
                ) : <span />}
                <SubmitBtn isEdit={!!editData} />
              </div>
            </form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
