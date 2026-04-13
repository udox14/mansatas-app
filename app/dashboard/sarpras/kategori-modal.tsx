'use client'

import { useState, useTransition } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SarprasKategori, saveKategori, deleteKategori } from './actions'
import { Trash2, Edit2, Plus, Loader2 } from 'lucide-react'

export function KategoriModal({ isOpen, onClose, kategori }: { isOpen: boolean, onClose: () => void, kategori: SarprasKategori[] }) {
  const [isPending, startTransition] = useTransition()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [nama, setNama] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nama.trim()) return
    setError(null)
    
    startTransition(async () => {
      const res = await saveKategori(editingId, nama)
      if (res.error) {
        setError(res.error)
      } else {
        setNama('')
        setEditingId(null)
      }
    })
  }

  const handleEdit = (k: SarprasKategori) => {
    setEditingId(k.id)
    setNama(k.nama)
    setError(null)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus kategori ini? Pastikan tidak ada aset yang menggunakan kategori ini.')) return
    startTransition(async () => {
      const res = await deleteKategori(id)
      if (res.error) {
        alert(res.error)
      }
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        setEditingId(null)
        setNama('')
        setError(null)
      }
      if (!open) onClose()
    }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Kelola Kategori Aset</DialogTitle>
        </DialogHeader>
        
        <div className="py-2 space-y-4">
          <form onSubmit={handleSave} className="flex gap-2">
            <input
              type="text"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="Nama kategori baru..."
              className="flex-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isPending}
            />
            <button 
              type="submit" 
              disabled={isPending || !nama.trim()}
              className="bg-blue-600 text-white p-2 rounded-md hover:bg-blue-700 disabled:opacity-50 flex-shrink-0"
            >
              {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : (editingId ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />)}
            </button>
            {editingId && (
              <button 
                type="button" 
                onClick={() => { setEditingId(null); setNama(''); setError(null) }}
                className="bg-slate-200 text-slate-700 p-2 rounded-md hover:bg-slate-300 flex-shrink-0 text-sm"
              >
                Batal
              </button>
            )}
          </form>
          {error && <p className="text-red-500 text-xs">{error}</p>}

          <div className="border rounded-md overflow-hidden bg-slate-50">
            <div className="max-h-[300px] overflow-y-auto">
              {kategori.length === 0 ? (
                <div className="p-4 text-center text-sm text-slate-500">Belum ada kategori</div>
              ) : (
                <ul className="divide-y divide-slate-200">
                  {kategori.map((k) => (
                    <li key={k.id} className={`flex items-center justify-between p-3 text-sm ${editingId === k.id ? 'bg-blue-50' : 'hover:bg-slate-100'}`}>
                      <span>{k.nama}</span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleEdit(k)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(k.id)} className="p-1.5 text-red-600 hover:bg-red-100 rounded">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
