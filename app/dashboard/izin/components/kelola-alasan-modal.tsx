// Lokasi: app/dashboard/izin/components/kelola-alasan-modal.tsx
'use client'

import { useState, useTransition } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Trash2, Plus, Loader2, Settings2 } from 'lucide-react'
import { tambahAlasanIzin, hapusAlasanIzin, type AlasanIzinRow } from '../actions'

interface Props {
  alasanList: AlasanIzinRow[]
  onAlasanChange: (list: AlasanIzinRow[]) => void
}

export function KelolaAlasanModal({ alasanList, onAlasanChange }: Props) {
  const [open, setOpen] = useState(false)
  const [inputAlasan, setInputAlasan] = useState('')
  const [pesan, setPesan] = useState<{ tipe: 'sukses' | 'error'; teks: string } | null>(null)
  const [isPending, startTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleTambah = () => {
    if (!inputAlasan.trim()) return
    startTransition(async () => {
      setPesan(null)
      const res = await tambahAlasanIzin(inputAlasan.trim())
      if (res.error) {
        setPesan({ tipe: 'error', teks: res.error })
      } else {
        // Optimistic update
        const newItem: AlasanIzinRow = {
          id: crypto.randomUUID(),
          alasan: inputAlasan.trim().toUpperCase(),
          urutan: alasanList.length + 1,
        }
        onAlasanChange([...alasanList, newItem])
        setInputAlasan('')
        setPesan({ tipe: 'sukses', teks: res.success || 'Berhasil ditambahkan' })
      }
    })
  }

  const handleHapus = (id: string) => {
    if (!confirm('Hapus alasan ini?')) return
    setDeletingId(id)
    startTransition(async () => {
      setPesan(null)
      const res = await hapusAlasanIzin(id)
      setDeletingId(null)
      if (res.error) {
        setPesan({ tipe: 'error', teks: res.error })
      } else {
        onAlasanChange(alasanList.filter(a => a.id !== id))
        setPesan({ tipe: 'sukses', teks: res.success || 'Dihapus' })
      }
    })
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => { setOpen(true); setPesan(null) }}
        className="h-8 px-3 text-xs border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
      >
        <Settings2 className="h-3.5 w-3.5 mr-1.5" />
        Kelola Alasan
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader className="border-b pb-3">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-indigo-600" />
              Kelola Alasan Izin
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            {/* Pesan */}
            {pesan && (
              <div className={`rounded-lg border px-3 py-2 text-xs ${pesan.tipe === 'sukses' ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                {pesan.teks}
              </div>
            )}

            {/* Daftar alasan yang ada */}
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {alasanList.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-4">Belum ada alasan. Tambahkan di bawah.</p>
              )}
              {alasanList.map(a => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50"
                >
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300 flex-1 min-w-0 truncate">
                    {a.alasan}
                  </span>
                  <button
                    onClick={() => handleHapus(a.id)}
                    disabled={deletingId === a.id || isPending}
                    className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-40 shrink-0"
                  >
                    {deletingId === a.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              ))}
            </div>

            {/* Form tambah alasan baru */}
            <div className="border-t pt-3 space-y-2">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Tambah Alasan Baru</p>
              <div className="flex gap-2">
                <Input
                  value={inputAlasan}
                  onChange={e => setInputAlasan(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleTambah()}
                  placeholder="Contoh: IZIN ORANG TUA..."
                  className="h-9 text-sm flex-1"
                  disabled={isPending}
                />
                <Button
                  onClick={handleTambah}
                  disabled={!inputAlasan.trim() || isPending}
                  size="sm"
                  className="h-9 px-3 bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
                >
                  {isPending && !deletingId
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Plus className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <p className="text-[10px] text-slate-400">Teks akan otomatis diubah ke HURUF KAPITAL.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
